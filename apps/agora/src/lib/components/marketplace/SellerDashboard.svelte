<!-- SellerDashboard.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { Button, Input, Select, Alert } from '$lib/components/ui';
  import { supabase } from '$lib/supabaseClient';
  import { user } from '$lib/stores/auth';
  import { Chart } from 'chart.js/auto';
  import { formatCurrency } from '$lib/utils/currency';
  import { formatDate } from '$lib/utils/date';

  let loading = false;
  let error: string | null = null;
  let timeRange: '24h' | '7d' | '30d' | 'all' = '7d';
  let selectedMetric: 'revenue' | 'orders' | 'views' = 'revenue';
  let selectedProduct: string | null = null;
  let products: any[] = [];
  let metrics = {
    totalRevenue: 0,
    totalOrders: 0,
    averageOrderValue: 0,
    conversionRate: 0,
    viewCount: 0,
    disputeRate: 0
  };
  let recentOrders: any[] = [];
  let topProducts: any[] = [];
  let chartInstance: Chart | null = null;
  let chartData: any = null;

  onMount(async () => {
    await Promise.all([
      loadProducts(),
      loadMetrics(),
      loadRecentOrders(),
      loadTopProducts()
    ]);
    setupRealtimeSubscription();
    initChart();
  });

  function setupRealtimeSubscription() {
    const channel = supabase
      .channel('seller_dashboard')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'marketplace_orders',
          filter: `seller_id=eq.${$user?.id}`
        },
        () => {
          // Refresh data on order updates
          loadMetrics();
          loadRecentOrders();
          loadTopProducts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }

  async function loadProducts() {
    try {
      const { data, error: fetchError } = await supabase
        .from('marketplace_products')
        .select('*')
        .eq('seller_id', $user?.id)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      products = data || [];
    } catch (e) {
      console.error('Error loading products:', e);
    }
  }

  async function loadMetrics() {
    try {
      loading = true;
      error = null;

      const startDate = getStartDate();

      // Load orders
      const { data: orders, error: ordersError } = await supabase
        .from('marketplace_orders')
        .select(`
          *,
          product:product_id (*)
        `)
        .eq('seller_id', $user?.id)
        .gte('created_at', startDate.toISOString());

      if (ordersError) throw ordersError;

      // Calculate metrics
      const completedOrders = orders?.filter(o => o.status === 'completed') || [];
      const totalRevenue = completedOrders.reduce((sum, order) => 
        sum + (order.unit_price * order.quantity), 0
      );
      const totalOrders = completedOrders.length;
      const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

      // Load views
      const { count: viewCount } = await supabase
        .from('product_views')
        .select('*', { count: 'exact' })
        .in(
          'product_id',
          products.map(p => p.id)
        )
        .gte('created_at', startDate.toISOString());

      // Calculate conversion rate
      const conversionRate = viewCount ? (totalOrders / viewCount) * 100 : 0;

      // Load disputes
      const { count: disputeCount } = await supabase
        .from('marketplace_disputes')
        .select('*', { count: 'exact' })
        .in(
          'order_id',
          orders?.map(o => o.id) || []
        );

      const disputeRate = totalOrders ? (disputeCount / totalOrders) * 100 : 0;

      metrics = {
        totalRevenue,
        totalOrders,
        averageOrderValue,
        conversionRate,
        viewCount: viewCount || 0,
        disputeRate
      };

      // Update chart data
      updateChartData(orders || []);
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  async function loadRecentOrders() {
    try {
      const { data, error: ordersError } = await supabase
        .from('marketplace_orders')
        .select(`
          *,
          product:product_id (*),
          buyer:buyer_id (*)
        `)
        .eq('seller_id', $user?.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (ordersError) throw ordersError;
      recentOrders = data || [];
    } catch (e) {
      console.error('Error loading recent orders:', e);
    }
  }

  async function loadTopProducts() {
    try {
      const { data, error: productsError } = await supabase
        .from('marketplace_products')
        .select(`
          *,
          metrics:product_metrics (
            orders_count,
            revenue,
            views_count
          )
        `)
        .eq('seller_id', $user?.id)
        .order('metrics(revenue)', { ascending: false })
        .limit(5);

      if (productsError) throw productsError;
      topProducts = data || [];
    } catch (e) {
      console.error('Error loading top products:', e);
    }
  }

  function getStartDate(): Date {
    const now = new Date();
    switch (timeRange) {
      case '24h':
        return new Date(now.setHours(now.getHours() - 24));
      case '7d':
        return new Date(now.setDate(now.getDate() - 7));
      case '30d':
        return new Date(now.setDate(now.getDate() - 30));
      default:
        return new Date(0); // Beginning of time
    }
  }

  function initChart() {
    const ctx = document.getElementById('metrics-chart') as HTMLCanvasElement;
    if (!ctx) return;

    chartInstance = new Chart(ctx, {
      type: 'line',
      data: chartData || {
        labels: [],
        datasets: []
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true
          }
        }
      }
    });
  }

  function updateChartData(orders: any[]) {
    if (!chartInstance) return;

    const dates = getDatesInRange(getStartDate(), new Date());
    const data = dates.map(date => {
      const dayOrders = orders.filter(order => 
        new Date(order.created_at).toDateString() === date.toDateString()
      );

      switch (selectedMetric) {
        case 'revenue':
          return dayOrders.reduce((sum, order) => 
            sum + (order.unit_price * order.quantity), 0
          );
        case 'orders':
          return dayOrders.length;
        case 'views':
          // This would need to be updated with actual view data
          return 0;
      }
    });

    chartData = {
      labels: dates.map(date => formatDate(date, 'short')),
      datasets: [{
        label: selectedMetric.charAt(0).toUpperCase() + selectedMetric.slice(1),
        data,
        borderColor: '#10B981',
        tension: 0.4
      }]
    };

    chartInstance.data = chartData;
    chartInstance.update();
  }

  function getDatesInRange(start: Date, end: Date): Date[] {
    const dates = [];
    let current = new Date(start);

    while (current <= end) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    return dates;
  }

  $: {
    if (timeRange || selectedMetric) {
      loadMetrics();
    }
  }
</script>

<div class="space-y-6">
  <!-- Header -->
  <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
    <h2 class="text-2xl font-bold">Seller Dashboard</h2>

    <div class="flex items-center space-x-4">
      <Select
        options={[
          { value: '24h', label: 'Last 24 Hours' },
          { value: '7d', label: 'Last 7 Days' },
          { value: '30d', label: 'Last 30 Days' },
          { value: 'all', label: 'All Time' }
        ]}
        bind:value={timeRange}
        class="w-40"
      />

      <Select
        options={[
          { value: 'revenue', label: 'Revenue' },
          { value: 'orders', label: 'Orders' },
          { value: 'views', label: 'Views' }
        ]}
        bind:value={selectedMetric}
        class="w-40"
      />
    </div>
  </div>

  {#if error}
    <Alert type="error" message={error} />
  {/if}

  <!-- Metrics Overview -->
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <div class="text-sm text-gray-500 dark:text-gray-400">Total Revenue</div>
      <div class="text-2xl font-bold mt-2">
        {formatCurrency(metrics.totalRevenue)}
      </div>
      <div class="text-sm text-gray-500 dark:text-gray-400 mt-2">
        from {metrics.totalOrders} orders
      </div>
    </div>

    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <div class="text-sm text-gray-500 dark:text-gray-400">Average Order Value</div>
      <div class="text-2xl font-bold mt-2">
        {formatCurrency(metrics.averageOrderValue)}
      </div>
      <div class="text-sm text-gray-500 dark:text-gray-400 mt-2">
        {metrics.viewCount} total views
      </div>
    </div>

    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <div class="text-sm text-gray-500 dark:text-gray-400">Conversion Rate</div>
      <div class="text-2xl font-bold mt-2">
        {metrics.conversionRate.toFixed(2)}%
      </div>
      <div class="text-sm text-gray-500 dark:text-gray-400 mt-2">
        {metrics.disputeRate.toFixed(2)}% dispute rate
      </div>
    </div>
  </div>

  <!-- Chart -->
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
    <canvas id="metrics-chart" height="300"></canvas>
  </div>

  <!-- Recent Orders & Top Products -->
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <!-- Recent Orders -->
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <h3 class="text-lg font-medium mb-4">Recent Orders</h3>

      <div class="space-y-4">
        {#each recentOrders as order}
          <div class="flex items-start justify-between">
            <div>
              <div class="font-medium">{order.product.title}</div>
              <div class="text-sm text-gray-500">
                by {order.buyer.name} • {formatDate(order.created_at)}
              </div>
            </div>
            <div class="text-right">
              <div class="font-medium">
                {formatCurrency(order.unit_price * order.quantity)}
              </div>
              <div class="text-sm">
                {order.status}
              </div>
            </div>
          </div>
        {/each}
      </div>
    </div>

    <!-- Top Products -->
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <h3 class="text-lg font-medium mb-4">Top Products</h3>

      <div class="space-y-4">
        {#each topProducts as product}
          <div class="flex items-start justify-between">
            <div>
              <div class="font-medium">{product.title}</div>
              <div class="text-sm text-gray-500">
                {product.metrics.orders_count} orders • {product.metrics.views_count} views
              </div>
            </div>
            <div class="text-right">
              <div class="font-medium">
                {formatCurrency(product.metrics.revenue)}
              </div>
              <div class="text-sm">
                revenue
              </div>
            </div>
          </div>
        {/each}
      </div>
    </div>
  </div>
</div>

<style>
  /* Add any component-specific styles here */
</style> 