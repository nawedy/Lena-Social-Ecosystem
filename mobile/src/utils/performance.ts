import analytics from '@react-native-firebase/analytics';
import perf, { FirebasePerformanceTypes } from '@react-native-firebase/perf';
import { Platform } from 'react-native';

class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private traces: Map<string, FirebasePerformanceTypes.Trace>;
  private httpMetrics: Map<string, FirebasePerformanceTypes.HttpMetric>;

  private constructor() {
    this.traces = new Map();
    this.httpMetrics = new Map();
  }

  public static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  // Start a performance trace
  public async startTrace(traceName: string): Promise<void> {
    try {
      const trace = await perf().startTrace(traceName);
      this.traces.set(traceName, trace);
    } catch (error) {
      console.error('Error starting trace:', error);
    }
  }

  // Stop a performance trace
  public async stopTrace(
    traceName: string,
    attributes?: Record<string, string>
  ): Promise<void> {
    try {
      const trace = this.traces.get(traceName);
      if (trace) {
        if (attributes) {
          Object.entries(attributes).forEach(([key, value]) => {
            trace.putAttribute(key, value);
          });
        }
        await trace.stop();
        this.traces.delete(traceName);

        // Log trace completion to analytics
        await analytics().logEvent('performance_trace_completed', {
          trace_name: traceName,
          duration: trace.getDuration(),
          ...attributes,
        });
      }
    } catch (error) {
      console.error('Error stopping trace:', error);
    }
  }

  // Add a metric to a trace
  public async addTraceMetric(
    traceName: string,
    metricName: string,
    value: number
  ): Promise<void> {
    try {
      const trace = this.traces.get(traceName);
      if (trace) {
        trace.putMetric(metricName, value);
      }
    } catch (error) {
      console.error('Error adding trace metric:', error);
    }
  }

  // Start monitoring a network request
  public async startNetworkMonitoring(
    url: string,
    method: string
  ): Promise<void> {
    try {
      const httpMetric = await perf().newHttpMetric(url, method);
      this.httpMetrics.set(url, httpMetric);
      await httpMetric.start();
    } catch (error) {
      console.error('Error starting network monitoring:', error);
    }
  }

  // Stop monitoring a network request
  public async stopNetworkMonitoring(
    url: string,
    responseCode?: number,
    responseSize?: number,
    requestSize?: number
  ): Promise<void> {
    try {
      const httpMetric = this.httpMetrics.get(url);
      if (httpMetric) {
        if (responseCode) {
          httpMetric.setHttpResponseCode(responseCode);
        }
        if (responseSize) {
          httpMetric.setResponseContentType('application/json');
          httpMetric.setResponsePayloadSize(responseSize);
        }
        if (requestSize) {
          httpMetric.setRequestPayloadSize(requestSize);
        }
        await httpMetric.stop();
        this.httpMetrics.delete(url);

        // Log network request completion to analytics
        await analytics().logEvent('network_request_completed', {
          url,
          response_code: responseCode,
          response_size: responseSize,
          request_size: requestSize,
        });
      }
    } catch (error) {
      console.error('Error stopping network monitoring:', error);
    }
  }

  // Monitor component render time
  public async monitorComponentRender(
    componentName: string,
    renderTime: number
  ): Promise<void> {
    try {
      await analytics().logEvent('component_render', {
        component_name: componentName,
        render_time: renderTime,
        platform: Platform.OS,
      });
    } catch (error) {
      console.error('Error logging component render:', error);
    }
  }

  // Monitor JavaScript execution time
  public async monitorJSExecution(
    operationName: string,
    startTime: number
  ): Promise<void> {
    const endTime = performance.now();
    const duration = endTime - startTime;

    try {
      await analytics().logEvent('js_execution', {
        operation_name: operationName,
        duration,
        platform: Platform.OS,
      });
    } catch (error) {
      console.error('Error logging JS execution:', error);
    }
  }

  // Monitor memory usage
  public async monitorMemoryUsage(componentName: string): Promise<void> {
    if (Platform.OS === 'android') {
      try {
        const memory = await global.performance?.memory;
        if (memory) {
          await analytics().logEvent('memory_usage', {
            component_name: componentName,
            used_js_heap_size: memory.usedJSHeapSize,
            total_js_heap_size: memory.totalJSHeapSize,
            js_heap_size_limit: memory.jsHeapSizeLimit,
            platform: 'android',
          });
        }
      } catch (error) {
        console.error('Error logging memory usage:', error);
      }
    }
  }

  // Monitor frame rate
  public async monitorFrameRate(
    componentName: string,
    frameCount: number,
    duration: number
  ): Promise<void> {
    try {
      const fps = (frameCount / duration) * 1000;
      await analytics().logEvent('frame_rate', {
        component_name: componentName,
        fps,
        frame_count: frameCount,
        duration,
        platform: Platform.OS,
      });
    } catch (error) {
      console.error('Error logging frame rate:', error);
    }
  }

  // Create a performance mark
  public mark(markName: string): void {
    try {
      performance.mark(markName);
    } catch (error) {
      console.error('Error creating performance mark:', error);
    }
  }

  // Measure between two marks
  public async measure(
    measureName: string,
    startMark: string,
    endMark: string
  ): Promise<void> {
    try {
      performance.measure(measureName, startMark, endMark);
      const entries = performance.getEntriesByName(measureName);
      if (entries.length > 0) {
        const duration = entries[0].duration;
        await analytics().logEvent('performance_measure', {
          measure_name: measureName,
          duration,
          start_mark: startMark,
          end_mark: endMark,
          platform: Platform.OS,
        });
      }
    } catch (error) {
      console.error('Error creating performance measure:', error);
    }
  }

  // Clear all performance marks
  public clearMarks(): void {
    try {
      performance.clearMarks();
    } catch (error) {
      console.error('Error clearing performance marks:', error);
    }
  }

  // Clear all performance measures
  public clearMeasures(): void {
    try {
      performance.clearMeasures();
    } catch (error) {
      console.error('Error clearing performance measures:', error);
    }
  }
}

export const performanceMonitor = PerformanceMonitor.getInstance();
