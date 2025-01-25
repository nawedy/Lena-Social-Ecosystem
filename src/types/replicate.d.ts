declare module 'replicate' {
  export interface ReplicateOptions {
    auth: string;
    userAgent?: string;
  }

  export interface PredictionInput {
    [key: string]: string | number | boolean | null;
  }

  export interface PredictionOptions {
    version: string;
    input: PredictionInput;
  }

  export interface PredictionMetrics {
    predict_time: number;
    [key: string]: number;
  }

  export interface Prediction {
    id: string;
    version: string;
    status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
    input: PredictionInput;
    output: string[] | string | number[] | number | null;
    error: string | null;
    logs: string;
    metrics: PredictionMetrics;
    created_at: string;
    started_at: string | null;
    completed_at: string | null;
    urls: {
      get: string;
      cancel: string;
    };
  }

  export default class Replicate {
    constructor(options: ReplicateOptions);

    run(
      modelPath: string,
      options: PredictionOptions
    ): Promise<Prediction['output']>;
    predictions: {
      create(options: PredictionOptions): Promise<Prediction>;
      get(id: string): Promise<Prediction>;
      list(): Promise<Prediction[]>;
      cancel(id: string): Promise<void>;
    };
  }
}
