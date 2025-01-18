declare module '../utils/performance' {
  export interface PerformanceMetrics {
    timeToFirstByte?: number;
    timeToFirstPaint?: number;
    timeToFirstContentfulPaint?: number;
    timeToInteractive?: number;
    totalBlockingTime?: number;
    largestContentfulPaint?: number;
    cumulativeLayoutShift?: number;
  }

  export function measurePerformance(): PerformanceMetrics;
  export function startMeasurement(name: string): void;
  export function endMeasurement(name: string): number;
  export function clearMeasurements(): void;
}
