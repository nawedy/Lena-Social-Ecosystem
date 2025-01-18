import * as React from 'react';

declare module '*/services/AnalyticsService' {
  export interface AnalyticsEvent {
    rule?: string;
    trigger?: string;
    account?: string;
    data?: Record<string, string | number | boolean | Date>;
  }

  export interface AnalyticsService {
    trackEvent(event: AnalyticsEvent): void;
    trackError(error: Error): void;
    getMetrics(): Promise<Record<string, number>>;
  }
}

declare module '*/services/metrics' {
  export interface MetricsService {
    recordMetric(name: string, value: number, labels?: Record<string, string>): void;
    getMetric(name: string): Promise<number>;
  }
}

declare module '*/services/logger' {
  export interface LoggerService {
    info(message: string, context?: Record<string, string | number | boolean | Date>): void;
    error(message: string, error?: Error, context?: Record<string, string | number | boolean | Date>): void;
    warn(message: string, context?: Record<string, string | number | boolean | Date>): void;
    debug(message: string, context?: Record<string, string | number | boolean | Date>): void;
  }
}

declare module '*/services/database' {
  export type QueryParams = string | number | boolean | Date | null;
  export type QueryResult = Record<string, string | number | boolean | Date | null>;

  export interface DatabaseService {
    query(sql: string, params?: QueryParams[]): Promise<QueryResult[]>;
    execute(sql: string, params?: QueryParams[]): Promise<void>;
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
  export interface DeploymentStatus {
    name: string;
    replicas: number;
    availableReplicas: number;
    readyReplicas: number;
    updatedReplicas: number;
    conditions: {
      type: string;
      status: string;
      lastUpdateTime: string;
      lastTransitionTime: string;
      reason?: string;
      message?: string;
    }[];
  }

  export interface PodMetrics {
    name: string;
    namespace: string;
    cpu: {
      usage: number;
      limit: number;
    };
    memory: {
      usage: number;
      limit: number;
    };
  }

  export interface KubernetesService {
    scaleDeployment(name: string, replicas: number): Promise<void>;
    getDeploymentStatus(name: string): Promise<DeploymentStatus>;
    getPodMetrics(selector: string): Promise<PodMetrics[]>;
  }
}

declare module '@elastic/apm-rum' {
  export interface APMConfig {
    serviceName: string;
    serverUrl: string;
    serviceVersion?: string;
    environment?: string;
    active?: boolean;
    logLevel?: 'trace' | 'debug' | 'info' | 'warn' | 'error';
    distributedTracing?: boolean;
    distributedTracingOrigins?: string[];
  }

  export interface APMUser {
    id: string;
    username?: string;
    email?: string;
  }

  export interface Transaction {
    name: string;
    type: string;
    result?: string;
    end(): void;
    startSpan(name: string, type: string): Span;
  }

  export interface Span {
    name: string;
    type: string;
    end(): void;
  }

  export interface CustomContext {
    [key: string]: string | number | boolean | null;
  }

  export interface APMService {
    init(config: APMConfig): void;
    setUserContext(user: APMUser): void;
    startTransaction(name: string, type: string): Transaction;
    startSpan(name: string, type: string): Span;
    setCustomContext(context: CustomContext): void;
  }
}

declare module '@opentelemetry/exporter-prometheus' {
  export interface PrometheusExporterConfig {
    port?: number;
    endpoint?: string;
    prefix?: string;
    appendTimestamp?: boolean;
  }

  export interface ServerOptions {
    port: number;
    host?: string;
    path?: string;
  }

  export class PrometheusExporter {
    constructor(config?: PrometheusExporterConfig);
    startServer(options: ServerOptions): void;
  }
}

declare module '@opentelemetry/metrics' {
  export interface MetricOptions {
    description?: string;
    unit?: string;
    valueType?: 'int' | 'double';
    labelKeys?: string[];
  }

  export interface Metric {
    add(value: number, labels?: Record<string, string>): void;
  }

  export interface MeterProvider {
    getMeter(name: string, version?: string): Meter;
  }

  export interface Meter {
    createCounter(name: string, options?: MetricOptions): Metric;
    createUpDownCounter(name: string, options?: MetricOptions): Metric;
    createValueRecorder(name: string, options?: MetricOptions): Metric;
  }
}

declare module '@opentelemetry/api-metrics' {
  export * from '@opentelemetry/metrics';
}

declare module '@sentry/node' {
  export interface SentryNodeConfig {
    dsn: string;
    debug?: boolean;
    environment?: string;
    release?: string;
    serverName?: string;
    maxBreadcrumbs?: number;
    attachStacktrace?: boolean;
    sampleRate?: number;
    tracesSampleRate?: number;
    maxValueLength?: number;
    beforeSend?: (event: Event, hint?: EventHint) => Promise<Event | null> | Event | null;
  }

  export interface Event {
    event_id?: string;
    message?: string;
    timestamp?: number;
    level?: string;
    platform?: string;
    logger?: string;
    server_name?: string;
    release?: string;
    dist?: string;
    environment?: string;
    sdk?: {
      name: string;
      version: string;
    };
    request?: {
      url?: string;
      method?: string;
      data?: string;
      query_string?: string;
      cookies?: string | Record<string, string>;
      headers?: Record<string, string>;
      env?: Record<string, string>;
    };
    exception?: {
      values: Array<{
        type?: string;
        value?: string;
        stacktrace?: {
          frames: Array<{
            filename?: string;
            function?: string;
            module?: string;
            lineno?: number;
            colno?: number;
            abs_path?: string;
            context_line?: string;
            pre_context?: string[];
            post_context?: string[];
            in_app?: boolean;
          }>;
        };
      }>;
    };
  }

  export interface EventHint {
    event_id?: string;
    originalException?: Error;
    syntheticException?: Error;
  }

  export function init(options: SentryNodeConfig): void;
  export function captureException(error: Error): string;
  export function captureMessage(message: string): string;
  export function setUser(user: { id: string; email?: string; username?: string } | null): void;
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

declare module '*/services/event-bus' {
  export interface EventBusOptions {
    name: string;
    version: string;
    trigger?: string;
    account?: string;
    data?: Record<string, string | number | boolean | Date>;
  }

  export interface EventBusService {
    publish(event: string, data: Record<string, string | number | boolean | Date>): Promise<void>;
    subscribe(event: string, handler: (data: Record<string, string | number | boolean | Date>) => Promise<void>): Promise<void>;
    unsubscribe(event: string): Promise<void>;
  }
}

declare module '*/services/cache' {
  export interface CacheOptions {
    ttl?: number;
    prefix?: string;
    namespace?: string;
  }

  export interface CacheService {
    get<T>(key: string): Promise<T | null>;
    set<T>(key: string, value: T, ttl?: number): Promise<void>;
    delete(key: string): Promise<void>;
    clear(): Promise<void>;
  }
}

declare module '*/services/logger' {
  export interface LoggerService {
    info(message: string, context?: Record<string, string | number | boolean | Date>): void;
    error(message: string, error?: Error, context?: Record<string, string | number | boolean | Date>): void;
    warn(message: string, context?: Record<string, string | number | boolean | Date>): void;
    debug(message: string, context?: Record<string, string | number | boolean | Date>): void;
  }
}

declare module '*/services/metrics' {
  export interface MetricsOptions {
    name: string;
    help?: string;
    labelNames?: string[];
  }

  export interface MetricsService {
    increment(name: string, labels?: Record<string, string>): void;
    decrement(name: string, labels?: Record<string, string>): void;
    gauge(name: string, value: number, labels?: Record<string, string>): void;
    histogram(name: string, value: number, labels?: Record<string, string>): void;
    summary(name: string, value: number, labels?: Record<string, string>): void;
  }
}

declare module '*/services/tracing' {
  export interface TracingOptions {
    name: string;
    type: 'web' | 'worker' | 'cron';
    version?: string;
    environment?: string;
  }

  export interface TracingService {
    startSpan(name: string, options?: Record<string, string | number | boolean | Date>): TracingSpan;
    getCurrentSpan(): TracingSpan | null;
    setCurrentSpan(span: TracingSpan): void;
  }

  export interface TracingSpan {
    id: string;
    traceId: string;
    parentId?: string;
    name: string;
    startTime: Date;
    endTime?: Date;
    attributes: Record<string, string | number | boolean | Date>;
    events: Array<{
      name: string;
      timestamp: Date;
      attributes?: Record<string, string | number | boolean | Date>;
    }>;
    status: 'unset' | 'ok' | 'error';
    end(endTime?: Date): void;
    setAttribute(key: string, value: string | number | boolean | Date): void;
    addEvent(name: string, attributes?: Record<string, string | number | boolean | Date>): void;
  }
}
