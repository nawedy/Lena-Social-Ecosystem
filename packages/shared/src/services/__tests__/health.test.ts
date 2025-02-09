import { healthCheckService } from '../monitoring/HealthCheckService';
import { metricsService } from '../monitoring/MetricsService';

describe('Health Check Service', () => {
  beforeEach(() => {
    healthCheckService.stop();
    // Reset health check results
    (healthCheckService as any).results.clear();
  });

  afterEach(() => {
    healthCheckService.stop();
  });

  describe('Health Check Registration', () => {
    it('should register new health checks', () => {
      healthCheckService.registerCheck({
        name: 'test_check',
        check: async () => ({
          status: 'healthy',
          lastCheck: Date.now()
        }),
        interval: 60000,
        timeout: 5000
      });

      const health = healthCheckService.getHealth();
      expect(health.details.test_check).toBeDefined();
    });

    it('should prevent duplicate health check registration', () => {
      healthCheckService.registerCheck({
        name: 'unique_check',
        check: async () => ({
          status: 'healthy',
          lastCheck: Date.now()
        }),
        interval: 60000,
        timeout: 5000
      });

      expect(() => {
        healthCheckService.registerCheck({
          name: 'unique_check',
          check: async () => ({
            status: 'healthy',
            lastCheck: Date.now()
          }),
          interval: 60000,
          timeout: 5000
        });
      }).toThrow('Health check unique_check already exists');
    });
  });

  describe('Health Check Execution', () => {
    it('should run health checks', async () => {
      const mockCheck = jest.fn().mockResolvedValue({
        status: 'healthy',
        lastCheck: Date.now()
      });

      healthCheckService.registerCheck({
        name: 'test_check',
        check: mockCheck,
        interval: 60000,
        timeout: 5000
      });

      await healthCheckService.runCheck('test_check');
      expect(mockCheck).toHaveBeenCalled();
    });

    it('should handle check timeouts', async () => {
      healthCheckService.registerCheck({
        name: 'slow_check',
        check: async () => {
          await new Promise(resolve => setTimeout(resolve, 2000));
          return {
            status: 'healthy',
            lastCheck: Date.now()
          };
        },
        interval: 60000,
        timeout: 100
      });

      const result = await healthCheckService.runCheck('slow_check');
      expect(result.status).toBe('unhealthy');
      expect(result.message).toContain('timeout');
    });

    it('should handle check errors', async () => {
      healthCheckService.registerCheck({
        name: 'failing_check',
        check: async () => {
          throw new Error('Check failed');
        },
        interval: 60000,
        timeout: 5000
      });

      const result = await healthCheckService.runCheck('failing_check');
      expect(result.status).toBe('unhealthy');
      expect(result.message).toBe('Check failed');
    });
  });

  describe('System Health Check', () => {
    beforeEach(() => {
      // Mock metrics service
      jest.spyOn(metricsService, 'getMetrics').mockReturnValue({
        system_cpu_usage: { value: 50 },
        system_memory_usage: { value: 60 }
      });
    });

    it('should report healthy when resources are normal', async () => {
      const result = await healthCheckService.runCheck('system');
      expect(result.status).toBe('healthy');
    });

    it('should report degraded when resources are high', async () => {
      jest.spyOn(metricsService, 'getMetrics').mockReturnValue({
        system_cpu_usage: { value: 75 },
        system_memory_usage: { value: 80 }
      });

      const result = await healthCheckService.runCheck('system');
      expect(result.status).toBe('degraded');
    });

    it('should report unhealthy when resources are critical', async () => {
      jest.spyOn(metricsService, 'getMetrics').mockReturnValue({
        system_cpu_usage: { value: 95 },
        system_memory_usage: { value: 92 }
      });

      const result = await healthCheckService.runCheck('system');
      expect(result.status).toBe('unhealthy');
    });
  });

  describe('Dependency Checks', () => {
    it('should handle dependent health checks', async () => {
      // Register parent check
      healthCheckService.registerCheck({
        name: 'parent',
        check: async () => ({
          status: 'unhealthy',
          lastCheck: Date.now()
        }),
        interval: 60000,
        timeout: 5000
      });

      // Register dependent check
      healthCheckService.registerCheck({
        name: 'child',
        check: async () => ({
          status: 'healthy',
          lastCheck: Date.now()
        }),
        interval: 60000,
        timeout: 5000,
        dependencies: ['parent']
      });

      await healthCheckService.runCheck('parent');
      await healthCheckService.runCheck('child');

      const health = healthCheckService.getHealth();
      expect(health.details.child.status).toBe('unhealthy');
      expect(health.details.child.message).toContain('Dependency parent is unhealthy');
    });
  });

  describe('Health Status Aggregation', () => {
    beforeEach(async () => {
      healthCheckService.registerCheck({
        name: 'check1',
        check: async () => ({
          status: 'healthy',
          lastCheck: Date.now()
        }),
        interval: 60000,
        timeout: 5000
      });

      healthCheckService.registerCheck({
        name: 'check2',
        check: async () => ({
          status: 'degraded',
          lastCheck: Date.now()
        }),
        interval: 60000,
        timeout: 5000
      });

      await healthCheckService.runCheck('check1');
      await healthCheckService.runCheck('check2');
    });

    it('should aggregate health status correctly', () => {
      const health = healthCheckService.getHealth();
      expect(health.status).toBe('degraded');
      expect(Object.keys(health.details).length).toBe(2);
    });

    it('should prioritize unhealthy status', async () => {
      healthCheckService.registerCheck({
        name: 'check3',
        check: async () => ({
          status: 'unhealthy',
          lastCheck: Date.now()
        }),
        interval: 60000,
        timeout: 5000
      });

      await healthCheckService.runCheck('check3');

      const health = healthCheckService.getHealth();
      expect(health.status).toBe('unhealthy');
    });
  });

  describe('Health Check Service Lifecycle', () => {
    it('should start and stop health checks', async () => {
      const mockCheck = jest.fn().mockResolvedValue({
        status: 'healthy',
        lastCheck: Date.now()
      });

      healthCheckService.registerCheck({
        name: 'interval_check',
        check: mockCheck,
        interval: 100,
        timeout: 5000
      });

      healthCheckService.start();
      await new Promise(resolve => setTimeout(resolve, 250));
      
      expect(mockCheck).toHaveBeenCalled();
      const callCount = mockCheck.mock.calls.length;

      healthCheckService.stop();
      await new Promise(resolve => setTimeout(resolve, 250));

      expect(mockCheck.mock.calls.length).toBe(callCount);
    });
  });

  describe('HTTP Endpoint', () => {
    it('should create health check endpoint', async () => {
      const endpoint = healthCheckService.createHealthEndpoint();
      const req = {};
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };

      await endpoint(req, res);

      expect(res.status).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        status: expect.any(String),
        details: expect.any(Object),
        timestamp: expect.any(Number)
      }));
    });

    it('should return 503 when unhealthy', async () => {
      healthCheckService.registerCheck({
        name: 'unhealthy_check',
        check: async () => ({
          status: 'unhealthy',
          lastCheck: Date.now()
        }),
        interval: 60000,
        timeout: 5000
      });

      await healthCheckService.runCheck('unhealthy_check');

      const endpoint = healthCheckService.createHealthEndpoint();
      const req = {};
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };

      await endpoint(req, res);

      expect(res.status).toHaveBeenCalledWith(503);
    });
  });

  describe('Event Emission', () => {
    it('should emit health changed events', async () => {
      const healthChanged = jest.fn();
      healthCheckService.on('health_changed', healthChanged);

      healthCheckService.registerCheck({
        name: 'event_check',
        check: async () => ({
          status: 'degraded',
          lastCheck: Date.now()
        }),
        interval: 60000,
        timeout: 5000
      });

      await healthCheckService.runCheck('event_check');

      expect(healthChanged).toHaveBeenCalledWith(expect.objectContaining({
        component: 'event_check',
        status: 'degraded'
      }));
    });
  });
}); 