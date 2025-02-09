import { configService } from '../config/GlobalConfig';
import { EventEmitter } from 'events';

interface ErrorMetadata {
  timestamp: number;
  environment: string;
  platform: string;
  userId?: string;
  sessionId?: string;
  requestId?: string;
  url?: string;
  method?: string;
  statusCode?: number;
  component?: string;
  action?: string;
  tags?: string[];
  [key: string]: any;
}

interface ErrorReport {
  id: string;
  error: Error;
  metadata: ErrorMetadata;
  stack?: string;
  fingerprint: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'new' | 'investigating' | 'resolved';
  resolution?: {
    resolvedBy: string;
    resolvedAt: number;
    resolution: string;
  };
}

interface ErrorFilter {
  severity?: ErrorReport['severity'];
  status?: ErrorReport['status'];
  platform?: string;
  component?: string;
  startDate?: number;
  endDate?: number;
  tags?: string[];
}

class ErrorService extends EventEmitter {
  private static instance: ErrorService;
  private errors: Map<string, ErrorReport> = new Map();
  private errorPatterns: Map<string, RegExp> = new Map();
  private errorHandlers: Map<string, (error: Error, metadata: ErrorMetadata) => Promise<void>> = new Map();
  private isInitialized = false;

  private constructor() {
    super();
    this.initializeErrorPatterns();
    this.setupGlobalHandlers();
  }

  static getInstance(): ErrorService {
    if (!ErrorService.instance) {
      ErrorService.instance = new ErrorService();
    }
    return ErrorService.instance;
  }

  private initializeErrorPatterns() {
    // Common error patterns for categorization
    this.errorPatterns.set('network', /^(Network|Connection|Timeout|DNS|TLS|SSL)/i);
    this.errorPatterns.set('auth', /^(Authentication|Authorization|Token|Permission|Access)/i);
    this.errorPatterns.set('validation', /^(Validation|Invalid|Required|Format|Type)/i);
    this.errorPatterns.set('database', /^(Database|Query|SQL|Deadlock|Lock|Transaction)/i);
    this.errorPatterns.set('storage', /^(Storage|File|Upload|Download|IPFS)/i);
    this.errorPatterns.set('rate_limit', /^(Rate Limit|Too Many|Quota|Threshold)/i);
    this.errorPatterns.set('blockchain', /^(Web3|Contract|Transaction|Gas|Chain)/i);
  }

  private setupGlobalHandlers() {
    if (typeof window !== 'undefined') {
      // Browser environment
      window.onerror = (message, source, lineno, colno, error) => {
        this.handleError(error || new Error(message as string), {
          source,
          lineno,
          colno,
          type: 'window.onerror'
        });
      };

      window.addEventListener('unhandledrejection', (event) => {
        this.handleError(event.reason, {
          type: 'unhandledrejection'
        });
      });
    } else {
      // Node.js environment
      process.on('uncaughtException', (error) => {
        this.handleError(error, {
          type: 'uncaughtException'
        });
      });

      process.on('unhandledRejection', (reason) => {
        this.handleError(reason as Error, {
          type: 'unhandledRejection'
        });
      });
    }
  }

  async initialize() {
    if (this.isInitialized) return;

    // Register default error handlers
    this.registerErrorHandler('network', this.handleNetworkError.bind(this));
    this.registerErrorHandler('auth', this.handleAuthError.bind(this));
    this.registerErrorHandler('validation', this.handleValidationError.bind(this));
    this.registerErrorHandler('database', this.handleDatabaseError.bind(this));
    this.registerErrorHandler('storage', this.handleStorageError.bind(this));
    this.registerErrorHandler('rate_limit', this.handleRateLimitError.bind(this));
    this.registerErrorHandler('blockchain', this.handleBlockchainError.bind(this));

    this.isInitialized = true;
  }

  registerErrorHandler(
    pattern: string,
    handler: (error: Error, metadata: ErrorMetadata) => Promise<void>
  ) {
    this.errorHandlers.set(pattern, handler);
  }

  async handleError(error: Error | any, metadata: Partial<ErrorMetadata> = {}): Promise<void> {
    try {
      // Ensure error is Error instance
      const normalizedError = error instanceof Error ? error : new Error(String(error));

      // Enrich metadata
      const enrichedMetadata: ErrorMetadata = {
        timestamp: Date.now(),
        environment: configService.get('platform').environment,
        platform: configService.get('platform').name,
        ...metadata
      };

      // Generate error report
      const errorReport = this.createErrorReport(normalizedError, enrichedMetadata);

      // Store error
      this.errors.set(errorReport.id, errorReport);

      // Emit error event
      this.emit('error', errorReport);

      // Find and execute appropriate handler
      const pattern = this.categorizeError(normalizedError);
      const handler = this.errorHandlers.get(pattern);
      if (handler) {
        await handler(normalizedError, enrichedMetadata);
      }

      // Log error if monitoring is enabled
      if (configService.get('monitoring').enabled) {
        await this.logError(errorReport);
      }

      // Check if error threshold is exceeded
      await this.checkErrorThreshold(pattern);
    } catch (handlingError) {
      console.error('Error while handling error:', handlingError);
    }
  }

  private createErrorReport(error: Error, metadata: ErrorMetadata): ErrorReport {
    return {
      id: crypto.randomUUID(),
      error,
      metadata,
      stack: error.stack,
      fingerprint: this.generateFingerprint(error),
      severity: this.calculateSeverity(error, metadata),
      status: 'new'
    };
  }

  private generateFingerprint(error: Error): string {
    // Generate unique fingerprint based on error properties
    const components = [
      error.name,
      error.message,
      error.stack?.split('\n')[1] || ''
    ];
    return components.join('|');
  }

  private calculateSeverity(error: Error, metadata: ErrorMetadata): ErrorReport['severity'] {
    // Determine severity based on error type and metadata
    if (error instanceof TypeError || error instanceof SyntaxError) {
      return 'low';
    }

    if (metadata.statusCode) {
      if (metadata.statusCode >= 500) return 'high';
      if (metadata.statusCode >= 400) return 'medium';
    }

    if (this.errorPatterns.get('network').test(error.message)) return 'high';
    if (this.errorPatterns.get('database').test(error.message)) return 'critical';
    if (this.errorPatterns.get('auth').test(error.message)) return 'high';

    return 'medium';
  }

  private categorizeError(error: Error): string {
    // Categorize error based on patterns
    for (const [pattern, regex] of this.errorPatterns) {
      if (regex.test(error.message)) {
        return pattern;
      }
    }
    return 'unknown';
  }

  private async checkErrorThreshold(pattern: string) {
    const threshold = configService.get('monitoring').alerts.thresholds.errors;
    const recentErrors = Array.from(this.errors.values()).filter(
      error => error.metadata.timestamp > Date.now() - 60000 // Last minute
    );

    if (recentErrors.length >= threshold) {
      await this.handleErrorThresholdExceeded(pattern, recentErrors);
    }
  }

  private async handleErrorThresholdExceeded(pattern: string, errors: ErrorReport[]) {
    // Implement threshold exceeded handling
    this.emit('threshold_exceeded', { pattern, errors });
  }

  private async logError(errorReport: ErrorReport) {
    // Implement error logging to monitoring system
    console.error('Error Report:', {
      id: errorReport.id,
      message: errorReport.error.message,
      severity: errorReport.severity,
      metadata: errorReport.metadata
    });
  }

  // Specific error handlers
  private async handleNetworkError(error: Error, metadata: ErrorMetadata) {
    // Implement network error handling
  }

  private async handleAuthError(error: Error, metadata: ErrorMetadata) {
    // Implement auth error handling
  }

  private async handleValidationError(error: Error, metadata: ErrorMetadata) {
    // Implement validation error handling
  }

  private async handleDatabaseError(error: Error, metadata: ErrorMetadata) {
    // Implement database error handling
  }

  private async handleStorageError(error: Error, metadata: ErrorMetadata) {
    // Implement storage error handling
  }

  private async handleRateLimitError(error: Error, metadata: ErrorMetadata) {
    // Implement rate limit error handling
  }

  private async handleBlockchainError(error: Error, metadata: ErrorMetadata) {
    // Implement blockchain error handling
  }

  // Public methods
  async getErrors(filter?: ErrorFilter): Promise<ErrorReport[]> {
    let errors = Array.from(this.errors.values());

    if (filter) {
      errors = errors.filter(error => {
        if (filter.severity && error.severity !== filter.severity) return false;
        if (filter.status && error.status !== filter.status) return false;
        if (filter.platform && error.metadata.platform !== filter.platform) return false;
        if (filter.component && error.metadata.component !== filter.component) return false;
        if (filter.startDate && error.metadata.timestamp < filter.startDate) return false;
        if (filter.endDate && error.metadata.timestamp > filter.endDate) return false;
        if (filter.tags && !filter.tags.every(tag => error.metadata.tags?.includes(tag))) return false;
        return true;
      });
    }

    return errors;
  }

  async resolveError(
    errorId: string,
    resolution: {
      resolvedBy: string;
      resolution: string;
    }
  ): Promise<void> {
    const error = this.errors.get(errorId);
    if (!error) {
      throw new Error(`Error with ID ${errorId} not found`);
    }

    error.status = 'resolved';
    error.resolution = {
      ...resolution,
      resolvedAt: Date.now()
    };

    this.errors.set(errorId, error);
    this.emit('error_resolved', error);
  }

  async clearResolvedErrors(olderThan?: number): Promise<void> {
    const now = Date.now();
    for (const [id, error] of this.errors.entries()) {
      if (
        error.status === 'resolved' &&
        (!olderThan || error.resolution.resolvedAt < now - olderThan)
      ) {
        this.errors.delete(id);
      }
    }
  }

  getErrorStats(): {
    total: number;
    bySeverity: Record<ErrorReport['severity'], number>;
    byStatus: Record<ErrorReport['status'], number>;
    byPattern: Record<string, number>;
  } {
    const errors = Array.from(this.errors.values());
    return {
      total: errors.length,
      bySeverity: {
        low: errors.filter(e => e.severity === 'low').length,
        medium: errors.filter(e => e.severity === 'medium').length,
        high: errors.filter(e => e.severity === 'high').length,
        critical: errors.filter(e => e.severity === 'critical').length
      },
      byStatus: {
        new: errors.filter(e => e.status === 'new').length,
        investigating: errors.filter(e => e.status === 'investigating').length,
        resolved: errors.filter(e => e.status === 'resolved').length
      },
      byPattern: Array.from(this.errorPatterns.keys()).reduce((acc, pattern) => ({
        ...acc,
        [pattern]: errors.filter(e => this.categorizeError(e.error) === pattern).length
      }), {})
    };
  }
}

// Export singleton instance
export const errorService = ErrorService.getInstance(); 