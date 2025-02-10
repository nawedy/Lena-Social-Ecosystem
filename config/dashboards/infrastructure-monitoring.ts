import { GrafanaConfig } from '../types/monitoring';

export const infrastructureDashboard: GrafanaConfig = {
  title: 'Infrastructure Health',
  refresh: '30s',
  panels: [
    {
      title: 'Node Health',
      type: 'status-grid',
      datasource: 'Prometheus',
      targets: [
        {
          expr: 'up{job="kubernetes-nodes"}',
          legendFormat: '{{node}}'
        }
      ]
    },
    {
      title: 'Pod Distribution',
      type: 'piechart',
      datasource: 'Prometheus',
      targets: [
        {
          expr: 'count(kube_pod_info) by (node)',
          legendFormat: '{{node}}'
        }
      ]
    },
    {
      title: 'Network Throughput',
      type: 'timeseries',
      datasource: 'Prometheus',
      targets: [
        {
          expr: 'sum(rate(container_network_transmit_bytes_total[5m])) by (node)',
          legendFormat: '{{node}} TX'
        },
        {
          expr: 'sum(rate(container_network_receive_bytes_total[5m])) by (node)',
          legendFormat: '{{node}} RX'
        }
      ]
    }
  ]
}; 