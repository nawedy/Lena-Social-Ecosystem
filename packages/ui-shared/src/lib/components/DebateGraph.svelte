<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { fade, slide } from 'svelte/transition';
  import * as d3 from 'd3';

  export let nodes: Array<{
    id: string;
    type: 'argument' | 'evidence' | 'question' | 'conclusion';
    content: string;
    author: {
      id: string;
      name: string;
      avatar?: string;
    };
    votes: {
      up: number;
      down: number;
    };
    createdAt: string;
  }>;

  export let links: Array<{
    source: string;
    target: string;
    type: 'supports' | 'opposes' | 'questions' | 'resolves';
  }>;

  export let width = 800;
  export let height = 600;
  export let zoom = true;
  export let interactive = true;

  const dispatch = createEventDispatcher<{
    select: { id: string };
    vote: { id: string; type: 'up' | 'down' };
    reply: { id: string; type: 'argument' | 'evidence' | 'question' | 'conclusion' };
  }>();

  let svg: SVGSVGElement;
  let container: SVGGElement;
  let simulation: d3.Simulation<any, any>;
  let selectedNode: typeof nodes[number] | null = null;

  const nodeColors = {
    argument: '#FF003C',
    evidence: '#00FFFF',
    question: '#FFD700',
    conclusion: '#00FF7F'
  };

  const linkColors = {
    supports: '#4CAF50',
    opposes: '#F44336',
    questions: '#FFC107',
    resolves: '#2196F3'
  };

  onMount(() => {
    initializeGraph();
  });

  function initializeGraph() {
    const svg = d3.select(container);

    // Create arrow markers for links
    svg.append('defs')
      .selectAll('marker')
      .data(['supports', 'opposes', 'questions', 'resolves'])
      .enter()
      .append('marker')
      .attr('id', d => `arrow-${d}`)
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 20)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('fill', d => linkColors[d])
      .attr('d', 'M0,-5L10,0L0,5');

    // Create links
    const link = svg.append('g')
      .selectAll('line')
      .data(links)
      .enter()
      .append('line')
      .attr('stroke', d => linkColors[d.type])
      .attr('stroke-width', 2)
      .attr('marker-end', d => `url(#arrow-${d.type})`);

    // Create nodes
    const node = svg.append('g')
      .selectAll('g')
      .data(nodes)
      .enter()
      .append('g')
      .call(d3.drag()
        .on('start', dragStarted)
        .on('drag', dragged)
        .on('end', dragEnded)
      );

    // Add circles to nodes
    node.append('circle')
      .attr('r', 20)
      .attr('fill', d => nodeColors[d.type])
      .attr('stroke', '#fff')
      .attr('stroke-width', 2);

    // Add icons to nodes
    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '.3em')
      .attr('fill', '#fff')
      .text(d => getNodeIcon(d.type));

    // Initialize force simulation
    simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(100))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .on('tick', ticked);

    // Add zoom behavior
    if (zoom) {
      const zoom = d3.zoom()
        .scaleExtent([0.1, 4])
        .on('zoom', (event) => {
          svg.attr('transform', event.transform);
        });

      d3.select(svg).call(zoom);
    }

    function ticked() {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

      node
        .attr('transform', d => `translate(${d.x},${d.y})`);
    }

    function dragStarted(event) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    function dragged(event) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragEnded(event) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }

    // Handle node clicks
    node.on('click', (event, d) => {
      event.stopPropagation();
      selectedNode = d;
      dispatch('select', { id: d.id });
    });
  }

  function getNodeIcon(type: typeof nodes[number]['type']): string {
    switch (type) {
      case 'argument': return '💭';
      case 'evidence': return '📊';
      case 'question': return '❓';
      case 'conclusion': return '✅';
      default: return '';
    }
  }

  function handleVote(id: string, type: 'up' | 'down') {
    dispatch('vote', { id, type });
  }

  function handleReply(id: string, type: typeof nodes[number]['type']) {
    dispatch('reply', { id, type });
  }
</script>

<div class="relative w-full h-full">
  <svg
    bind:this={svg}
    {width}
    {height}
    class="w-full h-full bg-black/50 rounded-lg"
  >
    <g bind:this={container} />
  </svg>

  {#if selectedNode}
    <div
      class="absolute top-4 right-4 w-80 bg-black/90 backdrop-blur-sm rounded-lg shadow-xl border border-primary-900/50 p-4"
      transition:fade={{ duration: 200 }}
    >
      <div class="flex items-start gap-3 mb-4">
        <img
          src={selectedNode.author.avatar || `https://api.dicebear.com/7.x/shapes/svg?seed=${selectedNode.author.id}`}
          alt={selectedNode.author.name}
          class="w-10 h-10 rounded-full bg-primary-900/50"
        />
        <div>
          <h3 class="font-medium">{selectedNode.author.name}</h3>
          <time class="text-sm text-gray-400">
            {new Date(selectedNode.createdAt).toLocaleDateString()}
          </time>
        </div>
      </div>

      <p class="mb-4">{selectedNode.content}</p>

      <div class="flex items-center justify-between">
        <div class="flex gap-2">
          <button
            class="flex items-center gap-1 px-2 py-1 rounded hover:bg-primary-900/50 transition-colors"
            on:click={() => handleVote(selectedNode.id, 'up')}
          >
            <span>👍</span>
            <span>{selectedNode.votes.up}</span>
          </button>
          <button
            class="flex items-center gap-1 px-2 py-1 rounded hover:bg-primary-900/50 transition-colors"
            on:click={() => handleVote(selectedNode.id, 'down')}
          >
            <span>👎</span>
            <span>{selectedNode.votes.down}</span>
          </button>
        </div>

        <div class="flex gap-2">
          <button
            class="flex items-center gap-1 px-2 py-1 rounded hover:bg-primary-900/50 transition-colors"
            on:click={() => handleReply(selectedNode.id, 'argument')}
          >
            <span>💭</span>
            <span>Argue</span>
          </button>
          <button
            class="flex items-center gap-1 px-2 py-1 rounded hover:bg-primary-900/50 transition-colors"
            on:click={() => handleReply(selectedNode.id, 'evidence')}
          >
            <span>📊</span>
            <span>Evidence</span>
          </button>
          <button
            class="flex items-center gap-1 px-2 py-1 rounded hover:bg-primary-900/50 transition-colors"
            on:click={() => handleReply(selectedNode.id, 'question')}
          >
            <span>❓</span>
            <span>Question</span>
          </button>
        </div>
      </div>
    </div>
  {/if}
</div> 