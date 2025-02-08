import { supabase } from '$lib/supabaseClient';
import { differentialPrivacy } from './DifferentialPrivacy';

interface AnalyticsEvent {
  type: string;
  properties: Record<string, any>;
  timestamp: Date;
  userId?: string;
  sessionId: string;
  deviceId?: string;
}

interface PrivacyConfig {
  epsilon: number;
  delta: number;
  minBatchSize: number;
  maxQueryFrequency: number;
  retentionPeriod: number;
  anonymizationRules: {
    ipAddress: boolean;
    userAgent: boolean;
    location: boolean;
    device: boolean;
  };
}

interface AggregateMetrics {
  totalEvents: number;
  uniqueUsers: number;
  eventCounts: Record<string, number>;
  properties: Record<string, any>;
  timeRange: {
    start: Date;
    end: Date;
  };
}

class PrivacyPreservingAnalytics {
  private readonly config: PrivacyConfig = {
    epsilon: 0.1, // Privacy budget
    delta: 1e-5, // Privacy failure probability
    minBatchSize: 50, // Minimum number of events for aggregation
    maxQueryFrequency: 3600000, // 1 hour in milliseconds
    retentionPeriod: 90 * 24 * 60 * 60 * 1000, // 90 days in milliseconds
    anonymizationRules: {
      ipAddress: true,
      userAgent: true,
      location: true,
      device: true
    }
  };

  private eventBuffer: AnalyticsEvent[] = [];
  private lastAggregation: Date = new Date(0);
  private readonly BUFFER_LIMIT = 1000;

  async trackEvent(event: AnalyticsEvent): Promise<void> {
    try {
      // Anonymize event data
      const anonymizedEvent = this.anonymizeEvent(event);

      // Add noise to sensitive properties
      const noisyEvent = this.addDifferentialPrivacyNoise(anonymizedEvent);

      // Add to buffer
      this.eventBuffer.push(noisyEvent);

      // Check if we should aggregate
      if (
        this.eventBuffer.length >= this.config.minBatchSize ||
        this.eventBuffer.length >= this.BUFFER_LIMIT ||
        Date.now() - this.lastAggregation.getTime() >= this.config.maxQueryFrequency
      ) {
        await this.aggregateAndStore();
      }
    } catch (error) {
      console.error('Error tracking event:', error);
    }
  }

  private anonymizeEvent(event: AnalyticsEvent): AnalyticsEvent {
    const anonymized = { ...event };

    // Remove user identifiers
    delete anonymized.userId;
    delete anonymized.deviceId;

    // Hash session ID
    anonymized.sessionId = this.hashValue(event.sessionId);

    // Anonymize properties based on rules
    if (this.config.anonymizationRules.ipAddress) {
      delete anonymized.properties.ipAddress;
    }
    if (this.config.anonymizationRules.userAgent) {
      delete anonymized.properties.userAgent;
    }
    if (this.config.anonymizationRules.location) {
      if (anonymized.properties.location) {
        // Reduce location precision
        anonymized.properties.location = this.reduceLocationPrecision(
          anonymized.properties.location
        );
      }
    }
    if (this.config.anonymizationRules.device) {
      delete anonymized.properties.deviceId;
      delete anonymized.properties.advertisingId;
    }

    return anonymized;
  }

  private addDifferentialPrivacyNoise(event: AnalyticsEvent): AnalyticsEvent {
    const noisyEvent = { ...event };

    // Add Laplace noise to numeric properties
    for (const [key, value] of Object.entries(event.properties)) {
      if (typeof value === 'number') {
        noisyEvent.properties[key] = differentialPrivacy.addLaplaceNoise(
          value,
          this.config.epsilon
        );
      }
    }

    return noisyEvent;
  }

  private async aggregateAndStore(): Promise<void> {
    if (this.eventBuffer.length === 0) return;

    try {
      const now = new Date();
      const metrics = this.computeAggregateMetrics(this.eventBuffer);

      // Add noise to aggregate metrics
      const noisyMetrics = this.addNoiseToMetrics(metrics);

      // Store aggregated metrics
      await supabase
        .from('analytics_aggregates')
        .insert({
          metrics: noisyMetrics,
          time_range: {
            start: metrics.timeRange.start.toISOString(),
            end: metrics.timeRange.end.toISOString()
          },
          created_at: now.toISOString()
        });

      // Clear buffer and update last aggregation time
      this.eventBuffer = [];
      this.lastAggregation = now;

      // Clean up old data
      await this.cleanupOldData();
    } catch (error) {
      console.error('Error aggregating metrics:', error);
    }
  }

  private computeAggregateMetrics(events: AnalyticsEvent[]): AggregateMetrics {
    const metrics: AggregateMetrics = {
      totalEvents: events.length,
      uniqueUsers: new Set(events.map(e => e.sessionId)).size,
      eventCounts: {},
      properties: {},
      timeRange: {
        start: new Date(Math.min(...events.map(e => e.timestamp.getTime()))),
        end: new Date(Math.max(...events.map(e => e.timestamp.getTime())))
      }
    };

    // Count events by type
    for (const event of events) {
      metrics.eventCounts[event.type] = (metrics.eventCounts[event.type] || 0) + 1;
    }

    // Aggregate properties
    const propertyKeys = new Set(
      events.flatMap(e => Object.keys(e.properties))
    );

    for (const key of propertyKeys) {
      const values = events
        .map(e => e.properties[key])
        .filter(v => v !== undefined);

      if (values.length === 0) continue;

      if (typeof values[0] === 'number') {
        // Compute statistics for numeric values
        metrics.properties[key] = {
          avg: values.reduce((a, b) => a + b, 0) / values.length,
          min: Math.min(...values),
          max: Math.max(...values),
          count: values.length
        };
      } else if (typeof values[0] === 'string') {
        // Count occurrences for categorical values
        metrics.properties[key] = values.reduce((acc, val) => {
          acc[val] = (acc[val] || 0) + 1;
          return acc;
        }, {});
      }
    }

    return metrics;
  }

  private addNoiseToMetrics(metrics: AggregateMetrics): AggregateMetrics {
    const noisy = { ...metrics };

    // Add noise to counts
    noisy.totalEvents = Math.round(
      differentialPrivacy.addLaplaceNoise(metrics.totalEvents, this.config.epsilon)
    );
    noisy.uniqueUsers = Math.round(
      differentialPrivacy.addLaplaceNoise(metrics.uniqueUsers, this.config.epsilon)
    );

    // Add noise to event counts
    for (const [type, count] of Object.entries(metrics.eventCounts)) {
      noisy.eventCounts[type] = Math.round(
        differentialPrivacy.addLaplaceNoise(count, this.config.epsilon)
      );
    }

    // Add noise to numeric property aggregates
    for (const [key, value] of Object.entries(metrics.properties)) {
      if (typeof value === 'object' && 'avg' in value) {
        noisy.properties[key] = {
          avg: differentialPrivacy.addLaplaceNoise(value.avg, this.config.epsilon),
          min: differentialPrivacy.addLaplaceNoise(value.min, this.config.epsilon),
          max: differentialPrivacy.addLaplaceNoise(value.max, this.config.epsilon),
          count: Math.round(
            differentialPrivacy.addLaplaceNoise(value.count, this.config.epsilon)
          )
        };
      } else if (typeof value === 'object') {
        // Add noise to categorical counts
        noisy.properties[key] = Object.fromEntries(
          Object.entries(value).map(([k, v]) => [
            k,
            Math.round(differentialPrivacy.addLaplaceNoise(v as number, this.config.epsilon))
          ])
        );
      }
    }

    return noisy;
  }

  private async cleanupOldData(): Promise<void> {
    const cutoffDate = new Date(Date.now() - this.config.retentionPeriod);

    await supabase
      .from('analytics_events')
      .delete()
      .lt('timestamp', cutoffDate.toISOString());

    await supabase
      .from('analytics_aggregates')
      .delete()
      .lt('created_at', cutoffDate.toISOString());
  }

  private hashValue(value: string): string {
    return crypto
      .createHash('sha256')
      .update(value)
      .digest('hex');
  }

  private reduceLocationPrecision(location: { lat: number; lon: number }): { lat: number; lon: number } {
    // Reduce precision to ~10km by rounding to 2 decimal places
    return {
      lat: Math.round(location.lat * 100) / 100,
      lon: Math.round(location.lon * 100) / 100
    };
  }

  async getMetrics(
    timeRange: { start: Date; end: Date },
    eventTypes?: string[]
  ): Promise<AggregateMetrics | null> {
    try {
      // Ensure minimum time between queries
      const timeSinceLastQuery = Date.now() - this.lastAggregation.getTime();
      if (timeSinceLastQuery < this.config.maxQueryFrequency) {
        throw new Error('Query rate limit exceeded');
      }

      // Get aggregated metrics
      const { data: metrics } = await supabase
        .from('analytics_aggregates')
        .select('*')
        .gte('time_range->>start', timeRange.start.toISOString())
        .lte('time_range->>end', timeRange.end.toISOString());

      if (!metrics || metrics.length === 0) return null;

      // Combine metrics if multiple aggregates exist
      return this.combineMetrics(
        metrics.map(m => m.metrics),
        eventTypes
      );
    } catch (error) {
      console.error('Error getting metrics:', error);
      return null;
    }
  }

  private combineMetrics(
    metricsList: AggregateMetrics[],
    eventTypes?: string[]
  ): AggregateMetrics {
    const combined: AggregateMetrics = {
      totalEvents: 0,
      uniqueUsers: 0,
      eventCounts: {},
      properties: {},
      timeRange: {
        start: new Date(Math.min(...metricsList.map(m => m.timeRange.start.getTime()))),
        end: new Date(Math.max(...metricsList.map(m => m.timeRange.end.getTime())))
      }
    };

    for (const metrics of metricsList) {
      combined.totalEvents += metrics.totalEvents;
      combined.uniqueUsers = Math.max(combined.uniqueUsers, metrics.uniqueUsers);

      // Combine event counts
      for (const [type, count] of Object.entries(metrics.eventCounts)) {
        if (!eventTypes || eventTypes.includes(type)) {
          combined.eventCounts[type] = (combined.eventCounts[type] || 0) + count;
        }
      }

      // Combine property metrics
      for (const [key, value] of Object.entries(metrics.properties)) {
        if (typeof value === 'object' && 'avg' in value) {
          // Combine numeric metrics
          if (!combined.properties[key]) {
            combined.properties[key] = { avg: 0, min: value.min, max: value.max, count: 0 };
          }
          const current = combined.properties[key];
          const totalCount = current.count + value.count;
          current.avg = (current.avg * current.count + value.avg * value.count) / totalCount;
          current.min = Math.min(current.min, value.min);
          current.max = Math.max(current.max, value.max);
          current.count = totalCount;
        } else if (typeof value === 'object') {
          // Combine categorical counts
          if (!combined.properties[key]) {
            combined.properties[key] = {};
          }
          for (const [category, count] of Object.entries(value)) {
            combined.properties[key][category] = (combined.properties[key][category] || 0) + count;
          }
        }
      }
    }

    return combined;
  }
}

export const privacyPreservingAnalytics = new PrivacyPreservingAnalytics(); 