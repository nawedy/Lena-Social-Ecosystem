declare module 'react-native-chart-kit' {
  import { ViewProps } from 'react-native';
  import React from 'react';

  export interface ChartConfig {
    backgroundColor?: string;
    backgroundGradientFrom?: string;
    backgroundGradientTo?: string;
    decimalPlaces?: number;
    color?: (opacity: number) => string;
    labelColor?: (opacity: number) => string;
    style?: object;
    propsForDots?: object;
    propsForLabels?: object;
    propsForBackgroundLines?: object;
  }

  export interface AbstractChartProps {
    width: number;
    height: number;
    chartConfig: ChartConfig;
    style?: object;
    withHorizontalLabels?: boolean;
    withVerticalLabels?: boolean;
    withInnerLines?: boolean;
    withOuterLines?: boolean;
    withDots?: boolean;
    withShadow?: boolean;
    withScrollableDot?: boolean;
    yAxisLabel?: string;
    yAxisSuffix?: string;
    yAxisInterval?: number;
    yLabelsOffset?: number;
    xLabelsOffset?: number;
    showValuesOnTopOfBars?: boolean;
    showBarTops?: boolean;
  }

  export interface LineChartData {
    labels: string[];
    datasets: {
      data: number[];
      color?: (opacity: number) => string;
      strokeWidth?: number;
      withDots?: boolean;
      withScrollableDot?: boolean;
    }[];
  }

  export interface BarChartData {
    labels: string[];
    datasets: {
      data: number[];
      colors?: string[];
      strokeWidth?: number;
    }[];
  }

  export interface PieChartData {
    name: string;
    population?: number;
    value?: number;
    color: string;
    legendFontColor?: string;
    legendFontSize?: number;
  }

  export interface ContributionGraphData {
    date: string;
    count: number;
    color?: string;
  }

  export interface RadarChartData {
    labels: string[];
    datasets: {
      data: number[];
      color?: string;
      strokeWidth?: number;
    }[];
  }

  export class LineChart extends React.Component<
    AbstractChartProps & {
      data: LineChartData;
      bezier?: boolean;
      getDotColor?: (dataPoint: number, index: number) => string;
      renderDotContent?: (params: {
        x: number;
        y: number;
        index: number;
        indexData: number;
      }) => React.ReactNode;
    }
  > {}

  export class BarChart extends React.Component<
    AbstractChartProps & {
      data: BarChartData;
      showValuesOnTopOfBars?: boolean;
      showBarTops?: boolean;
    }
  > {}

  export class PieChart extends React.Component<
    AbstractChartProps & {
      data: PieChartData[];
      accessor: string;
      backgroundColor?: string;
      paddingLeft?: string;
      center?: [number, number];
      absolute?: boolean;
    }
  > {}

  export class ContributionGraph extends React.Component<
    AbstractChartProps & {
      values: ContributionGraphData[];
      endDate: Date;
      numDays: number;
      squareSize?: number;
      gutterSize?: number;
      showMonthLabels?: boolean;
      tooltipDataAttrs?: (value: { date: string; count: number }) => any;
    }
  > {}

  export class ProgressChart extends React.Component<
    AbstractChartProps & {
      data: {
        labels?: string[];
        data: number[];
        colors?: string[];
      };
      hideLegend?: boolean;
    }
  > {}

  export class StackedBarChart extends React.Component<
    AbstractChartProps & {
      data: {
        labels: string[];
        legend: string[];
        data: number[][];
        barColors: string[];
      };
      hideLegend?: boolean;
    }
  > {}

  export class RadarChart extends React.Component<
    AbstractChartProps & {
      data: RadarChartData;
      transparent?: boolean;
    }
  > {}
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
  }

  export class StabilityAI {
    constructor(config: StabilityAIConfig);
    generate(options: GenerationOptions): Promise<any>;
  }
}

declare module 'replicate' {
  interface ReplicateConfig {
    auth: string;
    baseUrl?: string;
  }

  interface RunOptions {
    model: string;
    input: Record<string, any>;
  }

  export default class Replicate {
    constructor(config: ReplicateConfig);
    run(options: RunOptions): Promise<any>;
  }
}

declare module '@elastic/apm-rum' {
  interface APMConfig {
    serviceName: string;
    serverUrl: string;
    environment?: string;
    active?: boolean;
    logLevel?: 'trace' | 'debug' | 'info' | 'warn' | 'error';
  }

  interface Transaction {
    name: string;
    type: string;
    result?: string;
    outcome?: 'success' | 'failure' | 'unknown';
    addLabels(labels: Record<string, any>): void;
    end(endTime?: number): void;
  }

  interface Span {
    name: string;
    type: string;
    subtype?: string;
    action?: string;
    addLabels(labels: Record<string, any>): void;
    end(endTime?: number): void;
  }

  export function init(config: APMConfig): void;
  export function setUserContext(user: Record<string, any>): void;
  export function setCustomContext(context: Record<string, any>): void;
  export function addLabels(labels: Record<string, any>): void;
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
  interface SentryConfig {
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
  export function setContext(
    name: string,
    context: Record<string, any> | null
  ): void;
  export function addBreadcrumb(breadcrumb: Record<string, any>): void;
  export function configureScope(callback: (scope: any) => void): void;
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

declare module 'expo-linear-gradient' {
  import { ViewProps } from 'react-native';
  import React from 'react';

  interface LinearGradientProps extends ViewProps {
    colors: string[];
    start?: { x: number; y: number };
    end?: { x: number; y: number };
    locations?: number[];
  }

  export class LinearGradient extends React.Component<LinearGradientProps> {}
}

declare module 'expo-camera' {
  import { ViewProps } from 'react-native';
  import React from 'react';

  interface CameraProps extends ViewProps {
    type?: number;
    flashMode?: number;
    autoFocus?: boolean;
    zoom?: number;
  }

  export class Camera extends React.Component<CameraProps> {
    static Constants: {
      Type: { front: number; back: number };
      FlashMode: { on: number; off: number; auto: number; torch: number };
    };

    static requestCameraPermissionsAsync(): Promise<{
      status: 'granted' | 'denied';
    }>;
    takePictureAsync(options?: { quality?: number }): Promise<{ uri: string }>;
    recordAsync(options?: { quality?: number }): Promise<{ uri: string }>;
    stopRecording(): void;
  }
}

declare module 'expo-image-picker' {
  interface ImagePickerOptions {
    mediaTypes?: 'Images' | 'Videos' | 'All';
    allowsEditing?: boolean;
    aspect?: [number, number];
    quality?: number;
  }

  interface ImagePickerResult {
    cancelled: boolean;
    uri?: string;
    width?: number;
    height?: number;
    type?: 'image' | 'video';
    duration?: number;
    base64?: string;
    exif?: Record<string, any>;
  }

  export const MediaTypeOptions: {
    Images: 'Images';
    Videos: 'Videos';
    All: 'All';
  };

  export function launchImageLibraryAsync(
    options?: ImagePickerOptions
  ): Promise<ImagePickerResult>;
  export function launchCameraAsync(
    options?: ImagePickerOptions
  ): Promise<ImagePickerResult>;
  export function requestMediaLibraryPermissionsAsync(): Promise<{
    status: 'granted' | 'denied';
  }>;
  export function requestCameraPermissionsAsync(): Promise<{
    status: 'granted' | 'denied';
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
  export function mergeItem(key: string, value: string): Promise<void>;
  export function flushGetRequests(): void;
}
