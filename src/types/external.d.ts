import type { ReactNode, ReactElement, ComponentType } from 'react';
import type { ViewProps } from 'react-native';

declare module 'react-native-chart-kit' {
  export interface ChartConfig {
    backgroundColor?: string;
    backgroundGradientFrom?: string;
    backgroundGradientTo?: string;
    color?: (opacity?: number) => string;
    labelColor?: (opacity?: number) => string;
    strokeWidth?: number;
    barPercentage?: number;
    useShadowColorFromDataset?: boolean;
    decimalPlaces?: number;
    style?: ViewProps['style'];
    propsForBackgroundLines?: {
      strokeWidth?: number;
      strokeDasharray?: number[];
      stroke?: string;
    };
    propsForLabels?: {
      fontSize?: number;
      fontFamily?: string;
    };
  }

  export interface ContributionGraphProps {
    values: Array<{
      date: string;
      count: number;
    }>;
    endDate: Date;
    numDays: number;
    width: number;
    height: number;
    chartConfig: ChartConfig;
    style?: ViewProps['style'];
  }

  export interface ContributionGraph {
    (props: ContributionGraphProps): ReactElement;
  }

  export const ContributionGraph: ContributionGraph;
}

declare module 'expo-linear-gradient' {
  export interface LinearGradientPoint {
    x: number;
    y: number;
  }

  export interface LinearGradientProps extends ViewProps {
    colors: string[];
    start?: LinearGradientPoint;
    end?: LinearGradientPoint;
    locations?: number[];
  }

  export const LinearGradient: ComponentType<LinearGradientProps>;
}

declare module 'expo-camera' {
  interface CameraProps extends ViewProps {
    type?: number;
    flashMode?: number;
    autoFocus?: boolean;
    zoom?: number;
    whiteBalance?: number;
    ratio?: string;
    quality?: number;
    children?: ReactNode;
  }

  export const Camera: ComponentType<CameraProps>;
}

declare module '@stability-ai/api' {
  export interface StabilityAIConfig {
    apiKey: string;
    baseUrl?: string;
  }

  export interface GenerationOptions {
    prompt: string;
    width?: number;
    height?: number;
    steps?: number;
    cfgScale?: number;
    samples?: number;
    seed?: number;
    noiseThreshold?: number;
    modelId?: string;
  }

  export interface GenerationResponse {
    artifacts: Array<{
      base64: string;
      seed: number;
      finishReason: string;
    }>;
  }

  export class StabilityAI {
    constructor(config: StabilityAIConfig);
    generate(options: GenerationOptions): Promise<GenerationResponse>;
  }
}

declare module 'replicate-api' {
  interface ReplicateConfig {
    apiKey: string;
    baseUrl?: string;
  }

  interface RunOptions {
    model: string;
    input: Record<string, string | number | boolean | null>;
  }

  interface RunResponse {
    id: string;
    status: string;
    output: string[];
    error?: string;
    metrics: {
      predictTime: number;
      totalTime: number;
    };
  }

  export default class Replicate {
    constructor(config: ReplicateConfig);
    run(options: RunOptions): Promise<RunResponse>;
  }
}

declare module '@sentry/browser' {
  export interface SentryConfig {
    dsn: string;
    environment?: string;
    release?: string;
    debug?: boolean;
    sampleRate?: number;
    maxBreadcrumbs?: number;
    attachStacktrace?: boolean;
  }

  export interface SentryUser {
    id?: string;
    email?: string;
    username?: string;
    ipAddress?: string;
    [key: string]: string | undefined;
  }

  export interface SentryContext {
    [key: string]: string | number | boolean | null | undefined;
  }

  export interface SentryBreadcrumb {
    type?: string;
    level?: string;
    category?: string;
    message?: string;
    data?: Record<string, string | number | boolean>;
    timestamp?: number;
  }

  export interface SentryScope {
    setUser(user: SentryUser | null): void;
    setTag(key: string, value: string): void;
    setExtra(key: string, value: string | number | boolean | null): void;
    setContext(name: string, context: SentryContext | null): void;
    addBreadcrumb(breadcrumb: SentryBreadcrumb): void;
  }

  export function init(options: SentryConfig): void;
  export function captureException(error: Error): string;
  export function captureMessage(
    message: string,
    level?: 'fatal' | 'error' | 'warning' | 'info' | 'debug'
  ): string;
  export function setUser(user: SentryUser | null): void;
  export function setTag(key: string, value: string): void;
  export function setExtra(key: string, value: string | number | boolean | null): void;
  export function setContext(name: string, context: SentryContext | null): void;
  export function addBreadcrumb(breadcrumb: SentryBreadcrumb): void;
  export function configureScope(callback: (scope: SentryScope) => void): void;
}

declare module '@sentry/react-native' {
  export interface SentryConfig {
    dsn: string;
    debug?: boolean;
    environment?: string;
    release?: string;
    dist?: string;
    maxBreadcrumbs?: number;
    autoSessionTracking?: boolean;
    enableAutoSessionTracking?: boolean;
    sessionTrackingIntervalMillis?: number;
    integrations?: any[];
    beforeSend?: (event: Event, hint?: EventHint) => Promise<Event | null> | Event | null;
    beforeBreadcrumb?: (breadcrumb: Breadcrumb, hint?: BreadcrumbHint) => Breadcrumb | null;
  }

  export interface Event {
    event_id: string;
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
      data?: unknown;
      query_string?: string;
      cookies?: string;
      headers?: Record<string, string>;
      env?: Record<string, string>;
    };
    exception?: {
      values: Array<{
        type: string;
        value: string;
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
    user?: {
      id?: string;
      ip_address?: string;
      email?: string;
      username?: string;
      [key: string]: unknown;
    };
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
    contexts?: Record<string, unknown>;
  }

  export interface EventHint {
    event_id?: string;
    syntheticException?: Error | null;
    originalException?: Error;
    data?: Record<string, unknown>;
  }

  export interface Breadcrumb {
    type?: string;
    category?: string;
    message?: string;
    data?: Record<string, unknown>;
    level?: string;
    timestamp?: number;
  }

  export interface BreadcrumbHint {
    [key: string]: unknown;
  }

  export interface Integration {
    name: string;
    setupOnce(addGlobalEventProcessor: (callback: (event: Event) => Event | null) => void): void;
  }

  export interface Hub {
    addBreadcrumb(breadcrumb: Breadcrumb, hint?: BreadcrumbHint): void;
    captureException(exception: unknown): string;
    captureMessage(message: string, level?: string): string;
    setContext(name: string, context: Record<string, unknown> | null): void;
    setSpan(span: unknown): void;
    setUser(user: Record<string, unknown> | null): void;
    getUser(): Record<string, unknown> | null;
    clear(): void;
  }

  export function init(options: SentryConfig): void;
  export function captureException(error: unknown): string;
  export function captureMessage(
    message: string,
    level?: 'fatal' | 'error' | 'warning' | 'info' | 'debug'
  ): string;
  export function setUser(user: Record<string, unknown> | null): void;
  export function setTag(key: string, value: string): void;
  export function setExtra(key: string, extra: unknown): void;
  export function setContext(name: string, context: Record<string, unknown> | null): void;
  export function addBreadcrumb(breadcrumb: Record<string, unknown>): void;
  export function configureScope(callback: (scope: Hub) => void): void;
}

declare module 'expo-secure-store' {
  export function getItemAsync(
    key: string,
    options?: { keychainAccessible?: boolean }
  ): Promise<string | null>;
  export function setItemAsync(
    key: string,
    value: string,
    options?: { keychainAccessible?: boolean }
  ): Promise<void>;
  export function deleteItemAsync(
    key: string,
    options?: { keychainAccessible?: boolean }
  ): Promise<void>;
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
  export function mergeItem(key: string, value: string): Promise<void>;
  export function flushGetRequests(): void;
}

declare module 'react-calendar-heatmap' {
  import type { FC } from 'react';

  interface CalendarHeatmapValue {
    date: string;
    count: number;
  }

  interface CalendarHeatmapProps {
    values: CalendarHeatmapValue[];
    classForValue?: (value: CalendarHeatmapValue) => string;
    titleForValue?: (value: CalendarHeatmapValue) => string;
    tooltipDataAttrs?: (value: CalendarHeatmapValue) => Record<string, string>;
    showWeekdayLabels?: boolean;
    showMonthLabels?: boolean;
    horizontal?: boolean;
    gutterSize?: number;
    onClick?: (value: CalendarHeatmapValue) => void;
    startDate?: Date;
    endDate?: Date;
  }

  const CalendarHeatmap: FC<CalendarHeatmapProps>;
  export default CalendarHeatmap;
}

declare module '@elastic/apm-rum' {
  interface APMConfig {
    serviceName: string;
    serverUrl: string;
    environment?: string;
    logLevel?: 'trace' | 'debug' | 'info' | 'warn' | 'error';
  }

  interface Transaction {
    name: string;
    type: string;
    result?: string;
    outcome?: 'success' | 'failure' | 'unknown';
    addLabels(labels: Record<string, string | number | boolean>): void;
    end(endTime?: number): void;
  }

  interface Span {
    name: string;
    type: string;
    subtype?: string;
    action?: string;
    addLabels(labels: Record<string, string | number | boolean>): void;
    end(endTime?: number): void;
  }

  export function init(config: APMConfig): void;
  export function setUserContext(user: Record<string, string | number | boolean>): void;
  export function setCustomContext(context: Record<string, string | number | boolean>): void;
  export function addLabels(labels: Record<string, string | number | boolean>): void;
  export function startTransaction(name: string, type: string): Transaction;
  export function startSpan(name: string, type: string): Span;
  export function getCurrentTransaction(): Transaction | null;
  export function setInitialPageLoadName(name: string): void;
}

declare module '@opentelemetry/exporter-prometheus' {
  interface PrometheusExporterConfig {
    port?: number;
    endpoint?: string;
    prefix?: string;
  }

  export class PrometheusExporter {
    constructor(config?: PrometheusExporterConfig);
    startServer(options: { port: number }): void;
  }
}

declare module '@opentelemetry/metrics' {
  interface MetricOptions {
    description?: string;
    unit?: string;
    valueType?: 'int' | 'double';
  }

  interface Metric {
    add(value: number, labels?: Record<string, string>): void;
  }

  interface MeterProvider {
    getMeter(name: string, version?: string): Meter;
  }

  interface Meter {
    createCounter(name: string, options?: MetricOptions): Metric;
    createUpDownCounter(name: string, options?: MetricOptions): Metric;
    createValueRecorder(name: string, options?: MetricOptions): Metric;
  }
}

declare module '@opentelemetry/api-metrics' {
  export * from '@opentelemetry/metrics';
}

declare module '@sentry/node' {
  export interface SentryConfig {
    dsn: string;
    environment?: string;
    release?: string;
    debug?: boolean;
    sampleRate?: number;
    maxBreadcrumbs?: number;
    attachStacktrace?: boolean;
  }

  export function init(options: SentryConfig): void;
  export function captureException(error: any): string;
  export function captureMessage(
    message: string,
    level?: 'fatal' | 'error' | 'warning' | 'info' | 'debug'
  ): string;
  export function setUser(user: Record<string, any> | null): void;
  export function setTag(key: string, value: string): void;
  export function setExtra(key: string, extra: any): void;
  export function setContext(name: string, context: Record<string, any> | null): void;
  export function addBreadcrumb(breadcrumb: Record<string, any>): void;
  export function configureScope(callback: (scope: any) => void): void;
}

declare module '@sentry/browser' {
  interface SentryIntegration {
    name: string;
    setup: (options: unknown) => void;
  }

  interface SentryConfig {
    dsn: string;
    environment?: string;
    release?: string;
    debug?: boolean;
    sampleRate?: number;
    tracesSampleRate?: number;
    maxBreadcrumbs?: number;
    attachStacktrace?: boolean;
    serverName?: string;
    enableAutoSessionTracking?: boolean;
    sessionTrackingIntervalMillis?: number;
    integrations?: SentryIntegration[];
    beforeSend?: (event: Event, hint?: EventHint) => Promise<Event | null> | Event | null;
    beforeBreadcrumb?: (breadcrumb: Breadcrumb, hint?: BreadcrumbHint) => Breadcrumb | null;
  }

  interface SentryError {
    message: string;
    name: string;
    stack?: string;
    cause?: unknown;
  }

  interface SentryUser {
    id?: string;
    username?: string;
    email?: string;
    ipAddress?: string;
    [key: string]: unknown;
  }

  interface SentryContext {
    [key: string]: unknown;
  }

  interface SentryBreadcrumb {
    type?: string;
    category?: string;
    message?: string;
    data?: Record<string, unknown>;
    level?: string;
    timestamp?: number;
  }

  interface SentryScope {
    setUser: (user: SentryUser | null) => void;
    setTag: (key: string, value: string) => void;
    setExtra: (key: string, value: unknown) => void;
    setContext: (name: string, context: SentryContext | null) => void;
    addBreadcrumb: (breadcrumb: SentryBreadcrumb) => void;
  }

  export namespace Sentry {
    export function init(options: SentryConfig): void;
    export function captureException(error: SentryError): string;
    export function captureMessage(
      message: string,
      level?: 'fatal' | 'error' | 'warning' | 'info' | 'debug'
    ): string;
    export function setUser(user: SentryUser | null): void;
    export function setTag(key: string, value: string): void;
    export function setExtra(key: string, value: unknown): void;
    export function setContext(name: string, context: SentryContext | null): void;
    export function addBreadcrumb(breadcrumb: SentryBreadcrumb): void;
    export function configureScope(callback: (scope: SentryScope) => void): void;
  }
}
