<!-- ReputationProfile.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { fade, slide } from 'svelte/transition';
  import { reputationService } from '$lib/services/reputation/ReputationService';
  import { Button, Card, Tabs, Tab, Badge } from '$lib/components/ui';
  import LineChart from '../shared/LineChart.svelte';
  import PieChart from '../shared/PieChart.svelte';
  import DataTable from '../shared/DataTable.svelte';

  // Stores
  const reputation = reputationService.getUserReputation();
  const rules = reputationService.getReputationRules();

  // State
  let activeTab = 'overview';
  let selectedBadge: any = null;
  let timeRange = 'year';

  // Computed
  $: nextLevel = $reputation ? getNextLevel($reputation.level) : null;
  $: progressToNextLevel = $reputation && nextLevel
    ? ($reputation.points - $reputation.level.minPoints) /
      (nextLevel.minPoints - $reputation.level.minPoints)
    : 0;

  function getNextLevel(currentLevel: any) {
    const allLevels = Array.from(reputationService['levels'].values());
    const currentIndex = allLevels.findIndex(l => l.id === currentLevel.id);
    return currentIndex < allLevels.length - 1 ? allLevels[currentIndex + 1] : null;
  }

  function getBadgeTierColor(tier: string): string {
    switch (tier) {
      case 'bronze': return 'text-orange-700 bg-orange-700/10';
      case 'silver': return 'text-gray-400 bg-gray-400/10';
      case 'gold': return 'text-yellow-500 bg-yellow-500/10';
      case 'platinum': return 'text-blue-400 bg-blue-400/10';
      default: return 'text-gray-500 bg-gray-500/10';
    }
  }

  function formatNumber(num: number): string {
    return new Intl.NumberFormat('en-US', {
      notation: 'compact',
      maximumFractionDigits: 1
    }).format(num);
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

  function formatPercentage(num: number): string {
    return `${(num * 100).toFixed(1)}%`;
  }
</script>

<div class="space-y-6">
  {#if $reputation}
    <!-- Header -->
    <div class="flex items-start justify-between">
      <div>
        <h2 class="text-2xl font-semibold">Reputation Profile</h2>
        <div class="flex items-center gap-2 mt-2">
          <Badge class="text-primary bg-primary/10">
            Level {$reputation.level.name}
          </Badge>
          <span class="text-muted-foreground">
            {formatNumber($reputation.points)} points
          </span>
        </div>
      </div>
      <div class="text-right">
        <div class="text-sm text-muted-foreground">
          Total Earned: {formatNumber($reputation.stats.totalEarned)}
        </div>
        <div class="text-sm text-muted-foreground">
          Total Spent: {formatNumber($reputation.stats.totalSpent)}
        </div>
      </div>
    </div>

    <!-- Level Progress -->
    {#if nextLevel}
      <Card class="p-6">
        <div class="flex items-center justify-between mb-4">
          <div>
            <div class="text-sm text-muted-foreground">Current Level</div>
            <div class="font-medium">{$reputation.level.name}</div>
          </div>
          <div class="text-right">
            <div class="text-sm text-muted-foreground">Next Level</div>
            <div class="font-medium">{nextLevel.name}</div>
          </div>
        </div>

        <div class="relative h-2 bg-muted rounded-full overflow-hidden">
          <div
            class="absolute inset-y-0 left-0 bg-primary transition-all duration-500"
            style="width: {progressToNextLevel * 100}%"
          ></div>
        </div>

        <div class="flex items-center justify-between mt-2 text-sm">
          <div class="text-muted-foreground">
            {formatNumber($reputation.points - $reputation.level.minPoints)} points earned
          </div>
          <div class="text-muted-foreground">
            {formatNumber(nextLevel.minPoints - $reputation.points)} points needed
          </div>
        </div>
      </Card>
    {/if}

    <!-- Tabs -->
    <Tabs bind:active={activeTab}>
      <Tab id="overview" title="Overview">
        <div class="space-y-6">
          <!-- Level Benefits -->
          <Card class="p-6">
            <h3 class="text-lg font-medium mb-4">Level Benefits</h3>
            <div class="space-y-2">
              {#each $reputation.level.benefits as benefit}
                <div class="flex items-center gap-2">
                  <i class="fas fa-check text-green-500" />
                  <span>{benefit}</span>
                </div>
              {/each}
            </div>
          </Card>

          <!-- Reputation Chart -->
          <Card class="p-6">
            <h3 class="text-lg font-medium mb-4">Reputation History</h3>
            <div class="flex items-center justify-end gap-4 mb-4">
              <select
                bind:value={timeRange}
                class="bg-background border border-border rounded-lg px-3 py-1.5"
              >
                <option value="month">Last 30 Days</option>
                <option value="year">Last 12 Months</option>
              </select>
            </div>
            <LineChart
              data={$reputation.stats.byPeriod.map(period => ({
                date: period.period,
                earned: period.earned,
                spent: period.spent,
                net: period.earned - period.spent
              }))}
              height={300}
            />
          </Card>

          <!-- Distribution -->
          <div class="grid grid-cols-2 gap-6">
            <Card class="p-6">
              <h3 class="text-lg font-medium mb-4">Reputation Sources</h3>
              <PieChart
                data={Object.entries($reputation.stats.byType)
                  .filter(([_, value]) => value > 0)
                  .map(([type, value]) => ({
                    label: type,
                    value
                  }))}
                height={250}
              />
            </Card>

            <Card class="p-6">
              <h3 class="text-lg font-medium mb-4">Reputation Rules</h3>
              <div class="space-y-4">
                {#each Object.entries(rules) as [category, actions]}
                  <div>
                    <h4 class="font-medium capitalize mb-2">{category}</h4>
                    <div class="space-y-1">
                      {#each Object.entries(actions) as [action, points]}
                        <div class="flex items-center justify-between text-sm">
                          <span class="capitalize">{action}</span>
                          <span class={points > 0 ? 'text-green-500' : 'text-red-500'}>
                            {points > 0 ? '+' : ''}{points}
                          </span>
                        </div>
                      {/each}
                    </div>
                  </div>
                {/each}
              </div>
            </Card>
          </div>
        </div>
      </Tab>

      <Tab id="badges" title="Badges">
        <div class="space-y-6">
          <!-- Badge Grid -->
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {#each $reputation.badges as badge (badge.id)}
              <button
                class="p-4 bg-card border border-border rounded-lg hover:border-primary/50 transition-colors text-left"
                class:border-primary={selectedBadge?.id === badge.id}
                on:click={() => selectedBadge = badge}
              >
                <div class="flex items-center gap-2 mb-2">
                  <img
                    src={badge.icon}
                    alt={badge.name}
                    class="w-8 h-8"
                  />
                  <Badge class={getBadgeTierColor(badge.tier)}>
                    {badge.tier}
                  </Badge>
                </div>
                <h4 class="font-medium">{badge.name}</h4>
                <p class="text-sm text-muted-foreground mt-1">
                  {badge.description}
                </p>
              </button>
            {/each}
          </div>

          <!-- Badge Details -->
          {#if selectedBadge}
            <Card class="p-6">
              <div class="flex items-start justify-between">
                <div class="flex items-center gap-4">
                  <img
                    src={selectedBadge.icon}
                    alt={selectedBadge.name}
                    class="w-12 h-12"
                  />
                  <div>
                    <h3 class="text-lg font-medium">{selectedBadge.name}</h3>
                    <p class="text-muted-foreground mt-1">
                      {selectedBadge.description}
                    </p>
                  </div>
                </div>
                <Badge class={getBadgeTierColor(selectedBadge.tier)}>
                  {selectedBadge.tier}
                </Badge>
              </div>

              <div class="mt-6">
                <h4 class="font-medium mb-2">Requirements</h4>
                <div class="space-y-2">
                  {#each selectedBadge.requirements as req}
                    <div class="flex items-center justify-between">
                      <span class="capitalize">{req.type}</span>
                      <span>{formatNumber(req.threshold)}</span>
                    </div>
                  {/each}
                </div>
              </div>
            </Card>
          {/if}
        </div>
      </Tab>

      <Tab id="history" title="History">
        <Card class="p-6">
          <DataTable
            data={$reputation.history}
            columns={[
              { key: 'type', label: 'Type', format: (value) => value.charAt(0).toUpperCase() + value.slice(1) },
              { key: 'amount', label: 'Points', format: (value) => value > 0 ? `+${value}` : value },
              { key: 'reason', label: 'Reason' },
              { key: 'createdAt', label: 'Date', format: formatDate }
            ]}
          />
        </Card>
      </Tab>
    </Tabs>
  {:else}
    <div class="p-8 text-center text-muted-foreground">
      Loading reputation profile...
    </div>
  {/if}
</div>

<style>
  /* Add any component-specific styles here */
</style> 