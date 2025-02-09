import { browser } from '$app/environment';

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
}

interface ImageOptimizationConfig {
  maxWidth: number;
  quality: number;
  format: 'webp' | 'avif' | 'jpeg';
  placeholder: 'blur' | 'color' | 'none';
}

export class MobileOptimizationService {
  private static instance: MobileOptimizationService;
  private viewportConfig: ViewportConfig;
  private touchConfig: TouchConfig;
  private imageConfig: ImageOptimizationConfig;
  private mediaQueryList: MediaQueryList | null = null;
  private intersectionObserver: IntersectionObserver | null = null;
  private resizeObserver: ResizeObserver | null = null;

  private constructor() {
    this.viewportConfig = {
      width: 0,
      height: 0,
      scale: 1,
      orientation: 'portrait'
    };

    this.touchConfig = {
      enabled: false,
      tapDelay: 300,
      doubleTapDelay: 300,
      longPressDelay: 500,
      swipeThreshold: 50
    };

    this.imageConfig = {
      maxWidth: 1200,
      quality: 80,
      format: 'webp',
      placeholder: 'blur'
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

  private init() {
    this.setupViewport();
    this.setupTouchHandling();
    this.setupImageOptimization();
    this.setupMediaQueries();
  }

  private setupViewport() {
    // Set initial viewport dimensions
    this.updateViewportDimensions();

    // Create resize observer
    this.resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        this.viewportConfig.width = width;
        this.viewportConfig.height = height;
        this.viewportConfig.orientation = width > height ? 'landscape' : 'portrait';
      }
    });

    // Observe document body
    this.resizeObserver.observe(document.body);
  }

  private setupTouchHandling() {
    this.touchConfig.enabled = 'ontouchstart' in window;
    if (!this.touchConfig.enabled) return;

    // Prevent double-tap zoom on mobile
    document.addEventListener('touchstart', (e: TouchEvent) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    }, { passive: false });

    // Handle touch gestures
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;

    document.addEventListener('touchstart', (e: TouchEvent) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      touchStartTime = Date.now();
    }, { passive: true });

    document.addEventListener('touchend', (e: TouchEvent) => {
      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;
      const touchEndTime = Date.now();

      const deltaX = touchEndX - touchStartX;
      const deltaY = touchEndY - touchStartY;
      const deltaTime = touchEndTime - touchStartTime;

      // Detect swipe
      if (Math.abs(deltaX) > this.touchConfig.swipeThreshold) {
        const event = new CustomEvent('swipe', {
          detail: {
            direction: deltaX > 0 ? 'right' : 'left',
            distance: Math.abs(deltaX),
            deltaTime
          }
        });
        document.dispatchEvent(event);
      }

      // Detect long press
      if (deltaTime > this.touchConfig.longPressDelay && Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) {
        const event = new CustomEvent('longpress', {
          detail: {
            x: touchEndX,
            y: touchEndY,
            duration: deltaTime
          }
        });
        document.dispatchEvent(event);
      }
    }, { passive: true });
  }

  private setupImageOptimization() {
    // Create intersection observer for lazy loading
    this.intersectionObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target as HTMLImageElement;
            if (img.dataset.src) {
              this.loadOptimizedImage(img);
              observer.unobserve(img);
            }
          }
        });
      },
      {
        rootMargin: '50px 0px',
        threshold: 0.1
      }
    );

    // Observe all images with data-src attribute
    document.querySelectorAll('img[data-src]').forEach(img => {
      this.intersectionObserver.observe(img);
    });
  }

  private setupMediaQueries() {
    // Listen for dark mode changes
    this.mediaQueryList = window.matchMedia('(prefers-color-scheme: dark)');
    this.mediaQueryList.addEventListener('change', e => {
      document.documentElement.classList.toggle('dark', e.matches);
    });

    // Set initial dark mode
    document.documentElement.classList.toggle('dark', this.mediaQueryList.matches);
  }

  private async loadOptimizedImage(img: HTMLImageElement) {
    const originalSrc = img.dataset.src;
    if (!originalSrc) return;

    try {
      // Generate optimized image URL based on viewport and device pixel ratio
      const optimizedSrc = this.getOptimizedImageUrl(originalSrc);
      
      // Create new image to preload
      const preloadImg = new Image();
      preloadImg.src = optimizedSrc;
      
      // Wait for image to load
      await new Promise((resolve, reject) => {
        preloadImg.onload = resolve;
        preloadImg.onerror = reject;
      });

      // Update original image
      img.src = optimizedSrc;
      img.removeAttribute('data-src');

      // Add fade-in animation
      img.style.opacity = '0';
      img.style.transition = 'opacity 0.3s ease-in-out';
      requestAnimationFrame(() => {
        img.style.opacity = '1';
      });
    } catch (error) {
      console.error('Failed to load optimized image:', error);
      // Fallback to original source
      img.src = originalSrc;
    }
  }

  private getOptimizedImageUrl(originalUrl: string): string {
    const url = new URL(originalUrl);
    const width = Math.min(
      this.viewportConfig.width * window.devicePixelRatio,
      this.imageConfig.maxWidth
    );

    // Add optimization parameters
    url.searchParams.set('w', width.toString());
    url.searchParams.set('q', this.imageConfig.quality.toString());
    url.searchParams.set('fm', this.imageConfig.format);

    return url.toString();
  }

  private updateViewportDimensions() {
    if (!browser) return;

    const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
    const vh = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);

    this.viewportConfig = {
      width: vw,
      height: vh,
      scale: window.devicePixelRatio || 1,
      orientation: vw > vh ? 'landscape' : 'portrait'
    };
  }

  // Public methods
  getViewportConfig(): ViewportConfig {
    return { ...this.viewportConfig };
  }

  getTouchConfig(): TouchConfig {
    return { ...this.touchConfig };
  }

  updateImageConfig(config: Partial<ImageOptimizationConfig>) {
    this.imageConfig = {
      ...this.imageConfig,
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
      // Remove event listener
      const listeners = this.mediaQueryList.listeners;
      if (listeners) {
        listeners.forEach(listener => {
          this.mediaQueryList?.removeEventListener('change', listener);
        });
      }
    }
  }
}

// Create service instance
export const mobileOptimizationService = MobileOptimizationService.getInstance(); 