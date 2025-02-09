import { browser } from '$app/environment';
import { writable } from 'svelte/store';

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
    this.viewportConfig = {
      width: 0,
      height: 0,
      scale: 1,
      orientation: 'portrait'
    };

    this.touchConfig = {
      enabled: true,
      tapDelay: 300,
      doubleTapDelay: 300,
      longPressDelay: 500,
      swipeThreshold: 50,
      seekGestures: true,
      volumeGestures: true
    };

    this.audioConfig = {
      quality: 'auto',
      format: 'opus',
      bitrate: 128000,
      bufferSize: 30,
      preloadStrategy: 'metadata',
      backgroundPlayback: true,
      offlineMode: false
    };

    this.cacheConfig = {
      enabled: true,
      maxSize: 1024 * 1024 * 1024, // 1GB
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      priorityContent: [],
      autoCleanup: true
    };

    this.batteryConfig = {
      savingMode: false,
      thresholds: {
        low: 0.2,
        critical: 0.1
      },
      optimizations: {
        reducedQuality: true,
        disablePreload: true,
        disableBackground: true
      }
    };

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
    this.setupViewport();
    this.setupTouchHandling();
    this.setupMediaQueries();
    await this.setupBatteryMonitoring();
    await this.setupNetworkMonitoring();
  }

  private setupViewport() {
    this.updateViewportDimensions();

    // Create resize observer
    this.resizeObserver = new ResizeObserver(() => {
      this.updateViewportDimensions();
    });

    // Observe document body
    if (document.body) {
      this.resizeObserver.observe(document.body);
    }

    // Handle orientation changes
    window.addEventListener('orientationchange', () => {
      this.updateViewportDimensions();
    });
  }

  private setupTouchHandling() {
    if ('ontouchstart' in window) {
      let touchStartTime = 0;
      let touchStartX = 0;
      let touchStartY = 0;
      let lastTapTime = 0;
      let initialVolume = 0;
      let initialTime = 0;

      document.addEventListener('touchstart', (e) => {
        touchStartTime = Date.now();
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;

        // Handle double tap
        const timeSinceLastTap = touchStartTime - lastTapTime;
        if (timeSinceLastTap < this.touchConfig.doubleTapDelay) {
          e.preventDefault();
          document.dispatchEvent(new CustomEvent('doubletap', {
            detail: { x: touchStartX, y: touchStartY }
          }));
        }
        lastTapTime = touchStartTime;

        // Store initial values for gestures
        if (this.touchConfig.volumeGestures || this.touchConfig.seekGestures) {
          const audio = document.querySelector('audio');
          if (audio) {
            initialVolume = audio.volume;
            initialTime = audio.currentTime;
          }
        }
      });

      document.addEventListener('touchmove', (e) => {
        if (!this.touchConfig.volumeGestures && !this.touchConfig.seekGestures) return;

        const touchX = e.touches[0].clientX;
        const touchY = e.touches[0].clientY;
        const deltaX = touchX - touchStartX;
        const deltaY = touchY - touchStartY;
        const audio = document.querySelector('audio');

        if (!audio) return;

        // Horizontal swipe for seeking
        if (this.touchConfig.seekGestures && Math.abs(deltaX) > Math.abs(deltaY)) {
          const seekAmount = (deltaX / window.innerWidth) * audio.duration;
          audio.currentTime = Math.max(0, Math.min(audio.duration, initialTime + seekAmount));
          e.preventDefault();
        }

        // Vertical swipe for volume
        if (this.touchConfig.volumeGestures && Math.abs(deltaY) > Math.abs(deltaX)) {
          const volumeChange = -deltaY / window.innerHeight;
          audio.volume = Math.max(0, Math.min(1, initialVolume + volumeChange));
          e.preventDefault();
        }
      });

      document.addEventListener('touchend', (e) => {
        const touchEndTime = Date.now();
        const touchDuration = touchEndTime - touchStartTime;
        const touchEndX = e.changedTouches[0].clientX;
        const touchEndY = e.changedTouches[0].clientY;

        // Handle long press
        if (touchDuration > this.touchConfig.longPressDelay) {
          document.dispatchEvent(new CustomEvent('longpress', {
            detail: { x: touchEndX, y: touchEndY, duration: touchDuration }
          }));
          return;
        }

        // Handle swipe
        const deltaX = touchEndX - touchStartX;
        const deltaY = touchEndY - touchStartY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

        if (distance > this.touchConfig.swipeThreshold) {
          const angle = Math.atan2(deltaY, deltaX) * 180 / Math.PI;
          let direction = '';

          if (angle > -45 && angle <= 45) direction = 'right';
          else if (angle > 45 && angle <= 135) direction = 'down';
          else if (angle > 135 || angle <= -135) direction = 'left';
          else direction = 'up';

          document.dispatchEvent(new CustomEvent('swipe', {
            detail: { direction, distance, deltaX, deltaY }
          }));
        }
      });
    }
  }

  private setupMediaQueries() {
    // Handle dark mode changes
    this.mediaQueryList = window.matchMedia('(prefers-color-scheme: dark)');
    this.mediaQueryList.addEventListener('change', (e) => {
      document.documentElement.classList.toggle('dark', e.matches);
    });

    // Handle reduced motion preference
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    motionQuery.addEventListener('change', (e) => {
      document.documentElement.classList.toggle('reduce-motion', e.matches);
    });

    // Handle data saver mode
    const saveDataQuery = window.matchMedia('(prefers-reduced-data: reduce)');
    saveDataQuery.addEventListener('change', (e) => {
      if (e.matches) {
        this.updateAudioConfig({
          quality: 'low',
          preloadStrategy: 'none'
        });
      }
    });
  }

  private async setupBatteryMonitoring() {
    if ('getBattery' in navigator) {
      try {
        this.batteryManager = await (navigator as any).getBattery();
        
        const updateBatteryStatus = () => {
          const level = this.batteryManager.level;
          const charging = this.batteryManager.charging;

          if (!charging) {
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

        this.batteryManager.addEventListener('levelchange', updateBatteryStatus);
        this.batteryManager.addEventListener('chargingchange', updateBatteryStatus);
        
        updateBatteryStatus();
      } catch (error) {
        console.error('Battery status API not available:', error);
      }
    }
  }

  private async setupNetworkMonitoring() {
    if ('connection' in navigator) {
      this.networkInfo = (navigator as any).connection;

      const updateNetworkStatus = () => {
        const type = this.networkInfo.type;
        const saveData = this.networkInfo.saveData;

        // Adjust audio quality based on network
        if (type === 'cellular' || saveData) {
          this.updateAudioConfig({
            quality: 'low',
            preloadStrategy: 'none'
          });
        } else if (type === 'wifi') {
          this.updateAudioConfig({
            quality: 'auto',
            preloadStrategy: 'metadata'
          });
        }
      };

      this.networkInfo.addEventListener('change', updateNetworkStatus);
      updateNetworkStatus();
    }
  }

  private updateViewportDimensions() {
    this.viewportConfig = {
      width: window.innerWidth,
      height: window.innerHeight,
      scale: window.devicePixelRatio || 1,
      orientation: window.innerWidth > window.innerHeight ? 'landscape' : 'portrait'
    };
  }

  private enableBatterySavingMode(critical: boolean) {
    this.batteryConfig.savingMode = true;
    
    if (critical) {
      this.updateAudioConfig({
        quality: 'low',
        preloadStrategy: 'none',
        backgroundPlayback: false
      });
    } else {
      this.updateAudioConfig({
        quality: 'low',
        preloadStrategy: 'metadata',
        backgroundPlayback: true
      });
    }
  }

  private disableBatterySavingMode() {
    this.batteryConfig.savingMode = false;
    
    this.updateAudioConfig({
      quality: 'auto',
      preloadStrategy: 'metadata',
      backgroundPlayback: true
    });
  }

  // Public methods
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
    this.resizeObserver?.disconnect();
    this.intersectionObserver?.disconnect();
    this.mediaQueryList?.removeEventListener('change', () => {});
    if (this.networkInfo) {
      this.networkInfo.removeEventListener('change', () => {});
    }
  }
}

export const mobileOptimizationService = MobileOptimizationService.getInstance(); 