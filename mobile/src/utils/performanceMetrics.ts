import { Platform, InteractionManager } from 'react-native';
import analytics from '@react-native-firebase/analytics';
import perf from '@react-native-firebase/perf';

export class PerformanceMetrics {
  private static instance: PerformanceMetrics;
  private interactionCount: number = 0;
  private lastInteractionTime: number = 0;
  private frameDrops: number = 0;
  private jsHeapSize: number = 0;

  private constructor() {
    this.setupFrameDropMonitoring();
    this.setupMemoryMonitoring();
  }

  public static getInstance(): PerformanceMetrics {
    if (!PerformanceMetrics.instance) {
      PerformanceMetrics.instance = new PerformanceMetrics();
    }
    return PerformanceMetrics.instance;
  }

  // Monitor app launch time
  public async trackAppLaunch(): Promise<void> {
    const trace = await perf().startTrace('app_launch');

    // Add custom metrics
    trace.putMetric('js_initialization_time', performance.now());

    // Track time to interactive
    const interactiveTime = await new Promise<number>(resolve => {
      InteractionManager.runAfterInteractions(() => {
        resolve(performance.now());
      });
    });

    trace.putMetric('time_to_interactive', interactiveTime);
    await trace.stop();
  }

  // Monitor navigation transitions
  public async trackNavigation(
    fromScreen: string,
    toScreen: string
  ): Promise<void> {
    const trace = await perf().startTrace('screen_transition');
    trace.putAttribute('from_screen', fromScreen);
    trace.putAttribute('to_screen', toScreen);

    await new Promise<void>(resolve => {
      InteractionManager.runAfterInteractions(() => {
        resolve();
      });
    });

    await trace.stop();
  }

  // Monitor Redux state changes
  public async trackReduxAction(
    actionType: string,
    duration: number
  ): Promise<void> {
    await analytics().logEvent('redux_action_performance', {
      action_type: actionType,
      duration,
      timestamp: Date.now(),
    });
  }

  // Monitor API request performance
  public async trackApiRequest(
    endpoint: string,
    method: string,
    startTime: number
  ): Promise<void> {
    const endTime = performance.now();
    const duration = endTime - startTime;

    await analytics().logEvent('api_request_performance', {
      endpoint,
      method,
      duration,
      timestamp: Date.now(),
    });
  }

  // Monitor image loading performance
  public async trackImageLoad(
    imageUrl: string,
    loadTime: number
  ): Promise<void> {
    await analytics().logEvent('image_load_performance', {
      image_url: imageUrl,
      load_time: loadTime,
      timestamp: Date.now(),
    });
  }

  // Monitor user interaction performance
  public trackInteraction(interactionType: string): void {
    const currentTime = performance.now();
    const timeSinceLastInteraction = currentTime - this.lastInteractionTime;

    this.interactionCount++;
    this.lastInteractionTime = currentTime;

    analytics().logEvent('user_interaction_performance', {
      interaction_type: interactionType,
      time_since_last_interaction: timeSinceLastInteraction,
      interaction_count: this.interactionCount,
      timestamp: Date.now(),
    });
  }

  // Monitor frame drops
  private setupFrameDropMonitoring(): void {
    let lastFrameTime = performance.now();
    const targetFrameTime = 1000 / 60; // 60 FPS

    const frameCallback = () => {
      const currentTime = performance.now();
      const frameDuration = currentTime - lastFrameTime;

      if (frameDuration > targetFrameTime * 1.5) {
        // 1.5x threshold for dropped frames
        this.frameDrops++;

        if (this.frameDrops % 60 === 0) {
          // Log every 60 drops
          analytics().logEvent('frame_drops', {
            count: this.frameDrops,
            duration: frameDuration,
            timestamp: Date.now(),
          });
        }
      }

      lastFrameTime = currentTime;
      requestAnimationFrame(frameCallback);
    };

    requestAnimationFrame(frameCallback);
  }

  // Monitor memory usage
  private setupMemoryMonitoring(): void {
    if (Platform.OS === 'android') {
      setInterval(async () => {
        const memory = await global.performance?.memory;
        if (memory) {
          const currentHeapSize = memory.usedJSHeapSize;
          const heapDiff = currentHeapSize - this.jsHeapSize;
          this.jsHeapSize = currentHeapSize;

          analytics().logEvent('memory_usage', {
            used_heap_size: currentHeapSize,
            heap_size_diff: heapDiff,
            total_heap_size: memory.totalJSHeapSize,
            heap_limit: memory.jsHeapSizeLimit,
            timestamp: Date.now(),
          });
        }
      }, 30000); // Check every 30 seconds
    }
  }

  // Monitor gesture performance
  public async trackGesture(
    gestureType: string,
    duration: number
  ): Promise<void> {
    await analytics().logEvent('gesture_performance', {
      gesture_type: gestureType,
      duration,
      frame_drops: this.frameDrops,
      timestamp: Date.now(),
    });
  }

  // Monitor animation performance
  public async trackAnimation(
    animationType: string,
    duration: number,
    frameCount: number
  ): Promise<void> {
    const fps = (frameCount / duration) * 1000;

    await analytics().logEvent('animation_performance', {
      animation_type: animationType,
      duration,
      fps,
      frame_drops: this.frameDrops,
      timestamp: Date.now(),
    });
  }

  // Monitor list rendering performance
  public async trackListRender(
    listId: string,
    itemCount: number,
    renderTime: number
  ): Promise<void> {
    await analytics().logEvent('list_render_performance', {
      list_id: listId,
      item_count: itemCount,
      render_time: renderTime,
      average_item_render_time: renderTime / itemCount,
      timestamp: Date.now(),
    });
  }

  // Monitor form submission performance
  public async trackFormSubmission(
    formId: string,
    fieldCount: number,
    submissionTime: number
  ): Promise<void> {
    await analytics().logEvent('form_submission_performance', {
      form_id: formId,
      field_count: fieldCount,
      submission_time: submissionTime,
      timestamp: Date.now(),
    });
  }

  // Get performance report
  public async getPerformanceReport(): Promise<{
    frameDrops: number;
    jsHeapSize: number;
    interactionCount: number;
    averageInteractionTime: number;
  }> {
    return {
      frameDrops: this.frameDrops,
      jsHeapSize: this.jsHeapSize,
      interactionCount: this.interactionCount,
      averageInteractionTime:
        this.lastInteractionTime / (this.interactionCount || 1),
    };
  }
}

export const performanceMetrics = PerformanceMetrics.getInstance();
