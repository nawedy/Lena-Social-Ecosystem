import * as React from 'react';

declare module '*/services/AnalyticsService' {
  export interface AnalyticsEvent {
    rule?: string;
    trigger?: string;
    account?: string;
    data?: any;
  }

  export interface AnalyticsService {
    trackEvent(event: AnalyticsEvent): void;
    trackError(error: Error): void;
    getMetrics(): Promise<Record<string, number>>;
  }
}

declare module '*/services/metrics' {
  export interface MetricsService {
    recordMetric(
      name: string,
      value: number,
      labels?: Record<string, string>
    ): void;
    getMetric(name: string): Promise<number>;
  }
}

declare module '*/services/logger' {
  export interface LoggerService {
    info(message: string, context?: Record<string, any>): void;
    error(message: string, error?: Error, context?: Record<string, any>): void;
    warn(message: string, context?: Record<string, any>): void;
    debug(message: string, context?: Record<string, any>): void;
  }
}

declare module '*/services/database' {
  export interface DatabaseService {
    query(sql: string, params?: any[]): Promise<any[]>;
    execute(sql: string, params?: any[]): Promise<void>;
    transaction<T>(callback: () => Promise<T>): Promise<T>;
  }
}

declare module '*/services/redis' {
  export interface RedisService {
    get(key: string): Promise<string | null>;
    set(key: string, value: string, ttl?: number): Promise<void>;
    del(key: string): Promise<void>;
  }
}

declare module '*/services/kubernetes' {
  export interface KubernetesService {
    scaleDeployment(name: string, replicas: number): Promise<void>;
    getDeploymentStatus(name: string): Promise<any>;
    getPodMetrics(selector: string): Promise<any[]>;
  }
}

declare module '@elastic/apm-rum' {
  export interface APMService {
    init(config: any): void;
    setUserContext(user: any): void;
    startTransaction(name: string, type: string): any;
    startSpan(name: string, type: string): any;
    setCustomContext(context: any): void;
  }
}

declare module '@opentelemetry/exporter-prometheus' {
  export class PrometheusExporter {
    constructor(config?: any);
    startServer(options: any): void;
  }
}

declare module '@opentelemetry/metrics' {
  export interface Metric {
    add(value: number, labels?: Record<string, string>): void;
  }

  export interface MeterProvider {
    getMeter(name: string): Meter;
  }

  export interface Meter {
    createCounter(name: string, options?: any): Metric;
    createUpDownCounter(name: string, options?: any): Metric;
    createValueRecorder(name: string, options?: any): Metric;
  }
}

declare module '@opentelemetry/api-metrics' {
  export * from '@opentelemetry/metrics';
}

declare module '@sentry/node' {
  export function init(options: any): void;
  export function captureException(error: any): string;
  export function captureMessage(message: string): string;
  export function setUser(user: any): void;
  export function setTag(key: string, value: string): void;
}

declare module '@stability-ai/api' {
  export interface StabilityAIClient {
    generate(options: any): Promise<any>;
  }
}

declare module 'replicate' {
  export default class Replicate {
    constructor(options: any);
    run(model: string, options: any): Promise<any>;
  }
}

declare module 'expo-secure-store' {
  export function getItemAsync(key: string): Promise<string | null>;
  export function setItemAsync(key: string, value: string): Promise<void>;
  export function deleteItemAsync(key: string): Promise<void>;
}

declare module 'expo-linear-gradient' {
  import { ViewProps } from 'react-native';
  export class LinearGradient extends React.Component<
    ViewProps & {
      colors: string[];
      start?: { x: number; y: number };
      end?: { x: number; y: number };
      locations?: number[];
    }
  > {}
}

declare module 'expo-camera' {
  import { ViewProps } from 'react-native';
  export class Camera extends React.Component<
    ViewProps & {
      type?: number;
      flashMode?: number;
      autoFocus?: boolean;
      zoom?: number;
    }
  > {
    static Constants: {
      Type: { front: number; back: number };
      FlashMode: { on: number; off: number; auto: number; torch: number };
    };
  }
}

declare module 'expo-image-picker' {
  export function launchImageLibraryAsync(options?: {
    mediaTypes?: 'Images' | 'Videos' | 'All';
    allowsEditing?: boolean;
    quality?: number;
  }): Promise<{
    cancelled: boolean;
    uri?: string;
    width?: number;
    height?: number;
    type?: 'image' | 'video';
  }>;
}

declare module '@react-native-async-storage/async-storage' {
  export function getItem(key: string): Promise<string | null>;
  export function setItem(key: string, value: string): Promise<void>;
  export function removeItem(key: string): Promise<void>;
  export function clear(): Promise<void>;
  export function getAllKeys(): Promise<string[]>;
  export function multiGet(keys: string[]): Promise<[string, string | null][]>;
  export function multiSet(keyValuePairs: string[][]): Promise<void>;
  export function multiRemove(keys: string[]): Promise<void>;
}

declare module './services' {
  export interface ATProtoService {
    getAgent(): Promise<any>;
    agent: any;
  }

  export interface SecurityService {
    validateAccountAccess(accountId: string): Promise<boolean>;
  }

  export interface NotificationService {
    sendToTeam(message: string, data?: any): Promise<void>;
  }

  export interface TikTokMigrationService {
    getContentInventory(): Promise<any[]>;
    migrateContent(content: any): Promise<void>;
  }

  export interface ContentModerationService {
    moderateText(text: string): Promise<boolean>;
    moderateImage(image: Buffer): Promise<boolean>;
    moderateVideo(video: Buffer): Promise<boolean>;
  }

  export interface AnalyticsService {
    getContentPerformance(): Promise<any[]>;
    getAudienceInsights(): Promise<any[]>;
    getCompetitorAnalysis(): Promise<any[]>;
    getPredictiveInsights(): Promise<any[]>;
  }
}
