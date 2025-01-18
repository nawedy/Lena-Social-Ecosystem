import { ErrorReporting } from '@google-cloud/error-reporting';
import { monitoring_v3 } from '@google-cloud/monitoring';
import { Profiler } from '@google-cloud/profiler';
import { Trace } from '@google-cloud/trace-agent';

import { config } from '../config';

import { advancedAnalytics } from './advancedAnalytics';

interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: string;
  labels?: Record<string, string>;
}

interface TraceSpan {
  name: string;
  startTime: number;
  endTime?: number;
  attributes?: Record<string, string>;
}

export class PerformanceMonitoringService {
  private static instance: PerformanceMonitoringService;
  private monitoringClient: monitoring_v3.MetricServiceClient;
  private errorReporting: ErrorReporting;
  private trace: Trace;
  private activeTraces: Map<string, TraceSpan>;
  private metricsBuffer: PerformanceMetric[];
  private readonly BUFFER_FLUSH_INTERVAL = 60000; // 1 minute
  private readonly BUFFER_SIZE_LIMIT = 1000;

  private constructor() {
    this.monitoringClient = new monitoring_v3.MetricServiceClient({
      keyFilename: config.gcp.keyFile,
    });

    this.errorReporting = new ErrorReporting({
      projectId: config.gcp.projectId,
      keyFilename: config.gcp.keyFile,
    });

    // Initialize Cloud Trace
    this.trace = require('@google-cloud/trace-agent').start({
      projectId: config.gcp.projectId,
      keyFilename: config.gcp.keyFile,
    });

    // Initialize Cloud Profiler
    Profiler.start({
      projectId: config.gcp.projectId,
      serviceContext: {
        service: 'tiktok-toe',
        version: '1.0.0',
      },
    });

    this.activeTraces = new Map();
    this.metricsBuffer = [];

    // Set up periodic buffer flush
    setInterval(() => this.flushMetricsBuffer(), this.BUFFER_FLUSH_INTERVAL);
  }

  public static getInstance(): PerformanceMonitoringService {
    if (!PerformanceMonitoringService.instance) {
      PerformanceMonitoringService.instance = new PerformanceMonitoringService();
    }
    return PerformanceMonitoringService.instance;
  }

  // API Performance Monitoring
  async recordApiLatency(endpoint: string, latency: number): Promise<void> {
    this.bufferMetric({
      name: 'api-latency',
      value: latency,
      timestamp: new Date().toISOString(),
      labels: { endpoint },
    });

    // Record to advanced analytics for dashboard
    await advancedAnalytics.writeMetricData({
      name: 'api-latency',
      value: latency,
      timestamp: new Date().toISOString(),
      labels: { endpoint },
    });
  }

  // Resource Usage Monitoring
  async recordResourceUsage(resource: string, usage: number): Promise<void> {
    this.bufferMetric({
      name: 'resource-usage',
      value: usage,
      timestamp: new Date().toISOString(),
      labels: { resource },
    });
  }

  // Error Rate Monitoring
  async recordError(error: Error, context?: Record<string, any>): Promise<void> {
    // Report error to Error Reporting
    this.errorReporting.report(error, context);

    this.bufferMetric({
      name: 'error-rate',
      value: 1,
      timestamp: new Date().toISOString(),
      labels: {
        errorType: error.name,
        errorMessage: error.message,
      },
    });
  }

  // Distributed Tracing
  startTrace(name: string, attributes?: Record<string, string>): string {
    const traceId = crypto.randomUUID();
    this.activeTraces.set(traceId, {
      name,
      startTime: Date.now(),
      attributes,
    });
    return traceId;
  }

  endTrace(traceId: string): void {
    const trace = this.activeTraces.get(traceId);
    if (!trace) return;

    trace.endTime = Date.now();
    const duration = trace.endTime - trace.startTime;

    this.bufferMetric({
      name: 'trace-duration',
      value: duration,
      timestamp: new Date().toISOString(),
      labels: {
        traceName: trace.name,
        ...trace.attributes,
      },
    });

    this.activeTraces.delete(traceId);
  }

  // Cache Performance Monitoring
  async recordCacheMetrics(params: {
    operation: 'hit' | 'miss' | 'set' | 'evict';
    duration?: number;
    size?: number;
  }): Promise<void> {
    this.bufferMetric({
      name: 'cache-operation',
      value: params.duration || 1,
      timestamp: new Date().toISOString(),
      labels: {
        operation: params.operation,
        size: params.size?.toString(),
      },
    });
  }

  // Database Performance Monitoring
  async recordDbOperation(params: {
    operation: string;
    duration: number;
    success: boolean;
  }): Promise<void> {
    this.bufferMetric({
      name: 'db-operation',
      value: params.duration,
      timestamp: new Date().toISOString(),
      labels: {
        operation: params.operation,
        success: params.success.toString(),
      },
    });
  }

  // Memory Usage Monitoring
  async recordMemoryUsage(): Promise<void> {
    const usage = process.memoryUsage();

    Object.entries(usage).forEach(([type, bytes]) => {
      this.bufferMetric({
        name: 'memory-usage',
        value: bytes,
        timestamp: new Date().toISOString(),
        labels: { type },
      });
    });
  }

  // Custom Metric Recording
  async recordCustomMetric(params: {
    name: string;
    value: number;
    labels?: Record<string, string>;
  }): Promise<void> {
    this.bufferMetric({
      name: params.name,
      value: params.value,
      timestamp: new Date().toISOString(),
      labels: params.labels,
    });
  }

  // Performance Alert Configuration
  async configureAlert(params: {
    metricName: string;
    condition: 'above' | 'below';
    threshold: number;
    duration: string;
    notificationChannels: string[];
  }): Promise<void> {
    const projectPath = this.monitoringClient.projectPath(config.gcp.projectId);

    const alertPolicy = {
      displayName: `Alert for ${params.metricName}`,
      conditions: [
        {
          displayName: `${params.metricName} ${params.condition} ${params.threshold}`,
          conditionThreshold: {
            filter: `metric.type = "custom.googleapis.com/${params.metricName}"`,
            comparison: params.condition === 'above' ? 'COMPARISON_GT' : 'COMPARISON_LT',
            threshold: params.threshold,
            duration: params.duration,
            trigger: {
              count: 1,
            },
          },
        },
      ],
      notificationChannels: params.notificationChannels,
    };

    await this.monitoringClient.createAlertPolicy({
      name: projectPath,
      alertPolicy,
    });
  }

  // Private Methods
  private bufferMetric(metric: PerformanceMetric): void {
    this.metricsBuffer.push(metric);

    if (this.metricsBuffer.length >= this.BUFFER_SIZE_LIMIT) {
      this.flushMetricsBuffer();
    }
  }

  private async flushMetricsBuffer(): Promise<void> {
    if (this.metricsBuffer.length === 0) return;

    const projectPath = this.monitoringClient.projectPath(config.gcp.projectId);
    const timeSeries = this.metricsBuffer.map((metric) => ({
      metric: {
        type: `custom.googleapis.com/${metric.name}`,
        labels: metric.labels || {},
      },
      resource: {
        type: 'global',
        labels: {
          project_id: config.gcp.projectId,
        },
      },
      points: [
        {
          interval: {
            endTime: {
              seconds: Math.floor(new Date(metric.timestamp).getTime() / 1000),
            },
          },
          value: {
            doubleValue: metric.value,
          },
        },
      ],
    }));

    try {
      await this.monitoringClient.createTimeSeries({
        name: projectPath,
        timeSeries,
      });

      // Clear the buffer after successful write
      this.metricsBuffer = [];
    } catch (error) {
      console.error('Error flushing metrics buffer:', error);
      // Keep the metrics in buffer to retry on next flush
    }
  }
}

export const performanceMonitoring = PerformanceMonitoringService.getInstance();
