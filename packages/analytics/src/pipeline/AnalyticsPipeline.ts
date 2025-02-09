// packages/analytics/src/pipeline/AnalyticsPipeline.ts
export class AnalyticsPipeline {
    private processors: DataProcessor[] = [];
    private buffer: AnalyticsEvent[] = [];
  
    constructor(private options: {
      batchSize: number;
      flushInterval: number;
      storage: AnalyticsStorage;
    }) {
      this.startFlushInterval();
    }
  
    addProcessor(processor: DataProcessor): void {
      this.processors.push(processor);
    }
  
    async processEvent(event: AnalyticsEvent): Promise<void> {
      const processedEvent = await this.processors.reduce(
        async (acc, processor) => processor.process(await acc),
        Promise.resolve(event)
      );
  
      this.buffer.push(processedEvent);
      if (this.buffer.length >= this.options.batchSize) {
        await this.flush();
      }
    }
  }