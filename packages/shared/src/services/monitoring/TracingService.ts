import { EventEmitter } from 'events';
import { configService } from '../config/GlobalConfig';
import { errorService } from '../error/ErrorService';
import { loggingService } from '../logging/LoggingService';

interface SpanContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  sampled: boolean;
  baggage: Record<string, string>;
}

interface SpanData {
  name: string;
  startTime: number;
  endTime?: number;
  status: 'ok' | 'error' | 'cancelled';
  attributes: Record<string, any>;
  events: SpanEvent[];
  links: SpanLink[];
}

interface SpanEvent {
  name: string;
  timestamp: number;
  attributes?: Record<string, any>;
}

interface SpanLink {
  context: SpanContext;
  attributes?: Record<string, any>;
}

class Span {
  private context: SpanContext;
  private data: SpanData;
  private tracer: Tracer;

  constructor(
    tracer: Tracer,
    name: string,
    context: SpanContext,
    parentContext?: SpanContext
  ) {
    this.tracer = tracer;
    this.context = {
      ...context,
      parentSpanId: parentContext?.spanId
    };
    this.data = {
      name,
      startTime: Date.now(),
      status: 'ok',
      attributes: {},
      events: [],
      links: []
    };
  }

  getContext(): SpanContext {
    return this.context;
  }

  getData(): SpanData {
    return this.data;
  }

  setStatus(status: 'ok' | 'error' | 'cancelled', description?: string) {
    this.data.status = status;
    if (description) {
      this.setAttributes({ 'status.description': description });
    }
    return this;
  }

  setAttributes(attributes: Record<string, any>) {
    this.data.attributes = { ...this.data.attributes, ...attributes };
    return this;
  }

  addEvent(name: string, attributes?: Record<string, any>) {
    this.data.events.push({
      name,
      timestamp: Date.now(),
      attributes
    });
    return this;
  }

  addLink(context: SpanContext, attributes?: Record<string, any>) {
    this.data.links.push({ context, attributes });
    return this;
  }

  end() {
    this.data.endTime = Date.now();
    this.tracer.endSpan(this);
  }
}

class Tracer {
  private spans: Map<string, Span> = new Map();
  private activeSpans: Map<string, Span> = new Map();
  private sampler: (traceId: string) => boolean;
  private exporter: SpanExporter;

  constructor(sampler: (traceId: string) => boolean, exporter: SpanExporter) {
    this.sampler = sampler;
    this.exporter = exporter;
  }

  startSpan(name: string, parentContext?: SpanContext): Span {
    const traceId = parentContext?.traceId || this.generateTraceId();
    const spanId = this.generateSpanId();
    const context: SpanContext = {
      traceId,
      spanId,
      sampled: this.sampler(traceId),
      baggage: parentContext?.baggage || {}
    };

    const span = new Span(this, name, context, parentContext);
    this.activeSpans.set(spanId, span);
    return span;
  }

  endSpan(span: Span) {
    const spanId = span.getContext().spanId;
    this.activeSpans.delete(spanId);
    this.spans.set(spanId, span);
    this.exporter.export(span);
  }

  getActiveSpan(spanId: string): Span | undefined {
    return this.activeSpans.get(spanId);
  }

  private generateTraceId(): string {
    return crypto.randomUUID();
  }

  private generateSpanId(): string {
    return crypto.randomUUID().split('-')[0];
  }
}

interface SpanExporter {
  export(span: Span): void;
}

class ConsoleSpanExporter implements SpanExporter {
  export(span: Span) {
    const context = span.getContext();
    const data = span.getData();
    console.log('Span:', {
      traceId: context.traceId,
      spanId: context.spanId,
      parentSpanId: context.parentSpanId,
      name: data.name,
      duration: data.endTime ? data.endTime - data.startTime : undefined,
      status: data.status,
      attributes: data.attributes,
      events: data.events
    });
  }
}

class TracingService extends EventEmitter {
  private static instance: TracingService;
  private tracers: Map<string, Tracer> = new Map();
  private defaultTracer: Tracer;

  private constructor() {
    super();
    this.setupDefaultTracer();
  }

  static getInstance(): TracingService {
    if (!TracingService.instance) {
      TracingService.instance = new TracingService();
    }
    return TracingService.instance;
  }

  private setupDefaultTracer() {
    const sampler = (traceId: string) => {
      // Default sampling strategy: sample 10% of traces
      return parseInt(traceId.substring(0, 2), 16) < 26; // 10% of 256
    };

    this.defaultTracer = new Tracer(sampler, new ConsoleSpanExporter());
    this.tracers.set('default', this.defaultTracer);
  }

  registerTracer(name: string, sampler: (traceId: string) => boolean, exporter: SpanExporter) {
    if (this.tracers.has(name)) {
      throw new Error(`Tracer ${name} already exists`);
    }
    this.tracers.set(name, new Tracer(sampler, exporter));
  }

  getTracer(name: string = 'default'): Tracer {
    const tracer = this.tracers.get(name);
    if (!tracer) {
      throw new Error(`Tracer ${name} not found`);
    }
    return tracer;
  }

  startSpan(name: string, options: {
    tracer?: string;
    parentContext?: SpanContext;
    attributes?: Record<string, any>;
  } = {}): Span {
    try {
      const tracer = this.getTracer(options.tracer);
      const span = tracer.startSpan(name, options.parentContext);
      
      if (options.attributes) {
        span.setAttributes(options.attributes);
      }

      // Add default attributes
      span.setAttributes({
        'service.name': configService.get('platform').name,
        'service.version': configService.get('platform').version,
        'environment': configService.get('platform').environment
      });

      return span;
    } catch (error) {
      errorService.handleError(error, {
        component: 'TracingService',
        action: 'startSpan',
        spanName: name
      });
      throw error;
    }
  }

  // Convenience method for wrapping async functions with tracing
  async trace<T>(
    name: string,
    operation: (span: Span) => Promise<T>,
    options: {
      tracer?: string;
      parentContext?: SpanContext;
      attributes?: Record<string, any>;
    } = {}
  ): Promise<T> {
    const span = this.startSpan(name, options);

    try {
      const result = await operation(span);
      span.setStatus('ok');
      return result;
    } catch (error) {
      span.setStatus('error', error.message);
      span.setAttributes({
        'error.type': error.name,
        'error.message': error.message,
        'error.stack': error.stack
      });
      throw error;
    } finally {
      span.end();
    }
  }

  // Helper method for HTTP request tracing
  createMiddleware(options: {
    tracer?: string;
    shouldTrace?: (req: any) => boolean;
  } = {}) {
    return async (req: any, res: any, next: Function) => {
      if (options.shouldTrace && !options.shouldTrace(req)) {
        return next();
      }

      const span = this.startSpan(`HTTP ${req.method} ${req.path}`, {
        tracer: options.tracer,
        attributes: {
          'http.method': req.method,
          'http.url': req.url,
          'http.path': req.path,
          'http.host': req.headers.host,
          'http.user_agent': req.headers['user-agent'],
          'http.request_id': req.headers['x-request-id']
        }
      });

      // Inject trace context into response headers
      const context = span.getContext();
      res.setHeader('x-trace-id', context.traceId);
      res.setHeader('x-span-id', context.spanId);

      // Capture response
      const originalEnd = res.end;
      res.end = function(...args: any[]) {
        span.setAttributes({
          'http.status_code': res.statusCode,
          'http.response_size': res.getHeader('content-length')
        });
        span.setStatus(res.statusCode >= 400 ? 'error' : 'ok');
        span.end();
        originalEnd.apply(res, args);
      };

      next();
    };
  }
}

// Export singleton instance
export const tracingService = TracingService.getInstance(); 