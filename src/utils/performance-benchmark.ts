import { APMService } from './apm';
import { MetricsService } from '../services/metrics';
import { DatabaseService } from '../services/database';
import { RedisService } from '../services/redis';
import { LoggerService } from '../services/logger';

interface BenchmarkConfig {
  name: string;
  duration: number;
  concurrency: number;
  warmup: number;
  cooldown: number;
  targetRPS: number;
}

interface BenchmarkResult {
  name: string;
  timestamp: string;
  duration: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatency: number;
  p50Latency: number;
  p90Latency: number;
  p95Latency: number;
  p99Latency: number;
  rps: number;
  errorRate: number;
  cpu: {
    average: number;
    peak: number;
  };
  memory: {
    average: number;
    peak: number;
  };
}

export class PerformanceBenchmark {
  private apm: APMService;
  private metrics: MetricsService;
  private db: DatabaseService;
  private redis: RedisService;
  private logger: LoggerService;

  constructor(
    apm: APMService,
    metrics: MetricsService,
    db: DatabaseService,
    redis: RedisService,
    logger: LoggerService
  ) {
    this.apm = apm;
    this.metrics = metrics;
    this.db = db;
    this.redis = redis;
    this.logger = logger;
  }

  public async runBenchmark(config: BenchmarkConfig): Promise<BenchmarkResult> {
    const transaction = this.apm.startTransaction(`benchmark-${config.name}`, 'benchmark');
    
    try {
      // Prepare system
      await this.prepare(config);
      
      // Run warmup
      await this.warmup(config);
      
      // Run actual benchmark
      const result = await this.execute(config);
      
      // Cooldown
      await this.cooldown(config);
      
      // Store results
      await this.storeResults(result);
      
      return result;
    } finally {
      transaction?.end();
    }
  }

  private async prepare(config: BenchmarkConfig): Promise<void> {
    const span = this.apm.startSpan('benchmark-prepare');
    
    try {
      // Clear caches
      await this.redis.flushAll();
      
      // Reset connection pools
      await this.db.resetPool();
      
      // Clear metrics
      await this.metrics.reset();
      
      this.logger.info('Benchmark preparation complete', { config });
    } finally {
      span?.end();
    }
  }

  private async warmup(config: BenchmarkConfig): Promise<void> {
    const span = this.apm.startSpan('benchmark-warmup');
    
    try {
      const warmupConfig = {
        ...config,
        duration: config.warmup,
        targetRPS: config.targetRPS * 0.5
      };
      
      await this.execute(warmupConfig);
      this.logger.info('Warmup complete');
    } finally {
      span?.end();
    }
  }

  private async execute(config: BenchmarkConfig): Promise<BenchmarkResult> {
    const span = this.apm.startSpan('benchmark-execute');
    
    try {
      const startTime = Date.now();
      const metrics: number[] = [];
      const latencies: number[] = [];
      let successCount = 0;
      let failureCount = 0;

      // Create worker pool
      const workers = new Array(config.concurrency).fill(null).map((_, i) =>
        this.worker(i, config, metrics, latencies)
      );

      // Run benchmark
      await Promise.all(workers);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Calculate results
      const result: BenchmarkResult = {
        name: config.name,
        timestamp: new Date().toISOString(),
        duration,
        totalRequests: metrics.length,
        successfulRequests: successCount,
        failedRequests: failureCount,
        averageLatency: this.average(latencies),
        p50Latency: this.percentile(latencies, 50),
        p90Latency: this.percentile(latencies, 90),
        p95Latency: this.percentile(latencies, 95),
        p99Latency: this.percentile(latencies, 99),
        rps: metrics.length / (duration / 1000),
        errorRate: failureCount / metrics.length,
        cpu: {
          average: await this.metrics.getAverageCPU(),
          peak: await this.metrics.getPeakCPU()
        },
        memory: {
          average: await this.metrics.getAverageMemory(),
          peak: await this.metrics.getPeakMemory()
        }
      };

      this.logger.info('Benchmark execution complete', { result });
      return result;
    } finally {
      span?.end();
    }
  }

  private async worker(
    id: number,
    config: BenchmarkConfig,
    metrics: number[],
    latencies: number[]
  ): Promise<void> {
    const span = this.apm.startSpan(`benchmark-worker-${id}`);
    
    try {
      const endTime = Date.now() + config.duration;
      const interval = 1000 / (config.targetRPS / config.concurrency);

      while (Date.now() < endTime) {
        const startTime = Date.now();
        
        try {
          await this.executeRequest();
          metrics.push(1);
          latencies.push(Date.now() - startTime);
        } catch (error) {
          metrics.push(0);
          this.logger.error('Request failed', { error });
        }

        const elapsed = Date.now() - startTime;
        if (elapsed < interval) {
          await new Promise(resolve => setTimeout(resolve, interval - elapsed));
        }
      }
    } finally {
      span?.end();
    }
  }

  private async executeRequest(): Promise<void> {
    // Implement your request logic here
    // This is just a placeholder
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
  }

  private async cooldown(config: BenchmarkConfig): Promise<void> {
    const span = this.apm.startSpan('benchmark-cooldown');
    
    try {
      await new Promise(resolve => setTimeout(resolve, config.cooldown));
      this.logger.info('Cooldown complete');
    } finally {
      span?.end();
    }
  }

  private async storeResults(result: BenchmarkResult): Promise<void> {
    const span = this.apm.startSpan('store-benchmark-results');
    
    try {
      // Store in database
      await this.db.query(
        'INSERT INTO benchmark_results (name, data, timestamp) VALUES ($1, $2, $3)',
        [result.name, result, result.timestamp]
      );

      // Store in Redis for quick access
      await this.redis.set(
        `benchmark:${result.name}:latest`,
        JSON.stringify(result),
        'EX',
        86400
      );

      // Record metrics
      this.metrics.recordBenchmarkResult(result);

      this.logger.info('Benchmark results stored');
    } finally {
      span?.end();
    }
  }

  private average(numbers: number[]): number {
    return numbers.reduce((a, b) => a + b, 0) / numbers.length;
  }

  private percentile(numbers: number[], p: number): number {
    const sorted = [...numbers].sort((a, b) => a - b);
    const pos = (sorted.length - 1) * p / 100;
    const base = Math.floor(pos);
    const rest = pos - base;
    
    if (sorted[base + 1] !== undefined) {
      return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
    } else {
      return sorted[base];
    }
  }

  public async getHistoricalResults(
    name: string,
    limit: number = 10
  ): Promise<BenchmarkResult[]> {
    const results = await this.db.query(
      'SELECT data FROM benchmark_results WHERE name = $1 ORDER BY timestamp DESC LIMIT $2',
      [name, limit]
    );
    return results.rows.map(row => row.data);
  }

  public async compareResults(
    baseline: string,
    current: string
  ): Promise<Record<string, number>> {
    const [baselineResult, currentResult] = await Promise.all([
      this.db.query(
        'SELECT data FROM benchmark_results WHERE name = $1 ORDER BY timestamp DESC LIMIT 1',
        [baseline]
      ),
      this.db.query(
        'SELECT data FROM benchmark_results WHERE name = $1 ORDER BY timestamp DESC LIMIT 1',
        [current]
      )
    ]);

    const baselineData = baselineResult.rows[0]?.data;
    const currentData = currentResult.rows[0]?.data;

    if (!baselineData || !currentData) {
      throw new Error('Missing benchmark data for comparison');
    }

    return {
      rpsChange: (currentData.rps - baselineData.rps) / baselineData.rps * 100,
      latencyChange: (currentData.averageLatency - baselineData.averageLatency) / baselineData.averageLatency * 100,
      errorRateChange: (currentData.errorRate - baselineData.errorRate) / baselineData.errorRate * 100,
      cpuChange: (currentData.cpu.average - baselineData.cpu.average) / baselineData.cpu.average * 100,
      memoryChange: (currentData.memory.average - baselineData.memory.average) / baselineData.memory.average * 100
    };
  }
}
