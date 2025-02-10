export const chaosConfig = {
  experiments: {
    networkFailure: {
      type: 'network',
      actions: [
        {
          type: 'latency',
          target: 'inter-region-traffic',
          duration: '5m',
          latency: '200ms'
        },
        {
          type: 'packet-loss',
          target: 'all-services',
          duration: '2m',
          percentage: 0.1
        }
      ]
    },
    resourceExhaustion: {
      type: 'resources',
      actions: [
        {
          type: 'cpu-pressure',
          target: 'api-services',
          duration: '10m',
          load: 0.8
        },
        {
          type: 'memory-pressure',
          target: 'data-services',
          duration: '5m',
          percentage: 0.9
        }
      ]
    },
    serviceFailure: {
      type: 'service',
      actions: [
        {
          type: 'kill-pods',
          target: 'random-services',
          duration: '15m',
          percentage: 0.3
        },
        {
          type: 'corrupt-data',
          target: 'database',
          duration: '1m',
          percentage: 0.01
        }
      ]
    }
  },
  safetyChecks: {
    maxServiceFailure: 0.5,    // Max 50% services can fail
    maxDataLoss: 0.0001,       // Max 0.01% data loss
    minAvailability: 0.995     // Min 99.5% availability
  }
}; 