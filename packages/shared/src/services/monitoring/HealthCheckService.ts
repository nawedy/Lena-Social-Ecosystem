import { EventEmitter } from 'events';
import { configService } from '../config/GlobalConfig';
import { errorService } from '../error/ErrorService';
import { loggingService } from '../logging/LoggingService';
import { metricsService } from './MetricsService';
import { tracingService } from './TracingService';

interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  details: Record<string, ComponentHealth>;
  timestamp: number;
}

interface ComponentHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  message?: string;
  details?: Record<string, any>;
  lastCheck: number;
  latency?: number;
}

interface HealthCheck {
  name: string;
  check: () => Promise<ComponentHealth>;
  interval: number;
  timeout: number;
  dependencies?: string[];
}

class HealthCheckService extends EventEmitter {
  private static instance: HealthCheckService;
  private checks: Map<string, HealthCheck> = new Map();
  private results: Map<string, ComponentHealth> = new Map();
  private checkIntervals: Map<string, NodeJS.Timer> = new Map();
  private isRunning = false;

  private constructor() {
    super();
    this.setupDefaultChecks();
  }

  static getInstance(): HealthCheckService {
    if (!HealthCheckService.instance) {
      HealthCheckService.instance = new HealthCheckService();
    }
    return HealthCheckService.instance;
  }

  private setupDefaultChecks() {
    // System health check
    this.registerCheck({
      name: 'system',
      check: async () => {
        const metrics = metricsService.getMetrics();
        const cpuUsage = metrics.system_cpu_usage?.value || 0;
        const memoryUsage = metrics.system_memory_usage?.value || 0;

        let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
        if (cpuUsage > 90 || memoryUsage > 90) {
          status = 'unhealthy';
        } else if (cpuUsage > 70 || memoryUsage > 70) {
          status = 'degraded';
        }

        return {
          status,
          details: {
            cpu: cpuUsage,
            memory: memoryUsage
          },
          lastCheck: Date.now()
        };
      },
      interval: 30000, // 30 seconds
      timeout: 5000
    });

    // Database health check
    this.registerCheck({
      name: 'database',
      check: async () => {
        try {
          const start = Date.now();
          // Implement actual database check here
          const latency = Date.now() - start;

          return {
            status: 'healthy',
            details: {
              latency,
              connections: 10 // Replace with actual connection pool stats
            },
            lastCheck: Date.now(),
            latency
          };
        } catch (error) {
          return {
            status: 'unhealthy',
            message: error.message,
            lastCheck: Date.now()
          };
        }
      },
      interval: 60000, // 1 minute
      timeout: 5000
    });

    // Cache health check
    this.registerCheck({
      name: 'cache',
      check: async () => {
        try {
          const start = Date.now();
          // Implement actual cache check here
          const latency = Date.now() - start;

          return {
            status: 'healthy',
            details: {
              latency,
              hitRate: 0.95 // Replace with actual hit rate
            },
            lastCheck: Date.now(),
            latency
          };
        } catch (error) {
          return {
            status: 'unhealthy',
            message: error.message,
            lastCheck: Date.now()
          };
        }
      },
      interval: 60000,
      timeout: 5000,
      dependencies: ['database']
    });

    // Storage health check
    this.registerCheck({
      name: 'storage',
      check: async () => {
        try {
          const start = Date.now();
          // Implement actual storage check here
          const latency = Date.now() - start;

          return {
            status: 'healthy',
            details: {
              latency,
              availableSpace: '500GB' // Replace with actual storage stats
            },
            lastCheck: Date.now(),
            latency
          };
        } catch (error) {
          return {
            status: 'unhealthy',
            message: error.message,
            lastCheck: Date.now()
          };
        }
      },
      interval: 300000, // 5 minutes
      timeout: 10000
    });

    // External services health check
    this.registerCheck({
      name: 'external_services',
      check: async () => {
        const services = {
          ipfs: await this.checkExternalService('ipfs'),
          blockchain: await this.checkExternalService('blockchain')
        };

        const unhealthy = Object.values(services).filter(s => s.status === 'unhealthy');
        const degraded = Object.values(services).filter(s => s.status === 'degraded');

        let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
        if (unhealthy.length > 0) {
          status = 'unhealthy';
        } else if (degraded.length > 0) {
          status = 'degraded';
        }

        return {
          status,
          details: services,
          lastCheck: Date.now()
        };
      },
      interval: 60000,
      timeout: 10000
    });
  }

  private async checkExternalService(service: string): Promise<ComponentHealth> {
    const start = Date.now();
    try {
      // Implement actual service check here
      await new Promise(resolve => setTimeout(resolve, Math.random() * 1000));
      
      const latency = Date.now() - start;
      return {
        status: latency > 1000 ? 'degraded' : 'healthy',
        details: {
          latency,
          endpoint: `https://${service}.example.com`
        },
        lastCheck: Date.now(),
        latency
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: error.message,
        lastCheck: Date.now()
      };
    }
  }

  registerCheck(check: HealthCheck) {
    if (this.checks.has(check.name)) {
      throw new Error(`Health check ${check.name} already exists`);
    }
    this.checks.set(check.name, check);

    if (this.isRunning) {
      this.startCheck(check);
    }
  }

  async runCheck(name: string): Promise<ComponentHealth> {
    const check = this.checks.get(name);
    if (!check) {
      throw new Error(`Health check ${name} not found`);
    }

    return tracingService.trace(`health_check.${name}`, async (span) => {
      try {
        const result = await Promise.race([
          check.check(),
          new Promise<ComponentHealth>((_, reject) => 
            setTimeout(() => reject(new Error('Health check timeout')), check.timeout)
          )
        ]);

        this.results.set(name, result);
        
        if (result.status !== 'healthy') {
          span.setAttributes({
            'health.status': result.status,
            'health.message': result.message
          });

          this.emit('health_changed', {
            component: name,
            status: result.status,
            details: result
          });
        }

        return result;
      } catch (error) {
        const result: ComponentHealth = {
          status: 'unhealthy',
          message: error.message,
          lastCheck: Date.now()
        };

        this.results.set(name, result);
        
        span.setStatus('error', error.message);
        errorService.handleError(error, {
          component: 'HealthCheckService',
          check: name
        });

        this.emit('health_changed', {
          component: name,
          status: 'unhealthy',
          details: result
        });

        return result;
      }
    });
  }

  private startCheck(check: HealthCheck) {
    const interval = setInterval(async () => {
      await this.runCheck(check.name);
    }, check.interval);

    this.checkIntervals.set(check.name, interval);
  }

  start() {
    if (this.isRunning) return;

    this.isRunning = true;
    for (const check of this.checks.values()) {
      this.startCheck(check);
    }
  }

  stop() {
    if (!this.isRunning) return;

    this.isRunning = false;
    for (const interval of this.checkIntervals.values()) {
      clearInterval(interval);
    }
    this.checkIntervals.clear();
  }

  getHealth(): HealthCheckResult {
    const details: Record<string, ComponentHealth> = {};
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    for (const [name, check] of this.checks.entries()) {
      const result = this.results.get(name) || {
        status: 'unhealthy',
        message: 'Health check not run yet',
        lastCheck: 0
      };

      // Check dependencies
      if (check.dependencies) {
        for (const dep of check.dependencies) {
          const depResult = this.results.get(dep);
          if (depResult && depResult.status === 'unhealthy') {
            result.status = 'unhealthy';
            result.message = `Dependency ${dep} is unhealthy`;
          }
        }
      }

      details[name] = result;

      if (result.status === 'unhealthy') {
        overallStatus = 'unhealthy';
      } else if (result.status === 'degraded' && overallStatus === 'healthy') {
        overallStatus = 'degraded';
      }
    }

    return {
      status: overallStatus,
      details,
      timestamp: Date.now()
    };
  }

  // Helper method to create Express/Fastify compatible health check endpoint
  createHealthEndpoint() {
    return async (req: any, res: any) => {
      const span = tracingService.startSpan('health.check', {
        attributes: {
          'http.method': 'GET',
          'http.path': '/health'
        }
      });

      try {
        const health = this.getHealth();
        
        span.setAttributes({
          'health.status': health.status,
          'health.components': Object.keys(health.details).length
        });

        res.status(health.status === 'unhealthy' ? 503 : 200).json(health);
      } catch (error) {
        span.setStatus('error', error.message);
        res.status(500).json({
          status: 'unhealthy',
          error: error.message,
          timestamp: Date.now()
        });
      } finally {
        span.end();
      }
    };
  }
}

// Export singleton instance
export const healthCheckService = HealthCheckService.getInstance(); 