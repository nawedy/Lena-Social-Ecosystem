import { logger } from '../utils/logger';
import { runCodeQualityChecks } from './code-quality';
import { runSecurityChecks } from './security';
import { runPerformanceChecks } from './performance';
import { runInfrastructureChecks } from './infrastructure';
import { runDocumentationChecks } from './documentation';
import { runComplianceChecks } from './compliance';
import { runCICDChecks } from './cicd';
import { runUXChecks } from './ux';
import { runMonitoringChecks } from './monitoring';
import { runPostDeploymentChecks } from './post-deployment';
import { SlackNotifier } from '../utils/notifications';
import { generateDeploymentReport } from '../utils/reporting';
import { EmergencyResponseHandler } from './emergency';

interface CheckResult {
  status: 'success' | 'failure' | 'warning';
  details: string[];
  errors?: Error[];
}

interface DeploymentResult {
  success: boolean;
  checkResults: Record<string, CheckResult>;
  timestamp: string;
  duration: number;
  environment: string;
}

export class DeploymentAutomation {
  private notifier: SlackNotifier;
  private startTime: number;
  private environment: string;
  private emergencyHandler: EmergencyResponseHandler;

  constructor(environment: string = 'production') {
    this.notifier = new SlackNotifier();
    this.environment = environment;
    this.emergencyHandler = new EmergencyResponseHandler();
  }

  async runAllChecks(): Promise<DeploymentResult> {
    this.startTime = Date.now();
    const results: Record<string, CheckResult> = {};

    try {
      logger.info('Starting deployment automation checks...');

      // 1. Code Quality Checks
      results.codeQuality = await this.runWithRetry(runCodeQualityChecks);

      // 2. Security Checks
      results.security = await this.runWithRetry(runSecurityChecks);

      // 3. Performance Checks
      results.performance = await this.runWithRetry(runPerformanceChecks);

      // 4. Infrastructure Checks
      results.infrastructure = await this.runWithRetry(runInfrastructureChecks);

      // 5. Documentation Checks
      results.documentation = await this.runWithRetry(runDocumentationChecks);

      // 6. Compliance Checks
      results.compliance = await this.runWithRetry(runComplianceChecks);

      // 7. CI/CD Checks
      results.cicd = await this.runWithRetry(runCICDChecks);

      // 8. UX Checks
      results.ux = await this.runWithRetry(runUXChecks);

      // 9. Monitoring Checks
      results.monitoring = await this.runWithRetry(runMonitoringChecks);

      // 10. Post-deployment Checks
      results.postDeployment = await this.runWithRetry(runPostDeploymentChecks);

      // Add new check
      results.projectConsistency = await this.runWithRetry(checkProjectConsistency);

      const success = this.validateResults(results);
      const deploymentResult = this.createDeploymentResult(results, success);

      await this.notifyResults(deploymentResult);
      await this.generateReport(deploymentResult);

      return deploymentResult;

    } catch (error) {
      logger.error('Deployment automation failed:', error);
      await this.emergencyHandler.handleDeploymentFailure({
        status: 'failure',
        details: [`Fatal error: ${error.message}`],
        errors: [error]
      });
      throw error;
    }
  }

  private async runWithRetry<T>(
    checkFn: () => Promise<T>,
    maxRetries: number = 3
  ): Promise<T> {
    let lastError: Error;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await checkFn();
      } catch (error) {
        lastError = error as Error;
        logger.warn(`Attempt ${i + 1} failed, retrying...`, error);
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
      }
    }

    throw lastError!;
  }

  private validateResults(results: Record<string, CheckResult>): boolean {
    return Object.values(results).every(result => 
      result.status === 'success' || result.status === 'warning'
    );
  }

  private createDeploymentResult(
    results: Record<string, CheckResult>,
    success: boolean
  ): DeploymentResult {
    return {
      success,
      checkResults: results,
      timestamp: new Date().toISOString(),
      duration: Date.now() - this.startTime,
      environment: this.environment
    };
  }

  private async notifyResults(result: DeploymentResult): Promise<void> {
    const message = this.formatResultsForNotification(result);
    await this.notifier.send(message);
  }

  private async generateReport(result: DeploymentResult): Promise<void> {
    await generateDeploymentReport(result);
  }

  private formatResultsForNotification(result: DeploymentResult): string {
    const status = result.success ? '✅ PASSED' : '❌ FAILED';
    const duration = (result.duration / 1000).toFixed(2);
    
    let message = `Deployment Automation ${status}\n`;
    message += `Environment: ${result.environment}\n`;
    message += `Duration: ${duration}s\n\n`;

    Object.entries(result.checkResults).forEach(([check, result]) => {
      const icon = result.status === 'success' ? '✅' : result.status === 'warning' ? '⚠️' : '❌';
      message += `${icon} ${check}: ${result.status}\n`;
    });

    return message;
  }
}

// CLI entry point
if (require.main === module) {
  const environment = process.argv[2] || 'production';
  const automation = new DeploymentAutomation(environment);
  
  automation.runAllChecks()
    .then(result => {
      if (!result.success) {
        process.exit(1);
      }
    })
    .catch(error => {
      logger.error('Deployment automation failed:', error);
      process.exit(1);
    });
} 