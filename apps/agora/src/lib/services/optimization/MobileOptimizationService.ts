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
}

interface ImageOptimizationConfig {
  maxWidth: number;
  quality: number;
  format: 'webp' | 'avif' | 'jpeg';
  placeholder: 'blur' | 'color' | 'none';
  lazyLoadThreshold: number;
}

export class MobileOptimizationService {
  private static instance: MobileOptimizationService;
  private viewportConfig: ViewportConfig;
  private touchConfig: TouchConfig;
  private imageConfig: ImageOptimizationConfig;
  private mediaQueryList: MediaQueryList | null = null;
  private intersectionObserver: IntersectionObserver | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private isTouch = false;

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
      swipeThreshold: 50
    };

    this.imageConfig = {
      maxWidth: 1200,
      quality: 80,
      format: 'webp',
      placeholder: 'blur',
      lazyLoadThreshold: 0.1
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
    this.isTouch = 'ontouchstart' in window;

    if (this.isTouch) {
      let touchStartTime = 0;
      let touchStartX = 0;
      let touchStartY = 0;
      let lastTapTime = 0;

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

  private setupImageOptimization() {
    // Create intersection observer for lazy loading
    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target as HTMLImageElement;
            if (img.dataset.src) {
              this.loadOptimizedImage(img);
            }
          }
        });
      },
      {
        rootMargin: '50px',
        threshold: this.imageConfig.lazyLoadThreshold
      }
    );

    // Observe all images with data-src attribute
    document.querySelectorAll('img[data-src]').forEach(img => {
      this.intersectionObserver?.observe(img);
    });
  }

  private setupMediaQueries() {
    // Handle dark mode changes
    this.mediaQueryList = window.matchMedia('(prefers-color-scheme: dark)');
    this.mediaQueryList.addEventListener('change', (e) => {
      document.documentElement.classList.toggle('dark', e.matches);
    });
  }

  private async loadOptimizedImage(img: HTMLImageElement) {
    const originalSrc = img.dataset.src;
    if (!originalSrc) return;

    try {
      // Generate optimized URL
      const optimizedUrl = this.getOptimizedImageUrl(originalSrc);

      // Create placeholder if needed
      if (this.imageConfig.placeholder !== 'none') {
        const placeholder = await this.createPlaceholder(originalSrc);
        img.style.backgroundImage = `url(${placeholder})`;
        img.style.backgroundSize = 'cover';
      }

      // Load optimized image
      const optimizedImg = new Image();
      optimizedImg.src = optimizedUrl;
      
      optimizedImg.onload = () => {
        img.src = optimizedUrl;
        img.removeAttribute('data-src');
        this.intersectionObserver?.unobserve(img);
      };
    } catch (error) {
      console.error('Failed to load optimized image:', error);
      img.src = originalSrc;
    }
  }

  private getOptimizedImageUrl(originalUrl: string): string {
    const url = new URL(originalUrl);
    
    // Add optimization parameters
    url.searchParams.set('w', this.imageConfig.maxWidth.toString());
    url.searchParams.set('q', this.imageConfig.quality.toString());
    url.searchParams.set('fm', this.imageConfig.format);
    
    if (this.viewportConfig.width < this.imageConfig.maxWidth) {
      url.searchParams.set('w', this.viewportConfig.width.toString());
    }

    return url.toString();
  }

  private async createPlaceholder(url: string): Promise<string> {
    if (this.imageConfig.placeholder === 'blur') {
      // Generate tiny blurred placeholder
      const placeholderUrl = new URL(url);
      placeholderUrl.searchParams.set('w', '20');
      placeholderUrl.searchParams.set('blur', '10');
      return placeholderUrl.toString();
    } else if (this.imageConfig.placeholder === 'color') {
      // Extract dominant color
      const color = await this.extractDominantColor(url);
      return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='100%' height='100%' fill='${color}'/%3E%3C/svg%3E`;
    }
    return '';
  }

  private async extractDominantColor(url: string): Promise<string> {
    // Simplified color extraction
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = url;
    
    await new Promise(resolve => img.onload = resolve);
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return '#ffffff';
    
    canvas.width = 1;
    canvas.height = 1;
    ctx.drawImage(img, 0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  private updateViewportDimensions() {
    this.viewportConfig = {
      width: window.innerWidth,
      height: window.innerHeight,
      scale: window.devicePixelRatio || 1,
      orientation: window.innerWidth > window.innerHeight ? 'landscape' : 'portrait'
    };
  }

  getViewportConfig(): ViewportConfig {
    return { ...this.viewportConfig };
  }

  getTouchConfig(): TouchConfig {
    return { ...this.touchConfig };
  }

  updateImageConfig(config: Partial<ImageOptimizationConfig>) {
    this.imageConfig = { ...this.imageConfig, ...config };
    // Reinitialize image optimization with new config
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
      this.setupImageOptimization();
    }
  }

  cleanup() {
    this.resizeObserver?.disconnect();
    this.intersectionObserver?.disconnect();
    this.mediaQueryList?.removeEventListener('change', () => {});
  }
}

export const mobileOptimizationService = MobileOptimizationService.getInstance(); 