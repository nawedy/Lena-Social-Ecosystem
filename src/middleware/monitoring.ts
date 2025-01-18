import { APM } from '@elastic/apm-rum';
import { Counter, Histogram } from '@opentelemetry/api-metrics';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { MeterProvider } from '@opentelemetry/metrics';
import * as Sentry from '@sentry/node';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

interface MonitoringConfig {
  apm: {
    serviceName: string;
    serverUrl: string;
    environment: string;
  };
  sentry: {
    dsn: string;
    environment: string;
    tracesSampleRate: number;
  };
  metrics: {
    port: number;
    endpoint: string;
  };
}

export class MonitoringService {
  private static instance: MonitoringService;
  private apm: APM;
  private meterProvider: MeterProvider;
  private requestCounter: Counter;
  private responseTimeHistogram: Histogram;

  private constructor(config: MonitoringConfig) {
    // Initialize APM
    this.apm = require('elastic-apm-node').start({
      serviceName: config.apm.serviceName,
      serverUrl: config.apm.serverUrl,
      environment: config.apm.environment,
    });

    // Initialize Sentry
    Sentry.init({
      dsn: config.sentry.dsn,
      environment: config.sentry.environment,
      tracesSampleRate: config.sentry.tracesSampleRate,
      integrations: [
        new Sentry.Integrations.Http({ tracing: true }),
        new Sentry.Integrations.Express({ app: true }),
      ],
    });

    // Initialize Prometheus metrics
    const exporter = new PrometheusExporter({
      port: config.metrics.port,
      endpoint: config.metrics.endpoint,
    });

    this.meterProvider = new MeterProvider({
      exporter,
      interval: 1000,
    });

    const meter = this.meterProvider.getMeter('default');

    this.requestCounter = meter.createCounter('http_requests_total', {
      description: 'Total number of HTTP requests',
    });

    this.responseTimeHistogram = meter.createHistogram('http_response_time_seconds', {
      description: 'HTTP response time in seconds',
    });
  }

  public static getInstance(config?: MonitoringConfig): MonitoringService {
    if (!MonitoringService.instance) {
      if (!config) {
        throw new Error('Configuration required for first initialization');
      }
      MonitoringService.instance = new MonitoringService(config);
    }
    return MonitoringService.instance;
  }

  public requestTracking() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = process.hrtime();
      const traceId = uuidv4();

      // Add trace ID to request
      req.headers['x-trace-id'] = traceId;

      // Start APM transaction
      const transaction = this.apm.startTransaction(`${req.method} ${req.path}`, 'request');

      // Increment request counter
      this.requestCounter.add(1, {
        method: req.method,
        path: req.path,
        status: res.statusCode.toString(),
      });

      // Add response hooks
      res.on('finish', () => {
        const [seconds, nanoseconds] = process.hrtime(startTime);
        const duration = seconds + nanoseconds / 1e9;

        // Record response time
        this.responseTimeHistogram.record(duration, {
          method: req.method,
          path: req.path,
          status: res.statusCode.toString(),
        });

        // End APM transaction
        if (transaction) {
          transaction.result = res.statusCode.toString();
          transaction.end();
        }

        // Log request details
        console.log({
          timestamp: new Date().toISOString(),
          traceId,
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          duration,
          userAgent: req.headers['user-agent'],
          ip: req.ip,
        });
      });

      next();
    };
  }

  public errorTracking() {
    return (err: Error, req: Request, _res: Response, next: NextFunction) => {
      // Capture error in Sentry
      Sentry.captureException(err, {
        extra: {
          traceId: req.headers['x-trace-id'],
          path: req.path,
          method: req.method,
          query: req.query,
          body: req.body,
        },
      });

      // Capture error in APM
      this.apm.captureError(err);

      // Log error
      console.error({
        timestamp: new Date().toISOString(),
        traceId: req.headers['x-trace-id'],
        error: {
          message: err.message,
          stack: err.stack,
          name: err.name,
        },
        request: {
          path: req.path,
          method: req.method,
          query: req.query,
          body: req.body,
        },
      });

      next(err);
    };
  }

  public healthCheck() {
    return (_req: Request, res: Response) => {
      const healthStatus = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        services: {
          apm: this.apm.isStarted(),
          sentry: true,
          metrics: true,
        },
        version: process.env.APP_VERSION || 'unknown',
      };

      res.json(healthStatus);
    };
  }
}
