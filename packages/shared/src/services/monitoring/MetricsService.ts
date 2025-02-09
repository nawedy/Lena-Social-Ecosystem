import { EventEmitter } from 'events';
import { configService } from '../config/GlobalConfig';
import { errorService } from '../error/ErrorService';
import { loggingService } from '../logging/LoggingService';

interface MetricValue {
  value: number;
  timestamp: number;
  labels?: Record<string, string>;
}

interface MetricDefinition {
  name: string;
  help: string;
  type: 'counter' | 'gauge' | 'histogram';
  labels?: string[];
}

interface HistogramBucket {
  le: number;
  count: number;
}

interface HistogramConfig {
  buckets: number[];
}

interface AlertRule {
  metric: string;
  condition: 'gt' | 'lt' | 'eq';
  threshold: number;
  duration: number;
  severity: 'info' | 'warning' | 'critical';
  labels?: Record<string, string>;
}

interface Alert {
  id: string;
  rule: AlertRule;
  value: number;
  startsAt: number;
  endsAt?: number;
  status: 'firing' | 'resolved';
  labels?: Record<string, string>;
}

class MetricsService extends EventEmitter {
  private static instance: MetricsService;
  private metrics: Map<string, MetricDefinition> = new Map();
  private values: Map<string, MetricValue[]> = new Map();
  private alertRules: AlertRule[] = [];
  private activeAlerts: Map<string, Alert> = new Map();
  private scrapeInterval: number;
  private retentionPeriod: number;
  private isCollecting = false;
  private collectionInterval: NodeJS.Timer | null = null;

  private constructor() {
    super();
    this.scrapeInterval = configService.get('monitoring').metrics.interval * 1000;
    this.retentionPeriod = configService.get('monitoring').metrics.retention * 24 * 60 * 60 * 1000;
    this.setupDefaultMetrics();
    this.setupAlertRules();
  }

  static getInstance(): MetricsService {
    if (!MetricsService.instance) {
      MetricsService.instance = new MetricsService();
    }
    return MetricsService.instance;
  }

  private setupDefaultMetrics() {
    // System metrics
    this.registerMetric({
      name: 'system_cpu_usage',
      help: 'CPU usage percentage',
      type: 'gauge'
    });

    this.registerMetric({
      name: 'system_memory_usage',
      help: 'Memory usage in bytes',
      type: 'gauge'
    });

    // HTTP metrics
    this.registerMetric({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      type: 'counter',
      labels: ['method', 'path', 'status']
    });

    this.registerMetric({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      type: 'histogram',
      labels: ['method', 'path']
    });

    // Business metrics
    this.registerMetric({
      name: 'active_users',
      help: 'Number of active users',
      type: 'gauge'
    });

    this.registerMetric({
      name: 'content_uploads_total',
      help: 'Total number of content uploads',
      type: 'counter',
      labels: ['type', 'platform']
    });
  }

  private setupAlertRules() {
    this.addAlertRule({
      metric: 'system_cpu_usage',
      condition: 'gt',
      threshold: 80,
      duration: 300, // 5 minutes
      severity: 'warning'
    });

    this.addAlertRule({
      metric: 'system_memory_usage',
      condition: 'gt',
      threshold: 85,
      duration: 300,
      severity: 'warning'
    });

    this.addAlertRule({
      metric: 'http_request_duration_seconds',
      condition: 'gt',
      threshold: 5,
      duration: 60,
      severity: 'warning',
      labels: { path: '/api/*' }
    });
  }

  registerMetric(definition: MetricDefinition) {
    if (this.metrics.has(definition.name)) {
      throw new Error(`Metric ${definition.name} already exists`);
    }
    this.metrics.set(definition.name, definition);
    this.values.set(definition.name, []);
  }

  addAlertRule(rule: AlertRule) {
    this.alertRules.push(rule);
  }

  startCollection() {
    if (this.isCollecting) return;

    this.isCollecting = true;
    this.collectionInterval = setInterval(() => {
      this.collectMetrics();
      this.checkAlerts();
      this.cleanupOldMetrics();
    }, this.scrapeInterval);
  }

  stopCollection() {
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
      this.collectionInterval = null;
    }
    this.isCollecting = false;
  }

  private async collectMetrics() {
    try {
      // Collect system metrics
      const systemMetrics = await this.collectSystemMetrics();
      this.recordMetric('system_cpu_usage', systemMetrics.cpu);
      this.recordMetric('system_memory_usage', systemMetrics.memory);

      // Collect custom metrics
      this.emit('collect');
    } catch (error) {
      errorService.handleError(error, {
        component: 'MetricsService',
        action: 'collectMetrics'
      });
    }
  }

  private async collectSystemMetrics(): Promise<{ cpu: number; memory: number }> {
    // Implementation would depend on environment (browser vs Node.js)
    if (typeof window !== 'undefined') {
      // Browser implementation
      const memory = (performance as any).memory;
      return {
        cpu: 0, // Not available in browser
        memory: memory ? (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100 : 0
      };
    } else {
      // Node.js implementation
      const os = require('os');
      const cpus = os.cpus();
      const totalCpu = cpus.reduce((acc, cpu) => {
        const total = Object.values(cpu.times).reduce((a, b) => a + b);
        const idle = cpu.times.idle;
        return acc + ((total - idle) / total);
      }, 0) / cpus.length * 100;

      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = ((totalMem - freeMem) / totalMem) * 100;

      return {
        cpu: totalCpu,
        memory: usedMem
      };
    }
  }

  recordMetric(name: string, value: number, labels?: Record<string, string>) {
    const metric = this.metrics.get(name);
    if (!metric) {
      throw new Error(`Metric ${name} not found`);
    }

    const metricValues = this.values.get(name) || [];
    metricValues.push({
      value,
      timestamp: Date.now(),
      labels
    });
    this.values.set(name, metricValues);
  }

  incrementCounter(name: string, labels?: Record<string, string>) {
    const metric = this.metrics.get(name);
    if (!metric || metric.type !== 'counter') {
      throw new Error(`Counter ${name} not found`);
    }

    const currentValue = this.getLatestValue(name, labels) || 0;
    this.recordMetric(name, currentValue + 1, labels);
  }

  observeHistogram(name: string, value: number, labels?: Record<string, string>) {
    const metric = this.metrics.get(name);
    if (!metric || metric.type !== 'histogram') {
      throw new Error(`Histogram ${name} not found`);
    }

    this.recordMetric(name, value, labels);
  }

  private getLatestValue(name: string, labels?: Record<string, string>): number | null {
    const values = this.values.get(name);
    if (!values || values.length === 0) return null;

    const matchingValues = labels
      ? values.filter(v => this.labelsMatch(v.labels, labels))
      : values;

    return matchingValues[matchingValues.length - 1]?.value || null;
  }

  private labelsMatch(a?: Record<string, string>, b?: Record<string, string>): boolean {
    if (!a && !b) return true;
    if (!a || !b) return false;

    return Object.entries(a).every(([key, value]) => b[key] === value);
  }

  private async checkAlerts() {
    const now = Date.now();

    for (const rule of this.alertRules) {
      try {
        const values = this.getMetricValues(rule.metric, rule.labels, rule.duration);
        if (values.length === 0) continue;

        const isViolating = values.every(v => this.checkThreshold(v.value, rule));
        const alertKey = this.getAlertKey(rule);
        const existingAlert = this.activeAlerts.get(alertKey);

        if (isViolating && !existingAlert) {
          // New alert
          const alert: Alert = {
            id: crypto.randomUUID(),
            rule,
            value: values[values.length - 1].value,
            startsAt: now,
            status: 'firing',
            labels: rule.labels
          };

          this.activeAlerts.set(alertKey, alert);
          this.emit('alert', alert);

          loggingService.warn(`Alert fired: ${rule.metric}`, {
            alert,
            component: 'MetricsService'
          });
        } else if (!isViolating && existingAlert?.status === 'firing') {
          // Resolve alert
          existingAlert.status = 'resolved';
          existingAlert.endsAt = now;
          this.emit('alertResolved', existingAlert);

          loggingService.info(`Alert resolved: ${rule.metric}`, {
            alert: existingAlert,
            component: 'MetricsService'
          });
        }
      } catch (error) {
        errorService.handleError(error, {
          component: 'MetricsService',
          action: 'checkAlerts',
          alertRule: rule
        });
      }
    }
  }

  private getMetricValues(
    name: string,
    labels?: Record<string, string>,
    duration?: number
  ): MetricValue[] {
    const values = this.values.get(name) || [];
    const now = Date.now();

    return values.filter(v => 
      (!duration || v.timestamp > now - duration * 1000) &&
      this.labelsMatch(v.labels, labels)
    );
  }

  private checkThreshold(value: number, rule: AlertRule): boolean {
    switch (rule.condition) {
      case 'gt':
        return value > rule.threshold;
      case 'lt':
        return value < rule.threshold;
      case 'eq':
        return value === rule.threshold;
      default:
        return false;
    }
  }

  private getAlertKey(rule: AlertRule): string {
    return `${rule.metric}:${JSON.stringify(rule.labels || {})}`;
  }

  private cleanupOldMetrics() {
    const cutoff = Date.now() - this.retentionPeriod;

    for (const [name, values] of this.values.entries()) {
      const newValues = values.filter(v => v.timestamp > cutoff);
      this.values.set(name, newValues);
    }

    // Clean up old resolved alerts
    for (const [key, alert] of this.activeAlerts.entries()) {
      if (alert.status === 'resolved' && alert.endsAt && alert.endsAt < cutoff) {
        this.activeAlerts.delete(key);
      }
    }
  }

  getMetrics() {
    const metrics: Record<string, any> = {};

    for (const [name, definition] of this.metrics.entries()) {
      const values = this.values.get(name) || [];
      
      if (definition.type === 'histogram') {
        metrics[name] = this.calculateHistogram(values);
      } else {
        metrics[name] = {
          value: this.getLatestValue(name),
          values: values.map(v => ({
            value: v.value,
            timestamp: v.timestamp,
            labels: v.labels
          }))
        };
      }
    }

    return metrics;
  }

  private calculateHistogram(values: MetricValue[]): {
    count: number;
    sum: number;
    avg: number;
    p50: number;
    p90: number;
    p95: number;
    p99: number;
    buckets: HistogramBucket[];
  } {
    if (values.length === 0) {
      return {
        count: 0,
        sum: 0,
        avg: 0,
        p50: 0,
        p90: 0,
        p95: 0,
        p99: 0,
        buckets: []
      };
    }

    const sortedValues = values.map(v => v.value).sort((a, b) => a - b);
    const sum = sortedValues.reduce((a, b) => a + b, 0);

    return {
      count: values.length,
      sum,
      avg: sum / values.length,
      p50: this.percentile(sortedValues, 50),
      p90: this.percentile(sortedValues, 90),
      p95: this.percentile(sortedValues, 95),
      p99: this.percentile(sortedValues, 99),
      buckets: this.calculateBuckets(sortedValues)
    };
  }

  private percentile(sortedValues: number[], p: number): number {
    const index = Math.ceil((p / 100) * sortedValues.length) - 1;
    return sortedValues[index];
  }

  private calculateBuckets(sortedValues: number[]): HistogramBucket[] {
    const defaultBuckets = [0.01, 0.05, 0.1, 0.5, 1, 5, 10, Infinity];
    const buckets: HistogramBucket[] = defaultBuckets.map(le => ({
      le,
      count: sortedValues.filter(v => v <= le).length
    }));
    return buckets;
  }

  getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values());
  }
}

// Export singleton instance
export const metricsService = MetricsService.getInstance(); 