import { GrafanaConfig } from '../types/monitoring';

export const realTimeSecurityDashboard: GrafanaConfig = {
  title: 'Real-Time Security Monitoring',
  refresh: '5s',
  panels: [
    {
      title: 'Active Security Threats',
      type: 'stat-timeline',
      datasource: 'Prometheus',
      targets: [
        {
          expr: 'sum(security_threats_active) by (severity, type)',
          legendFormat: '{{severity}} - {{type}}'
        }
      ],
      thresholds: {
        steps: [
          { value: 0, color: 'green' },
          { value: 3, color: 'yellow' },
          { value: 5, color: 'orange' },
          { value: 10, color: 'red' }
        ]
      },
      alert: {
        name: 'High Threat Level',
        conditions: [
          {
            evaluator: { type: 'gt', params: [5] },
            operator: { type: 'and' },
            query: { params: ['A', '5m', 'now'] }
          }
        ],
        notifications: ['security-team', 'incident-response']
      }
    },
    {
      title: 'Authentication Patterns',
      type: 'heatmap',
      datasource: 'Prometheus',
      targets: [
        {
          expr: 'sum(rate(auth_attempts_total[1m])) by (status, source_ip)',
          format: 'heatmap'
        }
      ],
      options: {
        calculate: true,
        calculation: 'delta'
      }
    },
    {
      title: 'Suspicious Activities',
      type: 'timeseries',
      datasource: 'Elasticsearch',
      targets: [
        {
          query: `
            source = "security-logs" AND
            (
              severity IN ["high", "critical"] OR
              event_type IN ["brute_force", "sql_injection", "xss"]
            )
          `,
          metrics: [
            { type: 'count', id: 'suspicious_activities' }
          ],
          bucketAggs: [
            {
              type: 'date_histogram',
              field: '@timestamp',
              settings: { interval: 'auto' }
            }
          ]
        }
      ]
    }
  ],
  annotations: {
    list: [
      {
        name: 'Deployments',
        datasource: 'Prometheus',
        expr: 'changes(deployment_status{status="completed"}[5m])',
        iconColor: '#096',
        enable: true
      },
      {
        name: 'Security Patches',
        datasource: 'Prometheus',
        expr: 'security_patch_applied',
        iconColor: '#F00',
        enable: true
      }
    ]
  },
  templating: {
    list: [
      {
        name: 'environment',
        type: 'query',
        datasource: 'Prometheus',
        query: 'label_values(environment)'
      },
      {
        name: 'severity',
        type: 'custom',
        options: [
          { text: 'All', value: '.*' },
          { text: 'Critical', value: 'critical' },
          { text: 'High', value: 'high' },
          { text: 'Medium', value: 'medium' }
        ]
      }
    ]
  }
}; 