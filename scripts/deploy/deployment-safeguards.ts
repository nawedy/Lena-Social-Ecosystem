import { KubernetesService } from '../services/kubernetes';
import { MetricsService } from '../services/metrics';
import { Logger } from '../utils/logger';

interface SafeguardCheck {
  name: string;
  description: string;
  severity: 'critical' | 'warning';
  check: () => Promise<boolean>;
}

export class DeploymentSafeguards {
  private k8s: KubernetesService;
  private metrics: MetricsService;
  private logger: Logger;

  constructor() {
    this.k8s = new KubernetesService();
    this.metrics = new MetricsService();
    this.logger = new Logger('DeploymentSafeguards');
  }

  async performPreDeploymentChecks(): Promise<void> {
    this.logger.info('Running pre-deployment safeguard checks');

    const checks = await this.runAllChecks();
    const failedCritical = checks.filter(r => !r.passed && r.severity === 'critical');
    const failedWarnings = checks.filter(r => !r.passed && r.severity === 'warning');

    if (failedCritical.length > 0) {
      throw new Error(`Critical safeguard checks failed: ${failedCritical.map(c => c.name).join(', ')}`);
    }

    if (failedWarnings.length > 0) {
      this.logger.warn(`Warning: Some safeguard checks failed: ${failedWarnings.map(c => c.name).join(', ')}`);
    }
  }

  private async runAllChecks(): Promise<Array<SafeguardCheck & { passed: boolean }>> {
    const checks: SafeguardCheck[] = [
      {
        name: 'cluster-health',
        description: 'Verify cluster health status',
        severity: 'critical',
        check: async () => {
          const health = await this.k8s.getClusterHealth();
          return health.status === 'healthy';
        }
      },
      {
        name: 'resource-availability',
        description: 'Check resource quotas and limits',
        severity: 'critical',
        check: async () => {
          const resources = await this.k8s.getResourceQuotas();
          return resources.cpu.available > 1000 && resources.memory.available > 2048;
        }
      },
      {
        name: 'backup-status',
        description: 'Verify recent backup exists',
        severity: 'critical',
        check: async () => {
          const backup = await this.k8s.getLatestBackup();
          const backupAge = Date.now() - backup.timestamp;
          return backupAge < 24 * 60 * 60 * 1000; // 24 hours
        }
      },
      {
        name: 'current-load',
        description: 'Check current system load',
        severity: 'warning',
        check: async () => {
          const metrics = await this.metrics.getCurrentLoad();
          return metrics.cpu < 80 && metrics.memory < 80;
        }
      },
      {
        name: 'dependency-health',
        description: 'Verify all dependencies are healthy',
        severity: 'critical',
        check: async () => {
          const deps = await this.k8s.checkDependencies();
          return deps.every(d => d.healthy);
        }
      },
      {
        name: 'certificate-validity',
        description: 'Check SSL certificate validity',
        severity: 'critical',
        check: async () => {
          const certs = await this.k8s.checkCertificates();
          return certs.every(c => c.daysUntilExpiry > 30);
        }
      },
      {
        name: 'network-policies',
        description: 'Verify network policies are in place',
        severity: 'critical',
        check: async () => {
          const policies = await this.k8s.getNetworkPolicies();
          return policies.length > 0;
        }
      }
    ];

    return Promise.all(checks.map(async check => ({
      ...check,
      passed: await check.check().catch(error => {
        this.logger.error(`Check ${check.name} failed:`, error);
        return false;
      })
    })));
  }

  async monitorDeployment(): Promise<void> {
    // Start monitoring deployment progress
    const monitoring = setInterval(async () => {
      try {
        const metrics = await this.metrics.getCurrentMetrics();
        if (metrics.errorRate > 0.05) {
          this.logger.error('High error rate detected during deployment');
          // Could trigger rollback here
        }
      } catch (error) {
        this.logger.error('Error monitoring deployment:', error);
      }
    }, 5000);

    return () => clearInterval(monitoring);
  }
} 