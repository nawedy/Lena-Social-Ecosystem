import { GrafanaConfig } from '../types/monitoring';

export const apiDashboard: GrafanaConfig = {
  title: 'API Monitoring',
  refresh: '10s',
  panels: [
    {
      title: 'API Response Codes',
      type: 'timeseries',
      datasource: 'Prometheus',
      targets: [
        {
          expr: 'sum(rate(http_requests_total{handler!=""}[5m])) by (status_code)',
          legendFormat: '{{status_code}}'
        }
      ],
      alert: {
        name: 'High Error Rate',
        conditions: [
          {
            evaluator: { type: 'gt', params: [5] },
            operator: { type: 'and' },
            query: { params: ['A', '5m', 'now'] }
          }
        ]
      }
    },
    {
      title: 'API Rate Limiting',
      type: 'timeseries',
      datasource: 'Prometheus',
      targets: [
        {
          expr: 'rate(rate_limit_exceeded_total[5m])',
          legendFormat: 'Rate Limits'
        }
      ]
    },
    {
      title: 'API Authentication',
      type: 'stat-timeline',
      datasource: 'Prometheus',
      targets: [
        {
          expr: 'sum(rate(auth_failures_total[5m])) by (reason)',
          legendFormat: '{{reason}}'
        }
      ]
    }
  ]
}; 