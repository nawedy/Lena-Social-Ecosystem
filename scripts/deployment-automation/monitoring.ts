import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile } from 'fs/promises';
import { logger } from '../utils/logger';
import { CheckResult } from './types';
import { validatePrometheusConfig } from '../utils/prometheus-checker';
import { checkGrafanaDashboards } from '../utils/grafana-checker';
import { validateAlertRules } from '../utils/alert-checker';
import { AIMonitoringService } from './ai-monitoring';

const execAsync = promisify(exec);

interface MonitoringConfig {
  prometheus: {
    url: string;
    scrapeInterval: number;
    evaluationInterval: number;
    retentionDays: number;
  };
  grafana: {
    url: string;
    datasources: string[];
    dashboards: string[];
  };
  alertmanager: {
    url: string;
    receivers: string[];
    routes: any[];
  };
  logging: {
    provider: string;
    retentionDays: number;
    indexPattern: string;
  };
  tracing: {
    enabled: boolean;
    samplingRate: number;
    exporters: string[];
  };
}

interface MetricsStatus {
  up: boolean;
  scrapeSuccessRate: number;
  lastScrape: string;
  totalSeries: number;
  memoryUsage: number;
  storageUsage: number;
}

interface AlertStatus {
  name: string;
  state: 'inactive' | 'pending' | 'firing';
  severity: 'info' | 'warning' | 'critical';
  activeAt?: string;
  value?: number;
  labels: Record<string, string>;
}

interface LoggingStatus {
  indexHealth: 'green' | 'yellow' | 'red';
  documentsCount: number;
  storageSize: number;
  ingestRate: number;
  errors: string[];
}

interface TracingStatus {
  sampledTraces: number;
  errorTraces: number;
  p95Latency: number;
  storageUsage: number;
}

interface MetricsResult {
  userGrowth: number;
  contentEngagement: number;
  platformActivity: number;
  contentCreationRate: number;
  userRetentionRate: number;
  atProtocolSyncStatus: number;
  socialMetrics: {
    dailyActiveUsers: number;
    averageSessionDuration: number;
    viralityScore: number;
    contentDistribution: {
      videos: number;
      images: number;
      text: number;
    };
    networkHealth: {
      federationStatus: boolean;
      atProtocolLatency: number;
      peerConnections: number;
    };
  };
  aiAnalysis: {
    trending_topics: Array<{
      topic: string;
      growth: number;
      sentiment: number;
    }>;
    content_health: {
      moderation_accuracy: number;
      flagged_content_ratio: number;
    };
    engagement_quality: {
      authentic_interactions: number;
      spam_ratio: number;
    };
  };
}

interface AlertThresholds {
  userGrowth: { warning: number; critical: number };
  contentEngagement: { warning: number; critical: number };
  atProtocolSync: { warning: number; critical: number };
  serviceHealth: { warning: number; critical: number };
}

const ALERT_THRESHOLDS: AlertThresholds = {
  userGrowth: { warning: -5, critical: -10 }, // Percentage change
  contentEngagement: { warning: 0.8, critical: 0.6 }, // Ratio
  atProtocolSync: { warning: 2000, critical: 5000 }, // Milliseconds
  serviceHealth: { warning: 95, critical: 90 }, // Percentage uptime
};

export class MonitoringService {
  private aiMonitoring: AIMonitoringService;

  constructor() {
    this.aiMonitoring = new AIMonitoringService();
  }

  async runMonitoringChecks(): Promise<CheckResult> {
    const details: string[] = [];
    const errors: Error[] = [];

    try {
      // 1. Prometheus Status
      logger.info('Checking Prometheus status...');
      const prometheusStatus = await this.checkPrometheusStatus();
      
      if (!prometheusStatus.up || prometheusStatus.scrapeSuccessRate < 0.95) {
        details.push(`❌ Prometheus issues: Success rate ${(prometheusStatus.scrapeSuccessRate * 100).toFixed(1)}%`);
        errors.push(new Error('Prometheus metrics collection issues'));
      } else {
        details.push('✅ Prometheus metrics collection healthy');
      }

      // 2. Grafana Dashboards
      logger.info('Checking Grafana dashboards...');
      const dashboardStatus = await this.checkGrafanaDashboards();
      
      if (dashboardStatus.errors.length > 0) {
        details.push(`❌ Grafana dashboard issues: ${dashboardStatus.errors.join(', ')}`);
        errors.push(new Error('Grafana dashboard configuration issues'));
      } else {
        details.push('✅ Grafana dashboards properly configured');
      }

      // 3. Alert Rules
      logger.info('Checking alert rules...');
      const alertStatus = await this.checkAlertRules();
      
      const firingAlerts = alertStatus.filter(a => a.state === 'firing');
      if (firingAlerts.length > 0) {
        details.push(`❌ ${firingAlerts.length} active alerts`);
        errors.push(new Error('Active alerts detected'));
      } else {
        details.push('✅ No active alerts');
      }

      // 4. Logging System
      logger.info('Checking logging system...');
      const loggingStatus = await this.checkLoggingSystem();
      
      if (loggingStatus.indexHealth !== 'green' || loggingStatus.errors.length > 0) {
        details.push(`❌ Logging system issues: ${loggingStatus.errors.join(', ')}`);
        errors.push(new Error('Logging system issues detected'));
      } else {
        details.push('✅ Logging system healthy');
      }

      // 5. Tracing System
      logger.info('Checking tracing system...');
      const tracingStatus = await this.checkTracingSystem();
      
      if (tracingStatus.errorTraces > 0) {
        details.push(`❌ Tracing system errors: ${tracingStatus.errorTraces} error traces`);
        errors.push(new Error('Tracing system errors detected'));
      } else {
        details.push('✅ Tracing system healthy');
      }

      // 6. Resource Usage
      logger.info('Checking monitoring resource usage...');
      const resourceStatus = await this.checkResourceUsage();
      
      if (resourceStatus.issues.length > 0) {
        details.push(`❌ Resource usage issues: ${resourceStatus.issues.join(', ')}`);
        errors.push(new Error('Monitoring resource usage issues'));
      } else {
        details.push('✅ Monitoring resource usage within limits');
      }

      // 7. Retention Policies
      logger.info('Checking retention policies...');
      const retentionStatus = await this.checkRetentionPolicies();
      
      if (retentionStatus.issues.length > 0) {
        details.push(`❌ Retention policy issues: ${retentionStatus.issues.join(', ')}`);
        errors.push(new Error('Retention policy configuration issues'));
      } else {
        details.push('✅ Retention policies properly configured');
      }

      // 8. Social Media Metrics
      logger.info('Checking social media metrics...');
      const socialMetrics = await this.checkSocialMetrics();
      
      const socialHealthIssues = this.validateSocialMetrics(socialMetrics);
      if (socialHealthIssues.length > 0) {
        details.push('❌ Social media metrics issues');
        details.push(...socialHealthIssues.map(issue => `  - ${issue}`));
        errors.push(new Error('Social media metrics issues detected'));
      } else {
        details.push('✅ Social media metrics healthy');
        details.push(`  - DAU: ${socialMetrics.socialMetrics.dailyActiveUsers}`);
        details.push(`  - Virality Score: ${socialMetrics.socialMetrics.viralityScore}`);
        details.push(`  - Federation Status: ${socialMetrics.socialMetrics.networkHealth.federationStatus ? 'Healthy' : 'Issues Detected'}`);
      }

      return {
        status: errors.length === 0 ? 'success' : 'failure',
        details,
        errors: errors.length > 0 ? errors : undefined
      };

    } catch (error) {
      logger.error('Monitoring checks failed:', error);
      return {
        status: 'failure',
        details: [...details, `❌ Error: ${error.message}`],
        errors: [error]
      };
    }
  }

  async checkPrometheusStatus(): Promise<MetricsStatus> {
    try {
      const { stdout } = await execAsync('curl -s http://localhost:9090/api/v1/status/tsdb');
      const status = JSON.parse(stdout).data;

      return {
        up: true,
        scrapeSuccessRate: status.scrapeSuccessRate,
        lastScrape: status.lastScrape,
        totalSeries: status.totalSeries,
        memoryUsage: status.memoryUsage,
        storageUsage: status.storageUsage
      };
    } catch (error) {
      throw new Error(`Failed to check Prometheus status: ${error.message}`);
    }
  }

  async checkAlertRules(): Promise<AlertStatus[]> {
    try {
      const { stdout } = await execAsync('curl -s http://localhost:9093/api/v2/alerts');
      const alerts = JSON.parse(stdout);

      return alerts.map((alert: any) => ({
        name: alert.labels.alertname,
        state: alert.state,
        severity: alert.labels.severity,
        activeAt: alert.activeAt,
        value: alert.value,
        labels: alert.labels
      }));
    } catch (error) {
      throw new Error(`Failed to check alert rules: ${error.message}`);
    }
  }

  async checkLoggingSystem(): Promise<LoggingStatus> {
    try {
      const { stdout } = await execAsync('curl -s http://localhost:9200/_cluster/health');
      const health = JSON.parse(stdout);

      const { stdout: stats } = await execAsync('curl -s http://localhost:9200/_stats');
      const indexStats = JSON.parse(stats);

      return {
        indexHealth: health.status,
        documentsCount: indexStats._all.total.docs.count,
        storageSize: indexStats._all.total.store.size_in_bytes,
        ingestRate: indexStats._all.total.indexing.index_total,
        errors: []
      };
    } catch (error) {
      return {
        indexHealth: 'red',
        documentsCount: 0,
        storageSize: 0,
        ingestRate: 0,
        errors: [`Failed to check logging system: ${error.message}`]
      };
    }
  }

  async checkTracingSystem(): Promise<TracingStatus> {
    try {
      const { stdout } = await execAsync('curl -s http://localhost:16686/api/traces/stats');
      const stats = JSON.parse(stdout);

      return {
        sampledTraces: stats.sampledTraces,
        errorTraces: stats.errorTraces,
        p95Latency: stats.p95Latency,
        storageUsage: stats.storageUsage
      };
    } catch (error) {
      throw new Error(`Failed to check tracing system: ${error.message}`);
    }
  }

  async checkResourceUsage(): Promise<{ issues: string[] }> {
    try {
      const issues: string[] = [];
      const thresholds = {
        prometheusMemory: 80, // 80% of allocated memory
        prometheusStorage: 70, // 70% of allocated storage
        elasticsearchStorage: 75, // 75% of allocated storage
        tracingStorage: 70 // 70% of allocated storage
      };

      // Check Prometheus resource usage
      const { stdout: promStats } = await execAsync('curl -s http://localhost:9090/api/v1/status/runtimeinfo');
      const promInfo = JSON.parse(promStats);

      if (promInfo.memoryUsage > thresholds.prometheusMemory) {
        issues.push(`Prometheus memory usage (${promInfo.memoryUsage}%) exceeds threshold`);
      }
      if (promInfo.storageUsage > thresholds.prometheusStorage) {
        issues.push(`Prometheus storage usage (${promInfo.storageUsage}%) exceeds threshold`);
      }

      // Check Elasticsearch resource usage
      const { stdout: esStats } = await execAsync('curl -s http://localhost:9200/_cluster/stats');
      const esInfo = JSON.parse(esStats);

      if (esInfo.nodes.fs.available_in_bytes / esInfo.nodes.fs.total_in_bytes < (1 - thresholds.elasticsearchStorage / 100)) {
        issues.push('Elasticsearch storage usage exceeds threshold');
      }

      return { issues };
    } catch (error) {
      return {
        issues: [`Failed to check resource usage: ${error.message}`]
      };
    }
  }

  async checkRetentionPolicies(): Promise<{ issues: string[] }> {
    try {
      const issues: string[] = [];

      // Check Prometheus retention
      const { stdout: promConfig } = await execAsync('cat /etc/prometheus/prometheus.yml');
      const config = await validatePrometheusConfig(promConfig);

      if (!config.storage?.tsdb?.retention?.time) {
        issues.push('Prometheus retention policy not configured');
      }

      // Check logging retention
      const { stdout: esIlm } = await execAsync('curl -s http://localhost:9200/_ilm/policy');
      const ilmPolicies = JSON.parse(esIlm);

      if (!ilmPolicies.log_retention_policy) {
        issues.push('Elasticsearch log retention policy not configured');
      }

      // Check tracing retention
      const { stdout: jaegerConfig } = await execAsync('cat /etc/jaeger/jaeger-collector.yaml');
      if (!jaegerConfig.includes('retention-days')) {
        issues.push('Jaeger retention policy not configured');
      }

      return { issues };
    } catch (error) {
      return {
        issues: [`Failed to check retention policies: ${error.message}`]
      };
    }
  }

  async checkSocialMetrics(): Promise<MetricsResult> {
    const socialMetrics = await this.measureSocialMetrics();
    
    // Add AI analysis
    const aiAnalysis = await this.aiMonitoring.analyzeContent();
    
    // Process AI insights
    const trendingTopics = aiAnalysis.trends
      .map(trend => ({
        topic: trend.topic,
        growth: trend.growth,
        sentiment: aiAnalysis.topics.find(t => t.name === trend.topic)?.sentiment || 0
      }))
      .slice(0, 10); // Top 10 trending topics
    
    return {
      userGrowth: await this.measureUserGrowth(),
      contentEngagement: await this.measureContentEngagement(),
      platformActivity: await this.measurePlatformActivity(),
      contentCreationRate: await this.measureContentCreation(),
      userRetentionRate: await this.measureUserRetention(),
      atProtocolSyncStatus: await this.checkATProtocolSync(),
      socialMetrics: {
        dailyActiveUsers: await this.measureDAU(),
        averageSessionDuration: await this.measureSessionDuration(),
        viralityScore: await this.calculateViralityScore(),
        contentDistribution: await this.getContentDistribution(),
        networkHealth: await this.checkNetworkHealth()
      },
      aiAnalysis: {
        trending_topics: trendingTopics,
        content_health: {
          moderation_accuracy: aiAnalysis.moderation.accuracy,
          flagged_content_ratio: aiAnalysis.moderation.flagged_content / totalContent
        },
        engagement_quality: {
          authentic_interactions: await this.measureAuthenticEngagement(),
          spam_ratio: await this.calculateSpamRatio()
        }
      }
    };
  }

  async measureContentCreation(): Promise<number> {
    // Implementation for measuring content creation rate
    return 0;
  }

  async measureUserRetention(): Promise<number> {
    // Implementation for measuring user retention
    return 0;
  }

  async checkATProtocolSync(): Promise<number> {
    // Implementation for checking AT Protocol sync status
    return 0;
  }

  async measureDAU(): Promise<number> {
    try {
      const { stdout } = await execAsync(
        `curl -s -X GET "http://localhost:9090/api/v1/query?query=sum(increase(user_sessions_total[24h]))"`
      );
      const result = JSON.parse(stdout);
      return parseInt(result.data.result[0].value[1]);
    } catch (error) {
      logger.error('Failed to measure DAU:', error);
      return 0;
    }
  }

  async measureSessionDuration(): Promise<number> {
    try {
      const { stdout } = await execAsync(
        `curl -s -X GET "http://localhost:9090/api/v1/query?query=avg(rate(session_duration_seconds_sum[1h])/rate(session_duration_seconds_count[1h]))"`
      );
      const result = JSON.parse(stdout);
      return parseFloat(result.data.result[0].value[1]);
    } catch (error) {
      logger.error('Failed to measure session duration:', error);
      return 0;
    }
  }

  async calculateViralityScore(): Promise<number> {
    try {
      // Composite metric combining shares, reposts, and reach
      const { stdout } = await execAsync(
        `curl -s -X GET "http://localhost:9090/api/v1/query?query=sum(rate(content_shares_total[1h])) / sum(rate(content_views_total[1h]))"`
      );
      const result = JSON.parse(stdout);
      return parseFloat(result.data.result[0].value[1]);
    } catch (error) {
      logger.error('Failed to calculate virality score:', error);
      return 0;
    }
  }

  async getContentDistribution(): Promise<{ videos: number; images: number; text: number }> {
    try {
      const { stdout } = await execAsync(
        `curl -s -X GET "http://localhost:9090/api/v1/query?query=sum(increase(content_created_total[24h])) by (type)"`
      );
      const result = JSON.parse(stdout);
      return {
        videos: parseInt(result.data.result.find(r => r.metric.type === 'video')?.value[1] || '0'),
        images: parseInt(result.data.result.find(r => r.metric.type === 'image')?.value[1] || '0'),
        text: parseInt(result.data.result.find(r => r.metric.type === 'text')?.value[1] || '0')
      };
    } catch (error) {
      logger.error('Failed to get content distribution:', error);
      return { videos: 0, images: 0, text: 0 };
    }
  }

  async checkNetworkHealth(): Promise<{ federationStatus: boolean; atProtocolLatency: number; peerConnections: number }> {
    try {
      const [federationStatus, latency, connections] = await Promise.all([
        this.checkFederationStatus(),
        this.measureATProtocolLatency(),
        this.countPeerConnections()
      ]);
      return {
        federationStatus,
        atProtocolLatency: latency,
        peerConnections: connections
      };
    } catch (error) {
      logger.error('Failed to check network health:', error);
      return { federationStatus: false, atProtocolLatency: 0, peerConnections: 0 };
    }
  }

  validateSocialMetrics(metrics: MetricsResult): string[] {
    const issues: string[] = [];
    
    if (metrics.userGrowth < ALERT_THRESHOLDS.userGrowth.critical) {
      issues.push(`Critical: User growth rate (${metrics.userGrowth}%) below threshold`);
    } else if (metrics.userGrowth < ALERT_THRESHOLDS.userGrowth.warning) {
      issues.push(`Warning: User growth rate (${metrics.userGrowth}%) below optimal`);
    }
    
    if (metrics.socialMetrics.networkHealth.atProtocolLatency > ALERT_THRESHOLDS.atProtocolSync.critical) {
      issues.push(`Critical: AT Protocol latency (${metrics.socialMetrics.networkHealth.atProtocolLatency}ms) too high`);
    }
    
    if (metrics.socialMetrics.dailyActiveUsers < metrics.userRetentionRate * 0.5) {
      issues.push('Critical: Significant drop in daily active users');
    }
    
    return issues;
  }
} 