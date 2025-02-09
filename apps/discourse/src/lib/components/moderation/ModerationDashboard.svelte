<!-- ModerationDashboard.svelte -->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { fade, slide } from 'svelte/transition';
  import { moderationService } from '$lib/services/moderation/ModerationService';
  import { Button, Input, Alert, Badge, Tabs, Tab } from '$lib/components/ui';
  import LineChart from '../shared/LineChart.svelte';
  import PieChart from '../shared/PieChart.svelte';
  import DataTable from '../shared/DataTable.svelte';

  // Stores
  const reports = moderationService.getReports();
  const stats = moderationService.getStats();

  // State
  let activeTab = 'queue';
  let selectedReport: any = null;
  let actionType: string = 'warning';
  let actionReason: string = '';
  let actionDuration: number = 24; // hours
  let searchQuery: string = '';
  let filterStatus: string[] = ['pending', 'investigating'];
  let filterPriority: string[] = [];
  let filterType: string[] = [];
  let sortBy: 'newest' | 'oldest' | 'priority' = 'newest';

  // Computed
  $: filteredReports = filterReports($reports, {
    query: searchQuery,
    status: filterStatus,
    priority: filterPriority,
    type: filterType
  });

  $: sortedReports = sortReports(filteredReports, sortBy);

  function filterReports(reports: any[], filters: {
    query: string;
    status: string[];
    priority: string[];
    type: string[];
  }) {
    return reports.filter(report => {
      // Text search
      if (filters.query) {
        const searchText = `${report.reason} ${report.type}`.toLowerCase();
        if (!searchText.includes(filters.query.toLowerCase())) return false;
      }

      // Status filter
      if (filters.status.length > 0 && !filters.status.includes(report.status)) return false;

      // Priority filter
      if (filters.priority.length > 0 && !filters.priority.includes(report.priority)) return false;

      // Type filter
      if (filters.type.length > 0 && !filters.type.includes(report.type)) return false;

      return true;
    });
  }

  function sortReports(reports: any[], sortBy: string) {
    return [...reports].sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'priority':
          const priorityOrder = { critical: 3, high: 2, medium: 1, low: 0 };
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        default:
          return 0;
      }
    });
  }

  async function handleAction() {
    if (!selectedReport || !actionType || !actionReason) return;

    try {
      const action = {
        type: actionType,
        targetType: selectedReport.targetType,
        targetId: selectedReport.targetId,
        reason: actionReason,
        evidence: selectedReport.evidence,
        moderatorId: 'current-user-id', // Replace with actual user ID
        duration: actionType === 'ban' || actionType === 'mute' ? actionDuration * 3600000 : undefined
      };

      await moderationService.takeAction(action);
      await moderationService.updateReport(selectedReport.id, {
        status: 'resolved',
        resolution: {
          action: actionType,
          note: actionReason,
          moderatorId: 'current-user-id',
          timestamp: new Date().toISOString()
        }
      });

      selectedReport = null;
      actionType = 'warning';
      actionReason = '';
    } catch (error) {
      console.error('Error taking action:', error);
    }
  }

  function formatDate(date: string): string {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(date));
  }

  function getPriorityColor(priority: string): string {
    switch (priority) {
      case 'critical': return 'text-red-500 bg-red-500/10';
      case 'high': return 'text-orange-500 bg-orange-500/10';
      case 'medium': return 'text-yellow-500 bg-yellow-500/10';
      case 'low': return 'text-green-500 bg-green-500/10';
      default: return 'text-gray-500 bg-gray-500/10';
    }
  }

  function getStatusColor(status: string): string {
    switch (status) {
      case 'pending': return 'text-yellow-500 bg-yellow-500/10';
      case 'investigating': return 'text-blue-500 bg-blue-500/10';
      case 'resolved': return 'text-green-500 bg-green-500/10';
      case 'dismissed': return 'text-gray-500 bg-gray-500/10';
      default: return 'text-gray-500 bg-gray-500/10';
    }
  }
</script>

<div class="space-y-6">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <h1 class="text-2xl font-bold">Moderation Dashboard</h1>
    <div class="flex items-center gap-4">
      <Input
        type="search"
        placeholder="Search reports..."
        bind:value={searchQuery}
      />
      <select
        bind:value={sortBy}
        class="bg-card border border-border rounded-lg px-3 py-1.5"
      >
        <option value="newest">Newest First</option>
        <option value="oldest">Oldest First</option>
        <option value="priority">By Priority</option>
      </select>
    </div>
  </div>

  <!-- Tabs -->
  <Tabs bind:active={activeTab}>
    <Tab id="queue" title="Queue">
      <div class="space-y-6">
        <!-- Filters -->
        <div class="flex items-center gap-4 p-4 bg-card border border-border rounded-lg">
          <div>
            <label class="block text-sm font-medium mb-1">Status</label>
            <select
              multiple
              bind:value={filterStatus}
              class="bg-background border border-border rounded-lg px-2 py-1"
            >
              <option value="pending">Pending</option>
              <option value="investigating">Investigating</option>
              <option value="resolved">Resolved</option>
              <option value="dismissed">Dismissed</option>
            </select>
          </div>

          <div>
            <label class="block text-sm font-medium mb-1">Priority</label>
            <select
              multiple
              bind:value={filterPriority}
              class="bg-background border border-border rounded-lg px-2 py-1"
            >
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          <div>
            <label class="block text-sm font-medium mb-1">Type</label>
            <select
              multiple
              bind:value={filterType}
              class="bg-background border border-border rounded-lg px-2 py-1"
            >
              <option value="spam">Spam</option>
              <option value="harassment">Harassment</option>
              <option value="hate">Hate Speech</option>
              <option value="misinformation">Misinformation</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        <!-- Reports List -->
        <div class="space-y-4">
          {#each sortedReports as report (report.id)}
            <div
              class="p-4 bg-card border border-border rounded-lg hover:border-primary/50 transition-colors cursor-pointer"
              class:border-primary={selectedReport?.id === report.id}
              on:click={() => selectedReport = report}
              transition:fade
            >
              <div class="flex items-start justify-between">
                <div class="space-y-2">
                  <div class="flex items-center gap-2">
                    <Badge class={getPriorityColor(report.priority)}>
                      {report.priority}
                    </Badge>
                    <Badge class={getStatusColor(report.status)}>
                      {report.status}
                    </Badge>
                    <Badge variant="outline">
                      {report.type}
                    </Badge>
                  </div>

                  <p class="text-sm">{report.reason}</p>

                  <div class="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>Reported {formatDate(report.createdAt)}</span>
                    <span>Target: {report.targetType}</span>
                    {#if report.assignedTo}
                      <span>Assigned to: {report.assignedTo}</span>
                    {/if}
                  </div>
                </div>

                {#if report.status === 'pending'}
                  <Button
                    variant="outline"
                    size="sm"
                    on:click|stopPropagation={() => {
                      moderationService.updateReport(report.id, {
                        status: 'investigating',
                        assignedTo: 'current-user-id'
                      });
                    }}
                  >
                    Take Case
                  </Button>
                {/if}
              </div>
            </div>
          {/each}

          {#if sortedReports.length === 0}
            <div class="p-8 text-center text-muted-foreground">
              No reports match your filters
            </div>
          {/if}
        </div>
      </div>
    </Tab>

    <Tab id="stats" title="Statistics">
      {#if $stats}
        <div class="space-y-6">
          <!-- Overview Cards -->
          <div class="grid grid-cols-4 gap-4">
            <div class="p-4 bg-card border border-border rounded-lg">
              <div class="text-sm text-muted-foreground">Total Reports</div>
              <div class="text-2xl font-bold mt-1">{$stats.totalReports}</div>
            </div>
            <div class="p-4 bg-card border border-border rounded-lg">
              <div class="text-sm text-muted-foreground">Pending Reports</div>
              <div class="text-2xl font-bold mt-1">{$stats.pendingReports}</div>
            </div>
            <div class="p-4 bg-card border border-border rounded-lg">
              <div class="text-sm text-muted-foreground">Resolved Reports</div>
              <div class="text-2xl font-bold mt-1">{$stats.resolvedReports}</div>
            </div>
            <div class="p-4 bg-card border border-border rounded-lg">
              <div class="text-sm text-muted-foreground">Avg. Resolution Time</div>
              <div class="text-2xl font-bold mt-1">
                {Math.round($stats.averageResolutionTime / 3600000)}h
              </div>
            </div>
          </div>

          <!-- Charts -->
          <div class="grid grid-cols-2 gap-6">
            <div class="p-4 bg-card border border-border rounded-lg">
              <h3 class="text-lg font-medium mb-4">Reports by Type</h3>
              <PieChart
                data={Object.entries($stats.reportsByType).map(([type, count]) => ({
                  label: type,
                  value: count
                }))}
                height={300}
              />
            </div>

            <div class="p-4 bg-card border border-border rounded-lg">
              <h3 class="text-lg font-medium mb-4">Actions by Type</h3>
              <PieChart
                data={Object.entries($stats.actionsByType).map(([type, count]) => ({
                  label: type,
                  value: count
                }))}
                height={300}
              />
            </div>
          </div>

          <!-- Moderator Performance -->
          <div class="p-4 bg-card border border-border rounded-lg">
            <h3 class="text-lg font-medium mb-4">Moderator Performance</h3>
            <DataTable
              data={$stats.moderatorPerformance}
              columns={[
                { key: 'moderatorId', label: 'Moderator' },
                { key: 'actionsCount', label: 'Actions' },
                {
                  key: 'averageResponseTime',
                  label: 'Avg. Response Time',
                  format: value => `${Math.round(value / 3600000)}h`
                },
                {
                  key: 'resolutionRate',
                  label: 'Resolution Rate',
                  format: value => `${Math.round(value * 100)}%`
                }
              ]}
            />
          </div>
        </div>
      {/if}
    </Tab>
  </Tabs>

  <!-- Action Panel -->
  {#if selectedReport}
    <div
      class="fixed inset-y-0 right-0 w-96 bg-background border-l border-border p-6 space-y-6 shadow-xl"
      transition:slide={{ duration: 200, axis: 'x' }}
    >
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-medium">Take Action</h2>
        <Button
          variant="ghost"
          size="icon"
          on:click={() => selectedReport = null}
        >
          ×
        </Button>
      </div>

      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium mb-1">Action Type</label>
          <select
            bind:value={actionType}
            class="w-full bg-background border border-border rounded-lg px-3 py-2"
          >
            <option value="warning">Warning</option>
            <option value="mute">Mute</option>
            <option value="ban">Ban</option>
            <option value="delete">Delete Content</option>
          </select>
        </div>

        {#if actionType === 'ban' || actionType === 'mute'}
          <div>
            <label class="block text-sm font-medium mb-1">Duration (hours)</label>
            <Input
              type="number"
              bind:value={actionDuration}
              min="1"
              max="720"
            />
          </div>
        {/if}

        <div>
          <label class="block text-sm font-medium mb-1">Reason</label>
          <textarea
            bind:value={actionReason}
            class="w-full h-32 bg-background border border-border rounded-lg px-3 py-2 resize-none"
            placeholder="Explain the reason for this action..."
          ></textarea>
        </div>

        <div class="pt-4">
          <Button
            variant="primary"
            class="w-full"
            disabled={!actionType || !actionReason}
            on:click={handleAction}
          >
            Confirm Action
          </Button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  /* Add any component-specific styles here */
</style> 