import { monitoring_v3, google } from '@google-cloud/monitoring';
import { Datastore } from '@google-cloud/datastore';
import { BigQuery } from '@google-cloud/bigquery';
import { config } from '../config';
import { atproto } from './atproto';

interface MetricData {
  name: string;
  value: number;
  timestamp: string;
  labels?: Record<string, string>;
}

interface DashboardConfig {
  id: string;
  name: string;
  metrics: string[];
  refreshInterval: number;
  layout: {
    rows: number;
    cols: number;
    widgets: Array<{
      metric: string;
      position: { row: number; col: number };
      size: { width: number; height: number };
      type: 'line' | 'gauge' | 'bar' | 'number';
    }>;
  };
}

export class AdvancedAnalyticsService {
  private static instance: AdvancedAnalyticsService;
  private monitoringClient: monitoring_v3.MetricServiceClient;
  private datastore: Datastore;
  private bigquery: BigQuery;
  private projectId: string;
  private dashboardConfigs: Map<string, DashboardConfig>;

  private constructor() {
    this.projectId = config.gcp.projectId;
    this.monitoringClient = new monitoring_v3.MetricServiceClient({
      keyFilename: config.gcp.keyFile,
    });
    this.datastore = new Datastore({
      projectId: this.projectId,
      keyFilename: config.gcp.keyFile,
    });
    this.bigquery = new BigQuery({
      projectId: this.projectId,
      keyFilename: config.gcp.keyFile,
    });
    this.dashboardConfigs = new Map();
    this.initializeDashboards();
  }

  public static getInstance(): AdvancedAnalyticsService {
    if (!AdvancedAnalyticsService.instance) {
      AdvancedAnalyticsService.instance = new AdvancedAnalyticsService();
    }
    return AdvancedAnalyticsService.instance;
  }

  private async initializeDashboards() {
    // User Engagement Dashboard
    this.dashboardConfigs.set('user-engagement', {
      id: 'user-engagement',
      name: 'User Engagement Analytics',
      metrics: [
        'active-users',
        'session-duration',
        'feature-usage',
        'user-retention',
      ],
      refreshInterval: 300, // 5 minutes
      layout: {
        rows: 2,
        cols: 2,
        widgets: [
          {
            metric: 'active-users',
            position: { row: 0, col: 0 },
            size: { width: 1, height: 1 },
            type: 'line',
          },
          {
            metric: 'session-duration',
            position: { row: 0, col: 1 },
            size: { width: 1, height: 1 },
            type: 'gauge',
          },
          {
            metric: 'feature-usage',
            position: { row: 1, col: 0 },
            size: { width: 1, height: 1 },
            type: 'bar',
          },
          {
            metric: 'user-retention',
            position: { row: 1, col: 1 },
            size: { width: 1, height: 1 },
            type: 'number',
          },
        ],
      },
    });

    // Performance Dashboard
    this.dashboardConfigs.set('performance', {
      id: 'performance',
      name: 'System Performance Analytics',
      metrics: ['api-latency', 'error-rate', 'resource-usage', 'cache-hits'],
      refreshInterval: 60, // 1 minute
      layout: {
        rows: 2,
        cols: 2,
        widgets: [
          {
            metric: 'api-latency',
            position: { row: 0, col: 0 },
            size: { width: 1, height: 1 },
            type: 'line',
          },
          {
            metric: 'error-rate',
            position: { row: 0, col: 1 },
            size: { width: 1, height: 1 },
            type: 'gauge',
          },
          {
            metric: 'resource-usage',
            position: { row: 1, col: 0 },
            size: { width: 1, height: 1 },
            type: 'bar',
          },
          {
            metric: 'cache-hits',
            position: { row: 1, col: 1 },
            size: { width: 1, height: 1 },
            type: 'number',
          },
        ],
      },
    });

    // Federation Dashboard
    this.dashboardConfigs.set('federation', {
      id: 'federation',
      name: 'Federation Analytics',
      metrics: [
        'federation-requests',
        'federation-latency',
        'federation-errors',
        'federation-peers',
      ],
      refreshInterval: 300, // 5 minutes
      layout: {
        rows: 2,
        cols: 2,
        widgets: [
          {
            metric: 'federation-requests',
            position: { row: 0, col: 0 },
            size: { width: 1, height: 1 },
            type: 'line',
          },
          {
            metric: 'federation-latency',
            position: { row: 0, col: 1 },
            size: { width: 1, height: 1 },
            type: 'gauge',
          },
          {
            metric: 'federation-errors',
            position: { row: 1, col: 0 },
            size: { width: 1, height: 1 },
            type: 'bar',
          },
          {
            metric: 'federation-peers',
            position: { row: 1, col: 1 },
            size: { width: 1, height: 1 },
            type: 'number',
          },
        ],
      },
    });
  }

  async createCustomMetric(name: string, description: string): Promise<void> {
    const projectPath = this.monitoringClient.projectPath(this.projectId);
    const metricDescriptor = {
      name: `custom.googleapis.com/${name}`,
      displayName: name,
      description,
      type: 'custom.googleapis.com/metric',
      metricKind: 'GAUGE',
      valueType: 'DOUBLE',
      unit: '1',
      labels: [],
    };

    await this.monitoringClient.createMetricDescriptor({
      name: projectPath,
      metricDescriptor,
    });
  }

  async writeMetricData(data: MetricData): Promise<void> {
    const projectPath = this.monitoringClient.projectPath(this.projectId);
    const timeSeriesData = {
      metric: {
        type: `custom.googleapis.com/${data.name}`,
        labels: data.labels || {},
      },
      resource: {
        type: 'global',
        labels: {
          project_id: this.projectId,
        },
      },
      points: [
        {
          interval: {
            endTime: {
              seconds: Math.floor(Date.now() / 1000),
            },
          },
          value: {
            doubleValue: data.value,
          },
        },
      ],
    };

    await this.monitoringClient.createTimeSeries({
      name: projectPath,
      timeSeries: [timeSeriesData],
    });

    // Store in BigQuery for long-term analysis
    await this.storeToBigQuery(data);
  }

  private async storeToBigQuery(data: MetricData): Promise<void> {
    const dataset = this.bigquery.dataset('analytics');
    const table = dataset.table('metrics');

    await table.insert({
      metric_name: data.name,
      value: data.value,
      timestamp: data.timestamp,
      labels: JSON.stringify(data.labels || {}),
    });
  }

  async getDashboardData(dashboardId: string): Promise<any> {
    const config = this.dashboardConfigs.get(dashboardId);
    if (!config) throw new Error('Dashboard not found');

    const projectPath = this.monitoringClient.projectPath(this.projectId);
    const metricData: Record<string, any> = {};

    for (const metric of config.metrics) {
      const [timeSeries] = await this.monitoringClient.listTimeSeries({
        name: projectPath,
        filter: `metric.type = "custom.googleapis.com/${metric}"`,
        interval: {
          startTime: {
            seconds: Math.floor(Date.now() / 1000) - 3600,
          },
          endTime: {
            seconds: Math.floor(Date.now() / 1000),
          },
        },
      });

      metricData[metric] = timeSeries;
    }

    return {
      config,
      data: metricData,
    };
  }

  async getAggregatedMetrics(params: {
    metrics: string[];
    startTime: string;
    endTime: string;
    aggregation: 'sum' | 'avg' | 'min' | 'max';
  }): Promise<Record<string, number>> {
    const query = `
      SELECT
        metric_name,
        ${params.aggregation}(value) as aggregated_value
      FROM \`${this.projectId}.analytics.metrics\`
      WHERE
        timestamp BETWEEN @startTime AND @endTime
        AND metric_name IN UNNEST(@metrics)
      GROUP BY metric_name
    `;

    const options = {
      query,
      params: {
        startTime: params.startTime,
        endTime: params.endTime,
        metrics: params.metrics,
      },
    };

    const [rows] = await this.bigquery.query(options);
    return rows.reduce((acc: Record<string, number>, row: any) => {
      acc[row.metric_name] = row.aggregated_value;
      return acc;
    }, {});
  }

  async generateReport(params: {
    metrics: string[];
    startTime: string;
    endTime: string;
    format: 'json' | 'csv';
  }): Promise<string> {
    const query = `
      SELECT
        metric_name,
        timestamp,
        value,
        labels
      FROM \`${this.projectId}.analytics.metrics\`
      WHERE
        timestamp BETWEEN @startTime AND @endTime
        AND metric_name IN UNNEST(@metrics)
      ORDER BY timestamp DESC
    `;

    const options = {
      query,
      params: {
        startTime: params.startTime,
        endTime: params.endTime,
        metrics: params.metrics,
      },
    };

    const [rows] = await this.bigquery.query(options);

    if (params.format === 'csv') {
      // Convert to CSV format
      const header = 'metric_name,timestamp,value,labels\n';
      const csvRows = rows.map(
        (row: any) =>
          `${row.metric_name},${row.timestamp},${row.value},${JSON.stringify(row.labels)}`
      );
      return header + csvRows.join('\n');
    }

    return JSON.stringify(rows, null, 2);
  }
}

export const advancedAnalytics = AdvancedAnalyticsService.getInstance();
