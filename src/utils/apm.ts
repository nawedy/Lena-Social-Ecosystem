import * as apm from 'elastic-apm-node';
import { Transaction } from 'elastic-apm-node';
import { Express, Request, Response, NextFunction } from 'express';

interface APMConfig {
  serviceName: string;
  environment: string;
  secretToken?: string;
  serverUrl: string;
  logLevel?: string;
  active: boolean;
  captureBody: 'all' | 'errors' | 'transactions' | 'off';
  captureHeaders: boolean;
  captureErrorLogStackTraces: 'always' | 'messages' | 'never';
  errorOnAbortedRequests: boolean;
  stackTraceLimit: number;
  transactionSampleRate: number;
}

export class APMService {
  private static instance: APMService;
  private apm: typeof apm;

  private constructor(config: APMConfig) {
    this.apm = apm.start({
      serviceName: config.serviceName,
      environment: config.environment,
      secretToken: config.secretToken,
      serverUrl: config.serverUrl,
      logLevel: config.logLevel || 'info',
      active: config.active,
      captureBody: config.captureBody,
      captureHeaders: config.captureHeaders,
      captureErrorLogStackTraces: config.captureErrorLogStackTraces,
      errorOnAbortedRequests: config.errorOnAbortedRequests,
      stackTraceLimit: config.stackTraceLimit,
      transactionSampleRate: config.transactionSampleRate,

      // Additional configurations
      metricsInterval: '30s',
      centralConfig: true,
      cloudProvider: 'auto',
      instrumentIncomingHTTP: true,
      instrumentOutgoingHTTP: true,
      sourceLinesErrorAppFrames: 5,
      sourceLinesErrorLibraryFrames: 5,
      sourceLinesSpanAppFrames: 0,
      sourceLinesSpanLibraryFrames: 0,
    });
  }

  public static getInstance(config?: APMConfig): APMService {
    if (!APMService.instance) {
      if (!config) {
        throw new Error('Configuration required for first initialization');
      }
      APMService.instance = new APMService(config);
    }
    return APMService.instance;
  }

  public middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const transaction = this.apm.startTransaction(`${req.method} ${req.path}`, 'request');

      if (transaction) {
        // Add custom context
        transaction.setCustomContext({
          user: req.user,
          query: req.query,
          params: req.params,
        });

        // Add user context if available
        if (req.user) {
          transaction.setUserContext({
            id: req.user.id,
            username: req.user.username,
            email: req.user.email,
          });
        }

        // Add labels
        transaction.addLabels({
          method: req.method,
          route: req.route?.path,
          status: res.statusCode,
        });
      }

      // End transaction on response finish
      res.on('finish', () => {
        if (transaction) {
          transaction.result = String(res.statusCode);
          transaction.end();
        }
      });

      next();
    };
  }

  public createSpan<T>(name: string, type: string, fn: (span: any) => Promise<T>): Promise<T> {
    const span = this.apm.startSpan(name, type);
    return fn(span).finally(() => {
      if (span) span.end();
    });
  }

  public captureError(error: Error, custom?: Record<string, any>) {
    return this.apm.captureError(error, {
      custom,
      timestamp: new Date().toISOString(),
    });
  }

  public setCustomContext(context: Record<string, any>) {
    const transaction = this.apm.currentTransaction;
    if (transaction) {
      transaction.setCustomContext(context);
    }
  }

  public setUserContext(user: {
    id: string | number;
    username?: string;
    email?: string;
  }) {
    const transaction = this.apm.currentTransaction;
    if (transaction) {
      transaction.setUserContext(user);
    }
  }

  public startTransaction(name: string, type: string): Transaction | null {
    return this.apm.startTransaction(name, type);
  }

  public async withTransaction<T>(
    name: string,
    type: string,
    fn: (transaction: Transaction) => Promise<T>
  ): Promise<T> {
    const transaction = this.startTransaction(name, type);
    try {
      const result = await fn(transaction!);
      transaction?.end();
      return result;
    } catch (error) {
      transaction?.end();
      throw error;
    }
  }

  public instrumentDatabase() {
    return {
      beforeQuery: (sql: string, params: any[]) => {
        const span = this.apm.startSpan('db.query');
        if (span) {
          span.setLabel('sql', sql);
          span.setLabel('params', JSON.stringify(params));
        }
        return span;
      },
      afterQuery: (span: any) => {
        if (span) span.end();
      },
    };
  }

  public instrumentCache() {
    return {
      beforeOperation: (operation: string, key: string) => {
        const span = this.apm.startSpan(`cache.${operation}`);
        if (span) {
          span.setLabel('key', key);
        }
        return span;
      },
      afterOperation: (span: any) => {
        if (span) span.end();
      },
    };
  }

  public instrumentExternalCall() {
    return {
      beforeCall: (service: string, endpoint: string) => {
        const span = this.apm.startSpan(`external.${service}`);
        if (span) {
          span.setLabel('endpoint', endpoint);
        }
        return span;
      },
      afterCall: (span: any) => {
        if (span) span.end();
      },
    };
  }
}
