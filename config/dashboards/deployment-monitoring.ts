import { GrafanaConfig } from '../types/monitoring';

export const deploymentDashboard: GrafanaConfig = {
  title: 'Deployment Monitoring',
  refresh: '30s',
  panels: [
    {
      title: 'Deployment Status',
      type: 'stat',
      datasource: 'Prometheus',
      targets: [
        {
          expr: 'deployment_status{environment="$environment"}',
          legendFormat: '{{status}}'
        }
      ]
    },
    {
      title: 'Service Health',
      type: 'gauge',
      datasource: 'Prometheus',
      targets: [
        {
          expr: 'avg(service_health_status{environment="$environment"})',
          legendFormat: 'Health Score'
        }
      ]
    },
    {
      title: 'Error Rates',
      type: 'timeseries',
      datasource: 'Prometheus',
      targets: [
        {
          expr: 'rate(http_requests_total{status=~"5.."}[5m])',
          legendFormat: '{{service}} errors'
        }
      ]
    },
    {
      title: 'Resource Usage',
      type: 'timeseries',
      datasource: 'Prometheus',
      targets: [
        {
          expr: 'container_memory_usage_bytes{container!=""}',
          legendFormat: '{{container}} memory'
        },
        {
          expr: 'rate(container_cpu_usage_seconds_total{container!=""}[5m])',
          legendFormat: '{{container}} CPU'
        }
      ]
    }
  ],
  variables: [
    {
      name: 'environment',
      type: 'custom',
      options: ['development', 'staging', 'production']
    }
  ],
  alerts: [
    {
      name: 'High Error Rate',
      expr: 'rate(http_requests_total{status=~"5.."}[5m]) > 0.05',
      for: '5m',
      severity: 'critical'
    },
    {
      name: 'Deployment Failed',
      expr: 'deployment_status{status="failed"} == 1',
      for: '1m',
      severity: 'critical'
    }
  ]
}; 