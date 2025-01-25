import { DatabaseService } from '../services/database';
import { MetricsService } from '../services/metrics';
import { RedisService } from '../services/redis';
import { APMService } from '../utils/apm';

interface BusinessMetric {
  name: string;
  value: number;
  timestamp: string;
  dimensions?: Record<string, string | number>;
}

interface MetricQuery {
  name: string;
  timeRange: {
    start: Date;
    end: Date;
  };
  interval?: string;
  dimensions?: Record<string, string | number>;
}

export class BusinessMetrics {
  private apm: APMService;
  private redis: RedisService;
  private db: DatabaseService;
  private metrics: MetricsService;

  constructor(
    apm: APMService,
    redis: RedisService,
    db: DatabaseService,
    metrics: MetricsService
  ) {
    this.apm = apm;
    this.redis = redis;
    this.db = db;
    this.metrics = metrics;
  }

  public async trackUserEngagement(): Promise<void> {
    const transaction = this.apm.startTransaction(
      'track-user-engagement',
      'metrics'
    );

    try {
      // Daily Active Users
      const dau = await this.getDailyActiveUsers();
      await this.recordMetric('daily_active_users', dau);

      // Session Duration
      const avgSessionDuration = await this.getAverageSessionDuration();
      await this.recordMetric('avg_session_duration', avgSessionDuration);

      // Content Creation
      const contentMetrics = await this.getContentMetrics();
      await this.recordMetric('content_created_daily', contentMetrics.created);
      await this.recordMetric(
        'content_engagement_rate',
        contentMetrics.engagementRate
      );

      // User Retention
      const retention = await this.getUserRetention();
      await this.recordMetric('user_retention_7d', retention.sevenDay);
      await this.recordMetric('user_retention_30d', retention.thirtyDay);
    } catch (error) {
      this.apm.captureError(error);
    } finally {
      transaction?.end();
    }
  }

  public async trackBusinessPerformance(): Promise<void> {
    const transaction = this.apm.startTransaction(
      'track-business-performance',
      'metrics'
    );

    try {
      // Revenue Metrics
      const revenue = await this.getRevenueMetrics();
      await this.recordMetric('daily_revenue', revenue.daily);
      await this.recordMetric('mrr', revenue.monthly);
      await this.recordMetric('arpu', revenue.arpu);

      // Growth Metrics
      const growth = await this.getGrowthMetrics();
      await this.recordMetric('user_growth_rate', growth.userGrowth);
      await this.recordMetric('content_growth_rate', growth.contentGrowth);

      // Conversion Metrics
      const conversion = await this.getConversionMetrics();
      await this.recordMetric('signup_conversion_rate', conversion.signupRate);
      await this.recordMetric(
        'premium_conversion_rate',
        conversion.premiumRate
      );
    } catch (error) {
      this.apm.captureError(error);
    } finally {
      transaction?.end();
    }
  }

  private async getDailyActiveUsers(): Promise<number> {
    const result = await this.db.query(`
      SELECT COUNT(DISTINCT user_id) as dau
      FROM user_sessions
      WHERE created_at >= NOW() - INTERVAL '24 hours'
    `);
    return result.rows[0].dau;
  }

  private async getAverageSessionDuration(): Promise<number> {
    const result = await this.db.query(`
      SELECT AVG(EXTRACT(EPOCH FROM (ended_at - started_at))) as avg_duration
      FROM user_sessions
      WHERE created_at >= NOW() - INTERVAL '24 hours'
      AND ended_at IS NOT NULL
    `);
    return result.rows[0].avg_duration;
  }

  private async getContentMetrics(): Promise<{
    created: number;
    engagementRate: number;
  }> {
    const created = await this.db.query(`
      SELECT COUNT(*) as count
      FROM content
      WHERE created_at >= NOW() - INTERVAL '24 hours'
    `);

    const engagement = await this.db.query(`
      SELECT 
        COUNT(DISTINCT user_id)::float / NULLIF(COUNT(DISTINCT content_id), 0) as engagement_rate
      FROM content_interactions
      WHERE created_at >= NOW() - INTERVAL '24 hours'
    `);

    return {
      created: created.rows[0].count,
      engagementRate: engagement.rows[0].engagement_rate || 0,
    };
  }

  private async getUserRetention(): Promise<{
    sevenDay: number;
    thirtyDay: number;
  }> {
    const sevenDay = await this.db.query(`
      WITH cohort AS (
        SELECT user_id
        FROM user_sessions
        WHERE created_at BETWEEN NOW() - INTERVAL '7 days' AND NOW() - INTERVAL '6 days'
      )
      SELECT 
        COUNT(DISTINCT s.user_id)::float / NULLIF(COUNT(DISTINCT c.user_id), 0) as retention_rate
      FROM cohort c
      LEFT JOIN user_sessions s ON c.user_id = s.user_id
      WHERE s.created_at >= NOW() - INTERVAL '1 day'
    `);

    const thirtyDay = await this.db.query(`
      WITH cohort AS (
        SELECT user_id
        FROM user_sessions
        WHERE created_at BETWEEN NOW() - INTERVAL '30 days' AND NOW() - INTERVAL '29 days'
      )
      SELECT 
        COUNT(DISTINCT s.user_id)::float / NULLIF(COUNT(DISTINCT c.user_id), 0) as retention_rate
      FROM cohort c
      LEFT JOIN user_sessions s ON c.user_id = s.user_id
      WHERE s.created_at >= NOW() - INTERVAL '1 day'
    `);

    return {
      sevenDay: sevenDay.rows[0].retention_rate || 0,
      thirtyDay: thirtyDay.rows[0].retention_rate || 0,
    };
  }

  private async getRevenueMetrics(): Promise<{
    daily: number;
    monthly: number;
    arpu: number;
  }> {
    const daily = await this.db.query(`
      SELECT COALESCE(SUM(amount), 0) as revenue
      FROM transactions
      WHERE created_at >= NOW() - INTERVAL '24 hours'
    `);

    const monthly = await this.db.query(`
      SELECT COALESCE(SUM(amount), 0) as revenue
      FROM transactions
      WHERE created_at >= NOW() - INTERVAL '30 days'
    `);

    const arpu = await this.db.query(`
      WITH monthly_users AS (
        SELECT COUNT(DISTINCT user_id) as user_count
        FROM user_sessions
        WHERE created_at >= NOW() - INTERVAL '30 days'
      )
      SELECT 
        COALESCE(SUM(amount), 0) / NULLIF(user_count, 0) as arpu
      FROM transactions t
      CROSS JOIN monthly_users
      WHERE t.created_at >= NOW() - INTERVAL '30 days'
    `);

    return {
      daily: daily.rows[0].revenue,
      monthly: monthly.rows[0].revenue,
      arpu: arpu.rows[0].arpu || 0,
    };
  }

  private async getGrowthMetrics(): Promise<{
    userGrowth: number;
    contentGrowth: number;
  }> {
    const userGrowth = await this.db.query(`
      WITH current_period AS (
        SELECT COUNT(*) as current_count
        FROM users
        WHERE created_at >= NOW() - INTERVAL '7 days'
      ),
      previous_period AS (
        SELECT COUNT(*) as previous_count
        FROM users
        WHERE created_at BETWEEN NOW() - INTERVAL '14 days' AND NOW() - INTERVAL '7 days'
      )
      SELECT 
        (current_count - previous_count)::float / NULLIF(previous_count, 0) as growth_rate
      FROM current_period, previous_period
    `);

    const contentGrowth = await this.db.query(`
      WITH current_period AS (
        SELECT COUNT(*) as current_count
        FROM content
        WHERE created_at >= NOW() - INTERVAL '7 days'
      ),
      previous_period AS (
        SELECT COUNT(*) as previous_count
        FROM content
        WHERE created_at BETWEEN NOW() - INTERVAL '14 days' AND NOW() - INTERVAL '7 days'
      )
      SELECT 
        (current_count - previous_count)::float / NULLIF(previous_count, 0) as growth_rate
      FROM current_period, previous_period
    `);

    return {
      userGrowth: userGrowth.rows[0].growth_rate || 0,
      contentGrowth: contentGrowth.rows[0].growth_rate || 0,
    };
  }

  private async getConversionMetrics(): Promise<{
    signupRate: number;
    premiumRate: number;
  }> {
    const signupRate = await this.db.query(`
      WITH visitors AS (
        SELECT COUNT(DISTINCT session_id) as total_visitors
        FROM page_views
        WHERE created_at >= NOW() - INTERVAL '24 hours'
      ),
      signups AS (
        SELECT COUNT(*) as total_signups
        FROM users
        WHERE created_at >= NOW() - INTERVAL '24 hours'
      )
      SELECT 
        total_signups::float / NULLIF(total_visitors, 0) as conversion_rate
      FROM visitors, signups
    `);

    const premiumRate = await this.db.query(`
      WITH total_users AS (
        SELECT COUNT(DISTINCT user_id) as total_count
        FROM users
        WHERE created_at >= NOW() - INTERVAL '30 days'
      ),
      premium_users AS (
        SELECT COUNT(DISTINCT user_id) as premium_count
        FROM subscriptions
        WHERE status = 'active'
        AND created_at >= NOW() - INTERVAL '30 days'
      )
      SELECT 
        premium_count::float / NULLIF(total_count, 0) as conversion_rate
      FROM total_users, premium_users
    `);

    return {
      signupRate: signupRate.rows[0].conversion_rate || 0,
      premiumRate: premiumRate.rows[0].conversion_rate || 0,
    };
  }

  private async recordMetric(
    name: string,
    value: number,
    dimensions?: Record<string, string | number>
  ): Promise<void> {
    const metric: BusinessMetric = {
      name,
      value,
      timestamp: new Date().toISOString(),
      dimensions,
    };

    // Store in Redis for real-time access
    await this.redis.set(
      `metric:${name}:latest`,
      JSON.stringify(metric),
      'EX',
      3600
    );

    // Store in database for historical analysis
    await this.db.query(
      'INSERT INTO business_metrics (name, value, dimensions, timestamp) VALUES ($1, $2, $3, $4)',
      [name, value, dimensions, metric.timestamp]
    );

    // Send to metrics service
    this.metrics.recordBusinessMetric(name, value, dimensions);
  }

  public async queryMetrics(query: MetricQuery): Promise<BusinessMetric[]> {
    const sql = `
      SELECT name, value, dimensions, timestamp
      FROM business_metrics
      WHERE name = $1
      AND timestamp BETWEEN $2 AND $3
      ${query.dimensions ? 'AND dimensions @> $4' : ''}
      ORDER BY timestamp DESC
    `;

    const params = [
      query.name,
      query.timeRange.start,
      query.timeRange.end,
      query.dimensions ? JSON.stringify(query.dimensions) : null,
    ].filter(p => p !== null);

    const result = await this.db.query(sql, params);
    return result.rows;
  }

  public async getMetricStats(
    name: string,
    timeRange: { start: Date; end: Date }
  ): Promise<any> {
    const stats = await this.db.query(
      `
      SELECT 
        COUNT(*) as data_points,
        AVG(value) as avg_value,
        MIN(value) as min_value,
        MAX(value) as max_value,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY value) as median_value,
        STDDEV(value) as std_dev
      FROM business_metrics
      WHERE name = $1
      AND timestamp BETWEEN $2 AND $3
    `,
      [name, timeRange.start, timeRange.end]
    );

    return stats.rows[0];
  }
}
