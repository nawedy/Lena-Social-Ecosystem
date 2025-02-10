import { GrafanaConfig } from '../types/monitoring';

export const performanceDashboard: GrafanaConfig = {
  title: 'Performance Monitoring',
  refresh: '10s',
  panels: [
    {
      title: 'Service Latency Distribution',
      type: 'heatmap',
      datasource: 'Prometheus',
      targets: [
        {
          expr: 'rate(http_request_duration_seconds_bucket[5m])',
          format: 'heatmap'
        }
      ]
    },
    {
      title: 'Database Performance',
      type: 'timeseries',
      datasource: 'Prometheus',
      targets: [
        {
          expr: 'rate(database_query_duration_seconds_sum[5m])',
          legendFormat: 'Query Duration'
        },
        {
          expr: 'rate(database_connections_total[5m])',
          legendFormat: 'Connections'
        }
      ]
    },
    {
      title: 'Cache Hit Ratio',
      type: 'gauge',
      datasource: 'Prometheus',
      targets: [
        {
          expr: 'sum(rate(cache_hits_total[5m])) / sum(rate(cache_requests_total[5m]))',
          legendFormat: 'Hit Ratio'
        }
      ]
    }
  ]
}; 