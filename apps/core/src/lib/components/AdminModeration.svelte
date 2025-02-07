<script lang="ts">
  import { onMount } from 'svelte';
  import { writable } from 'svelte/store';
  import { supabase } from '$lib/supabaseClient';
  import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

  // Stores for moderation data
  const reportedContent = writable<{
    id: string;
    type: 'argument' | 'chat' | 'annotation';
    contentId: string;
    reporterId: string;
    reporterName: string;
    reason: string;
    status: 'pending' | 'reviewed' | 'resolved';
    timestamp: Date;
    content: any;
  }[]>([]);

  const moderationQueue = writable<{
    id: string;
    type: 'argument' | 'chat' | 'annotation';
    content: any;
    score: number;
    flags: string[];
    status: 'pending' | 'approved' | 'rejected';
    timestamp: Date;
  }[]>([]);

  const moderationStats = writable<{
    totalReports: number;
    pendingReports: number;
    resolvedReports: number;
    averageResponseTime: number;
    topReportReasons: { reason: string; count: number }[];
    recentActions: {
      id: string;
      action: string;
      contentType: string;
      moderator: string;
      timestamp: Date;
    }[];
  } | undefined>(undefined);

  let selectedReport: string | null = null;
  let selectedContent: any = null;
  let moderationNotes = '';
  let showAIAnalysis = false;
  let aiAnalysisResult: any = null;

  onMount(async () => {
    // Load initial data
    await Promise.all([
      loadReportedContent(),
      loadModerationQueue(),
      loadModerationStats()
    ]);

    // Subscribe to real-time updates
    const reportSubscription = supabase
      .channel('moderation-reports')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reported_content' },
        handleReportUpdate
      )
      .subscribe();

    const cleanup = () => {
      reportSubscription.unsubscribe();
    };

    return cleanup;
  });

  async function loadReportedContent() {
    const { data, error } = await supabase
      .from('reported_content')
      .select('*')
      .order('timestamp', { ascending: false });

    if (error) {
      console.error('Error loading reported content:', error);
      return;
    }

    reportedContent.set(data.map(item => ({
      ...item,
      timestamp: new Date(item.timestamp)
    })));
  }

  async function loadModerationQueue() {
    const { data, error } = await supabase
      .from('moderation_queue')
      .select('*')
      .order('score', { ascending: false });

    if (error) {
      console.error('Error loading moderation queue:', error);
      return;
    }

    moderationQueue.set(data.map(item => ({
      ...item,
      timestamp: new Date(item.timestamp)
    })));
  }

  async function loadModerationStats() {
    const { data, error } = await supabase
      .from('moderation_stats')
      .select('*')
      .single();

    if (error) {
      console.error('Error loading moderation stats:', error);
      return;
    }

    moderationStats.set({
      ...data,
      recentActions: data.recentActions.map((action: any) => ({
        ...action,
        timestamp: new Date(action.timestamp)
      }))
    });
  }

  function handleReportUpdate(payload: RealtimePostgresChangesPayload<any>) {
    loadReportedContent();
    loadModerationStats();
  }

  async function reviewContent(reportId: string | null, action: 'approve' | 'reject') {
    if (!reportId) return;
    
    const report = $reportedContent.find(r => r.id === reportId);
    if (!report) return;

    try {
      await supabase.from('reported_content').update({
        status: 'resolved',
        resolution: action,
        moderationNotes,
        resolvedAt: new Date().toISOString()
      }).eq('id', reportId);

      if (action === 'reject') {
        // Handle content removal based on type
        switch (report.type) {
          case 'argument':
            await supabase.from('argument_nodes').delete().eq('id', report.contentId);
            break;
          case 'chat':
            await supabase.from('chat_messages').delete().eq('id', report.contentId);
            break;
          case 'annotation':
            await supabase.from('annotations').delete().eq('id', report.contentId);
            break;
        }
      }

      // Clear selection
      selectedReport = null;
      selectedContent = null;
      moderationNotes = '';

      // Reload data
      await Promise.all([
        loadReportedContent(),
        loadModerationStats()
      ]);
    } catch (error) {
      console.error('Error reviewing content:', error);
    }
  }

  async function requestAIAnalysis() {
    if (!selectedContent) return;

    showAIAnalysis = true;
    try {
      const response = await fetch('/api/analyze-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: selectedContent,
          type: $reportedContent.find(r => r.id === selectedReport)?.type
        })
      });

      aiAnalysisResult = await response.json();
    } catch (error) {
      console.error('Error analyzing content:', error);
      aiAnalysisResult = { error: 'Failed to analyze content' };
    }
  }
</script>

<div class="admin-moderation">
  <div class="stats-panel">
    <h2>Moderation Overview</h2>
    {#if $moderationStats}
      <div class="stats-grid">
        <div class="stat-card">
          <h3>Total Reports</h3>
          <p class="stat-value">{$moderationStats.totalReports}</p>
        </div>
        <div class="stat-card">
          <h3>Pending Reports</h3>
          <p class="stat-value">{$moderationStats.pendingReports}</p>
        </div>
        <div class="stat-card">
          <h3>Average Response Time</h3>
          <p class="stat-value">{Math.round($moderationStats.averageResponseTime / 60000)}m</p>
        </div>
      </div>

      <div class="top-reasons">
        <h3>Top Report Reasons</h3>
        <div class="reason-list">
          {#each $moderationStats.topReportReasons as reason}
            <div class="reason-item">
              <span>{reason.reason}</span>
              <span class="count">{reason.count}</span>
            </div>
          {/each}
        </div>
      </div>

      <div class="recent-actions">
        <h3>Recent Actions</h3>
        <div class="action-list">
          {#each $moderationStats.recentActions as action}
            <div class="action-item">
              <span class="action-type">{action.action}</span>
              <span class="content-type">{action.contentType}</span>
              <span class="moderator">{action.moderator}</span>
              <span class="timestamp">{action.timestamp.toLocaleString()}</span>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  </div>

  <div class="queue-panel">
    <h2>Moderation Queue</h2>
    <div class="queue-list">
      {#each $reportedContent.filter(r => r.status === 'pending') as report}
        <div
          class="queue-item"
          class:selected={selectedReport === report.id}
          on:click={() => {
            selectedReport = report.id;
            selectedContent = report.content;
          }}
        >
          <div class="report-header">
            <span class="report-type">{report.type}</span>
            <span class="report-time">{report.timestamp.toLocaleString()}</span>
          </div>
          <div class="report-reason">{report.reason}</div>
          <div class="reporter">Reported by: {report.reporterName}</div>
        </div>
      {/each}
    </div>
  </div>

  {#if selectedReport && selectedContent}
    <div class="review-panel">
      <h2>Content Review</h2>
      
      <div class="content-preview">
        {#if selectedContent.type === 'argument'}
          <div class="argument-preview">
            <h3>{selectedContent.type}</h3>
            <p>{selectedContent.content}</p>
            <div class="metrics">
              <span>Strength: {selectedContent.strength}</span>
              <span>Fact Score: {selectedContent.factCheckerScore}</span>
            </div>
          </div>
        {:else if selectedContent.type === 'chat'}
          <div class="chat-preview">
            <div class="message">{selectedContent.message}</div>
            <div class="metadata">
              <span>{selectedContent.userName}</span>
              <span>{new Date(selectedContent.timestamp).toLocaleString()}</span>
            </div>
          </div>
        {:else}
          <div class="annotation-preview">
            <p>{selectedContent.content}</p>
            <div class="metadata">
              <span>{selectedContent.userName}</span>
              <span>{new Date(selectedContent.timestamp).toLocaleString()}</span>
            </div>
          </div>
        {/if}
      </div>

      <div class="ai-analysis">
        <button on:click={requestAIAnalysis}>
          Request AI Analysis
        </button>
        
        {#if showAIAnalysis}
          <div class="analysis-results">
            {#if aiAnalysisResult}
              <div class="analysis-card">
                <h4>Content Analysis</h4>
                <div class="analysis-metrics">
                  <div class="metric">
                    <span>Toxicity Score</span>
                    <div class="progress-bar">
                      <div
                        class="progress"
                        style="width: {aiAnalysisResult.toxicity * 100}%"
                      ></div>
                    </div>
                  </div>
                  <div class="metric">
                    <span>Spam Probability</span>
                    <div class="progress-bar">
                      <div
                        class="progress"
                        style="width: {aiAnalysisResult.spamProbability * 100}%"
                      ></div>
                    </div>
                  </div>
                </div>
                <div class="detected-issues">
                  {#each aiAnalysisResult.detectedIssues as issue}
                    <div class="issue-tag">{issue}</div>
                  {/each}
                </div>
                <p class="ai-recommendation">
                  Recommendation: {aiAnalysisResult.recommendation}
                </p>
              </div>
            {:else}
              <p>Loading analysis...</p>
            {/if}
          </div>
        {/if}
      </div>

      <div class="moderation-actions">
        <textarea
          bind:value={moderationNotes}
          placeholder="Add moderation notes..."
        ></textarea>
        
        <div class="action-buttons">
          <button
            class="approve"
            on:click={() => reviewContent(selectedReport, 'approve')}
          >
            Approve Content
          </button>
          <button
            class="reject"
            on:click={() => reviewContent(selectedReport, 'reject')}
          >
            Remove Content
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style lang="postcss">
  .admin-moderation {
    display: grid;
    grid-template-columns: 300px 1fr;
    grid-template-rows: auto 1fr;
    gap: 1rem;
    padding: 1rem;
    height: 100vh;
    background: var(--color-deep-space-black);
    color: white;
  }

  .stats-panel {
    grid-column: 1 / -1;
    background: rgba(10, 37, 64, 0.9);
    border-radius: 8px;
    padding: 1rem;
    border: 1px solid var(--color-deep-gold);
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .stat-card {
    background: rgba(255, 255, 255, 0.1);
    padding: 1rem;
    border-radius: 4px;
    text-align: center;
  }

  .stat-value {
    font-size: 2rem;
    font-weight: bold;
    color: var(--color-deep-gold);
  }

  .queue-panel {
    background: rgba(10, 37, 64, 0.9);
    border-radius: 8px;
    padding: 1rem;
    border: 1px solid var(--color-deep-gold);
    overflow-y: auto;
  }

  .queue-item {
    background: rgba(255, 255, 255, 0.1);
    padding: 1rem;
    border-radius: 4px;
    margin-bottom: 0.5rem;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .queue-item:hover {
    background: rgba(255, 255, 255, 0.15);
  }

  .queue-item.selected {
    background: rgba(var(--color-deep-gold-rgb), 0.2);
    border: 1px solid var(--color-deep-gold);
  }

  .review-panel {
    background: rgba(10, 37, 64, 0.9);
    border-radius: 8px;
    padding: 1rem;
    border: 1px solid var(--color-deep-gold);
    overflow-y: auto;
  }

  .content-preview {
    background: rgba(255, 255, 255, 0.1);
    padding: 1rem;
    border-radius: 4px;
    margin-bottom: 1rem;
  }

  .analysis-card {
    background: rgba(255, 255, 255, 0.1);
    padding: 1rem;
    border-radius: 4px;
    margin-top: 1rem;
  }

  .progress-bar {
    background: rgba(255, 255, 255, 0.1);
    height: 8px;
    border-radius: 4px;
    overflow: hidden;
  }

  .progress {
    height: 100%;
    background: var(--color-deep-gold);
    transition: width 0.3s ease;
  }

  .issue-tag {
    display: inline-block;
    background: rgba(255, 0, 0, 0.2);
    color: #ff6b6b;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    margin: 0.25rem;
    font-size: 0.9rem;
  }

  .moderation-actions {
    margin-top: 1rem;
  }

  .moderation-actions textarea {
    width: 100%;
    height: 100px;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid var(--color-deep-gold);
    border-radius: 4px;
    color: white;
    padding: 0.5rem;
    margin-bottom: 1rem;
  }

  .action-buttons {
    display: flex;
    gap: 1rem;
  }

  .action-buttons button {
    flex: 1;
    padding: 0.5rem;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-weight: bold;
    transition: background-color 0.2s;
  }

  .action-buttons .approve {
    background: var(--color-deep-gold);
    color: black;
  }

  .action-buttons .reject {
    background: #ff6b6b;
    color: white;
  }

  .action-buttons button:hover {
    opacity: 0.9;
  }
</style> 