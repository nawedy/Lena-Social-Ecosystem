import { BskyAgent } from '@atproto/api';
import { Monitoring } from '@google-cloud/monitoring';
import { PubSub } from '@google-cloud/pubsub';

interface CustomMetric {
  id: string;
  name: string;
  description: string;
  type: 'counter' | 'gauge' | 'histogram';
  labels?: string[];
  unit?: string;
}

interface MetricValue {
  metricId: string;
  value: number;
  labels?: Record<string, string>;
  timestamp: string;
}

export class ATMetricTracker {
  private agent: BskyAgent;
  private pubsub: PubSub;
  private monitoring: Monitoring;
  private readonly RECORD_NAMESPACE = 'app.bsky.metrics';
  private readonly PROJECT_ID: string;

  constructor(agent: BskyAgent, projectId: string) {
    this.agent = agent;
    this.pubsub = new PubSub();
    this.monitoring = new Monitoring();
    this.PROJECT_ID = projectId;
  }

  async createCustomMetric(params: Omit<CustomMetric, 'id'>): Promise<CustomMetric> {
    try {
      // Create metric in AT Protocol
      const record = {
        $type: `${this.RECORD_NAMESPACE}.metric`,
        createdAt: new Date().toISOString(),
        ...params,
      };

      const response = await this.agent.com.atproto.repo.createRecord({
        repo: this.agent.session?.did,
        collection: `${this.RECORD_NAMESPACE}.metric`,
        record,
      });

      const metric = {
        id: response.uri,
        ...params,
      };

      // Create corresponding metric descriptor in Cloud Monitoring
      const metricDescriptor = {
        type: `custom.googleapis.com/${params.name}`,
        metricKind: this.getMetricKind(params.type),
        valueType: 'DOUBLE',
        description: params.description,
        displayName: params.name,
        labels:
          params.labels?.map((label) => ({
            key: label,
            valueType: 'STRING',
            description: `Label: ${label}`,
          })) || [],
        unit: params.unit || '1',
      };

      await this.monitoring.projectMetricDescriptors.create({
        name: `projects/${this.PROJECT_ID}`,
        metricDescriptor,
      });

      return metric;
    } catch (error) {
      console.error('Error creating custom metric:', error);
      throw new Error('Failed to create custom metric');
    }
  }

  async trackMetric(value: Omit<MetricValue, 'timestamp'>): Promise<void> {
    try {
      const timestamp = new Date().toISOString();

      // Store metric value in AT Protocol
      await this.agent.com.atproto.repo.createRecord({
        repo: this.agent.session?.did,
        collection: `${this.RECORD_NAMESPACE}.value`,
        record: {
          $type: `${this.RECORD_NAMESPACE}.value`,
          ...value,
          timestamp,
        },
      });

      // Get metric details
      const metric = await this.getMetricById(value.metricId);
      if (!metric) throw new Error('Metric not found');

      // Write to Cloud Monitoring
      const dataPoint = {
        interval: {
          endTime: {
            seconds: Math.floor(Date.now() / 1000),
            nanos: 0,
          },
        },
        value: {
          doubleValue: value.value,
        },
      };

      const timeSeriesData = {
        metric: {
          type: `custom.googleapis.com/${metric.name}`,
          labels: value.labels || {},
        },
        resource: {
          type: 'global',
          labels: {
            project_id: this.PROJECT_ID,
          },
        },
        points: [dataPoint],
      };

      await this.monitoring.projectsTimeSeriesWrite({
        name: `projects/${this.PROJECT_ID}`,
        timeSeries: [timeSeriesData],
      });

      // Publish metric event to Pub/Sub
      const topic = this.pubsub.topic('metric-events');
      await topic.publish(
        Buffer.from(
          JSON.stringify({
            ...value,
            timestamp,
            metric,
          })
        )
      );
    } catch (error) {
      console.error('Error tracking metric:', error);
      throw new Error('Failed to track metric');
    }
  }

  async getMetrics(): Promise<CustomMetric[]> {
    try {
      const response = await this.agent.com.atproto.repo.listRecords({
        repo: this.agent.session?.did,
        collection: `${this.RECORD_NAMESPACE}.metric`,
        limit: 100,
      });

      return response.records.map((record) => ({
        id: record.uri,
        ...record.value,
      }));
    } catch (error) {
      console.error('Error getting metrics:', error);
      throw new Error('Failed to get metrics');
    }
  }

  async getMetricValues(
    metricId: string,
    startTime?: Date,
    endTime?: Date,
    limit = 100
  ): Promise<MetricValue[]> {
    try {
      const response = await this.agent.com.atproto.repo.listRecords({
        repo: this.agent.session?.did,
        collection: `${this.RECORD_NAMESPACE}.value`,
        limit,
      });

      let values = response.records
        .map((record) => record.value)
        .filter((value) => value.metricId === metricId);

      if (startTime) {
        values = values.filter((value) => new Date(value.timestamp) >= startTime);
      }

      if (endTime) {
        values = values.filter((value) => new Date(value.timestamp) <= endTime);
      }

      return values;
    } catch (error) {
      console.error('Error getting metric values:', error);
      throw new Error('Failed to get metric values');
    }
  }

  async deleteMetric(metricId: string): Promise<void> {
    try {
      const metric = await this.getMetricById(metricId);
      if (!metric) throw new Error('Metric not found');

      // Delete from AT Protocol
      await this.agent.com.atproto.repo.deleteRecord({
        repo: this.agent.session?.did,
        collection: `${this.RECORD_NAMESPACE}.metric`,
        rkey: metricId,
      });

      // Delete from Cloud Monitoring
      await this.monitoring.projectMetricDescriptors.delete({
        name: `projects/${this.PROJECT_ID}/metricDescriptors/custom.googleapis.com/${metric.name}`,
      });
    } catch (error) {
      console.error('Error deleting metric:', error);
      throw new Error('Failed to delete metric');
    }
  }

  private async getMetricById(metricId: string): Promise<CustomMetric | null> {
    try {
      const metrics = await this.getMetrics();
      return metrics.find((metric) => metric.id === metricId) || null;
    } catch {
      return null;
    }
  }

  private getMetricKind(type: CustomMetric['type']): string {
    switch (type) {
      case 'counter':
        return 'CUMULATIVE';
      case 'gauge':
        return 'GAUGE';
      case 'histogram':
        return 'DISTRIBUTION';
      default:
        return 'GAUGE';
    }
  }
}
