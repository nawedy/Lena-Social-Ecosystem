import { api } from './api';
import type { ApiResponse } from '$lib/types';
import { writable, derived } from 'svelte/store';
import { config } from './config';

interface ErrorReport {
  id: string;
  timestamp: string;
  type: string;
  message: string;
  stack?: string;
  context: {
    url: string;
    userAgent: string;
    userId?: string;
    sessionId?: string;
    [key: string]: any;
  };
  status: 'new' | 'investigating' | 'resolved';
}

interface PerformanceMetric {
  id: string;
  timestamp: string;
  type: string;
  value: number;
  context: {
    url: string;
    userAgent: string;
    userId?: string;
    sessionId?: string;
    [key: string]: any;
  };
}

interface MonitoringState {
  errors: ErrorReport[];
  metrics: PerformanceMetric[];
  loading: boolean;
  error: string | null;
}

function createMonitoringStore() {
  const { subscribe, set, update } = writable<MonitoringState>({
    errors: [],
    metrics: [],
    loading: false,
    error: null
  });

  // Performance observer for core web vitals
  let performanceObserver: PerformanceObserver | null = null;

  // Error event listener
  let errorListener: ((event: ErrorEvent) => void) | null = null;
  let unhandledRejectionListener: ((event: PromiseRejectionEvent) => void) | null = null;

  return {
    subscribe,
    set,
    update,

    /**
     * Initialize monitoring
     */
    initialize: async () => {
      update(state => ({ ...state, loading: true, error: null }));

      try {
        // Set up performance monitoring
        if ('PerformanceObserver' in window) {
          performanceObserver = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              this.trackPerformanceMetric({
                type: entry.entryType,
                value: entry.startTime,
                context: {
                  url: window.location.href,
                  userAgent: navigator.userAgent
                }
              });
            }
          });

          performanceObserver.observe({
            entryTypes: ['largest-contentful-paint', 'first-input', 'layout-shift']
          });
        }

        // Set up error monitoring
        errorListener = (event: ErrorEvent) => {
          this.trackError({
            type: 'error',
            message: event.message,
            stack: event.error?.stack,
            context: {
              url: window.location.href,
              userAgent: navigator.userAgent,
              line: event.lineno,
              column: event.colno
            }
          });
        };

        unhandledRejectionListener = (event: PromiseRejectionEvent) => {
          this.trackError({
            type: 'unhandledRejection',
            message: event.reason?.message || 'Unhandled Promise Rejection',
            stack: event.reason?.stack,
            context: {
              url: window.location.href,
              userAgent: navigator.userAgent
            }
          });
        };

        window.addEventListener('error', errorListener);
        window.addEventListener('unhandledrejection', unhandledRejectionListener);

        return { error: null };
      } catch (error) {
        console.error('Failed to initialize monitoring:', error);
        update(state => ({ ...state, error: error.message }));
        return { error };
      } finally {
        update(state => ({ ...state, loading: false }));
      }
    },

    /**
     * Track an error
     */
    trackError: async (data: {
      type: string;
      message: string;
      stack?: string;
      context: Record<string, any>;
    }): Promise<ApiResponse<ErrorReport>> => {
      try {
        const { data: report, error } = await api.post<ErrorReport>('/monitoring/errors', data);
        if (error) throw error;

        if (report) {
          update(state => ({
            ...state,
            errors: [...state.errors, report]
          }));
        }

        return { data: report };
      } catch (error) {
        console.error('Failed to track error:', error);
        return { error };
      }
    },

    /**
     * Track a performance metric
     */
    trackPerformanceMetric: async (data: {
      type: string;
      value: number;
      context: Record<string, any>;
    }): Promise<ApiResponse<PerformanceMetric>> => {
      try {
        const { data: metric, error } = await api.post<PerformanceMetric>('/monitoring/metrics', data);
        if (error) throw error;

        if (metric) {
          update(state => ({
            ...state,
            metrics: [...state.metrics, metric]
          }));
        }

        return { data: metric };
      } catch (error) {
        console.error('Failed to track metric:', error);
        return { error };
      }
    },

    /**
     * Get error reports with filtering
     */
    getErrors: async (params?: {
      status?: ErrorReport['status'];
      startDate?: string;
      endDate?: string;
      type?: string;
    }): Promise<ApiResponse<ErrorReport[]>> => {
      update(state => ({ ...state, loading: true, error: null }));

      try {
        const { data: errors, error } = await api.get<ErrorReport[]>('/monitoring/errors', params);
        if (error) throw error;

        if (errors) {
          update(state => ({ ...state, errors }));
        }

        return { data: errors };
      } catch (error) {
        console.error('Failed to get errors:', error);
        update(state => ({ ...state, error: error.message }));
        return { error };
      } finally {
        update(state => ({ ...state, loading: false }));
      }
    },

    /**
     * Get performance metrics with filtering
     */
    getMetrics: async (params?: {
      startDate?: string;
      endDate?: string;
      type?: string;
    }): Promise<ApiResponse<PerformanceMetric[]>> => {
      update(state => ({ ...state, loading: true, error: null }));

      try {
        const { data: metrics, error } = await api.get<PerformanceMetric[]>('/monitoring/metrics', params);
        if (error) throw error;

        if (metrics) {
          update(state => ({ ...state, metrics }));
        }

        return { data: metrics };
      } catch (error) {
        console.error('Failed to get metrics:', error);
        update(state => ({ ...state, error: error.message }));
        return { error };
      } finally {
        update(state => ({ ...state, loading: false }));
      }
    },

    /**
     * Update error report status
     */
    updateErrorStatus: async (id: string, status: ErrorReport['status']): Promise<ApiResponse<ErrorReport>> => {
      try {
        const { data: report, error } = await api.put<ErrorReport>(`/monitoring/errors/${id}`, { status });
        if (error) throw error;

        if (report) {
          update(state => ({
            ...state,
            errors: state.errors.map(err => err.id === id ? report : err)
          }));
        }

        return { data: report };
      } catch (error) {
        console.error('Failed to update error status:', error);
        return { error };
      }
    },

    /**
     * Clean up monitoring
     */
    cleanup: () => {
      if (performanceObserver) {
        performanceObserver.disconnect();
        performanceObserver = null;
      }

      if (errorListener) {
        window.removeEventListener('error', errorListener);
        errorListener = null;
      }

      if (unhandledRejectionListener) {
        window.removeEventListener('unhandledrejection', unhandledRejectionListener);
        unhandledRejectionListener = null;
      }

      set({
        errors: [],
        metrics: [],
        loading: false,
        error: null
      });
    }
  };
}

// Create monitoring store instance
export const monitoring = createMonitoringStore();

// Derived stores
export const errors = derived(monitoring, $monitoring => $monitoring.errors);
export const metrics = derived(monitoring, $monitoring => $monitoring.metrics);
export const isLoading = derived(monitoring, $monitoring => $monitoring.loading);
export const error = derived(monitoring, $monitoring => $monitoring.error);

// Helper functions
export function getErrorsByType(type: string): ErrorReport[] {
  return monitoring?.errors.filter(error => error.type === type) || [];
}

export function getMetricsByType(type: string): PerformanceMetric[] {
  return monitoring?.metrics.filter(metric => metric.type === type) || [];
}

export function getAverageMetricValue(type: string): number {
  const metrics = getMetricsByType(type);
  if (!metrics.length) return 0;
  return metrics.reduce((sum, metric) => sum + metric.value, 0) / metrics.length;
}

export function getErrorRate(timeframe: number = 3600000): number {
  const now = Date.now();
  const recentErrors = monitoring?.errors.filter(error => 
    now - new Date(error.timestamp).getTime() <= timeframe
  ) || [];
  return recentErrors.length / (timeframe / 1000);
} 