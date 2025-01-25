declare module 'detox' {
  export interface DetoxConfig {
    testRunner?: {
      args?: {
        $0: string;
        config?: string;
        debug?: boolean;
        t?: string;
        u?: boolean;
        runInBand?: boolean;
      };
      jest?: {
        setupTimeout?: number;
        teardownTimeout?: number;
        retries?: number;
      };
    };
    behavior?: {
      init?: {
        exposeGlobals?: boolean;
        reinstallApp?: boolean;
      };
    };
    apps?: {
      [appName: string]: {
        type: string;
        binaryPath: string;
        build: string;
        name?: string;
      };
    };
    devices?: {
      [deviceName: string]: {
        type: string;
        device: {
          type: string;
          os: string;
        };
      };
    };
    configurations?: {
      [configName: string]: {
        device: string;
        app: string;
      };
    };
  }

  export interface Device {
    reloadReactNative(): Promise<void>;
    launchApp(params?: { newInstance?: boolean }): Promise<void>;
    terminateApp(): Promise<void>;
    sendToHome(): Promise<void>;
    getBundleId(): Promise<string>;
    installApp(): Promise<void>;
    uninstallApp(): Promise<void>;
    openURL(url: string): Promise<void>;
    takeScreenshot(name: string): Promise<void>;
    setLocation(lat: number, lon: number): Promise<void>;
    setURLBlacklist(urlList: string[]): Promise<void>;
    enableSynchronization(): Promise<void>;
    disableSynchronization(): Promise<void>;
    setOrientation(orientation: 'portrait' | 'landscape'): Promise<void>;
    shake(): Promise<void>;
  }

  export interface Element {
    tap(): Promise<void>;
    tapAtPoint(point: { x: number; y: number }): Promise<void>;
    longPress(duration?: number): Promise<void>;
    multiTap(times: number): Promise<void>;
    tapBackspaceKey(): Promise<void>;
    tapReturnKey(): Promise<void>;
    typeText(text: string): Promise<void>;
    replaceText(text: string): Promise<void>;
    clearText(): Promise<void>;
    scroll(
      pixels: number,
      direction: 'up' | 'down' | 'left' | 'right'
    ): Promise<void>;
    scrollTo(edge: 'top' | 'bottom' | 'left' | 'right'): Promise<void>;
    swipe(
      direction: 'up' | 'down' | 'left' | 'right',
      speed?: 'fast' | 'slow'
    ): Promise<void>;
    setColumnToValue(column: number, value: string): Promise<void>;
    setDatePickerDate(dateString: string, dateFormat?: string): Promise<void>;
    pinch(scale: number, speed?: 'fast' | 'slow'): Promise<void>;
    getAttributes(): Promise<{
      text?: string;
      label?: string;
      placeholder?: string;
      value?: string;
      enabled?: boolean;
      visible?: boolean;
      identifier?: string;
    }>;
  }

  export interface ExpectElement {
    toBeVisible(): Promise<void>;
    toBeNotVisible(): Promise<void>;
    toExist(): Promise<void>;
    toNotExist(): Promise<void>;
    toHaveText(text: string): Promise<void>;
    toHaveLabel(label: string): Promise<void>;
    toHaveId(id: string): Promise<void>;
    toHaveValue(value: string): Promise<void>;
    toBeFocused(): Promise<void>;
    toBeEnabled(): Promise<void>;
    toBeDisabled(): Promise<void>;
  }

  export interface Expect {
    (element: Element): ExpectElement;
  }

  export interface By {
    id(id: string): Element;
    type(type: string): Element;
    text(text: string): Element;
    label(label: string): Element;
    traits(traits: string[]): Element;
  }

  export interface WaitForOptions {
    timeout?: number;
  }

  export interface WaitFor {
    (element: Element): {
      toBeVisible(options?: WaitForOptions): Promise<void>;
      toBeNotVisible(options?: WaitForOptions): Promise<void>;
      toExist(options?: WaitForOptions): Promise<void>;
      toNotExist(options?: WaitForOptions): Promise<void>;
      toHaveText(text: string, options?: WaitForOptions): Promise<void>;
    };
  }

  export const device: Device;
  export const element: By;
  export const expect: Expect;
  export const waitFor: WaitFor;

  export function init(config?: DetoxConfig): Promise<void>;
  export function cleanup(): Promise<void>;
  export function beforeEach(): Promise<void>;
  export function afterEach(): Promise<void>;
}
