import { GrafanaConfig } from '../types/monitoring';

export const serviceHealthDashboard: GrafanaConfig = {
  title: 'Service Health & Dependencies',
  refresh: '10s',
  panels: [
    {
      title: 'Service Dependency Map',
      type: 'nodeGraph',
      datasource: 'Prometheus',
      targets: [
        {
          expr: 'service_dependency_health',
          legendFormat: '{{service}} -> {{dependency}}'
        }
      ],
      options: {
        nodes: {
          mainStatUnit: 'ms',
          secondaryStatUnit: 'rps',
          arcs: [
            { color: 'green', weight: 'success_rate' },
            { color: 'red', weight: 'error_rate' }
          ]
        }
      }
    },
    {
      title: 'Circuit Breaker Status',
      type: 'status-history',
      datasource: 'Prometheus',
      targets: [
        {
          expr: 'circuit_breaker_status',
          legendFormat: '{{service}}'
        }
      ],
      fieldConfig: {
        defaults: {
          color: {
            mode: 'thresholds'
          },
          thresholds: {
            steps: [
              { value: 0, color: 'red' },
              { value: 0.5, color: 'yellow' },
              { value: 1, color: 'green' }
            ]
          }
        }
      }
    }
  ]
}; 