// packages/shared/src/services/realtime/EventProcessor.ts
interface EventProcessorConfig {
    maxConcurrent: number;
    processingTimeout: number;
    retryStrategy: RetryStrategy;
    errorHandling: ErrorHandlingStrategy;
  }
  
  export class EventProcessor {
    private eventQueue: PriorityQueue<Event>;
    private activeProcessors: Set<string>;
    private metrics: EventMetrics;
  
    constructor(private config: EventProcessorConfig) {
      this.eventQueue = new PriorityQueue();
      this.activeProcessors = new Set();
      this.metrics = new EventMetrics();
    }
  
    async processEvent(event: Event): Promise<void> {
      if (this.shouldThrottle()) {
        await this.throttle();
      }
  
      try {
        await this.preProcess(event);
        await this.process(event);
        await this.postProcess(event);
        this.metrics.recordSuccess(event);
      } catch (error) {
        await this.handleError(event, error);
      }
    }
  
    private async process(event: Event): Promise<void> {
      const processor = this.getProcessor(event.type);
      const result = await processor.process(event);
      await this.broadcast(result);
    }
  }