import { configService } from '../config/GlobalConfig';
import { errorService } from '../error/ErrorService';
import { EventEmitter } from 'events';

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

interface LogMetadata {
  timestamp: number;
  level: LogLevel;
  environment: string;
  platform: string;
  component?: string;
  userId?: string;
  sessionId?: string;
  requestId?: string;
  action?: string;
  duration?: number;
  tags?: string[];
  [key: string]: any;
}

interface LogEntry {
  id: string;
  message: string;
  metadata: LogMetadata;
  context?: any;
}

interface LogFilter {
  level?: LogLevel;
  platform?: string;
  component?: string;
  startDate?: number;
  endDate?: number;
  tags?: string[];
  search?: string;
}

interface LogTransport {
  name: string;
  log(entry: LogEntry): Promise<void>;
}

class ConsoleTransport implements LogTransport {
  name = 'console';

  private colorMap: Record<LogLevel, string> = {
    debug: '\x1b[34m', // Blue
    info: '\x1b[32m',  // Green
    warn: '\x1b[33m',  // Yellow
    error: '\x1b[31m', // Red
    fatal: '\x1b[35m'  // Magenta
  };

  async log(entry: LogEntry): Promise<void> {
    const color = this.colorMap[entry.metadata.level];
    const reset = '\x1b[0m';
    const timestamp = new Date(entry.metadata.timestamp).toISOString();
    
    console.log(
      `${color}[${timestamp}] [${entry.metadata.level.toUpperCase()}] ${entry.message}${reset}`,
      entry.metadata,
      entry.context || ''
    );
  }
}

class FileTransport implements LogTransport {
  name = 'file';
  private logFile: string;

  constructor(logFile: string) {
    this.logFile = logFile;
  }

  async log(entry: LogEntry): Promise<void> {
    // Implementation would write to file system
    // This would be implemented differently for browser vs Node.js
  }
}

class CloudTransport implements LogTransport {
  name = 'cloud';
  private endpoint: string;

  constructor(endpoint: string) {
    this.endpoint = endpoint;
  }

  async log(entry: LogEntry): Promise<void> {
    try {
      await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(entry)
      });
    } catch (error) {
      console.error('Failed to send log to cloud:', error);
    }
  }
}

class LoggingService extends EventEmitter {
  private static instance: LoggingService;
  private transports: Map<string, LogTransport> = new Map();
  private logs: Map<string, LogEntry> = new Map();
  private logBuffer: LogEntry[] = [];
  private isBuffering = false;
  private bufferSize = 100;
  private flushInterval = 5000; // 5 seconds
  private levelPriority: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
    fatal: 4
  };

  private constructor() {
    super();
    this.setupDefaultTransports();
    this.startBufferFlush();
    this.setupErrorServiceIntegration();
  }

  static getInstance(): LoggingService {
    if (!LoggingService.instance) {
      LoggingService.instance = new LoggingService();
    }
    return LoggingService.instance;
  }

  private setupDefaultTransports() {
    this.addTransport(new ConsoleTransport());

    if (configService.get('monitoring').enabled) {
      // Add cloud transport in production
      if (configService.isProduction()) {
        this.addTransport(
          new CloudTransport(configService.get('monitoring').endpoints.logging)
        );
      }

      // Add file transport in development
      if (configService.isDevelopment()) {
        this.addTransport(
          new FileTransport('./logs/app.log')
        );
      }
    }
  }

  private setupErrorServiceIntegration() {
    errorService.on('error', (errorReport) => {
      this.error(errorReport.error.message, {
        error: errorReport.error,
        stack: errorReport.stack,
        severity: errorReport.severity,
        ...errorReport.metadata
      });
    });
  }

  private startBufferFlush() {
    setInterval(() => {
      this.flushBuffer();
    }, this.flushInterval);
  }

  private async flushBuffer() {
    if (this.logBuffer.length === 0) return;

    const buffer = [...this.logBuffer];
    this.logBuffer = [];
    this.isBuffering = false;

    await Promise.all(
      Array.from(this.transports.values()).map(transport =>
        Promise.all(buffer.map(entry => transport.log(entry)))
      )
    );
  }

  addTransport(transport: LogTransport) {
    this.transports.set(transport.name, transport);
  }

  removeTransport(name: string) {
    this.transports.delete(name);
  }

  setBuffering(enabled: boolean, options?: { size?: number; interval?: number }) {
    this.isBuffering = enabled;
    if (options?.size) this.bufferSize = options.size;
    if (options?.interval) this.flushInterval = options.interval;
  }

  private async logWithLevel(
    level: LogLevel,
    message: string,
    metadata: Partial<LogMetadata> = {},
    context?: any
  ): Promise<void> {
    const configuredLevel = configService.get('monitoring').logLevel;
    if (this.levelPriority[level] < this.levelPriority[configuredLevel]) {
      return;
    }

    const entry: LogEntry = {
      id: crypto.randomUUID(),
      message,
      metadata: {
        timestamp: Date.now(),
        level,
        environment: configService.get('platform').environment,
        platform: configService.get('platform').name,
        ...metadata
      },
      context
    };

    // Store log entry
    this.logs.set(entry.id, entry);

    // Emit log event
    this.emit('log', entry);

    if (this.isBuffering) {
      this.logBuffer.push(entry);
      if (this.logBuffer.length >= this.bufferSize) {
        await this.flushBuffer();
      }
    } else {
      // Send to all transports
      await Promise.all(
        Array.from(this.transports.values()).map(transport =>
          transport.log(entry)
        )
      );
    }
  }

  // Public logging methods
  async debug(message: string, metadata?: Partial<LogMetadata>, context?: any) {
    return this.logWithLevel('debug', message, metadata, context);
  }

  async info(message: string, metadata?: Partial<LogMetadata>, context?: any) {
    return this.logWithLevel('info', message, metadata, context);
  }

  async warn(message: string, metadata?: Partial<LogMetadata>, context?: any) {
    return this.logWithLevel('warn', message, metadata, context);
  }

  async error(message: string, metadata?: Partial<LogMetadata>, context?: any) {
    return this.logWithLevel('error', message, metadata, context);
  }

  async fatal(message: string, metadata?: Partial<LogMetadata>, context?: any) {
    return this.logWithLevel('fatal', message, metadata, context);
  }

  // Query methods
  async getLogs(filter?: LogFilter): Promise<LogEntry[]> {
    let logs = Array.from(this.logs.values());

    if (filter) {
      logs = logs.filter(log => {
        if (filter.level && log.metadata.level !== filter.level) return false;
        if (filter.platform && log.metadata.platform !== filter.platform) return false;
        if (filter.component && log.metadata.component !== filter.component) return false;
        if (filter.startDate && log.metadata.timestamp < filter.startDate) return false;
        if (filter.endDate && log.metadata.timestamp > filter.endDate) return false;
        if (filter.tags && !filter.tags.every(tag => log.metadata.tags?.includes(tag))) return false;
        if (filter.search) {
          const searchLower = filter.search.toLowerCase();
          return (
            log.message.toLowerCase().includes(searchLower) ||
            JSON.stringify(log.metadata).toLowerCase().includes(searchLower)
          );
        }
        return true;
      });
    }

    return logs;
  }

  async clearLogs(filter?: LogFilter): Promise<void> {
    if (!filter) {
      this.logs.clear();
      return;
    }

    const logsToKeep = await this.getLogs(filter);
    this.logs = new Map(logsToKeep.map(log => [log.id, log]));
  }

  getLogStats(): {
    total: number;
    byLevel: Record<LogLevel, number>;
    byPlatform: Record<string, number>;
    recentErrors: number;
  } {
    const logs = Array.from(this.logs.values());
    const now = Date.now();

    return {
      total: logs.length,
      byLevel: {
        debug: logs.filter(log => log.metadata.level === 'debug').length,
        info: logs.filter(log => log.metadata.level === 'info').length,
        warn: logs.filter(log => log.metadata.level === 'warn').length,
        error: logs.filter(log => log.metadata.level === 'error').length,
        fatal: logs.filter(log => log.metadata.level === 'fatal').length
      },
      byPlatform: logs.reduce((acc, log) => ({
        ...acc,
        [log.metadata.platform]: (acc[log.metadata.platform] || 0) + 1
      }), {}),
      recentErrors: logs.filter(
        log =>
          (log.metadata.level === 'error' || log.metadata.level === 'fatal') &&
          log.metadata.timestamp > now - 3600000 // Last hour
      ).length
    };
  }
}

// Export singleton instance
export const loggingService = LoggingService.getInstance(); 