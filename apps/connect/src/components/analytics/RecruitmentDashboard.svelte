<!-- RecruitmentDashboard.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { recruitmentService } from '@tiktok/shared/services/recruitment/RecruitmentService';
  import MetricsCard from '../shared/MetricsCard.svelte';
  import LineChart from '../shared/LineChart.svelte';
  import BarChart from '../shared/BarChart.svelte';
  import PieChart from '../shared/PieChart.svelte';
  import DataTable from '../shared/DataTable.svelte';

  // Props
  export let companyId: string;
  export let timeRange: 'day' | 'week' | 'month' | 'year' = 'month';

  // State
  let loading = true;
  let error: string | null = null;
  let metrics = {
    activeJobs: 0,
    totalApplications: 0,
    interviewRate: 0,
    offerRate: 0,
    acceptanceRate: 0,
    averageTimeToHire: 0,
    costPerHire: 0
  };

  let applicationTrends: Array<{
    date: string;
    applications: number;
    interviews: number;
    offers: number;
  }> = [];

  let jobPerformance: Array<{
    jobId: string;
    title: string;
    applications: number;
    views: number;
    interviewRate: number;
    offerRate: number;
  }> = [];

  let sourcingChannels: Array<{
    name: string;
    applications: number;
    hires: number;
    conversionRate: number;
  }> = [];

  let skillDistribution: Array<{
    skill: string;
    count: number;
    demandScore: number;
  }> = [];

  onMount(async () => {
    try {
      await loadDashboardData();
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  });

  async function loadDashboardData() {
    // Load overview metrics
    const [
      activeJobsCount,
      applicationsData,
      hiringData
    ] = await Promise.all([
      fetchActiveJobsCount(),
      fetchApplicationsData(),
      fetchHiringData()
    ]);

    metrics = {
      activeJobs: activeJobsCount,
      totalApplications: applicationsData.total,
      interviewRate: applicationsData.interviewRate,
      offerRate: hiringData.offerRate,
      acceptanceRate: hiringData.acceptanceRate,
      averageTimeToHire: hiringData.averageTimeToHire,
      costPerHire: hiringData.costPerHire
    };

    // Load trend data
    applicationTrends = await fetchApplicationTrends();

    // Load job performance data
    jobPerformance = await fetchJobPerformance();

    // Load sourcing channel data
    sourcingChannels = await fetchSourcingChannels();

    // Load skill distribution data
    skillDistribution = await fetchSkillDistribution();
  }

  async function fetchActiveJobsCount(): Promise<number> {
    const { data, error } = await supabase
      .from('job_listings')
      .select('id')
      .eq('company_id', companyId)
      .eq('status', 'published');

    if (error) throw error;
    return data.length;
  }

  async function fetchApplicationsData(): Promise<{
    total: number;
    interviewRate: number;
  }> {
    const { data, error } = await supabase
      .from('job_applications')
      .select(`
        id,
        status,
        job_id,
        job_listings!inner(company_id)
      `)
      .eq('job_listings.company_id', companyId);

    if (error) throw error;

    const total = data.length;
    const interviews = data.filter(app => 
      ['interviewing', 'offered', 'accepted'].includes(app.status)
    ).length;

    return {
      total,
      interviewRate: total > 0 ? interviews / total : 0
    };
  }

  async function fetchHiringData(): Promise<{
    offerRate: number;
    acceptanceRate: number;
    averageTimeToHire: number;
    costPerHire: number;
  }> {
    const { data, error } = await supabase
      .from('job_applications')
      .select(`
        id,
        status,
        created_at,
        updated_at,
        job_id,
        job_listings!inner(company_id)
      `)
      .eq('job_listings.company_id', companyId)
      .in('status', ['interviewing', 'offered', 'accepted', 'rejected']);

    if (error) throw error;

    const interviews = data.filter(app => 
      ['interviewing', 'offered', 'accepted', 'rejected'].includes(app.status)
    ).length;

    const offers = data.filter(app => 
      ['offered', 'accepted'].includes(app.status)
    ).length;

    const acceptances = data.filter(app => 
      app.status === 'accepted'
    ).length;

    const timeToHire = data
      .filter(app => app.status === 'accepted')
      .map(app => 
        new Date(app.updated_at).getTime() - new Date(app.created_at).getTime()
      );

    return {
      offerRate: interviews > 0 ? offers / interviews : 0,
      acceptanceRate: offers > 0 ? acceptances / offers : 0,
      averageTimeToHire: timeToHire.length > 0 
        ? timeToHire.reduce((a, b) => a + b, 0) / timeToHire.length / (1000 * 60 * 60 * 24) // Convert to days
        : 0,
      costPerHire: 1000 // TODO: Implement actual cost calculation
    };
  }

  async function fetchApplicationTrends(): Promise<typeof applicationTrends> {
    const { data, error } = await supabase
      .from('job_applications')
      .select(`
        id,
        status,
        created_at,
        job_id,
        job_listings!inner(company_id)
      `)
      .eq('job_listings.company_id', companyId)
      .gte('created_at', getStartDate())
      .order('created_at');

    if (error) throw error;

    // Group by date
    const trends = new Map<string, {
      applications: number;
      interviews: number;
      offers: number;
    }>();

    data.forEach(app => {
      const date = new Date(app.created_at).toISOString().split('T')[0];
      const current = trends.get(date) || {
        applications: 0,
        interviews: 0,
        offers: 0
      };

      current.applications++;
      if (['interviewing', 'offered', 'accepted'].includes(app.status)) {
        current.interviews++;
      }
      if (['offered', 'accepted'].includes(app.status)) {
        current.offers++;
      }

      trends.set(date, current);
    });

    return Array.from(trends.entries()).map(([date, stats]) => ({
      date,
      ...stats
    }));
  }

  async function fetchJobPerformance(): Promise<typeof jobPerformance> {
    const { data, error } = await supabase
      .from('job_listings')
      .select(`
        id,
        title,
        job_applications (
          id,
          status
        )
      `)
      .eq('company_id', companyId)
      .eq('status', 'published');

    if (error) throw error;

    return data.map(job => {
      const applications = job.job_applications.length;
      const interviews = job.job_applications.filter(app =>
        ['interviewing', 'offered', 'accepted'].includes(app.status)
      ).length;
      const offers = job.job_applications.filter(app =>
        ['offered', 'accepted'].includes(app.status)
      ).length;

      return {
        jobId: job.id,
        title: job.title,
        applications,
        views: 0, // TODO: Implement view tracking
        interviewRate: applications > 0 ? interviews / applications : 0,
        offerRate: interviews > 0 ? offers / interviews : 0
      };
    });
  }

  async function fetchSourcingChannels(): Promise<typeof sourcingChannels> {
    // TODO: Implement actual sourcing channel tracking
    return [
      {
        name: 'Direct',
        applications: 150,
        hires: 12,
        conversionRate: 0.08
      },
      {
        name: 'LinkedIn',
        applications: 300,
        hires: 20,
        conversionRate: 0.067
      },
      {
        name: 'Referrals',
        applications: 80,
        hires: 15,
        conversionRate: 0.188
      },
      {
        name: 'Job Boards',
        applications: 450,
        hires: 25,
        conversionRate: 0.056
      }
    ];
  }

  async function fetchSkillDistribution(): Promise<typeof skillDistribution> {
    const { data, error } = await supabase
      .from('job_listings')
      .select('skills')
      .eq('company_id', companyId)
      .eq('status', 'published');

    if (error) throw error;

    const skillCounts = new Map<string, number>();
    data.forEach(job => {
      job.skills.forEach(skill => {
        skillCounts.set(skill, (skillCounts.get(skill) || 0) + 1);
      });
    });

    return Array.from(skillCounts.entries())
      .map(([skill, count]) => ({
        skill,
        count,
        demandScore: Math.random() // TODO: Implement actual demand scoring
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  function getStartDate(): string {
    const date = new Date();
    switch (timeRange) {
      case 'day':
        date.setDate(date.getDate() - 1);
        break;
      case 'week':
        date.setDate(date.getDate() - 7);
        break;
      case 'month':
        date.setMonth(date.getMonth() - 1);
        break;
      case 'year':
        date.setFullYear(date.getFullYear() - 1);
        break;
    }
    return date.toISOString();
  }
</script>

<div class="recruitment-dashboard">
  {#if loading}
    <div class="loading" transition:fade>Loading dashboard data...</div>
  {:else if error}
    <div class="error" transition:fade>{error}</div>
  {:else}
    <div class="metrics-grid" transition:fade>
      <MetricsCard
        title="Active Jobs"
        value={metrics.activeJobs}
        icon="briefcase"
      />
      <MetricsCard
        title="Total Applications"
        value={metrics.totalApplications}
        icon="users"
      />
      <MetricsCard
        title="Interview Rate"
        value={metrics.interviewRate}
        format="percent"
        icon="calendar"
      />
      <MetricsCard
        title="Offer Rate"
        value={metrics.offerRate}
        format="percent"
        icon="check-circle"
      />
      <MetricsCard
        title="Acceptance Rate"
        value={metrics.acceptanceRate}
        format="percent"
        icon="thumbs-up"
      />
      <MetricsCard
        title="Time to Hire"
        value={metrics.averageTimeToHire}
        format="days"
        icon="clock"
      />
      <MetricsCard
        title="Cost per Hire"
        value={metrics.costPerHire}
        format="currency"
        icon="dollar-sign"
      />
    </div>

    <div class="charts-grid">
      <div class="chart-card">
        <h3>Application Trends</h3>
        <LineChart
          data={applicationTrends}
          xKey="date"
          series={[
            { key: 'applications', name: 'Applications' },
            { key: 'interviews', name: 'Interviews' },
            { key: 'offers', name: 'Offers' }
          ]}
        />
      </div>

      <div class="chart-card">
        <h3>Sourcing Channels</h3>
        <PieChart
          data={sourcingChannels}
          valueKey="applications"
          labelKey="name"
        />
      </div>

      <div class="chart-card">
        <h3>Top Skills in Demand</h3>
        <BarChart
          data={skillDistribution}
          xKey="skill"
          yKey="count"
          colorKey="demandScore"
        />
      </div>
    </div>

    <div class="table-section">
      <h3>Job Performance</h3>
      <DataTable
        data={jobPerformance}
        columns={[
          { key: 'title', label: 'Job Title' },
          { key: 'applications', label: 'Applications' },
          { key: 'views', label: 'Views' },
          { 
            key: 'interviewRate',
            label: 'Interview Rate',
            format: 'percent'
          },
          {
            key: 'offerRate',
            label: 'Offer Rate',
            format: 'percent'
          }
        ]}
      />
    </div>
  {/if}
</div>

<style lang="postcss">
  .recruitment-dashboard {
    padding: 24px;
    background: var(--surface-1);
    border-radius: 8px;
  }

  .loading,
  .error {
    text-align: center;
    padding: 40px;
    color: var(--text-2);
  }

  .error {
    color: var(--error);
  }

  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
    margin-bottom: 24px;
  }

  .charts-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
    gap: 24px;
    margin-bottom: 24px;
  }

  .chart-card {
    background: var(--surface-2);
    border-radius: 8px;
    padding: 16px;

    h3 {
      margin: 0 0 16px;
      font-size: 18px;
      font-weight: 600;
      color: var(--text-1);
    }
  }

  .table-section {
    background: var(--surface-2);
    border-radius: 8px;
    padding: 16px;

    h3 {
      margin: 0 0 16px;
      font-size: 18px;
      font-weight: 600;
      color: var(--text-1);
    }
  }

  @media (max-width: 768px) {
    .recruitment-dashboard {
      padding: 16px;
    }

    .charts-grid {
      grid-template-columns: 1fr;
    }
  }
</style> 