import { chaosConfig } from './chaos-test.config';
import { TestContext } from '../utils/test-context';
import { MetricsCollector } from '../utils/metrics-collector';
import { EmergencyResponseHandler } from '../../scripts/deployment-automation/emergency';

export class ChaosTest {
  private testContext: TestContext;
  private metrics: MetricsCollector;
  private emergencyHandler: EmergencyResponseHandler;

  constructor() {
    this.metrics = new MetricsCollector();
    this.emergencyHandler = new EmergencyResponseHandler();
  }

  async runChaosExperiments(): Promise<void> {
    try {
      this.testContext = await TestContext.create({
        mockServices: false,
        recordMetrics: true,
        chaosTest: true
      });

      for (const [name, experiment] of Object.entries(chaosConfig.experiments)) {
        console.log(`Starting chaos experiment: ${name}`);
        
        // Verify system health before experiment
        await this.verifySystemHealth();
        
        // Execute chaos experiment
        const results = await this.executeExperiment(name, experiment);
        
        // Analyze results
        await this.analyzeExperiment(name, results);
        
        // Allow system to recover
        await this.ensureRecovery();
      }
    } catch (error) {
      console.error('Chaos test failed:', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  private async executeExperiment(name: string, experiment: any): Promise<any> {
    const results = {
      timeline: [],
      metrics: {},
      incidents: [],
      recoveryActions: []
    };

    try {
      // Start monitoring
      const monitoring = this.startExperimentMonitoring(name);

      // Execute each chaos action
      for (const action of experiment.actions) {
        // Verify safety checks before action
        if (!await this.verifySafetyChecks()) {
          throw new Error('Safety checks failed, aborting experiment');
        }

        // Execute chaos action
        await this.executeChaosAction(action);
        
        // Record system response
        results.timeline.push({
          action: action.type,
          timestamp: new Date(),
          systemState: await this.testContext.captureSystemState()
        });

        // Monitor emergency response
        const incidents = await this.emergencyHandler.getActiveIncidents();
        results.incidents.push(...incidents);
      }

      // Collect final metrics
      results.metrics = await monitoring.stop();

      return results;
    } catch (error) {
      console.error(`Experiment ${name} failed:`, error);
      throw error;
    }
  }

  private async verifySafetyChecks(): Promise<boolean> {
    const systemState = await this.testContext.captureSystemState();
    const { safetyChecks } = chaosConfig;

    return (
      systemState.serviceFailureRate <= safetyChecks.maxServiceFailure &&
      systemState.dataLossRate <= safetyChecks.maxDataLoss &&
      systemState.availability >= safetyChecks.minAvailability
    );
  }

  private async ensureRecovery(): Promise<void> {
    const maxRetries = 10;
    const retryInterval = 30000; // 30 seconds

    for (let i = 0; i < maxRetries; i++) {
      const systemHealth = await this.testContext.checkSystemHealth();
      
      if (systemHealth.healthy) {
        return;
      }

      await new Promise(resolve => setTimeout(resolve, retryInterval));
    }

    throw new Error('System failed to recover within expected time');
  }

  private async cleanup(): Promise<void> {
    await this.testContext.cleanup();
    await this.metrics.flush();
  }
} 