import { APMService } from '../utils/apm';
import { MetricsService } from '../services/metrics';
import { DatabaseService } from '../services/database';
import { RedisService } from '../services/redis';
import { LoggerService } from '../services/logger';
import { KubernetesService } from '../services/kubernetes';

interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: string;
  tags: Record<string, string>;
  thresholds: {
    warning: number;
    critical: number;
  };
}

interface ServiceHealth {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  metrics: PerformanceMetric[];
  issues: string[];
  recommendations: string[];
}

export class PerformanceMonitor {
  private apm: APMService;
  private metrics: MetricsService;
  private db: DatabaseService;
  private redis: RedisService;
  private logger: LoggerService;
  private kubernetes: KubernetesService;

  constructor(
    apm: APMService,
    metrics: MetricsService,
    db: DatabaseService,
    redis: RedisService,
    logger: LoggerService,
    kubernetes: KubernetesService
  ) {
    this.apm = apm;
    this.metrics = metrics;
    this.db = db;
    this.redis = redis;
    this.logger = logger;
    this.kubernetes = kubernetes;
  }

  public async monitorPerformance(): Promise<void> {
    const transaction = this.apm.startTransaction(
      'monitor-performance',
      'monitoring'
    );

    try {
      // Collect metrics from all services
      const [apiMetrics, dbMetrics, cacheMetrics, networkMetrics] =
        await Promise.all([
          this.collectApiMetrics(),
          this.collectDatabaseMetrics(),
          this.collectCacheMetrics(),
          this.collectNetworkMetrics(),
        ]);

      // Analyze service health
      const serviceHealth = this.analyzeServiceHealth([
        ...apiMetrics,
        ...dbMetrics,
        ...cacheMetrics,
        ...networkMetrics,
      ]);

      // Handle any issues
      await this.handleServiceIssues(serviceHealth);

      // Store metrics
      await this.storeMetrics(serviceHealth);

      // Update dashboards
      this.updateDashboards(serviceHealth);
    } catch (error) {
      this.logger.error('Performance monitoring failed', { error });
      this.apm.captureError(error);
    } finally {
      transaction?.end();
    }
  }

  private async collectApiMetrics(): Promise<PerformanceMetric[]> {
    const span = this.apm.startSpan('collect-api-metrics');

    try {
      const metrics: PerformanceMetric[] = [];

      // Response time metrics
      const responseTime = await this.metrics.getResponseTime();
      metrics.push({
        name: 'response_time',
        value: responseTime,
        timestamp: new Date().toISOString(),
        tags: { service: 'api' },
        thresholds: {
          warning: 200,
          critical: 500,
        },
      });

      // Error rate metrics
      const errorRate = await this.metrics.getErrorRate();
      metrics.push({
        name: 'error_rate',
        value: errorRate,
        timestamp: new Date().toISOString(),
        tags: { service: 'api' },
        thresholds: {
          warning: 0.01,
          critical: 0.05,
        },
      });

      // Request rate metrics
      const requestRate = await this.metrics.getRequestRate();
      metrics.push({
        name: 'request_rate',
        value: requestRate,
        timestamp: new Date().toISOString(),
        tags: { service: 'api' },
        thresholds: {
          warning: 1000,
          critical: 2000,
        },
      });

      return metrics;
    } finally {
      span?.end();
    }
  }

  private async collectDatabaseMetrics(): Promise<PerformanceMetric[]> {
    const span = this.apm.startSpan('collect-database-metrics');

    try {
      const metrics: PerformanceMetric[] = [];

      // Query performance metrics
      const queryTime = await this.db.getAverageQueryTime();
      metrics.push({
        name: 'query_time',
        value: queryTime,
        timestamp: new Date().toISOString(),
        tags: { service: 'database' },
        thresholds: {
          warning: 100,
          critical: 250,
        },
      });

      // Connection pool metrics
      const connections = await this.db.getActiveConnections();
      metrics.push({
        name: 'active_connections',
        value: connections,
        timestamp: new Date().toISOString(),
        tags: { service: 'database' },
        thresholds: {
          warning: 80,
          critical: 90,
        },
      });

      // Disk usage metrics
      const diskUsage = await this.db.getDiskUsage();
      metrics.push({
        name: 'disk_usage',
        value: diskUsage,
        timestamp: new Date().toISOString(),
        tags: { service: 'database' },
        thresholds: {
          warning: 75,
          critical: 90,
        },
      });

      return metrics;
    } finally {
      span?.end();
    }
  }

  private async collectCacheMetrics(): Promise<PerformanceMetric[]> {
    const span = this.apm.startSpan('collect-cache-metrics');

    try {
      const metrics: PerformanceMetric[] = [];

      // Hit rate metrics
      const hitRate = await this.redis.getHitRate();
      metrics.push({
        name: 'hit_rate',
        value: hitRate,
        timestamp: new Date().toISOString(),
        tags: { service: 'cache' },
        thresholds: {
          warning: 0.85,
          critical: 0.7,
        },
      });

      // Memory usage metrics
      const memoryUsage = await this.redis.getMemoryUsage();
      metrics.push({
        name: 'memory_usage',
        value: memoryUsage,
        timestamp: new Date().toISOString(),
        tags: { service: 'cache' },
        thresholds: {
          warning: 80,
          critical: 90,
        },
      });

      // Eviction rate metrics
      const evictionRate = await this.redis.getEvictionRate();
      metrics.push({
        name: 'eviction_rate',
        value: evictionRate,
        timestamp: new Date().toISOString(),
        tags: { service: 'cache' },
        thresholds: {
          warning: 0.01,
          critical: 0.05,
        },
      });

      return metrics;
    } finally {
      span?.end();
    }
  }

  private async collectNetworkMetrics(): Promise<PerformanceMetric[]> {
    const span = this.apm.startSpan('collect-network-metrics');

    try {
      const metrics: PerformanceMetric[] = [];

      // Network latency metrics
      const latency = await this.metrics.getNetworkLatency();
      metrics.push({
        name: 'network_latency',
        value: latency,
        timestamp: new Date().toISOString(),
        tags: { service: 'network' },
        thresholds: {
          warning: 50,
          critical: 100,
        },
      });

      // Bandwidth usage metrics
      const bandwidth = await this.metrics.getBandwidthUsage();
      metrics.push({
        name: 'bandwidth_usage',
        value: bandwidth,
        timestamp: new Date().toISOString(),
        tags: { service: 'network' },
        thresholds: {
          warning: 80,
          critical: 90,
        },
      });

      // Packet loss metrics
      const packetLoss = await this.metrics.getPacketLoss();
      metrics.push({
        name: 'packet_loss',
        value: packetLoss,
        timestamp: new Date().toISOString(),
        tags: { service: 'network' },
        thresholds: {
          warning: 0.001,
          critical: 0.01,
        },
      });

      return metrics;
    } finally {
      span?.end();
    }
  }

  private analyzeServiceHealth(metrics: PerformanceMetric[]): ServiceHealth[] {
    const serviceMetrics = this.groupMetricsByService(metrics);
    const health: ServiceHealth[] = [];

    for (const [service, serviceMetrics] of Object.entries(serviceMetrics)) {
      const issues: string[] = [];
      const recommendations: string[] = [];

      // Check each metric against thresholds
      for (const metric of serviceMetrics) {
        if (metric.value >= metric.thresholds.critical) {
          issues.push(
            `Critical: ${metric.name} is ${metric.value} (threshold: ${metric.thresholds.critical})`
          );
          recommendations.push(
            this.getRecommendation(service, metric.name, 'critical')
          );
        } else if (metric.value >= metric.thresholds.warning) {
          issues.push(
            `Warning: ${metric.name} is ${metric.value} (threshold: ${metric.thresholds.warning})`
          );
          recommendations.push(
            this.getRecommendation(service, metric.name, 'warning')
          );
        }
      }

      health.push({
        service,
        status: this.determineStatus(issues),
        metrics: serviceMetrics,
        issues,
        recommendations: [...new Set(recommendations)],
      });
    }

    return health;
  }

  private groupMetricsByService(
    metrics: PerformanceMetric[]
  ): Record<string, PerformanceMetric[]> {
    return metrics.reduce(
      (acc, metric) => {
        const service = metric.tags.service;
        acc[service] = acc[service] || [];
        acc[service].push(metric);
        return acc;
      },
      {} as Record<string, PerformanceMetric[]>
    );
  }

  private determineStatus(
    issues: string[]
  ): 'healthy' | 'degraded' | 'unhealthy' {
    const criticalCount = issues.filter(i => i.startsWith('Critical')).length;
    const warningCount = issues.filter(i => i.startsWith('Warning')).length;

    if (criticalCount > 0) return 'unhealthy';
    if (warningCount > 0) return 'degraded';
    return 'healthy';
  }

  private getRecommendation(
    service: string,
    metric: string,
    severity: 'warning' | 'critical'
  ): string {
    // Add service-specific recommendations
    switch (service) {
      case 'api':
        return this.getApiRecommendation(metric, severity);
      case 'database':
        return this.getDatabaseRecommendation(metric, severity);
      case 'cache':
        return this.getCacheRecommendation(metric, severity);
      case 'network':
        return this.getNetworkRecommendation(metric, severity);
      default:
        return 'Investigate and optimize service performance';
    }
  }

  private getApiRecommendation(
    metric: string,
    severity: 'warning' | 'critical'
  ): string {
    switch (metric) {
      case 'response_time':
        return 'Optimize API endpoints and consider caching';
      case 'error_rate':
        return 'Implement circuit breakers and retry mechanisms';
      case 'request_rate':
        return 'Scale API servers and implement rate limiting';
      default:
        return 'Monitor API performance and optimize as needed';
    }
  }

  private getDatabaseRecommendation(
    metric: string,
    severity: 'warning' | 'critical'
  ): string {
    switch (metric) {
      case 'query_time':
        return 'Optimize slow queries and add appropriate indexes';
      case 'active_connections':
        return 'Adjust connection pool size and implement connection management';
      case 'disk_usage':
        return 'Clean up old data and implement data archival';
      default:
        return 'Monitor database performance and optimize as needed';
    }
  }

  private getCacheRecommendation(
    metric: string,
    severity: 'warning' | 'critical'
  ): string {
    switch (metric) {
      case 'hit_rate':
        return 'Review cache strategy and adjust TTL values';
      case 'memory_usage':
        return 'Increase cache memory or implement eviction policies';
      case 'eviction_rate':
        return 'Optimize cache size and review cached items';
      default:
        return 'Monitor cache performance and optimize as needed';
    }
  }

  private getNetworkRecommendation(
    metric: string,
    severity: 'warning' | 'critical'
  ): string {
    switch (metric) {
      case 'network_latency':
        return 'Optimize network routes and consider using CDN';
      case 'bandwidth_usage':
        return 'Implement traffic shaping and optimize data transfer';
      case 'packet_loss':
        return 'Investigate network issues and improve reliability';
      default:
        return 'Monitor network performance and optimize as needed';
    }
  }

  private async handleServiceIssues(
    serviceHealth: ServiceHealth[]
  ): Promise<void> {
    const span = this.apm.startSpan('handle-service-issues');

    try {
      for (const health of serviceHealth) {
        if (health.status !== 'healthy') {
          // Log issues
          this.logger.warn('Service health issues detected', {
            service: health.service,
            status: health.status,
            issues: health.issues,
          });

          // Create incidents
          await this.createIncidents(health);

          // Send alerts
          await this.sendAlerts(health);

          // Trigger auto-remediation
          await this.triggerRemediation(health);
        }
      }
    } finally {
      span?.end();
    }
  }

  private async createIncidents(health: ServiceHealth): Promise<void> {
    // Implementation for creating incidents
  }

  private async sendAlerts(health: ServiceHealth): Promise<void> {
    // Implementation for sending alerts
  }

  private async triggerRemediation(health: ServiceHealth): Promise<void> {
    // Implementation for triggering remediation
  }

  private async storeMetrics(serviceHealth: ServiceHealth[]): Promise<void> {
    const span = this.apm.startSpan('store-metrics');

    try {
      const timestamp = new Date().toISOString();

      for (const health of serviceHealth) {
        for (const metric of health.metrics) {
          await this.db.query(
            'INSERT INTO performance_metrics (service, metric_name, value, timestamp, tags) VALUES ($1, $2, $3, $4, $5)',
            [health.service, metric.name, metric.value, timestamp, metric.tags]
          );
        }
      }
    } finally {
      span?.end();
    }
  }

  private updateDashboards(serviceHealth: ServiceHealth[]): void {
    const span = this.apm.startSpan('update-dashboards');

    try {
      for (const health of serviceHealth) {
        for (const metric of health.metrics) {
          this.metrics.updateDashboard(
            health.service,
            metric.name,
            metric.value
          );
        }
      }
    } finally {
      span?.end();
    }
  }

  public async generateHealthReport(): Promise<string> {
    const span = this.apm.startSpan('generate-health-report');

    try {
      const serviceHealth = await this.db.query(`
        SELECT 
          service,
          metric_name,
          AVG(value) as avg_value,
          MAX(value) as max_value,
          MIN(value) as min_value
        FROM performance_metrics
        WHERE timestamp >= NOW() - INTERVAL '1 hour'
        GROUP BY service, metric_name
      `);

      return `
# Service Health Report

${serviceHealth.rows
  .map(
    row => `
## ${row.service} - ${row.metric_name}
- Average: ${row.avg_value.toFixed(2)}
- Maximum: ${row.max_value.toFixed(2)}
- Minimum: ${row.min_value.toFixed(2)}
`
  )
  .join('\n')}
      `;
    } finally {
      span?.end();
    }
  }
}
