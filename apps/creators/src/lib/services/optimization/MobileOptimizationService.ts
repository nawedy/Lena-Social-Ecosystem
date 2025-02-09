import { browser } from '$app/environment';
import { writable, derived } from 'svelte/store';

interface ViewportConfig {
  width: number;
  height: number;
  scale: number;
  orientation: 'portrait' | 'landscape';
}

interface TouchConfig {
  enabled: boolean;
  tapDelay: number;
  doubleTapDelay: number;
  longPressDelay: number;
  swipeThreshold: number;
  seekGestures: boolean;
  volumeGestures: boolean;
}

interface AudioConfig {
  quality: 'low' | 'medium' | 'high' | 'auto';
  format: 'mp3' | 'aac' | 'opus';
  bitrate: number;
  bufferSize: number;
  preloadStrategy: 'none' | 'metadata' | 'auto';
  backgroundPlayback: boolean;
  offlineMode: boolean;
}

interface CacheConfig {
  enabled: boolean;
  maxSize: number;
  maxAge: number;
  priorityContent: string[];
  autoCleanup: boolean;
}

interface BatteryConfig {
  savingMode: boolean;
  thresholds: {
    low: number;
    critical: number;
  };
  optimizations: {
    reducedQuality: boolean;
    disablePreload: boolean;
    disableBackground: boolean;
  };
}

export class MobileOptimizationService {
  private static instance: MobileOptimizationService;
  private viewportConfig: ViewportConfig;
  private touchConfig: TouchConfig;
  private audioConfig: AudioConfig;
  private cacheConfig: CacheConfig;
  private batteryConfig: BatteryConfig;
  private mediaQueryList: MediaQueryList | null = null;
  private intersectionObserver: IntersectionObserver | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private batteryManager: any = null;
  private networkInfo: any = null;

  private constructor() {
    if (browser) {
      this.init();
    }
  }

  static getInstance(): MobileOptimizationService {
    if (!MobileOptimizationService.instance) {
      MobileOptimizationService.instance = new MobileOptimizationService();
    }
    return MobileOptimizationService.instance;
  }

  private async init() {
    // Initialize viewport configuration
    this.setupViewport();

    // Initialize touch handling
    this.setupTouchHandling();

    // Initialize media queries
    this.setupMediaQueries();

    // Initialize battery monitoring
    if ('getBattery' in navigator) {
      await this.setupBatteryMonitoring();
    }

    // Initialize network monitoring
    if ('connection' in navigator) {
      await this.setupNetworkMonitoring();
    }
  }

  private setupViewport() {
    this.viewportConfig = {
      width: window.innerWidth,
      height: window.innerHeight,
      scale: window.devicePixelRatio,
      orientation: window.innerWidth > window.innerHeight ? 'landscape' : 'portrait'
    };

    // Setup resize observer
    this.resizeObserver = new ResizeObserver(() => {
      this.updateViewportDimensions();
    });
    this.resizeObserver.observe(document.documentElement);
  }

  private setupTouchHandling() {
    this.touchConfig = {
      enabled: 'ontouchstart' in window,
      tapDelay: 300,
      doubleTapDelay: 300,
      longPressDelay: 500,
      swipeThreshold: 50,
      seekGestures: true,
      volumeGestures: true
    };

    if (this.touchConfig.enabled) {
      // Prevent default touch behaviors
      document.addEventListener('touchstart', (e) => {
        if (e.touches.length > 1) {
          e.preventDefault();
        }
      }, { passive: false });

      // Handle double tap to seek
      let lastTap = 0;
      document.addEventListener('touchend', (e) => {
        const currentTime = new Date().getTime();
        const tapLength = currentTime - lastTap;
        if (tapLength < this.touchConfig.doubleTapDelay && tapLength > 0) {
          e.preventDefault();
          // Handle double tap seek
          const x = e.changedTouches[0].clientX;
          const width = window.innerWidth;
          if (x < width / 2) {
            // Seek backward
            document.dispatchEvent(new CustomEvent('seekBackward'));
          } else {
            // Seek forward
            document.dispatchEvent(new CustomEvent('seekForward'));
          }
        }
        lastTap = currentTime;
      });

      // Handle volume gestures
      let touchStartY = 0;
      document.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
          touchStartY = e.touches[0].clientY;
        }
      });

      document.addEventListener('touchmove', (e) => {
        if (this.touchConfig.volumeGestures && e.touches.length === 1) {
          const deltaY = touchStartY - e.touches[0].clientY;
          if (Math.abs(deltaY) > this.touchConfig.swipeThreshold) {
            document.dispatchEvent(new CustomEvent('volumeChange', {
              detail: { delta: deltaY }
            }));
            touchStartY = e.touches[0].clientY;
          }
        }
      });
    }
  }

  private setupMediaQueries() {
    this.mediaQueryList = window.matchMedia('(prefers-color-scheme: dark)');
    this.mediaQueryList.addEventListener('change', (e) => {
      document.documentElement.classList.toggle('dark', e.matches);
    });
  }

  private async setupBatteryMonitoring() {
    try {
      this.batteryManager = await (navigator as any).getBattery();
      
      const updateBatteryStatus = () => {
        const level = this.batteryManager.level;
        const isCharging = this.batteryManager.charging;

        if (!isCharging) {
          if (level <= this.batteryConfig.thresholds.critical) {
            this.enableBatterySavingMode(true);
          } else if (level <= this.batteryConfig.thresholds.low) {
            this.enableBatterySavingMode(false);
          } else {
            this.disableBatterySavingMode();
          }
        } else {
          this.disableBatterySavingMode();
        }
      };

      // Listen for battery status changes
      this.batteryManager.addEventListener('levelchange', updateBatteryStatus);
      this.batteryManager.addEventListener('chargingchange', updateBatteryStatus);

      // Initial check
      updateBatteryStatus();
    } catch (err) {
      console.error('Battery monitoring not available:', err);
    }
  }

  private async setupNetworkMonitoring() {
    try {
      this.networkInfo = (navigator as any).connection;
      
      const updateNetworkStatus = () => {
        const { effectiveType, saveData } = this.networkInfo;
        
        // Adjust quality based on network conditions
        if (effectiveType === 'slow-2g' || effectiveType === '2g' || saveData) {
          this.audioConfig.quality = 'low';
          this.audioConfig.preloadStrategy = 'none';
        } else if (effectiveType === '3g') {
          this.audioConfig.quality = 'medium';
          this.audioConfig.preloadStrategy = 'metadata';
        } else {
          this.audioConfig.quality = 'high';
          this.audioConfig.preloadStrategy = 'auto';
        }
      };

      // Listen for network changes
      this.networkInfo.addEventListener('change', updateNetworkStatus);

      // Initial check
      updateNetworkStatus();
    } catch (err) {
      console.error('Network monitoring not available:', err);
    }
  }

  private updateViewportDimensions() {
    this.viewportConfig = {
      ...this.viewportConfig,
      width: window.innerWidth,
      height: window.innerHeight,
      orientation: window.innerWidth > window.innerHeight ? 'landscape' : 'portrait'
    };
  }

  private enableBatterySavingMode(critical: boolean) {
    this.batteryConfig.savingMode = true;
    if (critical) {
      this.audioConfig.quality = 'low';
      this.audioConfig.preloadStrategy = 'none';
      this.batteryConfig.optimizations = {
        reducedQuality: true,
        disablePreload: true,
        disableBackground: true
      };
    } else {
      this.audioConfig.quality = 'medium';
      this.audioConfig.preloadStrategy = 'metadata';
      this.batteryConfig.optimizations = {
        reducedQuality: true,
        disablePreload: false,
        disableBackground: false
      };
    }
  }

  private disableBatterySavingMode() {
    this.batteryConfig.savingMode = false;
    this.audioConfig.quality = 'high';
    this.audioConfig.preloadStrategy = 'auto';
    this.batteryConfig.optimizations = {
      reducedQuality: false,
      disablePreload: false,
      disableBackground: false
    };
  }

  getViewportConfig(): ViewportConfig {
    return { ...this.viewportConfig };
  }

  getTouchConfig(): TouchConfig {
    return { ...this.touchConfig };
  }

  getAudioConfig(): AudioConfig {
    return { ...this.audioConfig };
  }

  getCacheConfig(): CacheConfig {
    return { ...this.cacheConfig };
  }

  getBatteryConfig(): BatteryConfig {
    return { ...this.batteryConfig };
  }

  updateTouchConfig(config: Partial<TouchConfig>) {
    this.touchConfig = {
      ...this.touchConfig,
      ...config
    };
  }

  updateAudioConfig(config: Partial<AudioConfig>) {
    this.audioConfig = {
      ...this.audioConfig,
      ...config
    };
  }

  updateCacheConfig(config: Partial<CacheConfig>) {
    this.cacheConfig = {
      ...this.cacheConfig,
      ...config
    };
  }

  updateBatteryConfig(config: Partial<BatteryConfig>) {
    this.batteryConfig = {
      ...this.batteryConfig,
      ...config
    };
  }

  cleanup() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
    }
    if (this.mediaQueryList) {
      this.mediaQueryList.removeEventListener('change', () => {});
    }
    if (this.batteryManager) {
      this.batteryManager.removeEventListener('levelchange', () => {});
      this.batteryManager.removeEventListener('chargingchange', () => {});
    }
    if (this.networkInfo) {
      this.networkInfo.removeEventListener('change', () => {});
    }
  }
}

export const mobileOptimizationService = MobileOptimizationService.getInstance(); 