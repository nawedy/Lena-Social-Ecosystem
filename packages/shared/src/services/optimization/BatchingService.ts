// packages/shared/src/services/optimization/BatchingService.ts
interface BatchOptions {
    maxBatchSize: number;
    maxWaitTime: number;
    retryConfig: {
      attempts: number;
      backoff: number;
    };
    priorityLevels: {
      HIGH: number;
      MEDIUM: number;
      LOW: number;
    };
  }
  
  export class BatchingService {
    private batchQueues: Map<string, BatchQueue>;
    private metrics: BatchMetrics;
  
    constructor(private options: BatchOptions) {
      this.batchQueues = new Map();
      this.metrics = new BatchMetrics();
    }
  
    async addToBatch<T>(
      key: string,
      request: () => Promise<T>,
      priority: keyof BatchOptions['priorityLevels'] = 'MEDIUM'
    ): Promise<T> {
      const queue = this.getOrCreateQueue(key);
      return queue.add(request, priority);
    }
  
    private getOrCreateQueue(key: string): BatchQueue {
      if (!this.batchQueues.has(key)) {
        this.batchQueues.set(
          key,
          new BatchQueue(this.options, this.metrics)
        );
      }
      return this.batchQueues.get(key)!;
    }
  }