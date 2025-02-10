import { KubernetesService } from '../services/kubernetes';
import { MetricsService } from '../services/metrics';
import { Logger } from '../utils/logger';
import chalk from 'chalk';

interface RollbackOptions {
  namespace: string;
  deployment: string;
  revision?: number; // Specific revision to rollback to
  force?: boolean;   // Force rollback even if health checks pass
}

export class DeploymentRollback {
  private k8s: KubernetesService;
  private metrics: MetricsService;
  private logger: Logger;

  constructor() {
    this.k8s = new KubernetesService();
    this.metrics = new MetricsService();
    this.logger = new Logger('Rollback');
  }

  async rollback(options: RollbackOptions): Promise<void> {
    this.logger.info(chalk.yellow('🔄 Initiating rollback procedure...'));

    try {
      // Get deployment history
      const history = await this.k8s.getDeploymentHistory(options.namespace, options.deployment);
      
      // Determine rollback revision
      const targetRevision = options.revision || this.determineLastStableRevision(history);
      
      if (!targetRevision) {
        throw new Error('No stable revision found to rollback to');
      }

      // Execute rollback
      await this.executeRollback(options.namespace, options.deployment, targetRevision);

      // Verify rollback
      await this.verifyRollback(options);

      this.logger.info(chalk.green('✅ Rollback completed successfully'));
    } catch (error) {
      this.logger.error(chalk.red('❌ Rollback failed:'), error);
      throw error;
    }
  }

  private determineLastStableRevision(history: any[]): number | null {
    // Sort by revision number descending
    const sortedHistory = [...history].sort((a, b) => b.revision - a.revision);
    
    // Find the last known stable revision
    const stableRevision = sortedHistory.find(rev => 
      rev.status === 'Complete' && 
      !rev.labels?.includes('failed') &&
      rev.metrics?.errorRate < 0.01
    );

    return stableRevision?.revision || null;
  }

  private async executeRollback(namespace: string, deployment: string, revision: number): Promise<void> {
    this.logger.info(chalk.blue(`Rolling back ${deployment} to revision ${revision}...`));

    // Save current state for potential recovery
    await this.saveCurrentState(namespace, deployment);

    // Perform the rollback
    await this.k8s.rollbackDeployment(namespace, deployment, revision);

    // Wait for rollback to complete
    await this.waitForRollback(namespace, deployment);
  }

  private async saveCurrentState(namespace: string, deployment: string): Promise<void> {
    const state = await this.k8s.getDeploymentState(namespace, deployment);
    await this.k8s.saveState(namespace, deployment, state);
  }

  private async waitForRollback(namespace: string, deployment: string): Promise<void> {
    const maxAttempts = 30;
    const interval = 5000; // 5 seconds

    for (let i = 0; i < maxAttempts; i++) {
      const status = await this.k8s.getDeploymentStatus(namespace, deployment);
      
      if (status.replicas === status.availableReplicas && 
          status.updatedReplicas === status.replicas) {
        return;
      }

      await new Promise(resolve => setTimeout(resolve, interval));
    }

    throw new Error('Rollback timed out');
  }

  private async verifyRollback(options: RollbackOptions): Promise<void> {
    this.logger.info(chalk.yellow('Verifying rollback...'));

    const checks = await Promise.all([
      this.verifyPods(options),
      this.verifyHealth(options),
      this.verifyMetrics(options)
    ]);

    if (checks.some(check => !check.success)) {
      const failures = checks.filter(check => !check.success)
        .map(check => check.message)
        .join(', ');
      
      throw new Error(`Rollback verification failed: ${failures}`);
    }
  }

  private async verifyPods(options: RollbackOptions): Promise<{success: boolean; message: string}> {
    const pods = await this.k8s.getPods(options.namespace, `app=${options.deployment}`);
    const allRunning = pods.every(pod => pod.status.phase === 'Running');
    
    return {
      success: allRunning,
      message: allRunning ? 'All pods running' : 'Some pods are not running'
    };
  }

  private async verifyHealth(options: RollbackOptions): Promise<{success: boolean; message: string}> {
    const health = await this.k8s.getServiceHealth(options.namespace, options.deployment);
    
    return {
      success: health.healthy,
      message: health.message
    };
  }

  private async verifyMetrics(options: RollbackOptions): Promise<{success: boolean; message: string}> {
    const metrics = await this.metrics.getCurrentMetrics();
    const isHealthy = metrics.errorRate < 0.01 && metrics.responseTime < 500;
    
    return {
      success: isHealthy,
      message: isHealthy ? 'Metrics within acceptable range' : 'Metrics outside acceptable range'
    };
  }
} 