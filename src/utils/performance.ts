export const performanceMonitor = {
  startTrace: (traceName: string) => {
    return {
      putMetric: (name: string, value: number) => {},
      stop: () => {},
    };
  },
  stop: () => {},
};