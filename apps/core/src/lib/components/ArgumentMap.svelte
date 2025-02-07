<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import * as d3 from 'd3';
  import { writable, derived, get } from 'svelte/store';
  import type { FactCheckerResult } from './FactChecker.svelte';
  import { supabase } from '$lib/supabaseClient';
  import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
  import { scaleOrdinal } from 'd3-scale';
  import { hierarchy, pack } from 'd3-hierarchy';

  // Props
  export let debateId: string;
  export let factCheckerResults: FactCheckerResult[] = [];
  
  // Types
  interface ArgumentNode extends d3.SimulationNodeDatum {
    id: string;
    content: string;
    type: 'claim' | 'evidence' | 'counterpoint' | 'rebuttal';
    strength: number;
    factCheckerScore: number;
    expertConsensus: number;
    parentId?: string;
    children: string[];
    x?: number;
    y?: number;
    vx?: number;
    vy?: number;
    fx?: number | null;
    fy?: number | null;
    lastUpdated?: string;
    updatedBy?: string;
    activeUsers?: string[];
    [key: string]: any;
  }

  interface ArgumentLink extends d3.SimulationLinkDatum<ArgumentNode> {
    source: ArgumentNode;
    target: ArgumentNode;
    type: LinkType;
    strength: number;
    animated?: boolean;
  }

  type LinkType = 'supports' | 'opposes' | 'qualifies';

  interface ArgumentData {
    nodes: Partial<ArgumentNode>[];
    links: {
      source: string;
      target: string;
      type: LinkType;
      strength: number;
    }[];
  }

  interface PresenceState {
    [key: string]: [{
      user_id: string;
      user_name: string;
      color: string;
      last_active: string;
    }];
  }

  // Stores
  const argumentNodes = writable<ArgumentNode[]>([]);
  const argumentLinks = writable<ArgumentLink[]>([]);
  const selectedNode = writable<string | null>(null);
  const activeUsers = writable<Map<string, { id: string; name: string; color: string; lastActive: Date }>>(new Map());
  
  // Additional stores for filtering and clustering
  const filterCriteria = writable({
    type: [] as string[],
    minStrength: 0,
    minFactCheckerScore: 0,
    minExpertConsensus: 0,
    dateRange: { start: null, end: null } as { start: Date | null; end: Date | null },
    searchTerm: ''
  });

  const clusterBy = writable<'type' | 'strength' | 'consensus' | 'none'>('none');
  const showClusters = writable(false);

  // Add chat and annotation stores
  const chatMessages = writable<{
    id: string;
    userId: string;
    userName: string;
    message: string;
    timestamp: Date;
    replyTo?: string;
  }[]>([]);

  const annotations = writable<{
    id: string;
    nodeId: string;
    userId: string;
    userName: string;
    content: string;
    timestamp: Date;
    position: { x: number; y: number };
  }[]>([]);

  // Derived store for filtered nodes
  const filteredNodes = derived(
    [argumentNodes, filterCriteria],
    ([$argumentNodes, $filterCriteria]) => {
      return $argumentNodes.filter(node => {
        const matchesType = $filterCriteria.type.length === 0 || 
          $filterCriteria.type.includes(node.type);
        const matchesStrength = node.strength >= $filterCriteria.minStrength;
        const matchesFactChecker = node.factCheckerScore >= $filterCriteria.minFactCheckerScore;
        const matchesConsensus = node.expertConsensus >= $filterCriteria.minExpertConsensus;
        const matchesSearch = !$filterCriteria.searchTerm || 
          node.content.toLowerCase().includes($filterCriteria.searchTerm.toLowerCase());
        const matchesDate = !$filterCriteria.dateRange.start || !$filterCriteria.dateRange.end || 
          (node.lastUpdated && 
            new Date(node.lastUpdated) >= $filterCriteria.dateRange.start &&
            new Date(node.lastUpdated) <= $filterCriteria.dateRange.end);
        
        return matchesType && matchesStrength && matchesFactChecker && 
               matchesConsensus && matchesSearch && matchesDate;
      });
    }
  );

  // Constants
  const COLORS = {
    claim: 'var(--color-deep-gold)',
    evidence: 'var(--color-soft-purple)',
    counterpoint: 'var(--color-dark-maroon)',
    rebuttal: 'var(--color-neon-cyan)',
    link: {
      supports: 'rgba(29, 185, 84, 0.6)',
      opposes: 'rgba(255, 0, 60, 0.6)',
      qualifies: 'rgba(255, 215, 0, 0.6)'
    } as Record<LinkType, string>,
    userColors: [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
      '#FFEEAD', '#D4A5A5', '#9B59B6', '#3498DB'
    ]
  };

  // SVG dimensions and state
  let width = 0;
  let height = 0;
  let svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  let simulation: d3.Simulation<ArgumentNode, ArgumentLink>;
  let minimap: d3.Selection<SVGGElement, unknown, null, undefined>;
  let minimapScale = 0.15;
  let realtimeSubscription: any;
  let userPresenceSubscription: any;
  let currentUserColor: string;
  let isEditingNode = false;
  let showChat = false;
  let replyingTo: string | null = null;
  let newMessage = '';

  onMount(async () => {
    // Initialize SVG and force simulation
    const container = document.querySelector('#argument-map') as SVGSVGElement;
    svg = d3.select<SVGSVGElement, unknown>(container)
      .attr('width', width)
      .attr('height', height);

    // Create gradient definitions for node highlights
    const defs = svg.append('defs');
    createGlowEffect(defs, 'node-glow', COLORS.claim, 0.3);
    createGlowEffect(defs, 'selected-glow', COLORS.claim, 0.6);
    createLinkMarkers(defs);

    // Initialize force simulation
    simulation = d3.forceSimulation<ArgumentNode>()
      .force('link', d3.forceLink<ArgumentNode, ArgumentLink>().id(d => d.id))
      .force('charge', d3.forceManyBody<ArgumentNode>().strength(-200))
      .force('center', d3.forceCenter<ArgumentNode>(width / 2, height / 2))
      .force('collision', d3.forceCollide<ArgumentNode>().radius(60))
      .force('x', d3.forceX<ArgumentNode>().strength(0.05))
      .force('y', d3.forceY<ArgumentNode>().strength(0.05));

    // Load initial data
    await loadArgumentData();
    
    // Set up zoom behavior with bounds
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .on('zoom', (event) => {
        svg.selectAll('g.main-content').attr('transform', event.transform);
        updateMinimap(event.transform);
      });

    svg.call(zoom);
    
    // Initialize minimap
    setupMinimap();
    
    // Set up real-time collaboration
    setupRealtimeCollaboration();
    
    // Update visualization when window resizes
    const resizeObserver = new ResizeObserver(() => {
      updateDimensions();
      simulation.force('center', d3.forceCenter<ArgumentNode>(width / 2, height / 2));
      simulation.alpha(0.3).restart();
      updateMinimap();
    });
    
    resizeObserver.observe(document.querySelector('#argument-map-container')!);

    // Assign random color to current user
    currentUserColor = COLORS.userColors[Math.floor(Math.random() * COLORS.userColors.length)];
  });

  onDestroy(() => {
    if (realtimeSubscription) {
      supabase.channel('argument-updates').unsubscribe();
    }
    if (userPresenceSubscription) {
      supabase.channel('argument-presence').unsubscribe();
    }
  });

  function createLinkMarkers(defs: d3.Selection<SVGDefsElement, unknown, null, undefined>) {
    const markerTypes: LinkType[] = ['supports', 'opposes', 'qualifies'];
    markerTypes.forEach(type => {
      defs.append('marker')
        .attr('id', 'arrow-' + type)
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 30)
        .attr('refY', 0)
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,-5L10,0L0,5')
        .attr('fill', COLORS.link[type]);
    });
  }

  function setupMinimap() {
    const minimapContainer = svg.append('g')
      .attr('class', 'minimap')
      .attr('transform', 'translate(' + (width - 200) + ',' + (height - 150) + ')');

    minimapContainer.append('rect')
      .attr('width', 200)
      .attr('height', 150)
      .attr('fill', 'rgba(0, 0, 0, 0.2)')
      .attr('stroke', 'var(--color-deep-gold)')
      .attr('stroke-width', 1);

    minimap = minimapContainer.append('g');
  }

  function updateMinimap(transform?: d3.ZoomTransform) {
    const minimapNodes = minimap.selectAll<SVGCircleElement, ArgumentNode>('circle')
      .data($argumentNodes)
      .join('circle')
      .attr('r', 2)
      .attr('fill', d => COLORS[d.type])
      .attr('cx', d => (d.x || 0) * minimapScale)
      .attr('cy', d => (d.y || 0) * minimapScale);

    if (transform) {
      const viewportRect = minimap.selectAll<SVGRectElement, unknown>('.viewport')
        .data([null])
        .join('rect')
        .attr('class', 'viewport')
        .attr('stroke', 'var(--color-deep-gold)')
        .attr('stroke-width', 1)
        .attr('fill', 'none');

      const viewportWidth = width / transform.k;
      const viewportHeight = height / transform.k;
      viewportRect
        .attr('x', -transform.x * minimapScale)
        .attr('y', -transform.y * minimapScale)
        .attr('width', viewportWidth * minimapScale)
        .attr('height', viewportHeight * minimapScale);
    }
  }

  async function setupRealtimeCollaboration() {
    // Subscribe to node updates
    realtimeSubscription = supabase
      .channel('argument-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'argument_nodes',
          filter: 'debate_id=eq.' + debateId
        },
        (payload) => {
          handleRealtimeUpdate(payload);
        }
      )
      .subscribe();

    // Subscribe to user presence
    userPresenceSubscription = supabase
      .channel('argument-presence')
      .on('presence', { event: 'sync' }, () => {
        const presenceState = userPresenceSubscription.presenceState();
        updateActiveUsers(presenceState);
      })
      .subscribe();

    // Track current user's presence
    await userPresenceSubscription.track({
      user_id: 'current-user-id', // Replace with actual user ID
      user_name: 'Current User', // Replace with actual user name
      color: currentUserColor,
      last_active: new Date().toISOString()
    });
  }

  function handleRealtimeUpdate(payload: RealtimePostgresChangesPayload<any>) {
    const { eventType, new: newData, old: oldData } = payload;
    
    if (!newData || !('id' in newData) || !('content' in newData) || !('type' in newData)) {
      console.error('Invalid argument node data:', newData);
      return;
    }

    const validatedNewData = {
      id: newData.id,
      content: newData.content,
      type: newData.type,
      strength: newData.strength || 0,
      factCheckerScore: newData.factCheckerScore || 0,
      expertConsensus: newData.expertConsensus || 0,
      children: newData.children || [],
      ...newData
    } as ArgumentNode;

    if (eventType === 'INSERT') {
      $argumentNodes = [...$argumentNodes, validatedNewData];
    } else if (eventType === 'UPDATE') {
      $argumentNodes = $argumentNodes.map(node => 
        node.id === validatedNewData.id ? { ...node, ...validatedNewData } : node
      );
    } else if (eventType === 'DELETE' && oldData && 'id' in oldData) {
      $argumentNodes = $argumentNodes.filter(node => node.id !== oldData.id);
    }

    simulation.nodes($argumentNodes);
    simulation.alpha(0.3).restart();
    updateVisualization();
  }

  function updateActiveUsers(presenceState: PresenceState) {
    const newActiveUsers = new Map();
    Object.values(presenceState).forEach((presence) => {
      const userData = presence[0];
      newActiveUsers.set(userData.user_id, {
        id: userData.user_id,
        name: userData.user_name,
        color: userData.color,
        lastActive: new Date(userData.last_active)
      });
    });
    activeUsers.set(newActiveUsers);
  }

  async function loadArgumentData() {
    try {
      // Fetch argument data from your backend
      const response = await fetch('/api/debates/' + debateId + '/arguments');
      const data = (await response.json()) as ArgumentData;
      
      // Process the data to ensure proper node/link structure
      const nodes = data.nodes.map((node: Partial<ArgumentNode>) => ({
        ...node,
        x: undefined,
        y: undefined,
        vx: undefined,
        vy: undefined,
        fx: null,
        fy: null
      })) as ArgumentNode[];

      const links = data.links.map((link: ArgumentData['links'][0]) => ({
        ...link,
        source: nodes.find((n: ArgumentNode) => n.id === link.source) as ArgumentNode,
        target: nodes.find((n: ArgumentNode) => n.id === link.target) as ArgumentNode
      }));
      
      argumentNodes.set(nodes);
      argumentLinks.set(links);
      
      // Update visualization
      updateVisualization();
    } catch (error) {
      console.error('Error loading argument data:', error);
    }
  }

  function updateVisualization() {
    // Clear existing elements
    svg.selectAll('*').remove();

    const mainContent = svg.append('g')
      .attr('class', 'main-content');

    // Create links with animations
    const links = mainContent
      .append('g')
      .selectAll<SVGLineElement, ArgumentLink>('line')
      .data($argumentLinks)
      .enter()
      .append('line')
      .attr('stroke', (d: ArgumentLink) => COLORS.link[d.type])
      .attr('stroke-width', (d: ArgumentLink) => Math.sqrt(d.strength) * 2)
      .attr('marker-end', (d: ArgumentLink) => 'url(#arrow-' + d.type + ')')
      .attr('class', d => d.animated ? 'animated-link' : '');

    // Create node groups
    const nodes = mainContent
      .append('g')
      .selectAll<SVGGElement, ArgumentNode>('g')
      .data($argumentNodes)
      .enter()
      .append('g')
      .call(d3.drag<SVGGElement, ArgumentNode>()
        .on('start', dragStarted)
        .on('drag', dragging)
        .on('end', dragEnded))
      .on('click', handleNodeClick)
      .on('dblclick', handleNodeEdit);

    // Add node circles with ripple effect
    const nodeGroups = nodes.append('g')
      .attr('class', 'node-group');

    nodeGroups.append('circle')
      .attr('class', 'ripple')
      .attr('r', 30)
      .attr('fill', 'none')
      .attr('stroke', (d: ArgumentNode) => COLORS[d.type])
      .attr('stroke-width', 2)
      .attr('opacity', 0);

    nodeGroups.append('circle')
      .attr('class', 'main-circle')
      .attr('r', 30)
      .attr('fill', (d: ArgumentNode) => COLORS[d.type])
      .attr('filter', 'url(#node-glow)');

    // Add node labels
    nodes.append('text')
      .text((d: ArgumentNode) => truncateText(d.content, 30))
      .attr('text-anchor', 'middle')
      .attr('dy', '.3em')
      .attr('fill', 'white')
      .style('font-size', '12px');

    // Add user indicators
    nodes.each((d: ArgumentNode) => {
      if (d.activeUsers?.length) {
        const userCount = d.activeUsers.length;
        const angleStep = (2 * Math.PI) / userCount;
        d.activeUsers.forEach((userId, index) => {
          const user = $activeUsers.get(userId);
          if (user) {
            const angle = index * angleStep;
            const x = Math.cos(angle) * 35;
            const y = Math.sin(angle) * 35;
            
            nodeGroups.append('circle')
              .attr('class', 'user-indicator')
              .attr('cx', x)
              .attr('cy', y)
              .attr('r', 5)
              .attr('fill', user.color)
              .append('title')
              .text(user.name);
          }
        });
      }
    });

    // Update simulation
    simulation
      .nodes($argumentNodes)
      .force('link', d3.forceLink<ArgumentNode, ArgumentLink>($argumentLinks).id(d => d.id))
      .on('tick', () => {
        links
          .attr('x1', d => (d.source as ArgumentNode).x || 0)
          .attr('y1', d => (d.source as ArgumentNode).y || 0)
          .attr('x2', d => (d.target as ArgumentNode).x || 0)
          .attr('y2', d => (d.target as ArgumentNode).y || 0);

        nodes
          .attr('transform', d => 'translate(' + (d.x || 0) + ',' + (d.y || 0) + ')');
      });

    // Update minimap
    updateMinimap();
  }

  function createGlowEffect(defs: d3.Selection<SVGDefsElement, unknown, null, undefined>, id: string, color: string, intensity: number) {
    const filter = defs.append('filter')
      .attr('id', id)
      .attr('x', '-50%')
      .attr('y', '-50%')
      .attr('width', '200%')
      .attr('height', '200%');

    filter.append('feGaussianBlur')
      .attr('stdDeviation', '3')
      .attr('result', 'coloredBlur');

    const feMerge = filter.append('feMerge');
    feMerge.append('feMergeNode')
      .attr('in', 'coloredBlur');
    feMerge.append('feMergeNode')
      .attr('in', 'SourceGraphic');
  }

  function handleNodeClick(event: MouseEvent, node: ArgumentNode) {
    selectedNode.set(node.id);
    // Highlight selected node and connected nodes
    svg.selectAll<SVGCircleElement, ArgumentNode>('circle')
      .attr('filter', (d: ArgumentNode) => 
        d.id === node.id || 
        node.children.includes(d.id) || 
        d.children.includes(node.id)
          ? 'url(#selected-glow)'
          : 'url(#node-glow)'
      );
  }

  function dragStarted(event: d3.D3DragEvent<SVGGElement, ArgumentNode, ArgumentNode>) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    event.subject.fx = event.subject.x;
    event.subject.fy = event.subject.y;
  }

  function dragging(event: d3.D3DragEvent<SVGGElement, ArgumentNode, ArgumentNode>) {
    event.subject.fx = event.x;
    event.subject.fy = event.y;
  }

  function dragEnded(event: d3.D3DragEvent<SVGGElement, ArgumentNode, ArgumentNode>) {
    if (!event.active) simulation.alphaTarget(0);
    event.subject.fx = null;
    event.subject.fy = null;
  }

  function truncateText(text: string, maxLength: number): string {
    return text.length > maxLength ? text.substring(0, maxLength - 3) + '...' : text;
  }

  function updateDimensions() {
    const container = document.querySelector('#argument-map-container');
    if (container) {
      width = container.clientWidth;
      height = container.clientHeight;
      svg.attr('width', width).attr('height', height);
    }
  }

  async function handleNodeEdit(event: MouseEvent, node: ArgumentNode) {
    if (isEditingNode) return;
    isEditingNode = true;

    const target = event.currentTarget as SVGGElement;
    const foreignObject = d3.select(target)
      .append('foreignObject')
      .attr('x', -100)
      .attr('y', -50)
      .attr('width', 200)
      .attr('height', 100);

    const editor = foreignObject
      .append('xhtml:div')
      .attr('class', 'node-editor')
      .append('textarea')
      .attr('class', 'node-editor-textarea')
      .property('value', node.content)
      .on('keydown', async (event: KeyboardEvent) => {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          const newContent = (event.target as HTMLTextAreaElement).value;
          
          try {
            await supabase
              .from('argument_nodes')
              .update({ 
                content: newContent,
                lastUpdated: new Date().toISOString(),
                updatedBy: 'current-user-id' // Replace with actual user ID
              })
              .eq('id', node.id);

            foreignObject.remove();
            isEditingNode = false;
          } catch (error) {
            console.error('Failed to update node:', error);
          }
        } else if (event.key === 'Escape') {
          foreignObject.remove();
          isEditingNode = false;
        }
      });

    editor.node()?.focus();
  }

  // Function to handle clustering
  function updateClustering() {
    const $clusterBy = get(clusterBy);
    const $showClusters = get(showClusters);
    const $filteredNodes = get(filteredNodes);
    
    if (!$showClusters || $clusterBy === 'none') {
      simulation.force('cluster', null);
      return;
    }

    const clusters = new Map();
    $filteredNodes.forEach(node => {
      let clusterKey;
      switch ($clusterBy) {
        case 'type':
          clusterKey = node.type;
          break;
        case 'strength':
          clusterKey = Math.floor(node.strength * 4) / 4; // Round to nearest 0.25
          break;
        case 'consensus':
          clusterKey = Math.floor(node.expertConsensus * 4) / 4;
          break;
      }
      
      if (!clusters.has(clusterKey)) {
        clusters.set(clusterKey, {
          x: width / 2 + (Math.random() - 0.5) * 200,
          y: height / 2 + (Math.random() - 0.5) * 200,
          nodes: []
        });
      }
      clusters.get(clusterKey).nodes.push(node);
    });

    // Add clustering force
    simulation.force('cluster', forceCluster()
      .centers(Array.from(clusters.values()))
      .strength(0.5)
    );
  }

  // Custom clustering force
  function forceCluster() {
    let nodes: ArgumentNode[];
    let centers: { x: number; y: number; nodes: ArgumentNode[] }[];
    let strength = 0.1;

    function force(alpha: number) {
      nodes.forEach(node => {
        centers.forEach(center => {
          if (center.nodes.includes(node)) {
            node.vx = (node.vx || 0) + (center.x - (node.x || 0)) * strength * alpha;
            node.vy = (node.vy || 0) + (center.y - (node.y || 0)) * strength * alpha;
          }
        });
      });
    }

    force.initialize = (_nodes: ArgumentNode[]) => nodes = _nodes;
    force.centers = (_: typeof centers) => { centers = _; return force; };
    force.strength = (_: number) => { strength = _; return force; };

    return force;
  }

  // Update visualization to use filtered nodes
  $: {
    if (simulation && $filteredNodes) {
      simulation.nodes($filteredNodes);
      updateClustering();
      simulation.alpha(0.3).restart();
    }
  }

  function startReply(replyTo: string) {
    replyingTo = replyTo;
    newMessage = '';
  }

  function handleChatKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }

  async function sendMessage() {
    if (newMessage.trim() === '') return;

    const message = {
      id: Date.now().toString(),
      userId: 'current-user-id',
      userName: 'Current User',
      message: newMessage,
      timestamp: new Date(),
      replyTo: replyingTo
    };

    await supabase
      .from('chat_messages')
      .insert([message]);

    replyingTo = null;
    newMessage = '';
  }
</script>

<div id="argument-map-container" class="argument-map-container">
  <svg id="argument-map"></svg>
  
  {#if $selectedNode}
    <div class="node-details">
      <h3>Selected Argument Details</h3>
      {#each $argumentNodes as node}
        {#if node.id === $selectedNode}
          <div class="detail-card">
            <p class="content">{node.content}</p>
            <div class="metrics">
              <div class="metric">
                <span>Strength:</span>
                <div class="progress-bar">
                  <div class="progress" style="width: {node.strength * 100}%"></div>
                </div>
              </div>
              <div class="metric">
                <span>Fact Checker Score:</span>
                <div class="progress-bar">
                  <div class="progress" style="width: {node.factCheckerScore * 100}%"></div>
                </div>
              </div>
              <div class="metric">
                <span>Expert Consensus:</span>
                <div class="progress-bar">
                  <div class="progress" style="width: {node.expertConsensus * 100}%"></div>
                </div>
              </div>
            </div>
            {#if node.lastUpdated}
              <div class="last-updated">
                Last updated: {new Date(node.lastUpdated).toLocaleString()}
                {#if node.updatedBy}
                  by {$activeUsers.get(node.updatedBy)?.name || 'Unknown User'}
                {/if}
              </div>
            {/if}
          </div>
        {/if}
      {/each}
    </div>
  {/if}

  <div class="active-users">
    <h4>Active Users</h4>
    <div class="user-list">
      {#each [...$activeUsers.values()] as user}
        <div class="user-item">
          <span class="user-dot" style="background-color: {user.color}"></span>
          <span class="user-name">{user.name}</span>
        </div>
      {/each}
    </div>
  </div>

  <div class="controls-panel">
    <div class="filter-section">
      <h4>Filters</h4>
      <div class="filter-group">
        <label>Types</label>
        <div class="type-filters">
          {#each ['claim', 'evidence', 'counterpoint', 'rebuttal'] as type}
            <label class="checkbox-label">
              <input
                type="checkbox"
                bind:checked={$filterCriteria.type.includes(type)}
                on:change={() => {
                  const types = $filterCriteria.type;
                  if (types.includes(type)) {
                    filterCriteria.update(f => ({ ...f, type: types.filter(t => t !== type) }));
                  } else {
                    filterCriteria.update(f => ({ ...f, type: [...types, type] }));
                  }
                }}
              />
              {type}
            </label>
          {/each}
        </div>
      </div>
      
      <div class="filter-group">
        <label>Minimum Strength</label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          bind:value={$filterCriteria.minStrength}
        />
      </div>
      
      <div class="filter-group">
        <label>Search</label>
        <input
          type="text"
          bind:value={$filterCriteria.searchTerm}
          placeholder="Search arguments..."
        />
      </div>
    </div>

    <div class="clustering-section">
      <h4>Clustering</h4>
      <label class="checkbox-label">
        <input type="checkbox" bind:checked={$showClusters} />
        Enable Clustering
      </label>
      
      <select bind:value={$clusterBy} disabled={!$showClusters}>
        <option value="none">No Clustering</option>
        <option value="type">By Type</option>
        <option value="strength">By Strength</option>
        <option value="consensus">By Consensus</option>
      </select>
    </div>
  </div>

  <div class="chat-panel" class:expanded={showChat}>
    <button class="toggle-chat" on:click={() => showChat = !showChat}>
      {showChat ? '→' : '←'} Chat
    </button>
    
    {#if showChat}
      <div class="chat-container">
        <div class="chat-messages">
          {#each $chatMessages as message}
            <div class="chat-message" class:reply={message.replyTo}>
              <div class="message-header">
                <span class="user-name">{message.userName}</span>
                <span class="timestamp">{message.timestamp.toLocaleTimeString()}</span>
              </div>
              <div class="message-content">{message.message}</div>
              <button class="reply-button" on:click={() => startReply(message.id)}>Reply</button>
            </div>
          {/each}
        </div>
        
        <div class="chat-input">
          <textarea
            bind:value={newMessage}
            placeholder={replyingTo ? 'Write a reply...' : 'Type a message...'}
            on:keydown={handleChatKeydown}
          ></textarea>
          <button on:click={sendMessage}>Send</button>
        </div>
      </div>
    {/if}
  </div>

  <div class="annotations-container">
    {#each $annotations as annotation}
      <div
        class="annotation"
        style="left: {annotation.position.x}px; top: {annotation.position.y}px;"
      >
        <div class="annotation-header">
          <span class="user-name">{annotation.userName}</span>
          <span class="timestamp">{annotation.timestamp.toLocaleTimeString()}</span>
        </div>
        <div class="annotation-content">{annotation.content}</div>
      </div>
    {/each}
  </div>
</div>

<style lang="postcss">
  .argument-map-container {
    width: 100%;
    height: 100%;
    background: var(--color-deep-space-black);
    position: relative;
    overflow: hidden;
  }

  svg {
    width: 100%;
    height: 100%;
  }

  .node-details {
    position: absolute;
    bottom: 0;
    right: 0;
    width: 300px;
    background: rgba(10, 37, 64, 0.9);
    backdrop-filter: blur(10px);
    border-radius: 12px 0 0 0;
    padding: 1rem;
    color: white;
    border-top: 2px solid var(--color-deep-gold);
    border-left: 2px solid var(--color-deep-gold);
  }

  .active-users {
    position: absolute;
    top: 1rem;
    right: 1rem;
    background: rgba(10, 37, 64, 0.9);
    backdrop-filter: blur(10px);
    border-radius: 8px;
    padding: 1rem;
    color: white;
    border: 1px solid var(--color-deep-gold);
  }

  .user-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .user-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .user-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .user-name {
    font-size: 0.9rem;
  }

  .node-editor {
    background: rgba(10, 37, 64, 0.9);
    backdrop-filter: blur(10px);
    border-radius: 8px;
    padding: 0.5rem;
    border: 1px solid var(--color-deep-gold);
  }

  .node-editor-textarea {
    width: 100%;
    height: 100%;
    background: transparent;
    border: none;
    color: white;
    font-family: inherit;
    font-size: 12px;
    resize: none;
    outline: none;
  }

  .animated-link {
    animation: flowAnimation 2s infinite linear;
    stroke-dasharray: 10 5;
  }

  @keyframes flowAnimation {
    from {
      stroke-dashoffset: 0;
    }
    to {
      stroke-dashoffset: 30;
    }
  }

  .ripple {
    animation: rippleAnimation 2s infinite;
  }

  @keyframes rippleAnimation {
    0% {
      transform: scale(1);
      opacity: 0.5;
    }
    100% {
      transform: scale(1.5);
      opacity: 0;
    }
  }

  .controls-panel {
    position: absolute;
    top: 1rem;
    left: 1rem;
    background: rgba(10, 37, 64, 0.9);
    backdrop-filter: blur(10px);
    border-radius: 8px;
    padding: 1rem;
    color: white;
    border: 1px solid var(--color-deep-gold);
    width: 250px;
  }

  .filter-group {
    margin-bottom: 1rem;
  }

  .type-filters {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.5rem;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9rem;
  }

  .chat-panel {
    position: absolute;
    right: 0;
    top: 0;
    bottom: 0;
    width: 300px;
    transform: translateX(100%);
    transition: transform 0.3s ease;
    background: rgba(10, 37, 64, 0.95);
    backdrop-filter: blur(10px);
    border-left: 2px solid var(--color-deep-gold);
  }

  .chat-panel.expanded {
    transform: translateX(0);
  }

  .toggle-chat {
    position: absolute;
    left: -30px;
    top: 50%;
    transform: translateY(-50%);
    background: var(--color-deep-gold);
    border: none;
    padding: 0.5rem;
    cursor: pointer;
    border-radius: 4px 0 0 4px;
  }

  .chat-container {
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .chat-messages {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
  }

  .chat-message {
    margin-bottom: 1rem;
    padding: 0.5rem;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 4px;
  }

  .chat-message.reply {
    margin-left: 1rem;
    border-left: 2px solid var(--color-deep-gold);
  }

  .chat-input {
    padding: 1rem;
    border-top: 1px solid var(--color-deep-gold);
  }

  .chat-input textarea {
    width: 100%;
    height: 60px;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid var(--color-deep-gold);
    border-radius: 4px;
    color: white;
    padding: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .annotation {
    position: absolute;
    background: rgba(10, 37, 64, 0.9);
    backdrop-filter: blur(10px);
    border-radius: 4px;
    padding: 0.5rem;
    color: white;
    border: 1px solid var(--color-deep-gold);
    max-width: 200px;
    pointer-events: none;
  }

  .annotation::before {
    content: '';
    position: absolute;
    bottom: -6px;
    left: 50%;
    transform: translateX(-50%);
    border-left: 6px solid transparent;
    border-right: 6px solid transparent;
    border-top: 6px solid var(--color-deep-gold);
  }
</style> 