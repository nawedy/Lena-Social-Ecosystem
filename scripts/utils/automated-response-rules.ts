export interface AutomatedResponseRule {
  id: string;
  name: string;
  description: string;
  conditions: Condition[];
  actions: Action[];
  priority: number;
  cooldown: number; // seconds
  maxRetries: number;
  requiredApprovals?: number;
}

export const automatedResponseRules: AutomatedResponseRule[] = [
  {
    id: 'ddos-mitigation',
    name: 'DDoS Attack Mitigation',
    description: 'Automatically mitigate DDoS attacks',
    conditions: [
      {
        type: 'metric',
        metric: 'requests_per_second',
        operator: 'gt',
        threshold: 10000,
        duration: '1m'
      },
      {
        type: 'metric',
        metric: 'error_rate',
        operator: 'gt',
        threshold: 0.3,
        duration: '1m'
      }
    ],
    actions: [
      {
        type: 'enable_ddos_protection',
        params: {
          mode: 'aggressive',
          duration: '1h'
        }
      },
      {
        type: 'scale_up',
        params: {
          service: 'edge-proxy',
          replicas: 5,
          resources: {
            cpu: '2',
            memory: '4Gi'
          }
        }
      }
    ],
    priority: 1,
    cooldown: 3600,
    maxRetries: 3
  },
  {
    id: 'data-breach-response',
    name: 'Data Breach Response',
    description: 'Immediate response to potential data breaches',
    conditions: [
      {
        type: 'log_pattern',
        pattern: 'sensitive_data_access',
        threshold: 10,
        duration: '5m'
      },
      {
        type: 'anomaly',
        metric: 'data_access_pattern',
        sensitivity: 'high'
      }
    ],
    actions: [
      {
        type: 'block_suspicious_ips',
        params: {
          duration: '24h',
          mode: 'strict'
        }
      },
      {
        type: 'rotate_credentials',
        params: {
          scope: ['api_keys', 'service_accounts'],
          emergency: true
        }
      },
      {
        type: 'notify_authorities',
        params: {
          channels: ['security_team', 'legal_team', 'management'],
          priority: 'critical'
        }
      }
    ],
    priority: 1,
    cooldown: 86400,
    maxRetries: 1,
    requiredApprovals: 2
  }
]; 