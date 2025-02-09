// packages/analytics/src/pipeline/AnalyticsPipeline.ts
interface AnalyticsEvent {
  type: string;
  timestamp: number;
  data: Record<string, any>;
}

interface DataProcessor {
  process(event: AnalyticsEvent): Promise<AnalyticsEvent>;
}

export class AnalyticsPipeline {
    private processors: DataProcessor[] = [];
    private buffer: AnalyticsEvent[] = [];
    private flushIntervalId: NodeJS.Timer | null = null;
  
    constructor(private options: {
      batchSize: number;
      flushInterval: number;
      storage: any; // Assuming AnalyticsStorage is not defined or imported
    }) {
      this.startFlushInterval();
    }

    private startFlushInterval(): void {
      this.flushIntervalId = setInterval(async () => {
        if (this.buffer.length > 0) {
          await this.flush();
        }
      }, this.options.flushInterval);
    }

    private async flush(): Promise<void> {
      const events = [...this.buffer];
      this.buffer = [];
      await this.options.storage.saveEvents(events);
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