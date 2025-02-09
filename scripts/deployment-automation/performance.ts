import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../utils/logger';
import { CheckResult } from './types';
import { runLighthouse } from '../utils/lighthouse';
import { analyzeBundleSize } from '../utils/bundle-analyzer';
import { checkDatabaseIndexes } from '../utils/db-analyzer';
import { measureApiLatency } from '../utils/api-tester';

const execAsync = promisify(exec);

interface PerformanceMetrics {
  lighthouse: {
    performance: number;
    accessibility: number;
    bestPractices: number;
    seo: number;
    pwa: number;
  };
  bundle: {
    totalSize: number;
    gzippedSize: number;
    chunks: Array<{
      name: string;
      size: number;
    }>;
  };
  api: {
    averageLatency: number;
    p95Latency: number;
    errorRate: number;
  };
  database: {
    queryPerformance: Array<{
      query: string;
      averageTime: number;
      indexUsage: boolean;
    }>;
    missingIndexes: string[];
  };
}

interface LoadTestResult {
  averageResponseTime: number;
  maxResponseTime: number;
  requestsPerSecond: number;
  errorRate: number;
  concurrentUsers: number;
}

export async function runPerformanceChecks(): Promise<CheckResult> {
  const details: string[] = [];
  const errors: Error[] = [];

  try {
    // 1. Lighthouse Performance Audit
    logger.info('Running Lighthouse audit...');
    const lighthouseResults = await runLighthouse('http://localhost:3000');
    
    if (lighthouseResults.performance < 90) {
      details.push(`❌ Lighthouse performance score: ${lighthouseResults.performance}`);
      errors.push(new Error('Lighthouse performance score below threshold'));
    } else {
      details.push(`✅ Lighthouse performance score: ${lighthouseResults.performance}`);
    }

    // 2. Bundle Size Analysis
    logger.info('Analyzing bundle size...');
    const bundleAnalysis = await analyzeBundleSize();
    const maxBundleSize = 500 * 1024; // 500KB threshold

    if (bundleAnalysis.gzippedSize > maxBundleSize) {
      details.push(`❌ Bundle size too large: ${(bundleAnalysis.gzippedSize / 1024).toFixed(2)}KB`);
      errors.push(new Error('Bundle size exceeds threshold'));
    } else {
      details.push(`✅ Bundle size: ${(bundleAnalysis.gzippedSize / 1024).toFixed(2)}KB`);
    }

    // 3. API Performance Testing
    logger.info('Testing API performance...');
    const apiMetrics = await measureApiLatency();
    const maxLatency = 200; // 200ms threshold

    if (apiMetrics.p95Latency > maxLatency) {
      details.push(`❌ API P95 latency too high: ${apiMetrics.p95Latency}ms`);
      errors.push(new Error('API latency exceeds threshold'));
    } else {
      details.push(`✅ API P95 latency: ${apiMetrics.p95Latency}ms`);
    }

    // 4. Database Performance
    logger.info('Checking database performance...');
    const dbMetrics = await checkDatabaseIndexes();
    
    if (dbMetrics.missingIndexes.length > 0) {
      details.push(`❌ Missing database indexes: ${dbMetrics.missingIndexes.length}`);
      errors.push(new Error('Missing critical database indexes'));
    } else {
      details.push('✅ Database indexes optimized');
    }

    // 5. Load Testing
    logger.info('Running load tests...');
    const loadTestResults = await runLoadTest();
    const maxErrorRate = 0.01; // 1% threshold

    if (loadTestResults.errorRate > maxErrorRate) {
      details.push(`❌ Load test error rate too high: ${(loadTestResults.errorRate * 100).toFixed(2)}%`);
      errors.push(new Error('Load test error rate exceeds threshold'));
    } else {
      details.push(`✅ Load test passed: ${loadTestResults.requestsPerSecond} req/s`);
    }

    // 6. Memory Usage
    logger.info('Checking memory usage...');
    const memoryMetrics = await checkMemoryUsage();
    const maxMemoryUsage = 1024 * 1024 * 1024; // 1GB threshold

    if (memoryMetrics.heapUsed > maxMemoryUsage) {
      details.push(`❌ Memory usage too high: ${(memoryMetrics.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      errors.push(new Error('Memory usage exceeds threshold'));
    } else {
      details.push(`✅ Memory usage: ${(memoryMetrics.heapUsed / 1024 / 1024).toFixed(2)}MB`);
    }

    return {
      status: errors.length === 0 ? 'success' : 'failure',
      details,
      errors: errors.length > 0 ? errors : undefined
    };

  } catch (error) {
    logger.error('Performance checks failed:', error);
    return {
      status: 'failure',
      details: [...details, `❌ Error: ${error.message}`],
      errors: [error]
    };
  }
}

async function runLoadTest(): Promise<LoadTestResult> {
  try {
    const { stdout } = await execAsync('k6 run load-test.js');
    const results = parseK6Output(stdout);
    
    return {
      averageResponseTime: results.avg_response_time,
      maxResponseTime: results.max_response_time,
      requestsPerSecond: results.requests_per_second,
      errorRate: results.error_rate,
      concurrentUsers: results.concurrent_users
    };
  } catch (error) {
    throw new Error(`Load test failed: ${error.message}`);
  }
}

function parseK6Output(output: string): any {
  // Parse k6 output format
  const metrics = {
    avg_response_time: 0,
    max_response_time: 0,
    requests_per_second: 0,
    error_rate: 0,
    concurrent_users: 0
  };

  // Extract metrics from k6 output
  const matches = {
    avg: /avg=([0-9.]+)ms/.exec(output),
    max: /max=([0-9.]+)ms/.exec(output),
    rps: /([0-9.]+) req\/s/.exec(output),
    errors: /error rate=([0-9.]+)%/.exec(output)
  };

  if (matches.avg) metrics.avg_response_time = parseFloat(matches.avg[1]);
  if (matches.max) metrics.max_response_time = parseFloat(matches.max[1]);
  if (matches.rps) metrics.requests_per_second = parseFloat(matches.rps[1]);
  if (matches.errors) metrics.error_rate = parseFloat(matches.errors[1]) / 100;

  return metrics;
}

async function checkMemoryUsage(): Promise<{ heapUsed: number }> {
  try {
    const { stdout } = await execAsync('node -e "console.log(JSON.stringify(process.memoryUsage()))"');
    const memoryUsage = JSON.parse(stdout);
    return { heapUsed: memoryUsage.heapUsed };
  } catch (error) {
    throw new Error(`Memory usage check failed: ${error.message}`);
  }
} 