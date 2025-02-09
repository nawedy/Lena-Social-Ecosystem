import { adminDashboardService } from '../admin/AdminDashboardService';
import { healthCheckService } from '../monitoring/HealthCheckService';
import { metricsService } from '../monitoring/MetricsService';
import { errorService } from '../error/ErrorService';
import { configService } from '../config/GlobalConfig';

describe('Admin Dashboard Service', () => {
  beforeEach(async () => {
    await adminDashboardService.cleanup();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await adminDashboardService.cleanup();
  });

  describe('Initialization', () => {
    it('should initialize dashboard services', async () => {
      const startHealthSpy = jest.spyOn(healthCheckService, 'start');
      const startMetricsSpy = jest.spyOn(metricsService, 'startCollection');

      await adminDashboardService.initialize();

      expect(startHealthSpy).toHaveBeenCalled();
      expect(startMetricsSpy).toHaveBeenCalled();
    });

    it('should prevent multiple initializations', async () => {
      const startHealthSpy = jest.spyOn(healthCheckService, 'start');

      await adminDashboardService.initialize();
      await adminDashboardService.initialize();

      expect(startHealthSpy).toHaveBeenCalledTimes(1);
    });

    it('should handle initialization errors', async () => {
      const error = new Error('Initialization failed');
      jest.spyOn(healthCheckService, 'start').mockRejectedValue(error);

      await expect(adminDashboardService.initialize()).rejects.toThrow(error);
    });
  });

  describe('Metrics Collection', () => {
    beforeEach(async () => {
      await adminDashboardService.initialize();
    });

    it('should collect system metrics', async () => {
      jest.spyOn(metricsService, 'getMetrics').mockReturnValue({
        system_cpu_usage: { value: 50 },
        system_memory_usage: { value: 60 },
        http_requests_total: { value: 1000 },
        http_request_duration_seconds: {
          p50: 0.1,
          p90: 0.5,
          p99: 1.0
        },
        active_users: { value: 100 },
        content_uploads_total: { value: 500 }
      });

      const metrics = await adminDashboardService.getMetrics();

      expect(metrics.system.cpu).toBe(50);
      expect(metrics.system.memory).toBe(60);
      expect(metrics.performance.requestRate).toBe(1000);
      expect(metrics.performance.responseTime.p90).toBe(0.5);
      expect(metrics.business.activeUsers).toBe(100);
      expect(metrics.business.contentUploads).toBe(500);
    });

    it('should handle missing metrics', async () => {
      jest.spyOn(metricsService, 'getMetrics').mockReturnValue({});

      const metrics = await adminDashboardService.getMetrics();

      expect(metrics.system.cpu).toBe(0);
      expect(metrics.system.memory).toBe(0);
      expect(metrics.performance.requestRate).toBe(0);
      expect(metrics.business.activeUsers).toBe(0);
    });
  });

  describe('Alert Management', () => {
    beforeEach(async () => {
      await adminDashboardService.initialize();
    });

    it('should get active alerts', async () => {
      const mockAlerts = [{
        id: '1',
        rule: {
          severity: 'critical',
          metric: 'system_cpu'
        },
        startsAt: Date.now()
      }];

      jest.spyOn(healthCheckService, 'getActiveAlerts').mockReturnValue(mockAlerts as any);

      const alerts = await adminDashboardService.getAlerts();

      expect(alerts.active.length).toBe(1);
      expect(alerts.active[0].severity).toBe('critical');
      expect(alerts.active[0].component).toBe('system');
    });

    it('should maintain alert history', async () => {
      const mockAlert = {
        id: '1',
        rule: {
          severity: 'warning',
          metric: 'memory_usage'
        },
        startsAt: Date.now()
      };

      // Simulate alert lifecycle
      healthCheckService.emit('health_changed', {
        component: 'memory',
        status: 'degraded',
        details: mockAlert
      });

      const alerts = await adminDashboardService.getAlerts();
      expect(alerts.history.length).toBeGreaterThan(0);
    });
  });

  describe('System Status', () => {
    beforeEach(async () => {
      await adminDashboardService.initialize();
    });

    it('should get system health status', async () => {
      const mockHealth = {
        status: 'healthy',
        details: {
          database: {
            status: 'healthy',
            lastCheck: Date.now()
          },
          cache: {
            status: 'healthy',
            lastCheck: Date.now()
          }
        }
      };

      jest.spyOn(healthCheckService, 'getHealth').mockReturnValue(mockHealth as any);

      const status = await adminDashboardService.getSystemStatus();

      expect(status.health.status).toBe('healthy');
      expect(Object.keys(status.health.components)).toContain('database');
      expect(Object.keys(status.health.components)).toContain('cache');
    });

    it('should include service information', async () => {
      jest.spyOn(configService, 'get').mockReturnValue({
        version: '1.0.0'
      });

      const status = await adminDashboardService.getSystemStatus();

      expect(status.services.api.version).toBe('1.0.0');
      expect(status.services.api.status).toBe('running');
    });
  });

  describe('Audit Logging', () => {
    it('should log audit events', async () => {
      const auditEvent = {
        action: 'test_action',
        user: 'test_user',
        details: { key: 'value' },
        status: 'success' as const
      };

      adminDashboardService.logAudit(auditEvent);

      const logs = await adminDashboardService.getAuditLogs();
      expect(logs.length).toBe(1);
      expect(logs[0].action).toBe('test_action');
      expect(logs[0].user).toBe('test_user');
    });

    it('should filter audit logs', async () => {
      const now = Date.now();

      adminDashboardService.logAudit({
        action: 'action1',
        user: 'user1',
        details: {},
        status: 'success'
      });

      adminDashboardService.logAudit({
        action: 'action2',
        user: 'user2',
        details: {},
        status: 'success'
      });

      const userLogs = await adminDashboardService.getAuditLogs({
        user: 'user1'
      });
      expect(userLogs.length).toBe(1);
      expect(userLogs[0].user).toBe('user1');

      const timeLogs = await adminDashboardService.getAuditLogs({
        startTime: now
      });
      expect(timeLogs.length).toBe(2);
    });

    it('should limit audit log size', async () => {
      // Add more than 1000 logs
      for (let i = 0; i < 1100; i++) {
        adminDashboardService.logAudit({
          action: `action${i}`,
          user: 'test',
          details: {},
          status: 'success'
        });
      }

      const logs = await adminDashboardService.getAuditLogs();
      expect(logs.length).toBe(1000);
      expect(logs[0].action).toBe('action100'); // First 100 should be trimmed
    });
  });

  describe('Admin Actions', () => {
    beforeEach(async () => {
      await adminDashboardService.initialize();
    });

    it('should restart services', async () => {
      const serviceRestarted = jest.fn();
      adminDashboardService.on('service_restarted', serviceRestarted);

      await adminDashboardService.restartService('api');

      expect(serviceRestarted).toHaveBeenCalledWith({
        service: 'api'
      });

      const logs = await adminDashboardService.getAuditLogs({
        action: 'service_restart'
      });
      expect(logs.length).toBe(1);
    });

    it('should update configuration', async () => {
      const updateSpy = jest.spyOn(configService, 'update');

      await adminDashboardService.updateConfiguration('test.path', 'new-value');

      expect(updateSpy).toHaveBeenCalledWith('test.path', 'new-value');

      const logs = await adminDashboardService.getAuditLogs({
        action: 'config_update'
      });
      expect(logs.length).toBe(1);
    });

    it('should clear error history', async () => {
      const clearSpy = jest.spyOn(errorService, 'clearResolvedErrors');

      await adminDashboardService.clearErrorHistory();

      expect(clearSpy).toHaveBeenCalled();

      const logs = await adminDashboardService.getAuditLogs({
        action: 'clear_error_history'
      });
      expect(logs.length).toBe(1);
    });
  });

  describe('Dashboard Customization', () => {
    it('should save dashboard layout', async () => {
      const layout = {
        widgets: ['metrics', 'alerts']
      };

      await adminDashboardService.saveDashboardLayout('test-user', layout);

      const logs = await adminDashboardService.getAuditLogs({
        action: 'dashboard_layout_update',
        user: 'test-user'
      });

      expect(logs.length).toBe(1);
      expect(logs[0].details.layout).toEqual(layout);
    });
  });

  describe('Event Handling', () => {
    it('should emit dashboard updates', async () => {
      const dashboardUpdate = jest.fn();
      adminDashboardService.on('dashboard_update', dashboardUpdate);

      // Simulate health change
      healthCheckService.emit('health_changed', {
        component: 'test',
        status: 'degraded'
      });

      expect(dashboardUpdate).toHaveBeenCalledWith({
        type: 'health',
        data: expect.any(Object)
      });
    });

    it('should handle error events', async () => {
      const dashboardUpdate = jest.fn();
      adminDashboardService.on('dashboard_update', dashboardUpdate);

      // Simulate error event
      errorService.emit('error', new Error('Test error'));

      expect(dashboardUpdate).toHaveBeenCalledWith({
        type: 'error',
        data: expect.any(Error)
      });
    });
  });
}); 