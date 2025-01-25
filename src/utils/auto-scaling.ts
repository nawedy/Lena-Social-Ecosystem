import * as k8s from '@kubernetes/client-node';

import { ConfigService } from '../services/config';
import { LoggerService } from '../services/logger';
import { MetricsService } from '../services/metrics';

import { APMService } from './apm';

interface ScalingRule {
  metric: string;
  target: number;
  minReplicas: number;
  maxReplicas: number;
  scaleUpThreshold: number;
  scaleDownThreshold: number;
  scaleUpCooldown: number;
  scaleDownCooldown: number;
}

interface ResourceMetrics {
  cpu: number;
  memory: number;
  requests: number;
}

export class AutoScalingService {
  private k8sApi: k8s.AppsV1Api;
  private metricsApi: k8s.CustomObjectsApi;
  private apm: APMService;
  private metrics: MetricsService;
  private config: ConfigService;
  private logger: LoggerService;
  private rules: Map<string, ScalingRule>;
  private lastScaleTime: Map<string, Date>;

  constructor(
    apm: APMService,
    metrics: MetricsService,
    config: ConfigService,
    logger: LoggerService
  ) {
    const kc = new k8s.KubeConfig();
    kc.loadFromDefault();

    this.k8sApi = kc.makeApiClient(k8s.AppsV1Api);
    this.metricsApi = kc.makeApiClient(k8s.CustomObjectsApi);
    this.apm = apm;
    this.metrics = metrics;
    this.config = config;
    this.logger = logger;
    this.rules = new Map();
    this.lastScaleTime = new Map();

    this.initializeRules();
  }

  private initializeRules() {
    // Load scaling rules from configuration
    const rules = this.config.get('scaling.rules') as Record<
      string,
      ScalingRule
    >;

    for (const [service, rule] of Object.entries(rules)) {
      this.rules.set(service, rule);
      this.lastScaleTime.set(service, new Date(0)); // Initialize with epoch
    }
  }

  public async startAutoScaling() {
    const interval = this.config.get('scaling.checkInterval') || 30000; // 30 seconds default

    setInterval(async () => {
      try {
        await this.checkAndScale();
      } catch (error) {
        this.logger.error('Auto-scaling check failed', { error });
        this.apm.captureError(error);
      }
    }, interval);
  }

  private async checkAndScale() {
    const transaction = this.apm.startTransaction(
      'auto-scaling-check',
      'auto-scaling'
    );

    try {
      for (const [service, rule] of this.rules.entries()) {
        const span = this.apm.startSpan(`check-service:${service}`);

        try {
          const metrics = await this.getServiceMetrics(service);
          const deployment = await this.getDeployment(service);

          if (!deployment || !metrics) {
            continue;
          }

          const currentReplicas = deployment.spec.replicas || 1;
          const decision = this.makeScalingDecision(
            service,
            rule,
            metrics,
            currentReplicas
          );

          if (decision !== currentReplicas) {
            await this.scaleDeployment(service, decision);
          }
        } finally {
          span?.end();
        }
      }
    } finally {
      transaction?.end();
    }
  }

  private async getServiceMetrics(service: string): Promise<ResourceMetrics> {
    const span = this.apm.startSpan('get-service-metrics');

    try {
      const [cpu, memory, requests] = await Promise.all([
        this.metrics.getServiceCPU(service),
        this.metrics.getServiceMemory(service),
        this.metrics.getServiceRequests(service),
      ]);

      return { cpu, memory, requests };
    } finally {
      span?.end();
    }
  }

  private async getDeployment(service: string) {
    const span = this.apm.startSpan('get-deployment');

    try {
      const namespace = this.config.get('kubernetes.namespace');
      const response = await this.k8sApi.readNamespacedDeployment(
        service,
        namespace
      );
      return response.body;
    } catch (error) {
      this.logger.error('Failed to get deployment', { service, error });
      return null;
    } finally {
      span?.end();
    }
  }

  private makeScalingDecision(
    service: string,
    rule: ScalingRule,
    metrics: ResourceMetrics,
    currentReplicas: number
  ): number {
    const span = this.apm.startSpan('make-scaling-decision');

    try {
      const currentTime = new Date();
      const lastScale = this.lastScaleTime.get(service) || new Date(0);

      // Check cooldown periods
      const timeSinceLastScale = currentTime.getTime() - lastScale.getTime();

      let metricValue: number;
      switch (rule.metric) {
        case 'cpu':
          metricValue = metrics.cpu;
          break;
        case 'memory':
          metricValue = metrics.memory;
          break;
        case 'requests':
          metricValue = metrics.requests;
          break;
        default:
          throw new Error(`Unknown metric: ${rule.metric}`);
      }

      let newReplicas = currentReplicas;

      // Scale up
      if (
        metricValue > rule.scaleUpThreshold &&
        currentReplicas < rule.maxReplicas &&
        timeSinceLastScale > rule.scaleUpCooldown
      ) {
        newReplicas = Math.min(currentReplicas + 1, rule.maxReplicas);
      }
      // Scale down
      else if (
        metricValue < rule.scaleDownThreshold &&
        currentReplicas > rule.minReplicas &&
        timeSinceLastScale > rule.scaleDownCooldown
      ) {
        newReplicas = Math.max(currentReplicas - 1, rule.minReplicas);
      }

      if (newReplicas !== currentReplicas) {
        this.logger.info('Scaling decision made', {
          service,
          currentReplicas,
          newReplicas,
          metric: rule.metric,
          value: metricValue,
        });
      }

      return newReplicas;
    } finally {
      span?.end();
    }
  }

  private async scaleDeployment(service: string, replicas: number) {
    const span = this.apm.startSpan('scale-deployment');

    try {
      const namespace = this.config.get('kubernetes.namespace');

      const patch = {
        spec: {
          replicas: replicas,
        },
      };

      await this.k8sApi.patchNamespacedDeployment(
        service,
        namespace,
        patch,
        undefined,
        undefined,
        undefined,
        undefined,
        {
          headers: { 'Content-Type': 'application/strategic-merge-patch+json' },
        }
      );

      this.lastScaleTime.set(service, new Date());

      // Record scaling event
      this.metrics.recordScalingEvent(service, replicas);

      this.logger.info('Deployment scaled', {
        service,
        replicas,
      });
    } catch (error) {
      this.logger.error('Failed to scale deployment', {
        service,
        replicas,
        error,
      });
      this.apm.captureError(error);
      throw error;
    } finally {
      span?.end();
    }
  }

  public async getScalingMetrics(service: string) {
    const span = this.apm.startSpan('get-scaling-metrics');

    try {
      const namespace = this.config.get('kubernetes.namespace');

      const [deployment, metrics] = await Promise.all([
        this.k8sApi.readNamespacedDeployment(service, namespace),
        this.getServiceMetrics(service),
      ]);

      const rule = this.rules.get(service);
      const lastScale = this.lastScaleTime.get(service);

      return {
        currentReplicas: deployment.body.spec.replicas,
        metrics,
        rule,
        lastScaleTime: lastScale,
        status: {
          ready: deployment.body.status.readyReplicas,
          available: deployment.body.status.availableReplicas,
          unavailable: deployment.body.status.unavailableReplicas,
        },
      };
    } finally {
      span?.end();
    }
  }

  public async updateScalingRule(service: string, rule: Partial<ScalingRule>) {
    const span = this.apm.startSpan('update-scaling-rule');

    try {
      const currentRule = this.rules.get(service);
      if (!currentRule) {
        throw new Error(`No scaling rule found for service: ${service}`);
      }

      const updatedRule = { ...currentRule, ...rule };
      this.rules.set(service, updatedRule);

      // Update configuration
      await this.config.set(`scaling.rules.${service}`, updatedRule);

      this.logger.info('Scaling rule updated', {
        service,
        rule: updatedRule,
      });

      return updatedRule;
    } finally {
      span?.end();
    }
  }
}
