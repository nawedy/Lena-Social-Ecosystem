import { logger } from '../utils/logger';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface ContentAnalysis {
  topics: Array<{
    name: string;
    confidence: number;
    volume: number;
    sentiment: number;
  }>;
  trends: Array<{
    topic: string;
    growth: number;
    velocity: number;
    predicted_peak: Date;
  }>;
  moderation: {
    flagged_content: number;
    accuracy: number;
    false_positives: number;
  };
}

interface NetworkTrend {
  topic: string;
  mentions: number;
  engagement: number;
  reach: number;
  sentiment: number;
  velocity: number;
}

export class AIMonitoringService {
  private readonly TREND_THRESHOLD = 0.15; // 15% growth rate
  private readonly SENTIMENT_THRESHOLD = 0.7; // 70% positive sentiment
  
  async analyzeContent(): Promise<ContentAnalysis> {
    try {
      // Query content analytics from Prometheus
      const [topics, trends, moderation] = await Promise.all([
        this.analyzeTopics(),
        this.analyzeTrends(),
        this.checkModeration()
      ]);

      return {
        topics,
        trends,
        moderation
      };
    } catch (error) {
      logger.error('Content analysis failed:', error);
      throw error;
    }
  }

  private async analyzeTopics(): Promise<Array<{ name: string; confidence: number; volume: number; sentiment: number }>> {
    try {
      // Query topic classification metrics
      const { stdout } = await execAsync(
        `curl -s -X GET "http://localhost:9090/api/v1/query?query=sum(increase(content_topics_total[24h])) by (topic)`
      );
      const result = JSON.parse(stdout);

      // Process and enrich topic data with ML service
      const topics = await Promise.all(
        result.data.result.map(async (topic: any) => {
          const sentiment = await this.analyzeSentiment(topic.metric.topic);
          return {
            name: topic.metric.topic,
            confidence: parseFloat(topic.value[1]),
            volume: parseInt(topic.value[1]),
            sentiment
          };
        })
      );

      return topics.sort((a, b) => b.volume - a.volume);
    } catch (error) {
      logger.error('Topic analysis failed:', error);
      return [];
    }
  }

  private async analyzeTrends(): Promise<Array<{ topic: string; growth: number; velocity: number; predicted_peak: Date }>> {
    try {
      // Query trend metrics with prediction data
      const { stdout } = await execAsync(
        `curl -s -X GET "http://localhost:9090/api/v1/query?query=rate(topic_mentions_total[24h])`
      );
      const result = JSON.parse(stdout);

      // Process trend data and make predictions
      const trends = await Promise.all(
        result.data.result.map(async (trend: any) => {
          const prediction = await this.predictTrendPeak(trend.metric.topic);
          return {
            topic: trend.metric.topic,
            growth: parseFloat(trend.value[1]),
            velocity: await this.calculateTrendVelocity(trend.metric.topic),
            predicted_peak: prediction
          };
        })
      );

      return trends.filter(trend => trend.growth > this.TREND_THRESHOLD)
                  .sort((a, b) => b.velocity - a.velocity);
    } catch (error) {
      logger.error('Trend analysis failed:', error);
      return [];
    }
  }

  private async checkModeration(): Promise<{ flagged_content: number; accuracy: number; false_positives: number }> {
    try {
      const [flagged, accuracy, falsePositives] = await Promise.all([
        this.getFlaggedContentCount(),
        this.getModerationAccuracy(),
        this.getFalsePositivesCount()
      ]);

      return {
        flagged_content: flagged,
        accuracy,
        false_positives: falsePositives
      };
    } catch (error) {
      logger.error('Moderation check failed:', error);
      return { flagged_content: 0, accuracy: 0, false_positives: 0 };
    }
  }

  private async analyzeSentiment(topic: string): Promise<number> {
    try {
      const { stdout } = await execAsync(
        `curl -s -X GET "http://localhost:9090/api/v1/query?query=avg(sentiment_score{topic='${topic}'}[24h])`
      );
      const result = JSON.parse(stdout);
      return parseFloat(result.data.result[0].value[1]);
    } catch (error) {
      logger.error('Sentiment analysis failed:', error);
      return 0;
    }
  }

  private async predictTrendPeak(topic: string): Promise<Date> {
    try {
      // Query ML service for trend prediction
      const { stdout } = await execAsync(
        `curl -s -X POST "http://localhost:5000/api/predict-peak" -d '{"topic":"${topic}"}'`
      );
      const result = JSON.parse(stdout);
      return new Date(result.predicted_peak);
    } catch (error) {
      logger.error('Trend peak prediction failed:', error);
      return new Date();
    }
  }

  private async calculateTrendVelocity(topic: string): Promise<number> {
    try {
      const { stdout } = await execAsync(
        `curl -s -X GET "http://localhost:9090/api/v1/query?query=deriv(topic_mentions_total{topic='${topic}'}[24h])`
      );
      const result = JSON.parse(stdout);
      return parseFloat(result.data.result[0].value[1]);
    } catch (error) {
      logger.error('Trend velocity calculation failed:', error);
      return 0;
    }
  }

  private async getFlaggedContentCount(): Promise<number> {
    const { stdout } = await execAsync(
      `curl -s -X GET "http://localhost:9090/api/v1/query?query=sum(increase(moderation_flagged_total[24h]))`
    );
    const result = JSON.parse(stdout);
    return parseInt(result.data.result[0].value[1]);
  }

  private async getModerationAccuracy(): Promise<number> {
    const { stdout } = await execAsync(
      `curl -s -X GET "http://localhost:9090/api/v1/query?query=avg(moderation_accuracy[24h])`
    );
    const result = JSON.parse(stdout);
    return parseFloat(result.data.result[0].value[1]);
  }

  private async getFalsePositivesCount(): Promise<number> {
    const { stdout } = await execAsync(
      `curl -s -X GET "http://localhost:9090/api/v1/query?query=sum(increase(moderation_false_positives_total[24h]))`
    );
    const result = JSON.parse(stdout);
    return parseInt(result.data.result[0].value[1]);
  }
} 