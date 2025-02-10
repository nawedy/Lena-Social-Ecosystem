import { LoadTestConfig } from './types';
import { MetricsCollector } from '../utils/metrics-collector';

export const loadTestConfig: LoadTestConfig = {
  scenarios: {
    normalOperation: {
      duration: '30m',
      rampUp: '5m',
      targetRPS: 1000,
      distribution: {
        'api-requests': 0.7,
        'data-sync': 0.2,
        'system-checks': 0.1
      }
    },
    peakLoad: {
      duration: '15m',
      rampUp: '2m',
      targetRPS: 5000,
      distribution: {
        'api-requests': 0.8,
        'data-sync': 0.15,
        'system-checks': 0.05
      }
    },
    sustainedHeavyLoad: {
      duration: '2h',
      rampUp: '15m',
      targetRPS: 3000,
      distribution: {
        'api-requests': 0.75,
        'data-sync': 0.2,
        'system-checks': 0.05
      }
    }
  },
  thresholds: {
    latency: {
      p95: 200, // ms
      p99: 500  // ms
    },
    errorRate: {
      max: 0.01 // 1%
    },
    resourceUtilization: {
      cpu: 0.8,    // 80%
      memory: 0.75 // 75%
    }
  }
}; 