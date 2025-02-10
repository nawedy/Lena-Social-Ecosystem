import { GrafanaConfig } from '../types/monitoring';

export const securityDashboard: GrafanaConfig = {
  title: 'Security Monitoring',
  refresh: '1m',
  panels: [
    {
      title: 'Security Incidents',
      type: 'timeseries',
      datasource: 'Prometheus',
      targets: [
        {
          expr: 'sum(security_incidents_total) by (severity)',
          legendFormat: '{{severity}}'
        }
      ],
      alert: {
        name: 'High Security Incidents',
        conditions: [
          {
            evaluator: { type: 'gt', params: [5] },
            operator: { type: 'and' },
            query: { params: ['A', '5m', 'now'] }
          }
        ],
        notifications: ['security-team']
      }
    },
    {
      title: 'WAF Events',
      type: 'timeseries',
      datasource: 'Prometheus',
      targets: [
        {
          expr: 'sum(rate(waf_events_total[5m])) by (rule)',
          legendFormat: '{{rule}}'
        }
      ]
    },
    {
      title: 'Authentication Failures',
      type: 'timeseries',
      datasource: 'Prometheus',
      targets: [
        {
          expr: 'sum(rate(auth_failures_total[5m])) by (reason)',
          legendFormat: '{{reason}}'
        }
      ]
    },
    {
      title: 'Compliance Status',
      type: 'gauge',
      datasource: 'Prometheus',
      targets: [
        {
          expr: 'compliance_check_score',
          legendFormat: 'Compliance Score'
        }
      ]
    }
  ]
}; 