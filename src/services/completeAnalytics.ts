import { BigQuery } from '@google-cloud/bigquery';
import { Storage } from '@google-cloud/storage';
import { PubSub } from '@google-cloud/pubsub';
import { config } from '../config';
import { performanceMonitoring } from './performanceMonitoring';
import { advancedAnalytics } from './advancedAnalytics';

interface AnalyticsEvent {
  id: string;
  type: string;
  timestamp: string;
  userId?: string;
  sessionId?: string;
  data: Record<string, any>;
  metadata: {
    service: string;
    environment: string;
    version: string;
  };
}

interface AnalyticsQuery {
  metrics: string[];
  dimensions: string[];
  filters?: Array<{
    field: string;
    operator: 'equals' | 'contains' | 'gt' | 'lt' | 'between';
    value: any;
  }>;
  timeRange: {
    start: string;
    end: string;
  };
  groupBy?: string[];
  orderBy?: Array<{
    field: string;
    direction: 'asc' | 'desc';
  }>;
  limit?: number;
}

interface AnalyticsDashboard {
  id: string;
  name: string;
  description: string;
  queries: Array<{
    id: string;
    name: string;
    query: AnalyticsQuery;
    visualization: 'line' | 'bar' | 'pie' | 'table';
    refreshInterval: number;
  }>;
  layout: Array<{
    queryId: string;
    position: { x: number; y: number };
    size: { width: number; height: number };
  }>;
}

export class CompleteAnalyticsService {
  private static instance: CompleteAnalyticsService;
  private bigquery: BigQuery;
  private storage: Storage;
  private pubsub: PubSub;
  private dashboards: Map<string, AnalyticsDashboard>;
  private eventBuffer: AnalyticsEvent[];
  private readonly BUFFER_FLUSH_INTERVAL = 60000; // 1 minute
  private readonly BUFFER_SIZE_LIMIT = 1000;
  private readonly DATASET_NAME = 'complete_analytics';

  private constructor() {
    this.bigquery = new BigQuery({
      projectId: config.gcp.projectId,
      keyFilename: config.gcp.keyFile,
    });
    this.storage = new Storage({
      projectId: config.gcp.projectId,
      keyFilename: config.gcp.keyFile,
    });
    this.pubsub = new PubSub({
      projectId: config.gcp.projectId,
      keyFilename: config.gcp.keyFile,
    });
    this.dashboards = new Map();
    this.eventBuffer = [];

    this.initializeService();
  }

  public static getInstance(): CompleteAnalyticsService {
    if (!CompleteAnalyticsService.instance) {
      CompleteAnalyticsService.instance = new CompleteAnalyticsService();
    }
    return CompleteAnalyticsService.instance;
  }

  private async initializeService(): Promise<void> {
    await this.ensureDatasetExists();
    await this.loadDashboards();
    this.startEventBufferFlush();
    this.setupEventSubscription();
  }

  // Event Tracking
  async trackEvent(
    event: Omit<AnalyticsEvent, 'id' | 'timestamp'>
  ): Promise<void> {
    const completeEvent: AnalyticsEvent = {
      ...event,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    };

    this.eventBuffer.push(completeEvent);

    if (this.eventBuffer.length >= this.BUFFER_SIZE_LIMIT) {
      await this.flushEventBuffer();
    }
  }

  // Query Builder
  async queryAnalytics(query: AnalyticsQuery): Promise<any[]> {
    const sqlQuery = this.buildSqlQuery(query);
    try {
      const [rows] = await this.bigquery.query({ query: sqlQuery });
      return rows;
    } catch (error) {
      performanceMonitoring.recordError(error as Error, {
        operation: 'queryAnalytics',
        query: sqlQuery,
      });
      throw error;
    }
  }

  // Dashboard Management
  async createDashboard(
    dashboard: Omit<AnalyticsDashboard, 'id'>
  ): Promise<AnalyticsDashboard> {
    const newDashboard: AnalyticsDashboard = {
      ...dashboard,
      id: crypto.randomUUID(),
    };

    await this.persistDashboard(newDashboard);
    this.dashboards.set(newDashboard.id, newDashboard);
    return newDashboard;
  }

  async getDashboardData(dashboardId: string): Promise<Record<string, any>> {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) {
      throw new Error('Dashboard not found');
    }

    const results: Record<string, any> = {};
    await Promise.all(
      dashboard.queries.map(async query => {
        try {
          results[query.id] = await this.queryAnalytics(query.query);
        } catch (error) {
          performanceMonitoring.recordError(error as Error, {
            operation: 'getDashboardData',
            dashboardId,
            queryId: query.id,
          });
        }
      })
    );

    return results;
  }

  // Service-Specific Analytics
  async getUserAnalytics(params: {
    userId: string;
    metrics: string[];
    timeRange: AnalyticsQuery['timeRange'];
  }): Promise<any> {
    const query: AnalyticsQuery = {
      metrics: params.metrics,
      dimensions: ['timestamp'],
      filters: [
        {
          field: 'userId',
          operator: 'equals',
          value: params.userId,
        },
      ],
      timeRange: params.timeRange,
      orderBy: [{ field: 'timestamp', direction: 'asc' }],
    };

    return this.queryAnalytics(query);
  }

  async getServiceMetrics(params: {
    service: string;
    metrics: string[];
    timeRange: AnalyticsQuery['timeRange'];
  }): Promise<any> {
    const query: AnalyticsQuery = {
      metrics: params.metrics,
      dimensions: ['timestamp'],
      filters: [
        {
          field: 'metadata.service',
          operator: 'equals',
          value: params.service,
        },
      ],
      timeRange: params.timeRange,
      groupBy: ['metadata.service'],
      orderBy: [{ field: 'timestamp', direction: 'asc' }],
    };

    return this.queryAnalytics(query);
  }

  // Export and Reporting
  async exportAnalytics(params: {
    query: AnalyticsQuery;
    format: 'csv' | 'json';
    destination: 'file' | 'bigquery';
  }): Promise<string> {
    const data = await this.queryAnalytics(params.query);

    if (params.destination === 'file') {
      const bucket = this.storage.bucket(config.gcp.storageBucket);
      const filename = `analytics_export_${new Date().toISOString()}.${params.format}`;
      const file = bucket.file(`analytics_exports/${filename}`);

      let content: string;
      if (params.format === 'csv') {
        content = this.convertToCsv(data);
      } else {
        content = JSON.stringify(data, null, 2);
      }

      await file.save(content);
      return `gs://${config.gcp.storageBucket}/analytics_exports/${filename}`;
    } else {
      const datasetRef = this.bigquery.dataset(this.DATASET_NAME);
      const tableId = `export_${new Date().getTime()}`;
      const [table] = await datasetRef.createTable(tableId);
      await table.insert(data);
      return `${config.gcp.projectId}.${this.DATASET_NAME}.${tableId}`;
    }
  }

  // Private Methods
  private async ensureDatasetExists(): Promise<void> {
    const [datasets] = await this.bigquery.getDatasets();
    const exists = datasets.some(d => d.id === this.DATASET_NAME);

    if (!exists) {
      await this.bigquery.createDataset(this.DATASET_NAME);
      await this.createAnalyticsTables();
    }
  }

  private async createAnalyticsTables(): Promise<void> {
    const dataset = this.bigquery.dataset(this.DATASET_NAME);

    // Events table
    await dataset.createTable('events', {
      schema: {
        fields: [
          { name: 'id', type: 'STRING' },
          { name: 'type', type: 'STRING' },
          { name: 'timestamp', type: 'TIMESTAMP' },
          { name: 'userId', type: 'STRING' },
          { name: 'sessionId', type: 'STRING' },
          { name: 'data', type: 'JSON' },
          {
            name: 'metadata',
            type: 'RECORD',
            fields: [
              { name: 'service', type: 'STRING' },
              { name: 'environment', type: 'STRING' },
              { name: 'version', type: 'STRING' },
            ],
          },
        ],
      },
      timePartitioning: {
        type: 'DAY',
        field: 'timestamp',
      },
    });

    // Metrics table
    await dataset.createTable('metrics', {
      schema: {
        fields: [
          { name: 'name', type: 'STRING' },
          { name: 'value', type: 'FLOAT' },
          { name: 'timestamp', type: 'TIMESTAMP' },
          { name: 'labels', type: 'JSON' },
        ],
      },
      timePartitioning: {
        type: 'DAY',
        field: 'timestamp',
      },
    });
  }

  private buildSqlQuery(query: AnalyticsQuery): string {
    const select = [...query.metrics, ...query.dimensions].join(', ');
    const from = `\`${config.gcp.projectId}.${this.DATASET_NAME}.events\``;

    let sql = `SELECT ${select} FROM ${from}`;

    // Add WHERE clause
    if (query.filters && query.filters.length > 0) {
      const conditions = query.filters.map(filter => {
        switch (filter.operator) {
          case 'equals':
            return `${filter.field} = @${filter.field}`;
          case 'contains':
            return `${filter.field} LIKE @${filter.field}`;
          case 'gt':
            return `${filter.field} > @${filter.field}`;
          case 'lt':
            return `${filter.field} < @${filter.field}`;
          case 'between':
            return `${filter.field} BETWEEN @${filter.field}_start AND @${filter.field}_end`;
          default:
            return '';
        }
      });
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    // Add time range
    sql += ` AND timestamp BETWEEN @start_time AND @end_time`;

    // Add GROUP BY
    if (query.groupBy && query.groupBy.length > 0) {
      sql += ` GROUP BY ${query.groupBy.join(', ')}`;
    }

    // Add ORDER BY
    if (query.orderBy && query.orderBy.length > 0) {
      const orderClauses = query.orderBy.map(
        order => `${order.field} ${order.direction.toUpperCase()}`
      );
      sql += ` ORDER BY ${orderClauses.join(', ')}`;
    }

    // Add LIMIT
    if (query.limit) {
      sql += ` LIMIT ${query.limit}`;
    }

    return sql;
  }

  private async persistDashboard(dashboard: AnalyticsDashboard): Promise<void> {
    const bucket = this.storage.bucket(config.gcp.storageBucket);
    const file = bucket.file(`analytics/dashboards/${dashboard.id}.json`);
    await file.save(JSON.stringify(dashboard, null, 2));
  }

  private async loadDashboards(): Promise<void> {
    const bucket = this.storage.bucket(config.gcp.storageBucket);
    const [files] = await bucket.getFiles({ prefix: 'analytics/dashboards/' });

    await Promise.all(
      files.map(async file => {
        const content = await file.download();
        const dashboard: AnalyticsDashboard = JSON.parse(content[0].toString());
        this.dashboards.set(dashboard.id, dashboard);
      })
    );
  }

  private async flushEventBuffer(): Promise<void> {
    if (this.eventBuffer.length === 0) return;

    const events = [...this.eventBuffer];
    this.eventBuffer = [];

    try {
      const dataset = this.bigquery.dataset(this.DATASET_NAME);
      const table = dataset.table('events');
      await table.insert(events);

      // Record success metric
      await advancedAnalytics.writeMetricData({
        name: 'analytics-events-processed',
        value: events.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      performanceMonitoring.recordError(error as Error, {
        operation: 'flushEventBuffer',
        eventCount: events.length,
      });

      // Put events back in buffer
      this.eventBuffer.push(...events);
    }
  }

  private startEventBufferFlush(): void {
    setInterval(() => this.flushEventBuffer(), this.BUFFER_FLUSH_INTERVAL);
  }

  private setupEventSubscription(): void {
    const topic = this.pubsub.topic('analytics-events');
    const subscription = topic.subscription('analytics-processor');

    subscription.on('message', async message => {
      try {
        const event: AnalyticsEvent = JSON.parse(message.data.toString());
        await this.trackEvent(event);
        message.ack();
      } catch (error) {
        performanceMonitoring.recordError(error as Error, {
          operation: 'processAnalyticsEvent',
          messageId: message.id,
        });
        message.nack();
      }
    });
  }

  private convertToCsv(data: any[]): string {
    if (data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.join(','),
      ...data.map(row =>
        headers
          .map(header => {
            const value = row[header];
            return typeof value === 'object'
              ? JSON.stringify(value).replace(/"/g, '""')
              : value;
          })
          .join(',')
      ),
    ];

    return csvRows.join('\n');
  }
}

export const completeAnalytics = CompleteAnalyticsService.getInstance();
