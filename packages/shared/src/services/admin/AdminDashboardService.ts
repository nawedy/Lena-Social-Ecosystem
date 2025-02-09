import { EventEmitter } from 'events';
import { configService } from '../config/GlobalConfig';
import { errorService } from '../error/ErrorService';
import { loggingService } from '../logging/LoggingService';
import { metricsService } from '../monitoring/MetricsService';
import { tracingService } from '../monitoring/TracingService';
import { healthCheckService } from '../monitoring/HealthCheckService';

interface DashboardMetrics {
  system: {
    cpu: number;
    memory: number;
    uptime: number;
  };
  performance: {
    requestRate: number;
    errorRate: number;
    responseTime: {
      p50: number;
      p90: number;
      p99: number;
    };
  };
  business: {
    activeUsers: number;
    contentUploads: number;
    storageUsed: number;
  };
}

interface DashboardAlerts {
  active: Array<{
    id: string;
    severity: 'info' | 'warning' | 'critical';
    message: string;
    timestamp: number;
    component: string;
  }>;
  history: Array<{
    id: string;
    severity: 'info' | 'warning' | 'critical';
    message: string;
    timestamp: number;
    component: string;
    resolvedAt: number;
  }>;
}

interface SystemStatus {
  health: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    components: Record<string, {
      status: 'healthy' | 'degraded' | 'unhealthy';
      message?: string;
      lastCheck: number;
    }>;
  };
  services: Record<string, {
    status: 'running' | 'stopped' | 'error';
    version: string;
    lastDeployment: number;
  }>;
}

interface AuditLog {
  timestamp: number;
  action: string;
  user: string;
  details: Record<string, any>;
  status: 'success' | 'failure';
}

class AdminDashboardService extends EventEmitter {
  private static instance: AdminDashboardService;
  private auditLogs: AuditLog[] = [];
  private alertHistory: DashboardAlerts['history'] = [];
  private isInitialized = false;

  private constructor() {
    super();
    this.setupEventListeners();
  }

  static getInstance(): AdminDashboardService {
    if (!AdminDashboardService.instance) {
      AdminDashboardService.instance = new AdminDashboardService();
    }
    return AdminDashboardService.instance;
  }

  private setupEventListeners() {
    // Listen for health changes
    healthCheckService.on('health_changed', (event) => {
      this.emit('dashboard_update', {
        type: 'health',
        data: event
      });
      this.logAudit({
        action: 'health_status_change',
        user: 'system',
        details: event,
        status: 'success'
      });
    });

    // Listen for error events
    errorService.on('error', (error) => {
      this.emit('dashboard_update', {
        type: 'error',
        data: error
      });
    });
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      // Start health checks
      healthCheckService.start();

      // Start metrics collection
      metricsService.startCollection();

      this.isInitialized = true;
      
      this.logAudit({
        action: 'dashboard_initialized',
        user: 'system',
        details: {},
        status: 'success'
      });
    } catch (error) {
      this.logAudit({
        action: 'dashboard_initialization_failed',
        user: 'system',
        details: { error: error.message },
        status: 'failure'
      });
      throw error;
    }
  }

  async getMetrics(): Promise<DashboardMetrics> {
    return tracingService.trace('admin.get_metrics', async () => {
      const metrics = metricsService.getMetrics();

      return {
        system: {
          cpu: metrics.system_cpu_usage?.value || 0,
          memory: metrics.system_memory_usage?.value || 0,
          uptime: process.uptime()
        },
        performance: {
          requestRate: metrics.http_requests_total?.value || 0,
          errorRate: this.calculateErrorRate(),
          responseTime: {
            p50: metrics.http_request_duration_seconds?.p50 || 0,
            p90: metrics.http_request_duration_seconds?.p90 || 0,
            p99: metrics.http_request_duration_seconds?.p99 || 0
          }
        },
        business: {
          activeUsers: metrics.active_users?.value || 0,
          contentUploads: metrics.content_uploads_total?.value || 0,
          storageUsed: this.calculateStorageUsed()
        }
      };
    });
  }

  private calculateErrorRate(): number {
    const errorStats = errorService.getErrorStats();
    const timeWindow = 5 * 60 * 1000; // 5 minutes
    const now = Date.now();
    
    return errorStats.recentErrors.filter(e => e.timestamp > now - timeWindow).length;
  }

  private calculateStorageUsed(): number {
    // Implementation would depend on actual storage service
    return 0;
  }

  async getAlerts(): Promise<DashboardAlerts> {
    return tracingService.trace('admin.get_alerts', async () => {
      const activeAlerts = healthCheckService.getActiveAlerts().map(alert => ({
        id: alert.id,
        severity: alert.rule.severity,
        message: alert.rule.metric,
        timestamp: alert.startsAt,
        component: alert.rule.metric.split('_')[0]
      }));

      return {
        active: activeAlerts,
        history: this.alertHistory
      };
    });
  }

  async getSystemStatus(): Promise<SystemStatus> {
    return tracingService.trace('admin.get_system_status', async () => {
      const health = healthCheckService.getHealth();
      
      return {
        health: {
          status: health.status,
          components: Object.entries(health.details).reduce((acc, [name, details]) => {
            acc[name] = {
              status: details.status,
              message: details.message,
              lastCheck: details.lastCheck
            };
            return acc;
          }, {} as SystemStatus['health']['components'])
        },
        services: {
          api: {
            status: 'running',
            version: configService.get('platform').version,
            lastDeployment: Date.now() // Replace with actual deployment timestamp
          },
          worker: {
            status: 'running',
            version: configService.get('platform').version,
            lastDeployment: Date.now()
          }
        }
      };
    });
  }

  async getAuditLogs(options: {
    startTime?: number;
    endTime?: number;
    user?: string;
    action?: string;
    limit?: number;
  } = {}): Promise<AuditLog[]> {
    return tracingService.trace('admin.get_audit_logs', async () => {
      let logs = this.auditLogs;

      if (options.startTime) {
        logs = logs.filter(log => log.timestamp >= options.startTime!);
      }

      if (options.endTime) {
        logs = logs.filter(log => log.timestamp <= options.endTime!);
      }

      if (options.user) {
        logs = logs.filter(log => log.user === options.user);
      }

      if (options.action) {
        logs = logs.filter(log => log.action === options.action);
      }

      return logs.slice(0, options.limit || 100);
    });
  }

  logAudit(log: Omit<AuditLog, 'timestamp'>) {
    const auditLog: AuditLog = {
      ...log,
      timestamp: Date.now()
    };

    this.auditLogs.push(auditLog);
    this.emit('audit_log', auditLog);

    // Keep only last 1000 logs
    if (this.auditLogs.length > 1000) {
      this.auditLogs = this.auditLogs.slice(-1000);
    }
  }

  // Admin actions
  async restartService(service: string) {
    return tracingService.trace('admin.restart_service', async (span) => {
      try {
        span.setAttributes({
          'service.name': service
        });

        // Implementation would depend on deployment infrastructure
        this.logAudit({
          action: 'service_restart',
          user: 'admin', // Replace with actual user
          details: { service },
          status: 'success'
        });

        this.emit('service_restarted', { service });
      } catch (error) {
        this.logAudit({
          action: 'service_restart',
          user: 'admin',
          details: { service, error: error.message },
          status: 'failure'
        });
        throw error;
      }
    });
  }

  async updateConfiguration(path: string, value: any) {
    return tracingService.trace('admin.update_config', async (span) => {
      try {
        span.setAttributes({
          'config.path': path
        });

        await configService.update(path, value);

        this.logAudit({
          action: 'config_update',
          user: 'admin',
          details: { path, value },
          status: 'success'
        });
      } catch (error) {
        this.logAudit({
          action: 'config_update',
          user: 'admin',
          details: { path, value, error: error.message },
          status: 'failure'
        });
        throw error;
      }
    });
  }

  async clearErrorHistory() {
    return tracingService.trace('admin.clear_errors', async () => {
      try {
        await errorService.clearResolvedErrors();

        this.logAudit({
          action: 'clear_error_history',
          user: 'admin',
          details: {},
          status: 'success'
        });
      } catch (error) {
        this.logAudit({
          action: 'clear_error_history',
          user: 'admin',
          details: { error: error.message },
          status: 'failure'
        });
        throw error;
      }
    });
  }

  // Dashboard customization
  async saveDashboardLayout(userId: string, layout: any) {
    return tracingService.trace('admin.save_layout', async () => {
      try {
        // Implementation would persist layout to user preferences
        this.logAudit({
          action: 'dashboard_layout_update',
          user: userId,
          details: { layout },
          status: 'success'
        });
      } catch (error) {
        this.logAudit({
          action: 'dashboard_layout_update',
          user: userId,
          details: { layout, error: error.message },
          status: 'failure'
        });
        throw error;
      }
    });
  }

  // Cleanup
  async cleanup() {
    healthCheckService.stop();
    metricsService.stopCollection();
    this.isInitialized = false;
  }
}

// Export singleton instance
export const adminDashboardService = AdminDashboardService.getInstance(); 