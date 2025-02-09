import { EventEmitter } from 'events';

interface PerformanceMetrics {
  timestamp: number;
  type: string;
  value: number;
  metadata?: Record<string, any>;
}

interface ThresholdConfig {
  cpu: number;
  memory: number;
  latency: number;
  errorRate: number;
}

export class PerformanceMonitor extends EventEmitter {
  private metrics: PerformanceMetrics[] = [];
  private thresholds: ThresholdConfig;
  private isMonitoring = false;

  constructor(thresholds: Partial<ThresholdConfig> = {}) {
    super();
    this.thresholds = {
      cpu: thresholds.cpu || 80, // 80% CPU usage threshold
      memory: thresholds.memory || 85, // 85% memory usage threshold
      latency: thresholds.latency || 1000, // 1 second latency threshold
      errorRate: thresholds.errorRate || 5 // 5% error rate threshold
    };
  }

  startMonitoring(): void {
    if (this.isMonitoring) return;
    this.isMonitoring = true;

    // Monitor CPU usage
    this.monitorCPU();
    // Monitor memory usage
    this.monitorMemory();
    // Monitor network latency
    this.monitorLatency();
    // Monitor error rates
    this.monitorErrors();
  }

  private monitorCPU(): void {
    setInterval(async () => {
      const usage = await this.getCPUUsage();
      this.recordMetric('cpu', usage);

      if (usage > this.thresholds.cpu) {
        this.emit('bottleneck', {
          type: 'cpu',
          value: usage,
          threshold: this.thresholds.cpu
        });
      }
    }, 5000);
  }

  private monitorMemory(): void {
    setInterval(() => {
      const usage = this.getMemoryUsage();
      this.recordMetric('memory', usage);

      if (usage > this.thresholds.memory) {
        this.emit('bottleneck', {
          type: 'memory',
          value: usage,
          threshold: this.thresholds.memory
        });
      }
    }, 10000);
  }

  private monitorLatency(): void {
    setInterval(async () => {
      const latency = await this.measureLatency();
      this.recordMetric('latency', latency);

      if (latency > this.thresholds.latency) {
        this.emit('bottleneck', {
          type: 'latency',
          value: latency,
          threshold: this.thresholds.latency
        });
      }
    }, 15000);
  }

  private monitorErrors(): void {
    setInterval(() => {
      const errorRate = this.calculateErrorRate();
      this.recordMetric('error_rate', errorRate);

      if (errorRate > this.thresholds.errorRate) {
        this.emit('bottleneck', {
          type: 'error_rate',
          value: errorRate,
          threshold: this.thresholds.errorRate
        });
      }
    }, 30000);
  }

  private async getCPUUsage(): Promise<number> {
    // Implementation depends on environment (browser/node)
    if (typeof window !== 'undefined') {
      // Browser implementation
      const usage = await performance.measureUserAgentSpecificMemory?.() || {};
      return (usage.bytes || 0) / (usage.limit || 1) * 100;
    } else {
      // Node.js implementation
      const os = require('os');
      const cpus = os.cpus();
      const usage = cpus.reduce((acc, cpu) => {
        const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
        const idle = cpu.times.idle;
        return acc + ((total - idle) / total) * 100;
      }, 0) / cpus.length;
      return usage;
    }
  }

  private getMemoryUsage(): number {
    if (typeof window !== 'undefined') {
      // Browser implementation
      const memory = (performance as any).memory;
      if (memory) {
        return (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;
      }
      return 0;
    } else {
      // Node.js implementation
      const used = process.memoryUsage().heapUsed;
      const total = process.memoryUsage().heapTotal;
      return (used / total) * 100;
    }
  }

  private async measureLatency(): Promise<number> {
    const start = performance.now();
    try {
      await fetch('/api/health');
      return performance.now() - start;
    } catch (error) {
      console.error('Latency measurement failed:', error);
      return Infinity;
    }
  }

  private calculateErrorRate(): number {
    const recentMetrics = this.getRecentMetrics(60000); // Last minute
    const errors = recentMetrics.filter(m => m.type === 'error').length;
    const total = recentMetrics.length;
    return total > 0 ? (errors / total) * 100 : 0;
  }

  private recordMetric(type: string, value: number, metadata?: Record<string, any>): void {
    this.metrics.push({
      timestamp: Date.now(),
      type,
      value,
      metadata
    });

    // Keep only last hour of metrics
    const oneHourAgo = Date.now() - 3600000;
    this.metrics = this.metrics.filter(m => m.timestamp > oneHourAgo);
  }

  getRecentMetrics(duration: number): PerformanceMetrics[] {
    const cutoff = Date.now() - duration;
    return this.metrics.filter(m => m.timestamp > cutoff);
  }

  getAverageMetric(type: string, duration: number): number {
    const metrics = this.getRecentMetrics(duration)
      .filter(m => m.type === type);
    
    if (metrics.length === 0) return 0;
    
    const sum = metrics.reduce((acc, m) => acc + m.value, 0);
    return sum / metrics.length;
  }

  stop(): void {
    this.isMonitoring = false;
    this.removeAllListeners();
  }
} 