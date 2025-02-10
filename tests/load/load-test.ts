import { LoadTestRunner } from './load-test-runner';
import { loadTestConfig } from './load-test.config';
import { MetricsCollector } from '../utils/metrics-collector';
import { TestContext } from '../utils/test-context';

export class LoadTest {
  private runner: LoadTestRunner;
  private metrics: MetricsCollector;
  private testContext: TestContext;

  constructor() {
    this.runner = new LoadTestRunner(loadTestConfig);
    this.metrics = new MetricsCollector();
  }

  async runLoadTests(): Promise<void> {
    try {
      // Initialize test environment
      this.testContext = await TestContext.create({
        mockServices: false,
        recordMetrics: true,
        loadTest: true
      });

      // Run scenarios sequentially
      for (const [name, scenario] of Object.entries(loadTestConfig.scenarios)) {
        console.log(`Starting load test scenario: ${name}`);
        
        // Prepare system state
        await this.prepareSystemState(scenario);
        
        // Execute load test
        const results = await this.runner.executeScenario(name, scenario);
        
        // Analyze results
        await this.analyzeResults(name, results);
        
        // Cool down period
        await this.coolDown();
      }
    } catch (error) {
      console.error('Load test failed:', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  private async prepareSystemState(scenario: any): Promise<void> {
    // Reset system state
    await this.testContext.resetState();
    
    // Pre-warm caches
    await this.testContext.warmupCaches();
    
    // Ensure sufficient capacity
    await this.testContext.ensureCapacity(scenario.targetRPS);
  }

  private async analyzeResults(scenarioName: string, results: any): Promise<void> {
    const analysis = {
      latency: {
        p95: results.latencies.p95,
        p99: results.latencies.p99,
        mean: results.latencies.mean
      },
      throughput: {
        achieved: results.rps,
        target: results.targetRps,
        success: results.successRate
      },
      resources: {
        cpu: results.resourceUtilization.cpu,
        memory: results.resourceUtilization.memory,
        network: results.resourceUtilization.network
      }
    };

    // Verify against thresholds
    this.verifyThresholds(analysis);

    // Store results
    await this.metrics.storeLoadTestResults(scenarioName, analysis);
  }

  private verifyThresholds(analysis: any): void {
    const { thresholds } = loadTestConfig;
    
    if (analysis.latency.p95 > thresholds.latency.p95) {
      throw new Error(`P95 latency threshold exceeded: ${analysis.latency.p95}ms`);
    }
    
    if (analysis.latency.p99 > thresholds.latency.p99) {
      throw new Error(`P99 latency threshold exceeded: ${analysis.latency.p99}ms`);
    }
    
    if (analysis.throughput.success < (1 - thresholds.errorRate.max)) {
      throw new Error(`Error rate threshold exceeded: ${1 - analysis.throughput.success}`);
    }
  }

  private async coolDown(): Promise<void> {
    // Wait for system to stabilize
    await new Promise(resolve => setTimeout(resolve, 30000));
    
    // Verify system returns to baseline
    await this.testContext.verifySystemBaseline();
  }

  private async cleanup(): Promise<void> {
    await this.testContext.cleanup();
    await this.metrics.flush();
  }
} 