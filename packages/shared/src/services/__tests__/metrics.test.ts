import { metricsService } from '../monitoring/MetricsService';
import { configService } from '../config/GlobalConfig';

describe('Metrics Service', () => {
  beforeEach(() => {
    metricsService.stopCollection();
    // Reset metrics state
    (metricsService as any).metrics.clear();
    (metricsService as any).values.clear();
    (metricsService as any).alertRules.clear();
    (metricsService as any).activeAlerts.clear();
  });

  afterEach(() => {
    metricsService.stopCollection();
  });

  describe('Metric Registration', () => {
    it('should register new metrics', () => {
      metricsService.registerMetric({
        name: 'test_metric',
        help: 'Test metric help text',
        type: 'counter'
      });

      const metrics = metricsService.getMetrics();
      expect(metrics.test_metric).toBeDefined();
    });

    it('should prevent duplicate metric registration', () => {
      metricsService.registerMetric({
        name: 'unique_metric',
        help: 'Test metric',
        type: 'gauge'
      });

      expect(() => {
        metricsService.registerMetric({
          name: 'unique_metric',
          help: 'Duplicate metric',
          type: 'gauge'
        });
      }).toThrow('Metric unique_metric already exists');
    });

    it('should support different metric types', () => {
      metricsService.registerMetric({
        name: 'counter_metric',
        help: 'Counter test',
        type: 'counter'
      });

      metricsService.registerMetric({
        name: 'gauge_metric',
        help: 'Gauge test',
        type: 'gauge'
      });

      metricsService.registerMetric({
        name: 'histogram_metric',
        help: 'Histogram test',
        type: 'histogram'
      });

      const metrics = metricsService.getMetrics();
      expect(metrics.counter_metric).toBeDefined();
      expect(metrics.gauge_metric).toBeDefined();
      expect(metrics.histogram_metric).toBeDefined();
    });
  });

  describe('Metric Recording', () => {
    beforeEach(() => {
      metricsService.registerMetric({
        name: 'test_counter',
        help: 'Test counter',
        type: 'counter'
      });

      metricsService.registerMetric({
        name: 'test_gauge',
        help: 'Test gauge',
        type: 'gauge'
      });

      metricsService.registerMetric({
        name: 'test_histogram',
        help: 'Test histogram',
        type: 'histogram'
      });
    });

    it('should record counter values', () => {
      metricsService.incrementCounter('test_counter');
      metricsService.incrementCounter('test_counter');

      const metrics = metricsService.getMetrics();
      expect(metrics.test_counter.value).toBe(2);
    });

    it('should record gauge values', () => {
      metricsService.recordMetric('test_gauge', 42);
      metricsService.recordMetric('test_gauge', 43);

      const metrics = metricsService.getMetrics();
      expect(metrics.test_gauge.value).toBe(43);
    });

    it('should record histogram values', () => {
      metricsService.observeHistogram('test_histogram', 10);
      metricsService.observeHistogram('test_histogram', 20);
      metricsService.observeHistogram('test_histogram', 30);

      const metrics = metricsService.getMetrics();
      expect(metrics.test_histogram.count).toBe(3);
      expect(metrics.test_histogram.avg).toBe(20);
    });

    it('should support labels', () => {
      metricsService.recordMetric('test_gauge', 42, { region: 'us-east' });
      metricsService.recordMetric('test_gauge', 43, { region: 'us-west' });

      const metrics = metricsService.getMetrics();
      const values = metrics.test_gauge.values;
      expect(values.some(v => v.labels?.region === 'us-east')).toBe(true);
      expect(values.some(v => v.labels?.region === 'us-west')).toBe(true);
    });
  });

  describe('Alert Rules', () => {
    beforeEach(() => {
      metricsService.registerMetric({
        name: 'system_cpu',
        help: 'CPU usage',
        type: 'gauge'
      });
    });

    it('should add alert rules', () => {
      metricsService.addAlertRule({
        metric: 'system_cpu',
        condition: 'gt',
        threshold: 80,
        duration: 300,
        severity: 'warning'
      });

      const alerts = metricsService.getActiveAlerts();
      expect(alerts.length).toBe(0); // No alerts yet, just rule added
    });

    it('should fire alerts when thresholds are exceeded', async () => {
      metricsService.addAlertRule({
        metric: 'system_cpu',
        condition: 'gt',
        threshold: 80,
        duration: 0, // Immediate alert
        severity: 'critical'
      });

      metricsService.recordMetric('system_cpu', 90);
      await new Promise(resolve => setTimeout(resolve, 100)); // Wait for alert check

      const alerts = metricsService.getActiveAlerts();
      expect(alerts.length).toBe(1);
      expect(alerts[0].status).toBe('firing');
    });

    it('should resolve alerts when metrics return to normal', async () => {
      metricsService.addAlertRule({
        metric: 'system_cpu',
        condition: 'gt',
        threshold: 80,
        duration: 0,
        severity: 'warning'
      });

      metricsService.recordMetric('system_cpu', 90);
      await new Promise(resolve => setTimeout(resolve, 100));

      metricsService.recordMetric('system_cpu', 70);
      await new Promise(resolve => setTimeout(resolve, 100));

      const alerts = metricsService.getActiveAlerts();
      expect(alerts[0].status).toBe('resolved');
    });
  });

  describe('Metric Collection', () => {
    it('should start and stop collection', () => {
      metricsService.startCollection();
      expect((metricsService as any).isCollecting).toBe(true);

      metricsService.stopCollection();
      expect((metricsService as any).isCollecting).toBe(false);
    });

    it('should collect system metrics', async () => {
      metricsService.startCollection();
      await new Promise(resolve => setTimeout(resolve, 1000));

      const metrics = metricsService.getMetrics();
      expect(metrics.system_cpu_usage).toBeDefined();
      expect(metrics.system_memory_usage).toBeDefined();
    });
  });

  describe('Histogram Calculations', () => {
    beforeEach(() => {
      metricsService.registerMetric({
        name: 'response_time',
        help: 'Response time histogram',
        type: 'histogram'
      });
    });

    it('should calculate histogram statistics', () => {
      const values = [10, 20, 30, 40, 50];
      values.forEach(v => metricsService.observeHistogram('response_time', v));

      const metrics = metricsService.getMetrics();
      const histogram = metrics.response_time;

      expect(histogram.count).toBe(5);
      expect(histogram.sum).toBe(150);
      expect(histogram.avg).toBe(30);
      expect(histogram.p50).toBe(30);
      expect(histogram.p90).toBe(50);
    });

    it('should handle empty histograms', () => {
      const metrics = metricsService.getMetrics();
      const histogram = metrics.response_time;

      expect(histogram.count).toBe(0);
      expect(histogram.sum).toBe(0);
      expect(histogram.avg).toBe(0);
      expect(histogram.buckets).toEqual([]);
    });
  });

  describe('Data Retention', () => {
    beforeEach(() => {
      metricsService.registerMetric({
        name: 'test_retention',
        help: 'Retention test metric',
        type: 'gauge'
      });
    });

    it('should clean up old metrics', async () => {
      // Record metrics with different timestamps
      const now = Date.now();
      (metricsService as any).values.get('test_retention').push(
        { value: 1, timestamp: now - 25 * 60 * 60 * 1000 }, // 25 hours ago
        { value: 2, timestamp: now - 23 * 60 * 60 * 1000 }, // 23 hours ago
        { value: 3, timestamp: now } // current
      );

      (metricsService as any).cleanupOldMetrics();

      const metrics = metricsService.getMetrics();
      expect(metrics.test_retention.values.length).toBe(2); // Only recent values remain
    });
  });

  describe('Integration Tests', () => {
    it('should handle multiple metrics and alerts simultaneously', async () => {
      // Register multiple metrics
      metricsService.registerMetric({
        name: 'requests_total',
        help: 'Total requests',
        type: 'counter',
        labels: ['method', 'path']
      });

      metricsService.registerMetric({
        name: 'response_time',
        help: 'Response time',
        type: 'histogram',
        labels: ['path']
      });

      // Add alert rules
      metricsService.addAlertRule({
        metric: 'requests_total',
        condition: 'gt',
        threshold: 1000,
        duration: 0,
        severity: 'warning'
      });

      // Record metrics
      for (let i = 0; i < 1100; i++) {
        metricsService.incrementCounter('requests_total', { method: 'GET', path: '/api' });
      }

      for (let i = 0; i < 100; i++) {
        metricsService.observeHistogram('response_time', Math.random() * 1000, { path: '/api' });
      }

      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify metrics and alerts
      const metrics = metricsService.getMetrics();
      const alerts = metricsService.getActiveAlerts();

      expect(metrics.requests_total.value).toBe(1100);
      expect(metrics.response_time.count).toBe(100);
      expect(alerts.length).toBe(1);
      expect(alerts[0].status).toBe('firing');
    });
  });
}); 