declare module 'replicate' {
  export interface ReplicateOptions {
    auth: string;
    baseUrl?: string;
  }

  export interface PredictionOptions {
    version: string;
    input: Record<string, any>;
  }

  export interface Prediction {
    id: string;
    version: string;
    status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
    input: Record<string, any>;
    output: any;
    error: string | null;
    logs: string;
    metrics: Record<string, any>;
    created_at: string;
    started_at: string | null;
    completed_at: string | null;
  }

  export default class Replicate {
    constructor(options: ReplicateOptions);

    run(modelPath: string, options: PredictionOptions): Promise<any>;
    predictions: {
      create(options: PredictionOptions): Promise<Prediction>;
      get(id: string): Promise<Prediction>;
      list(): Promise<Prediction[]>;
      cancel(id: string): Promise<void>;
    };
  }
}
