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
  networkInfo: NetworkInfo | null;
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
  priority: string;
}

interface MemoryUsage {
  jsHeapSizeLimit: number;
  totalJSHeapSize: number;
  usedJSHeapSize: number;
  gcTime: number;
}

interface NetworkInfo {
  effectiveType: string;
  downlink: number;
  rtt: number;
  saveData: boolean;
}

interface CacheConfig {
  maxAge: number;
  maxItems: number;
  prefetchThreshold: number;
  compressionEnabled: boolean;
}

export class PerformanceOptimizationService {
  private static instance: PerformanceOptimizationService;
  private metrics = writable<PerformanceMetrics | null>(null);
  private observer: PerformanceObserver | null = null;
  private cache: Map<string, { data: any; timestamp: number; size: number }> = new Map();
  private prefetchQueue: Set<string> = new Set();
  private cacheConfig: CacheConfig = {
    maxAge: 3600000, // 1 hour
    maxItems: 100,
    prefetchThreshold: 0.8,
    compressionEnabled: true
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
    this.setupNetworkMonitoring();
  }

  private setupPerformanceObserver() {
    if (!('PerformanceObserver' in window)) return;

    try {
      this.observer = new PerformanceObserver(list => {
        const entries = list.getEntries();
        entries.forEach(entry => this.updateMetrics(entry));
      });

      this.observer.observe({
        entryTypes: [
          'paint',
          'largest-contentful-paint',
          'first-input',
          'layout-shift',
          'resource',
          'navigation',
          'longtask'
        ]
      });
    } catch (error) {
      console.error('PerformanceObserver setup failed:', error);
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
      encodedBodySize: entry.encodedBodySize,
      priority: this.getResourcePriority(entry)
    }));

    const memoryUsage = this.getMemoryUsage();
    const networkInfo = this.getNetworkInfo();

    this.metrics.set({
      fcp: 0,
      lcp: 0,
      fid: 0,
      cls: 0,
      ttfb: timing.responseStart - timing.navigationStart,
      navigationTiming,
      resourceTiming,
      memoryUsage,
      networkInfo
    });
  }

  private getResourcePriority(entry: PerformanceResourceTiming): string {
    // Determine resource priority based on type and timing
    const type = entry.initiatorType;
    const loadTime = entry.duration;
    
    if (type === 'script' || type === 'css') {
      return loadTime < 100 ? 'high' : 'medium';
    } else if (type === 'image') {
      return loadTime < 200 ? 'medium' : 'low';
    }
    return 'low';
  }

  private getMemoryUsage(): MemoryUsage | null {
    if (!performance || !('memory' in performance)) return null;

    const memory = (performance as any).memory;
    return {
      jsHeapSizeLimit: memory.jsHeapSizeLimit,
      totalJSHeapSize: memory.totalJSHeapSize,
      usedJSHeapSize: memory.usedJSHeapSize,
      gcTime: 0 // Updated through performance.measureUserAgentSpecificMemory()
    };
  }

  private getNetworkInfo(): NetworkInfo | null {
    if (!navigator.connection) return null;

    const connection = navigator.connection as any;
    return {
      effectiveType: connection.effectiveType,
      downlink: connection.downlink,
      rtt: connection.rtt,
      saveData: connection.saveData
    };
  }

  private setupNetworkMonitoring() {
    if (!navigator.connection) return;

    (navigator.connection as any).addEventListener('change', () => {
      this.metrics.update(metrics => {
        if (!metrics) return metrics;
        metrics.networkInfo = this.getNetworkInfo();
        return metrics;
      });
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
        case 'resource':
          const resourceEntry = entry as PerformanceResourceTiming;
          metrics.resourceTiming.push({
            name: resourceEntry.name,
            initiatorType: resourceEntry.initiatorType,
            startTime: resourceEntry.startTime,
            duration: resourceEntry.duration,
            transferSize: resourceEntry.transferSize,
            decodedBodySize: resourceEntry.decodedBodySize,
            encodedBodySize: resourceEntry.encodedBodySize,
            priority: this.getResourcePriority(resourceEntry)
          });
          break;
      }

      return metrics;
    });
  }

  private setupPeriodicCleanup() {
    setInterval(() => {
      this.cleanupCache();
      this.updateMemoryMetrics();
    }, 60000); // Every minute
  }

  private async updateMemoryMetrics() {
    if (!performance || !('measureUserAgentSpecificMemory' in performance)) return;

    try {
      const measurement = await (performance as any).measureUserAgentSpecificMemory();
      this.metrics.update(metrics => {
        if (!metrics || !metrics.memoryUsage) return metrics;
        metrics.memoryUsage.gcTime = measurement.duration;
        return metrics;
      });
    } catch (error) {
      console.error('Memory measurement failed:', error);
    }
  }

  private cleanupCache() {
    const now = Date.now();
    let totalSize = 0;

    // Remove expired items and calculate total size
    for (const [key, value] of this.cache) {
      if (now - value.timestamp > this.cacheConfig.maxAge) {
        this.cache.delete(key);
      } else {
        totalSize += value.size;
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
  async prefetchResources(urls: string[], priority: 'high' | 'low' = 'low'): Promise<string[]> {
    if (!browser) return [];

    const networkInfo = this.getNetworkInfo();
    if (networkInfo?.saveData) return []; // Respect data saver mode

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

    return (await Promise.all(prefetchPromises)).filter(Boolean) as string[];
  }

  async cacheData<T>(key: string, data: T): Promise<void> {
    const serialized = JSON.stringify(data);
    const compressed = this.cacheConfig.compressionEnabled
      ? await this.compressData(serialized)
      : serialized;

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      size: compressed.length
    });

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
      case 'js': return 'script';
      case 'css': return 'style';
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

  private async compressData(data: string): Promise<string> {
    if (!this.cacheConfig.compressionEnabled) return data;

    try {
      const blob = new Blob([data]);
      const compressed = await new Response(blob.stream().pipeThrough(new CompressionStream('gzip'))).blob();
      return await compressed.text();
    } catch (error) {
      console.error('Compression failed:', error);
      return data;
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

export const performanceOptimizationService = PerformanceOptimizationService.getInstance(); 