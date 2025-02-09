import { browser } from '$app/environment';
import { writable } from 'svelte/store';

interface PerformanceMetrics {
  fcp: number; // First Contentful Paint
  lcp: number; // Largest Contentful Paint
  fid: number; // First Input Delay
  cls: number; // Cumulative Layout Shift
  ttfb: number; // Time to First Byte
  navigationTiming: NavigationTiming;
  resourceTiming: ResourceTiming[];
  memoryUsage: MemoryUsage | null;
}

interface NavigationTiming {
  fetchStart: number;
  dnsStart: number;
  dnsEnd: number;
  connectStart: number;
  connectEnd: number;
  requestStart: number;
  responseStart: number;
  responseEnd: number;
  domInteractive: number;
  domComplete: number;
  loadEventEnd: number;
}

interface ResourceTiming {
  name: string;
  initiatorType: string;
  startTime: number;
  duration: number;
  transferSize: number;
  decodedBodySize: number;
  encodedBodySize: number;
}

interface MemoryUsage {
  jsHeapSizeLimit: number;
  totalJSHeapSize: number;
  usedJSHeapSize: number;
}

interface CacheConfig {
  maxAge: number;
  maxItems: number;
  prefetchThreshold: number;
}

export class PerformanceOptimizationService {
  private static instance: PerformanceOptimizationService;
  private metrics = writable<PerformanceMetrics | null>(null);
  private observer: PerformanceObserver | null = null;
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private prefetchQueue: Set<string> = new Set();
  private cacheConfig: CacheConfig = {
    maxAge: 3600000, // 1 hour
    maxItems: 100,
    prefetchThreshold: 0.8 // Prefetch when 80% confident
  };

  private constructor() {
    if (browser) {
      this.init();
    }
  }

  static getInstance(): PerformanceOptimizationService {
    if (!PerformanceOptimizationService.instance) {
      PerformanceOptimizationService.instance = new PerformanceOptimizationService();
    }
    return PerformanceOptimizationService.instance;
  }

  private init() {
    this.setupPerformanceObserver();
    this.collectInitialMetrics();
    this.setupPeriodicCleanup();
  }

  private setupPerformanceObserver() {
    if (!('PerformanceObserver' in window)) return;

    // Observe paint timing
    try {
      this.observer = new PerformanceObserver(list => {
        const entries = list.getEntries();
        entries.forEach(entry => {
          if (entry.entryType === 'paint') {
            this.updateMetrics(entry);
          }
        });
      });
      this.observer.observe({ entryTypes: ['paint', 'largest-contentful-paint', 'first-input', 'layout-shift'] });
    } catch (e) {
      console.error('PerformanceObserver setup failed:', e);
    }
  }

  private async collectInitialMetrics() {
    if (!performance || !performance.timing) return;

    const timing = performance.timing;
    const navigationTiming: NavigationTiming = {
      fetchStart: timing.fetchStart,
      dnsStart: timing.domainLookupStart,
      dnsEnd: timing.domainLookupEnd,
      connectStart: timing.connectStart,
      connectEnd: timing.connectEnd,
      requestStart: timing.requestStart,
      responseStart: timing.responseStart,
      responseEnd: timing.responseEnd,
      domInteractive: timing.domInteractive,
      domComplete: timing.domComplete,
      loadEventEnd: timing.loadEventEnd
    };

    const resourceEntries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const resourceTiming: ResourceTiming[] = resourceEntries.map(entry => ({
      name: entry.name,
      initiatorType: entry.initiatorType,
      startTime: entry.startTime,
      duration: entry.duration,
      transferSize: entry.transferSize,
      decodedBodySize: entry.decodedBodySize,
      encodedBodySize: entry.encodedBodySize
    }));

    const memoryUsage = (performance as any).memory ? {
      jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit,
      totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
      usedJSHeapSize: (performance as any).memory.usedJSHeapSize
    } : null;

    this.metrics.set({
      fcp: 0,
      lcp: 0,
      fid: 0,
      cls: 0,
      ttfb: timing.responseStart - timing.navigationStart,
      navigationTiming,
      resourceTiming,
      memoryUsage
    });
  }

  private updateMetrics(entry: PerformanceEntry) {
    this.metrics.update(metrics => {
      if (!metrics) return metrics;

      switch (entry.entryType) {
        case 'paint':
          if (entry.name === 'first-contentful-paint') {
            metrics.fcp = entry.startTime;
          }
          break;
        case 'largest-contentful-paint':
          metrics.lcp = entry.startTime;
          break;
        case 'first-input':
          metrics.fid = (entry as any).processingStart - entry.startTime;
          break;
        case 'layout-shift':
          metrics.cls += (entry as any).value;
          break;
      }

      return metrics;
    });
  }

  private setupPeriodicCleanup() {
    setInterval(() => {
      this.cleanupCache();
    }, 300000); // Every 5 minutes
  }

  private cleanupCache() {
    const now = Date.now();
    for (const [key, value] of this.cache) {
      if (now - value.timestamp > this.cacheConfig.maxAge) {
        this.cache.delete(key);
      }
    }

    // If still over limit, remove oldest entries
    if (this.cache.size > this.cacheConfig.maxItems) {
      const sortedEntries = Array.from(this.cache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      const entriesToRemove = sortedEntries.slice(0, this.cache.size - this.cacheConfig.maxItems);
      entriesToRemove.forEach(([key]) => this.cache.delete(key));
    }
  }

  // Public methods
  async prefetchResources(urls: string[], priority: 'high' | 'low' = 'low') {
    if (!browser) return;

    const prefetchPromises = urls
      .filter(url => !this.prefetchQueue.has(url))
      .map(async url => {
        try {
          this.prefetchQueue.add(url);

          const link = document.createElement('link');
          link.rel = 'prefetch';
          link.href = url;
          link.as = this.getResourceType(url);
          if (priority === 'high') {
            link.setAttribute('importance', 'high');
          }

          document.head.appendChild(link);

          // Wait for prefetch to complete
          await new Promise((resolve, reject) => {
            link.onload = resolve;
            link.onerror = reject;
          });

          return url;
        } catch (error) {
          console.error(`Failed to prefetch ${url}:`, error);
          return null;
        } finally {
          this.prefetchQueue.delete(url);
        }
      });

    return Promise.all(prefetchPromises);
  }

  async cacheData<T>(key: string, data: T, maxAge?: number): Promise<void> {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });

    // Clean up if cache is full
    if (this.cache.size > this.cacheConfig.maxItems) {
      this.cleanupCache();
    }
  }

  getCachedData<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp > this.cacheConfig.maxAge) {
      this.cache.delete(key);
      return null;
    }

    return cached.data as T;
  }

  getMetrics() {
    return this.metrics;
  }

  updateCacheConfig(config: Partial<CacheConfig>) {
    this.cacheConfig = {
      ...this.cacheConfig,
      ...config
    };
  }

  private getResourceType(url: string): string {
    const extension = url.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'js':
        return 'script';
      case 'css':
        return 'style';
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'webp':
        return 'image';
      case 'woff':
      case 'woff2':
      case 'ttf':
      case 'otf':
        return 'font';
      default:
        return '';
    }
  }

  cleanup() {
    if (this.observer) {
      this.observer.disconnect();
    }
    this.cache.clear();
    this.prefetchQueue.clear();
  }
}

// Create service instance
export const performanceOptimizationService = PerformanceOptimizationService.getInstance(); 