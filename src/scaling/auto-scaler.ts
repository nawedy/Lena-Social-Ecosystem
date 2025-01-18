import { KubernetesService } from '../services/kubernetes';
import { LoggerService } from '../services/logger';
import { MetricsService } from '../services/metrics';
import { APMService } from '../utils/apm';

interface ScalingRule {
  metric: string;
  threshold: number;
  duration: number;
  action: 'scale_up' | 'scale_down';
  cooldown: number;
  minReplicas: number;
  maxReplicas: number;
  scaleIncrement: number;
}

interface ScalingDecision {
  service: string;
  currentReplicas: number;
  targetReplicas: number;
  reason: string;
  metrics: Record<string, number>;
}

export class AutoScaler {
  private apm: APMService;
  private metrics: MetricsService;
  private logger: LoggerService;
  private kubernetes: KubernetesService;

  private scalingRules: Record<string, ScalingRule[]> = {
    api: [
      {
        metric: 'cpu_utilization',
        threshold: 70,
        duration: 300,
        action: 'scale_up',
        cooldown: 300,
        minReplicas: 2,
        maxReplicas: 10,
        scaleIncrement: 1,
      },
      {
        metric: 'memory_utilization',
        threshold: 80,
        duration: 300,
        action: 'scale_up',
        cooldown: 300,
        minReplicas: 2,
        maxReplicas: 10,
        scaleIncrement: 1,
      },
      {
        metric: 'request_rate',
        threshold: 1000,
        duration: 300,
        action: 'scale_up',
        cooldown: 300,
        minReplicas: 2,
        maxReplicas: 10,
        scaleIncrement: 2,
      },
    ],
    worker: [
      {
        metric: 'queue_length',
        threshold: 1000,
        duration: 300,
        action: 'scale_up',
        cooldown: 300,
        minReplicas: 2,
        maxReplicas: 20,
        scaleIncrement: 2,
      },
      {
        metric: 'processing_time',
        threshold: 500,
        duration: 300,
        action: 'scale_up',
        cooldown: 300,
        minReplicas: 2,
        maxReplicas: 20,
        scaleIncrement: 1,
      },
    ],
    cache: [
      {
        metric: 'memory_utilization',
        threshold: 80,
        duration: 300,
        action: 'scale_up',
        cooldown: 600,
        minReplicas: 2,
        maxReplicas: 5,
        scaleIncrement: 1,
      },
      {
        metric: 'connections',
        threshold: 5000,
        duration: 300,
        action: 'scale_up',
        cooldown: 600,
        minReplicas: 2,
        maxReplicas: 5,
        scaleIncrement: 1,
      },
    ],
  };

  private lastScaleTime: Record<string, number> = {};

  constructor(
    apm: APMService,
    metrics: MetricsService,
    logger: LoggerService,
    kubernetes: KubernetesService
  ) {
    this.apm = apm;
    this.metrics = metrics;
    this.logger = logger;
    this.kubernetes = kubernetes;
  }

  public async checkAndScale(): Promise<void> {
    const transaction = this.apm.startTransaction('check-and-scale', 'scaling');

    try {
      // Check scaling for each service
      for (const [service, rules] of Object.entries(this.scalingRules)) {
        await this.checkServiceScaling(service, rules);
      }
    } catch (error) {
      this.logger.error('Auto-scaling check failed', { error });
      this.apm.captureError(error);
    } finally {
      transaction?.end();
    }
  }

  private async checkServiceScaling(service: string, rules: ScalingRule[]): Promise<void> {
    const span = this.apm.startSpan('check-service-scaling');

    try {
      // Get current metrics
      const metrics = await this.collectServiceMetrics(service);

      // Get current deployment info
      const currentReplicas = await this.kubernetes.getReplicas(service);

      // Check if we're in cooldown period
      if (this.isInCooldown(service)) {
        this.logger.info('Service in cooldown period', {
          service,
          lastScaleTime: this.lastScaleTime[service],
        });
        return;
      }

      // Evaluate scaling rules
      const decision = this.evaluateScalingRules(service, rules, metrics, currentReplicas);

      // Apply scaling if needed
      if (decision.targetReplicas !== currentReplicas) {
        await this.applyScaling(decision);
      }
    } finally {
      span?.end();
    }
  }

  private async collectServiceMetrics(service: string): Promise<Record<string, number>> {
    const span = this.apm.startSpan('collect-service-metrics');

    try {
      const metrics: Record<string, number> = {};

      // Collect CPU metrics
      metrics.cpu_utilization = await this.metrics.getCPUUtilization(service);

      // Collect memory metrics
      metrics.memory_utilization = await this.metrics.getMemoryUtilization(service);

      // Collect request rate
      metrics.request_rate = await this.metrics.getRequestRate(service);

      // Collect queue metrics for workers
      if (service === 'worker') {
        metrics.queue_length = await this.metrics.getQueueLength();
        metrics.processing_time = await this.metrics.getProcessingTime();
      }

      // Collect cache metrics
      if (service === 'cache') {
        metrics.connections = await this.metrics.getCacheConnections();
      }

      return metrics;
    } finally {
      span?.end();
    }
  }

  private isInCooldown(service: string): boolean {
    const lastScale = this.lastScaleTime[service];
    if (!lastScale) return false;

    const cooldownPeriod = Math.max(...this.scalingRules[service].map((rule) => rule.cooldown));
    return Date.now() - lastScale < cooldownPeriod * 1000;
  }

  private evaluateScalingRules(
    service: string,
    rules: ScalingRule[],
    metrics: Record<string, number>,
    currentReplicas: number
  ): ScalingDecision {
    let targetReplicas = currentReplicas;
    let scaleReason = '';

    for (const rule of rules) {
      const metricValue = metrics[rule.metric];
      if (!metricValue) continue;

      if (rule.action === 'scale_up' && metricValue >= rule.threshold) {
        const newTarget = Math.min(currentReplicas + rule.scaleIncrement, rule.maxReplicas);
        if (newTarget > targetReplicas) {
          targetReplicas = newTarget;
          scaleReason = `${rule.metric} above threshold (${metricValue} >= ${rule.threshold})`;
        }
      } else if (rule.action === 'scale_down' && metricValue < rule.threshold) {
        const newTarget = Math.max(currentReplicas - rule.scaleIncrement, rule.minReplicas);
        if (newTarget < targetReplicas) {
          targetReplicas = newTarget;
          scaleReason = `${rule.metric} below threshold (${metricValue} < ${rule.threshold})`;
        }
      }
    }

    return {
      service,
      currentReplicas,
      targetReplicas,
      reason: scaleReason,
      metrics,
    };
  }

  private async applyScaling(decision: ScalingDecision): Promise<void> {
    const span = this.apm.startSpan('apply-scaling');

    try {
      this.logger.info('Applying scaling decision', { decision });

      // Apply the scaling
      await this.kubernetes.scaleDeployment(decision.service, decision.targetReplicas);

      // Update last scale time
      this.lastScaleTime[decision.service] = Date.now();

      // Log the scaling event
      this.logger.info('Scaling applied successfully', {
        service: decision.service,
        previousReplicas: decision.currentReplicas,
        newReplicas: decision.targetReplicas,
        reason: decision.reason,
      });

      // Record metrics
      this.metrics.recordScalingEvent({
        service: decision.service,
        previousReplicas: decision.currentReplicas,
        newReplicas: decision.targetReplicas,
        reason: decision.reason,
        metrics: decision.metrics,
      });
    } catch (error) {
      this.logger.error('Failed to apply scaling', {
        error,
        decision,
      });
      this.apm.captureError(error);
      throw error;
    } finally {
      span?.end();
    }
  }

  public async getScalingHistory(service: string, duration: number): Promise<any[]> {
    const span = this.apm.startSpan('get-scaling-history');

    try {
      // Get scaling events from metrics storage
      const events = await this.metrics.getScalingEvents(service, duration);

      // Enrich events with additional context
      const enrichedEvents = await Promise.all(
        events.map(async (event) => ({
          ...event,
          metrics: await this.metrics.getMetricsAtTime(service, event.timestamp),
        }))
      );

      return enrichedEvents;
    } finally {
      span?.end();
    }
  }

  public async generateScalingReport(duration: number): Promise<string> {
    const span = this.apm.startSpan('generate-scaling-report');

    try {
      const reports: string[] = [];

      for (const service of Object.keys(this.scalingRules)) {
        const events = await this.getScalingHistory(service, duration);

        reports.push(`
## ${service} Scaling Report

Total Scaling Events: ${events.length}

### Scaling Events:
${events
  .map(
    (event) => `
- Time: ${event.timestamp}
  * Previous Replicas: ${event.previousReplicas}
  * New Replicas: ${event.newReplicas}
  * Reason: ${event.reason}
  * Metrics:
    ${Object.entries(event.metrics)
      .map(([key, value]) => `- ${key}: ${value}`)
      .join('\n    ')}
`
  )
  .join('\n')}
`);
      }

      return `
# Auto-Scaling Report
Duration: Last ${duration / 3600} hours

${reports.join('\n')}
`;
    } finally {
      span?.end();
    }
  }
}
