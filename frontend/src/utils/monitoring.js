import { WebTracerProvider } from '@opentelemetry/sdk-trace-web';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { ZoneContextManager } from '@opentelemetry/context-zone';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { DocumentLoadInstrumentation } from '@opentelemetry/instrumentation-document-load';
import { UserInteractionInstrumentation } from '@opentelemetry/instrumentation-user-interaction';
import { XMLHttpRequestInstrumentation } from '@opentelemetry/instrumentation-xml-http-request';
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch';
import { LongTaskInstrumentation } from '@opentelemetry/instrumentation-long-task';

// Initialize the tracer
export const initializeTracing = () => {
  const resource = new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: 'tiktok-toe-frontend',
    [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
    environment: process.env.NODE_ENV,
  });

  const provider = new WebTracerProvider({
    resource: resource,
  });

  // Configure OTLP exporter
  const otlpExporter = new OTLPTraceExporter({
    url: 'http://localhost:4318/v1/traces',
  });

  provider.addSpanProcessor(new BatchSpanProcessor(otlpExporter));

  // Initialize context manager
  provider.register({
    contextManager: new ZoneContextManager(),
  });

  // Register instrumentations
  registerInstrumentations({
    instrumentations: [
      new DocumentLoadInstrumentation(),
      new UserInteractionInstrumentation(),
      new XMLHttpRequestInstrumentation({
        propagateTraceHeaderCorsUrls: [
          /localhost:.*/,
          /api\..*/,
        ],
      }),
      new FetchInstrumentation({
        propagateTraceHeaderCorsUrls: [
          /localhost:.*/,
          /api\..*/,
        ],
      }),
      new LongTaskInstrumentation(),
    ],
  });
};

// Performance monitoring
export const initializePerformanceMonitoring = () => {
  if ('performance' in window) {
    // Core Web Vitals
    const reportWebVitals = ({ name, delta, id }) => {
      window.gtag('event', name, {
        event_category: 'Web Vitals',
        event_label: id,
        value: Math.round(name === 'CLS' ? delta * 1000 : delta),
        non_interaction: true,
      });
    };

    // Custom performance metrics
    const reportCustomMetric = (name, value) => {
      window.gtag('event', name, {
        event_category: 'Performance',
        value: value,
        non_interaction: true,
      });
    };

    // Monitor navigation timing
    const observeNavigationTiming = () => {
      const navigation = performance.getEntriesByType('navigation')[0];
      reportCustomMetric('DNS Lookup Time', navigation.domainLookupEnd - navigation.domainLookupStart);
      reportCustomMetric('Connection Time', navigation.connectEnd - navigation.connectStart);
      reportCustomMetric('First Byte Time', navigation.responseStart - navigation.requestStart);
      reportCustomMetric('Response Time', navigation.responseEnd - navigation.responseStart);
      reportCustomMetric('DOM Interactive Time', navigation.domInteractive - navigation.responseEnd);
      reportCustomMetric('DOM Complete Time', navigation.domComplete - navigation.domInteractive);
    };

    // Monitor resource timing
    const observeResourceTiming = () => {
      const resources = performance.getEntriesByType('resource');
      resources.forEach(resource => {
        reportCustomMetric(`Resource Load Time: ${resource.name}`, resource.duration);
      });
    };

    // Error monitoring
    window.addEventListener('error', (event) => {
      reportCustomMetric('JavaScript Error', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    });

    // Performance Observer for Long Tasks
    const longTaskObserver = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        reportCustomMetric('Long Task Duration', entry.duration);
      });
    });
    longTaskObserver.observe({ entryTypes: ['longtask'] });

    // First Input Delay
    const fidObserver = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        reportWebVitals({
          name: 'FID',
          delta: entry.processingStart - entry.startTime,
          id: entry.target,
        });
      });
    });
    fidObserver.observe({ type: 'first-input', buffered: true });

    // Largest Contentful Paint
    const lcpObserver = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        reportWebVitals({
          name: 'LCP',
          delta: entry.renderTime || entry.loadTime,
          id: entry.id,
        });
      });
    });
    lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

    // Cumulative Layout Shift
    const clsObserver = new PerformanceObserver((list) => {
      let clsValue = 0;
      list.getEntries().forEach((entry) => {
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
        }
      });
      reportWebVitals({
        name: 'CLS',
        delta: clsValue,
        id: 'cls',
      });
    });
    clsObserver.observe({ entryTypes: ['layout-shift'] });

    // Initialize timing observations
    window.addEventListener('load', () => {
      observeNavigationTiming();
      observeResourceTiming();
    });
  }
};

// Initialize both tracing and performance monitoring
export const initializeMonitoring = () => {
  initializeTracing();
  initializePerformanceMonitoring();
};
