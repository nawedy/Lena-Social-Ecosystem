import axios from 'axios';
import { APMService } from '../utils/apm';
import { RedisService } from '../services/redis';
import { DatabaseService } from '../services/database';
import { MetricsService } from '../services/metrics';

interface SyntheticCheck {
  name: string;
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: any;
  expectedStatus: number;
  expectedResponse?: any;
  timeout: number;
  headers?: Record<string, string>;
}

interface CheckResult {
  name: string;
  success: boolean;
  duration: number;
  error?: string;
  timestamp: string;
}

export class SyntheticMonitoring {
  private apm: APMService;
  private redis: RedisService;
  private db: DatabaseService;
  private metrics: MetricsService;
  private checks: SyntheticCheck[];
  private baseUrl: string;

  constructor(
    apm: APMService,
    redis: RedisService,
    db: DatabaseService,
    metrics: MetricsService,
    baseUrl: string
  ) {
    this.apm = apm;
    this.redis = redis;
    this.db = db;
    this.metrics = metrics;
    this.baseUrl = baseUrl;
    this.checks = this.getDefaultChecks();
  }

  private getDefaultChecks(): SyntheticCheck[] {
    return [
      {
        name: 'API Health Check',
        endpoint: '/health',
        method: 'GET',
        expectedStatus: 200,
        timeout: 5000,
      },
      {
        name: 'User Authentication',
        endpoint: '/api/auth/login',
        method: 'POST',
        body: {
          username: process.env.SYNTHETIC_TEST_USER,
          password: process.env.SYNTHETIC_TEST_PASSWORD,
        },
        expectedStatus: 200,
        timeout: 5000,
      },
      {
        name: 'Database Connection',
        endpoint: '/api/health/db',
        method: 'GET',
        expectedStatus: 200,
        timeout: 5000,
      },
      {
        name: 'Cache Operation',
        endpoint: '/api/health/cache',
        method: 'GET',
        expectedStatus: 200,
        timeout: 5000,
      },
      {
        name: 'Content Creation',
        endpoint: '/api/content',
        method: 'POST',
        body: {
          title: 'Synthetic Test Content',
          description: 'Test content for monitoring',
        },
        expectedStatus: 201,
        timeout: 5000,
        headers: {
          Authorization: 'Bearer {{test_token}}',
        },
      },
    ];
  }

  public async runChecks(): Promise<CheckResult[]> {
    const results: CheckResult[] = [];
    const transaction = this.apm.startTransaction(
      'synthetic-monitoring',
      'monitoring'
    );

    try {
      for (const check of this.checks) {
        const result = await this.runSingleCheck(check);
        results.push(result);

        // Record metrics
        this.metrics.recordSyntheticCheck(
          check.name,
          result.success,
          result.duration
        );

        // Store result in Redis for quick access
        await this.redis.set(
          `synthetic:${check.name}:latest`,
          JSON.stringify(result),
          'EX',
          3600
        );

        // Store in database for historical analysis
        await this.db.query(
          'INSERT INTO synthetic_checks (name, success, duration, error, timestamp) VALUES ($1, $2, $3, $4, $5)',
          [
            check.name,
            result.success,
            result.duration,
            result.error,
            result.timestamp,
          ]
        );
      }
    } catch (error) {
      this.apm.captureError(error);
    } finally {
      transaction?.end();
    }

    return results;
  }

  private async runSingleCheck(check: SyntheticCheck): Promise<CheckResult> {
    const span = this.apm.startSpan(`synthetic-check:${check.name}`);
    const startTime = Date.now();

    try {
      const headers = await this.prepareHeaders(check.headers);
      const response = await axios({
        method: check.method,
        url: `${this.baseUrl}${check.endpoint}`,
        data: check.body,
        headers,
        timeout: check.timeout,
      });

      const success = response.status === check.expectedStatus;
      if (check.expectedResponse) {
        const responseMatch = this.compareResponse(
          response.data,
          check.expectedResponse
        );
        if (!responseMatch) {
          throw new Error('Response did not match expected format');
        }
      }

      return {
        name: check.name,
        success,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        name: check.name,
        success: false,
        duration: Date.now() - startTime,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    } finally {
      span?.end();
    }
  }

  private async prepareHeaders(
    headers?: Record<string, string>
  ): Promise<Record<string, string>> {
    if (!headers) return {};

    const preparedHeaders: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
      if (value.includes('{{test_token}}')) {
        const token = await this.redis.get('synthetic:test:token');
        preparedHeaders[key] = value.replace('{{test_token}}', token || '');
      } else {
        preparedHeaders[key] = value;
      }
    }

    return preparedHeaders;
  }

  private compareResponse(actual: any, expected: any): boolean {
    if (typeof expected === 'function') {
      return expected(actual);
    }

    if (Array.isArray(expected)) {
      return (
        Array.isArray(actual) &&
        expected.every((exp, index) => this.compareResponse(actual[index], exp))
      );
    }

    if (typeof expected === 'object') {
      return Object.keys(expected).every(key =>
        this.compareResponse(actual[key], expected[key])
      );
    }

    return actual === expected;
  }

  public async getCheckHistory(
    checkName: string,
    limit: number = 100
  ): Promise<CheckResult[]> {
    const results = await this.db.query(
      'SELECT * FROM synthetic_checks WHERE name = $1 ORDER BY timestamp DESC LIMIT $2',
      [checkName, limit]
    );
    return results.rows;
  }

  public async getCheckStats(checkName: string): Promise<any> {
    const stats = await this.db.query(
      `
      SELECT 
        COUNT(*) as total_runs,
        SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful_runs,
        AVG(duration) as avg_duration,
        MAX(duration) as max_duration,
        MIN(duration) as min_duration
      FROM synthetic_checks 
      WHERE name = $1 
      AND timestamp > NOW() - INTERVAL '24 hours'
    `,
      [checkName]
    );

    return stats.rows[0];
  }

  public addCheck(check: SyntheticCheck): void {
    this.checks.push(check);
  }

  public removeCheck(checkName: string): void {
    this.checks = this.checks.filter(check => check.name !== checkName);
  }

  public updateCheck(
    checkName: string,
    updates: Partial<SyntheticCheck>
  ): void {
    const index = this.checks.findIndex(check => check.name === checkName);
    if (index !== -1) {
      this.checks[index] = { ...this.checks[index], ...updates };
    }
  }
}
