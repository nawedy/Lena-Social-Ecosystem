import { useEffect, useRef } from 'react';
import { InteractionManager } from 'react-native';

import { performanceMonitor } from '../utils/performance';

interface PerformanceOptions {
  monitorRender?: boolean;
  monitorMemory?: boolean;
  monitorFrameRate?: boolean;
  frameRateInterval?: number;
}

export const usePerformanceMonitoring = (
  componentName: string,
  options: PerformanceOptions = {}
) => {
  const {
    monitorRender = true,
    monitorMemory = true,
    monitorFrameRate = true,
    frameRateInterval = 1000,
  } = options;

  const mountTime = useRef(performance.now());
  const frameCountRef = useRef(0);
  const frameIntervalRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    const traceName = `${componentName}_mount`;
    performanceMonitor.startTrace(traceName);

    const interactionPromise = InteractionManager.runAfterInteractions(() => {
      const renderTime = performance.now() - mountTime.current;

      if (monitorRender) {
        performanceMonitor.monitorComponentRender(componentName, renderTime);
      }

      performanceMonitor.stopTrace(traceName, {
        render_time: renderTime.toString(),
      });
    });

    return () => {
      interactionPromise.cancel();
    };
  }, [componentName, monitorRender]);

  useEffect(() => {
    if (monitorMemory) {
      const interval = setInterval(() => {
        performanceMonitor.monitorMemoryUsage(componentName);
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [componentName, monitorMemory]);

  useEffect(() => {
    if (monitorFrameRate) {
      const requestFrame = () => {
        frameCountRef.current++;
        requestAnimationFrame(requestFrame);
      };

      const frameId = requestAnimationFrame(requestFrame);

      frameIntervalRef.current = setInterval(() => {
        performanceMonitor.monitorFrameRate(
          componentName,
          frameCountRef.current,
          frameRateInterval
        );
        frameCountRef.current = 0;
      }, frameRateInterval);

      return () => {
        cancelAnimationFrame(frameId);
        if (frameIntervalRef.current) {
          clearInterval(frameIntervalRef.current);
        }
      };
    }
  }, [componentName, monitorFrameRate, frameRateInterval]);

  const measureOperation = async (
    operationName: string,
    operation: () => Promise<void>
  ) => {
    const startTime = performance.now();
    try {
      await operation();
    } finally {
      performanceMonitor.monitorJSExecution(operationName, startTime);
    }
  };

  const measureSync = (operationName: string, operation: () => void) => {
    const startTime = performance.now();
    try {
      operation();
    } finally {
      performanceMonitor.monitorJSExecution(operationName, startTime);
    }
  };

  const measureNetworkRequest = async (
    url: string,
    method: string,
    request: () => Promise<Response>
  ) => {
    await performanceMonitor.startNetworkMonitoring(url, method);
    try {
      const response = await request();
      const responseSize = response.headers.get('content-length');
      await performanceMonitor.stopNetworkMonitoring(
        url,
        response.status,
        responseSize ? parseInt(responseSize, 10) : undefined
      );
      return response;
    } catch (error) {
      await performanceMonitor.stopNetworkMonitoring(url, 0);
      throw error;
    }
  };

  return {
    measureOperation,
    measureSync,
    measureNetworkRequest,
  };
};
