import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile } from 'fs/promises';
import { logger } from '../utils/logger';
import { CheckResult } from './types';
import { validatePrometheusConfig } from '../utils/prometheus-checker';
import { checkGrafanaDashboards } from '../utils/grafana-checker';
import { validateAlertRules } from '../utils/alert-checker';

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

export async function runMonitoringChecks(): Promise<CheckResult> {
  const details: string[] = [];
  const errors: Error[] = [];

  try {
    // 1. Prometheus Status
    logger.info('Checking Prometheus status...');
    const prometheusStatus = await checkPrometheusStatus();
    
    if (!prometheusStatus.up || prometheusStatus.scrapeSuccessRate < 0.95) {
      details.push(`❌ Prometheus issues: Success rate ${(prometheusStatus.scrapeSuccessRate * 100).toFixed(1)}%`);
      errors.push(new Error('Prometheus metrics collection issues'));
    } else {
      details.push('✅ Prometheus metrics collection healthy');
    }

    // 2. Grafana Dashboards
    logger.info('Checking Grafana dashboards...');
    const dashboardStatus = await checkGrafanaDashboards();
    
    if (dashboardStatus.errors.length > 0) {
      details.push(`❌ Grafana dashboard issues: ${dashboardStatus.errors.join(', ')}`);
      errors.push(new Error('Grafana dashboard configuration issues'));
    } else {
      details.push('✅ Grafana dashboards properly configured');
    }

    // 3. Alert Rules
    logger.info('Checking alert rules...');
    const alertStatus = await checkAlertRules();
    
    const firingAlerts = alertStatus.filter(a => a.state === 'firing');
    if (firingAlerts.length > 0) {
      details.push(`❌ ${firingAlerts.length} active alerts`);
      errors.push(new Error('Active alerts detected'));
    } else {
      details.push('✅ No active alerts');
    }

    // 4. Logging System
    logger.info('Checking logging system...');
    const loggingStatus = await checkLoggingSystem();
    
    if (loggingStatus.indexHealth !== 'green' || loggingStatus.errors.length > 0) {
      details.push(`❌ Logging system issues: ${loggingStatus.errors.join(', ')}`);
      errors.push(new Error('Logging system issues detected'));
    } else {
      details.push('✅ Logging system healthy');
    }

    // 5. Tracing System
    logger.info('Checking tracing system...');
    const tracingStatus = await checkTracingSystem();
    
    if (tracingStatus.errorTraces > 0) {
      details.push(`❌ Tracing system errors: ${tracingStatus.errorTraces} error traces`);
      errors.push(new Error('Tracing system errors detected'));
    } else {
      details.push('✅ Tracing system healthy');
    }

    // 6. Resource Usage
    logger.info('Checking monitoring resource usage...');
    const resourceStatus = await checkResourceUsage();
    
    if (resourceStatus.issues.length > 0) {
      details.push(`❌ Resource usage issues: ${resourceStatus.issues.join(', ')}`);
      errors.push(new Error('Monitoring resource usage issues'));
    } else {
      details.push('✅ Monitoring resource usage within limits');
    }

    // 7. Retention Policies
    logger.info('Checking retention policies...');
    const retentionStatus = await checkRetentionPolicies();
    
    if (retentionStatus.issues.length > 0) {
      details.push(`❌ Retention policy issues: ${retentionStatus.issues.join(', ')}`);
      errors.push(new Error('Retention policy configuration issues'));
    } else {
      details.push('✅ Retention policies properly configured');
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

async function checkPrometheusStatus(): Promise<MetricsStatus> {
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

async function checkAlertRules(): Promise<AlertStatus[]> {
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

async function checkLoggingSystem(): Promise<LoggingStatus> {
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

async function checkTracingSystem(): Promise<TracingStatus> {
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

async function checkResourceUsage(): Promise<{ issues: string[] }> {
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

async function checkRetentionPolicies(): Promise<{ issues: string[] }> {
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