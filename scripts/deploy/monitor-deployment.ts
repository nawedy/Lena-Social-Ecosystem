import { KubernetesService } from '../services/kubernetes';
import { MetricsService } from '../services/metrics';
import { Logger } from '../utils/logger';
import chalk from 'chalk';
import { DeploymentRollback } from '../services/deployment-rollback';

interface RollbackTrigger {
  condition: () => Promise<boolean>;
  message: string;
  severity: 'warning' | 'critical';
}

class DeploymentMonitor {
  private k8s: KubernetesService;
  private metrics: MetricsService;
  private logger: Logger;

  private rollbackTriggers: RollbackTrigger[] = [
    {
      condition: async () => {
        const metrics = await this.metrics.getCurrentMetrics();
        return metrics.errorRate > 0.05; // 5% error rate
      },
      message: 'High error rate detected',
      severity: 'critical'
    },
    {
      condition: async () => {
        const metrics = await this.metrics.getCurrentMetrics();
        return metrics.responseTime > 1000; // 1s response time
      },
      message: 'High latency detected',
      severity: 'warning'
    },
    {
      condition: async () => {
        const health = await this.k8s.getServiceHealth('game-services', 'tiktok-toe');
        return health.healthyReplicas < health.totalReplicas * 0.7; // 70% healthy
      },
      message: 'Insufficient healthy replicas',
      severity: 'critical'
    }
  ];

  constructor() {
    this.k8s = new KubernetesService();
    this.metrics = new MetricsService();
    this.logger = new Logger('DeploymentMonitor');
  }

  async monitorDeployment(): Promise<void> {
    console.log(chalk.blue('\n📊 Starting Deployment Monitoring...\n'));

    try {
      const monitoringInterval = setInterval(async () => {
        await this.checkRollbackTriggers();
      }, 30000); // Check every 30 seconds

      // Monitor deployment progress
      await this.watchDeploymentProgress();

      // Verify deployment status
      await this.verifyDeploymentStatus();

      // Show deployment logs
      await this.showDeploymentLogs();

      clearInterval(monitoringInterval);

      console.log(chalk.green('\n✅ Deployment monitoring completed successfully\n'));
    } catch (error) {
      console.log(chalk.red('\n❌ Deployment monitoring detected issues:\n'));
      console.error(error);
      throw error;
    }
  }

  private async watchDeploymentProgress(): Promise<void> {
    const deploymentName = 'tiktok-toe';
    const namespace = 'game-services';

    console.log(chalk.yellow('📈 Watching Deployment Progress:'));

    return new Promise((resolve, reject) => {
      const watch = this.k8s.watchDeployment(namespace, deploymentName);
      
      watch.on('data', (event) => {
        const deployment = event.object;
        const status = this.formatDeploymentStatus(deployment);
        console.log(status);

        if (deployment.status.availableReplicas === deployment.spec.replicas) {
          watch.destroy();
          resolve();
        }
      });

      watch.on('error', reject);

      // Set timeout
      setTimeout(() => {
        watch.destroy();
        reject(new Error('Deployment watch timeout'));
      }, 600000); // 10 minutes
    });
  }

  private async verifyDeploymentStatus(): Promise<void> {
    console.log(chalk.yellow('\n🔍 Verifying Deployment Status:'));

    const checks = [
      this.checkPodHealth(),
      this.checkServiceHealth(),
      this.checkMetrics(),
      this.checkEndpoints()
    ];

    const results = await Promise.all(checks);
    
    results.forEach(result => {
      const icon = result.status ? '✅' : '❌';
      const color = result.status ? chalk.green : chalk.red;
      console.log(color(`${icon} ${result.message}`));
    });

    if (results.some(r => !r.status)) {
      throw new Error('Deployment verification failed');
    }
  }

  private async showDeploymentLogs(): Promise<void> {
    console.log(chalk.yellow('\n📜 Recent Deployment Logs:'));

    const logs = await this.k8s.getPodLogs('game-services', 'tiktok-toe', {
      tailLines: 50,
      timestamps: true
    });

    logs.forEach(log => {
      const level = this.getLogLevel(log);
      const color = this.getLogColor(level);
      console.log(color(log));
    });
  }

  private async checkPodHealth(): Promise<{status: boolean; message: string}> {
    const pods = await this.k8s.getPods('game-services', 'app=tiktok-toe');
    const healthy = pods.every(pod => pod.status.phase === 'Running');
    return {
      status: healthy,
      message: `Pod Health: ${pods.length} pods running`
    };
  }

  private async checkServiceHealth(): Promise<{status: boolean; message: string}> {
    const health = await this.k8s.getServiceHealth('game-services', 'tiktok-toe');
    return {
      status: health.healthy,
      message: `Service Health: ${health.message}`
    };
  }

  private async checkMetrics(): Promise<{status: boolean; message: string}> {
    const metrics = await this.metrics.getCurrentMetrics();
    return {
      status: metrics.errorRate < 0.01,
      message: `Metrics: Error Rate ${(metrics.errorRate * 100).toFixed(2)}%, Response Time ${metrics.responseTime}ms`
    };
  }

  private async checkEndpoints(): Promise<{status: boolean; message: string}> {
    const endpoints = await this.k8s.getEndpoints('game-services', 'tiktok-toe');
    return {
      status: endpoints.addresses.length > 0,
      message: `Endpoints: ${endpoints.addresses.length} endpoints available`
    };
  }

  private formatDeploymentStatus(deployment: any): string {
    const available = deployment.status.availableReplicas || 0;
    const desired = deployment.spec.replicas;
    const updated = deployment.status.updatedReplicas || 0;
    const progress = (available / desired) * 100;

    return chalk.cyan(
      `[${new Date().toISOString()}] ` +
      `Progress: ${progress.toFixed(0)}% | ` +
      `Available: ${available}/${desired} | ` +
      `Updated: ${updated}/${desired}`
    );
  }

  private getLogLevel(log: string): string {
    if (log.includes('ERROR')) return 'error';
    if (log.includes('WARN')) return 'warn';
    if (log.includes('INFO')) return 'info';
    return 'debug';
  }

  private getLogColor(level: string): chalk.Chalk {
    switch (level) {
      case 'error': return chalk.red;
      case 'warn': return chalk.yellow;
      case 'info': return chalk.blue;
      default: return chalk.gray;
    }
  }

  private async checkRollbackTriggers(): Promise<void> {
    for (const trigger of this.rollbackTriggers) {
      if (await trigger.condition()) {
        this.logger.error(chalk.red(`🚨 Rollback trigger: ${trigger.message}`));
        
        if (trigger.severity === 'critical') {
          await this.initiateRollback(trigger.message);
        } else {
          this.logger.warn(chalk.yellow(`⚠️ Warning: ${trigger.message}`));
        }
      }
    }
  }

  private async initiateRollback(reason: string): Promise<void> {
    this.logger.info(chalk.yellow(`🔄 Initiating automated rollback due to: ${reason}`));
    
    const rollback = new DeploymentRollback();
    await rollback.rollback({
      namespace: 'game-services',
      deployment: 'tiktok-toe',
      force: true
    });
  }
}

// Start monitoring
const monitor = new DeploymentMonitor();
monitor.monitorDeployment()
  .then(() => {
    console.log(chalk.green('\n🚀 Deployment monitoring completed successfully. Ready for production!\n'));
  })
  .catch((error) => {
    console.error(chalk.red('\n💥 Deployment monitoring failed:'), error);
    process.exit(1);
  }); 