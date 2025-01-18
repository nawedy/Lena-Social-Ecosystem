import { APMService } from '../utils/apm';
import { MetricsService } from '../services/metrics';
import { DatabaseService } from '../services/database';
import { LoggerService } from '../services/logger';
import * as AWS from 'aws-sdk';

interface CostBreakdown {
  service: string;
  amount: number;
  unit: string;
  startDate: string;
  endDate: string;
  tags?: Record<string, string>;
}

interface ResourceUsage {
  service: string;
  metric: string;
  value: number;
  unit: string;
  timestamp: string;
}

interface CostAlert {
  service: string;
  threshold: number;
  currentAmount: number;
  percentageIncrease: number;
  timestamp: string;
}

export class CostMonitor {
  private apm: APMService;
  private metrics: MetricsService;
  private db: DatabaseService;
  private logger: LoggerService;
  private cloudwatch: AWS.CloudWatch;
  private costExplorer: AWS.CostExplorer;

  constructor(
    apm: APMService,
    metrics: MetricsService,
    db: DatabaseService,
    logger: LoggerService
  ) {
    this.apm = apm;
    this.metrics = metrics;
    this.db = db;
    this.logger = logger;

    this.cloudwatch = new AWS.CloudWatch();
    this.costExplorer = new AWS.CostExplorer();
  }

  public async trackCosts(): Promise<void> {
    const transaction = this.apm.startTransaction('track-costs', 'monitoring');

    try {
      // Get costs from various sources
      const [awsCosts, dbCosts, cacheCosts, cdnCosts] = await Promise.all([
        this.getAWSCosts(),
        this.getDatabaseCosts(),
        this.getCacheCosts(),
        this.getCDNCosts(),
      ]);

      // Combine all costs
      const allCosts = [...awsCosts, ...dbCosts, ...cacheCosts, ...cdnCosts];

      // Store cost data
      await this.storeCostData(allCosts);

      // Check for cost anomalies
      await this.detectCostAnomalies(allCosts);

      // Update metrics
      this.updateCostMetrics(allCosts);

      this.logger.info('Cost tracking completed', {
        totalCosts: allCosts.reduce((sum, cost) => sum + cost.amount, 0),
      });
    } catch (error) {
      this.logger.error('Cost tracking failed', { error });
      this.apm.captureError(error);
    } finally {
      transaction?.end();
    }
  }

  private async getAWSCosts(): Promise<CostBreakdown[]> {
    const span = this.apm.startSpan('get-aws-costs');

    try {
      const response = await this.costExplorer
        .getCostAndUsage({
          TimePeriod: {
            Start: new Date(Date.now() - 24 * 60 * 60 * 1000)
              .toISOString()
              .split('T')[0],
            End: new Date().toISOString().split('T')[0],
          },
          Granularity: 'DAILY',
          Metrics: ['UnblendedCost'],
          GroupBy: [
            { Type: 'DIMENSION', Key: 'SERVICE' },
            { Type: 'TAG', Key: 'Environment' },
          ],
        })
        .promise();

      return (
        response.ResultsByTime?.[0]?.Groups?.map(group => ({
          service: group.Keys[0],
          amount: parseFloat(group.Metrics.UnblendedCost.Amount),
          unit: 'USD',
          startDate: response.ResultsByTime[0].TimePeriod.Start,
          endDate: response.ResultsByTime[0].TimePeriod.End,
          tags: { environment: group.Keys[1] },
        })) || []
      );
    } finally {
      span?.end();
    }
  }

  private async getDatabaseCosts(): Promise<CostBreakdown[]> {
    const span = this.apm.startSpan('get-database-costs');

    try {
      const metrics = await this.db.query(`
        SELECT 
          'database' as service,
          SUM(pg_database_size(datname)) as size_bytes,
          current_timestamp as timestamp
        FROM pg_database
        GROUP BY datname
      `);

      // Convert storage size to cost (example: $0.115 per GB per month)
      return metrics.rows.map(row => ({
        service: 'database',
        amount: ((row.size_bytes / 1024 / 1024 / 1024) * 0.115) / 30,
        unit: 'USD',
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date().toISOString(),
      }));
    } finally {
      span?.end();
    }
  }

  private async getCacheCosts(): Promise<CostBreakdown[]> {
    const span = this.apm.startSpan('get-cache-costs');

    try {
      // Example: Redis cache costs based on memory usage
      const metrics = await this.cloudwatch
        .getMetricData({
          MetricDataQueries: [
            {
              Id: 'cache_memory',
              MetricStat: {
                Metric: {
                  Namespace: 'AWS/ElastiCache',
                  MetricName: 'DatabaseMemoryUsagePercentage',
                  Dimensions: [
                    {
                      Name: 'CacheClusterId',
                      Value: 'your-cache-cluster',
                    },
                  ],
                },
                Period: 3600,
                Stat: 'Average',
              },
            },
          ],
          StartTime: new Date(Date.now() - 24 * 60 * 60 * 1000),
          EndTime: new Date(),
        })
        .promise();

      // Convert memory usage to cost (example: $0.034 per GB-hour)
      return [
        {
          service: 'cache',
          amount: (metrics.MetricDataResults[0].Values[0] || 0) * 0.034 * 24,
          unit: 'USD',
          startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date().toISOString(),
        },
      ];
    } finally {
      span?.end();
    }
  }

  private async getCDNCosts(): Promise<CostBreakdown[]> {
    const span = this.apm.startSpan('get-cdn-costs');

    try {
      // Example: CloudFront costs based on data transfer
      const metrics = await this.cloudwatch
        .getMetricData({
          MetricDataQueries: [
            {
              Id: 'cdn_bytes',
              MetricStat: {
                Metric: {
                  Namespace: 'AWS/CloudFront',
                  MetricName: 'BytesDownloaded',
                  Dimensions: [
                    {
                      Name: 'DistributionId',
                      Value: 'your-distribution-id',
                    },
                  ],
                },
                Period: 3600,
                Stat: 'Sum',
              },
            },
          ],
          StartTime: new Date(Date.now() - 24 * 60 * 60 * 1000),
          EndTime: new Date(),
        })
        .promise();

      // Convert data transfer to cost (example: $0.085 per GB)
      return [
        {
          service: 'cdn',
          amount:
            ((metrics.MetricDataResults[0].Values[0] || 0) /
              1024 /
              1024 /
              1024) *
            0.085,
          unit: 'USD',
          startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date().toISOString(),
        },
      ];
    } finally {
      span?.end();
    }
  }

  private async storeCostData(costs: CostBreakdown[]): Promise<void> {
    const span = this.apm.startSpan('store-cost-data');

    try {
      await this.db.query(
        'INSERT INTO cost_tracking (service, amount, unit, start_date, end_date, tags) VALUES ($1, $2, $3, $4, $5, $6)',
        costs.map(cost => [
          cost.service,
          cost.amount,
          cost.unit,
          cost.startDate,
          cost.endDate,
          cost.tags,
        ])
      );
    } finally {
      span?.end();
    }
  }

  private async detectCostAnomalies(costs: CostBreakdown[]): Promise<void> {
    const span = this.apm.startSpan('detect-cost-anomalies');

    try {
      for (const cost of costs) {
        // Get historical costs
        const historicalCosts = await this.db.query(
          `
          SELECT AVG(amount) as avg_amount
          FROM cost_tracking
          WHERE service = $1
          AND start_date >= NOW() - INTERVAL '7 days'
        `,
          [cost.service]
        );

        const avgAmount = historicalCosts.rows[0].avg_amount;
        const threshold = avgAmount * 1.5; // 50% increase threshold

        if (cost.amount > threshold) {
          const alert: CostAlert = {
            service: cost.service,
            threshold: threshold,
            currentAmount: cost.amount,
            percentageIncrease: ((cost.amount - avgAmount) / avgAmount) * 100,
            timestamp: new Date().toISOString(),
          };

          await this.handleCostAlert(alert);
        }
      }
    } finally {
      span?.end();
    }
  }

  private async handleCostAlert(alert: CostAlert): Promise<void> {
    const span = this.apm.startSpan('handle-cost-alert');

    try {
      // Store alert
      await this.db.query(
        'INSERT INTO cost_alerts (service, threshold, current_amount, percentage_increase, timestamp) VALUES ($1, $2, $3, $4, $5)',
        [
          alert.service,
          alert.threshold,
          alert.currentAmount,
          alert.percentageIncrease,
          alert.timestamp,
        ]
      );

      // Send metrics
      this.metrics.recordCostAlert(alert);

      // Log alert
      this.logger.warn('Cost anomaly detected', { alert });
    } finally {
      span?.end();
    }
  }

  private updateCostMetrics(costs: CostBreakdown[]): void {
    const span = this.apm.startSpan('update-cost-metrics');

    try {
      // Update total cost metric
      const totalCost = costs.reduce((sum, cost) => sum + cost.amount, 0);
      this.metrics.recordTotalCost(totalCost);

      // Update per-service cost metrics
      const costsByService = costs.reduce(
        (acc, cost) => {
          acc[cost.service] = (acc[cost.service] || 0) + cost.amount;
          return acc;
        },
        {} as Record<string, number>
      );

      for (const [service, amount] of Object.entries(costsByService)) {
        this.metrics.recordServiceCost(service, amount);
      }
    } finally {
      span?.end();
    }
  }

  public async getCostReport(
    startDate: string,
    endDate: string
  ): Promise<Record<string, any>> {
    const span = this.apm.startSpan('get-cost-report');

    try {
      const results = await this.db.query(
        `
        WITH daily_costs AS (
          SELECT 
            date_trunc('day', start_date) as day,
            service,
            SUM(amount) as daily_amount
          FROM cost_tracking
          WHERE start_date >= $1 AND end_date <= $2
          GROUP BY date_trunc('day', start_date), service
        ),
        service_totals AS (
          SELECT 
            service,
            SUM(amount) as total_amount,
            AVG(amount) as avg_daily_amount,
            MIN(amount) as min_daily_amount,
            MAX(amount) as max_daily_amount
          FROM cost_tracking
          WHERE start_date >= $1 AND end_date <= $2
          GROUP BY service
        )
        SELECT 
          json_build_object(
            'total_cost', (SELECT SUM(total_amount) FROM service_totals),
            'by_service', (
              SELECT json_object_agg(
                service,
                json_build_object(
                  'total', total_amount,
                  'average', avg_daily_amount,
                  'min', min_daily_amount,
                  'max', max_daily_amount
                )
              )
              FROM service_totals
            ),
            'daily_breakdown', (
              SELECT json_object_agg(
                day::text,
                json_object_agg(service, daily_amount)
              )
              FROM daily_costs
              GROUP BY day
            )
          ) as report
      `,
        [startDate, endDate]
      );

      return results.rows[0].report;
    } finally {
      span?.end();
    }
  }

  public async getForecastedCosts(
    days: number = 30
  ): Promise<Record<string, number>> {
    const span = this.apm.startSpan('get-forecasted-costs');

    try {
      const response = await this.costExplorer
        .getCostForecast({
          TimePeriod: {
            Start: new Date().toISOString().split('T')[0],
            End: new Date(Date.now() + days * 24 * 60 * 60 * 1000)
              .toISOString()
              .split('T')[0],
          },
          Metric: 'UNBLENDED_COST',
          Granularity: 'MONTHLY',
        })
        .promise();

      return {
        totalForecast: parseFloat(response.Total.Amount),
        monthlyForecast: response.ForecastResultsByTime.map(result => ({
          startDate: result.TimePeriod.Start,
          amount: parseFloat(result.MeanValue),
        })),
      };
    } finally {
      span?.end();
    }
  }

  public async getOptimizationRecommendations(): Promise<string[]> {
    const span = this.apm.startSpan('get-optimization-recommendations');

    try {
      const recommendations: string[] = [];

      // Check for underutilized resources
      const utilization = await this.getResourceUtilization();
      for (const resource of utilization) {
        if (resource.value < 30) {
          recommendations.push(
            `Consider downsizing ${resource.service} resources. Current utilization: ${resource.value}%`
          );
        }
      }

      // Check for reserved instance opportunities
      const riOpportunities = await this.getReservedInstanceOpportunities();
      recommendations.push(...riOpportunities);

      // Check for storage optimization opportunities
      const storageRecommendations =
        await this.getStorageOptimizationRecommendations();
      recommendations.push(...storageRecommendations);

      return recommendations;
    } finally {
      span?.end();
    }
  }

  private async getResourceUtilization(): Promise<ResourceUsage[]> {
    // Implementation for getting resource utilization
    return [];
  }

  private async getReservedInstanceOpportunities(): Promise<string[]> {
    // Implementation for getting RI opportunities
    return [];
  }

  private async getStorageOptimizationRecommendations(): Promise<string[]> {
    // Implementation for storage optimization recommendations
    return [];
  }
}
