declare module 'detox' {
  export interface Device {
    reloadReactNative(): Promise<void>;
    launchApp(params?: {
      newInstance?: boolean;
      permissions?: { [key: string]: string };
    }): Promise<void>;
    terminateApp(): Promise<void>;
    sendToHome(): Promise<void>;
    getBundleId(): Promise<string>;
    installApp(): Promise<void>;
    uninstallApp(): Promise<void>;
    openURL(url: string): Promise<void>;
    getPlatform(): 'ios' | 'android';
    pressBack(): Promise<void>;
    shake(): Promise<void>;
    selectImage(image: string): Promise<void>;
    selectImages(images: string[]): Promise<void>;
    setLocation(lat: number, lon: number): Promise<void>;
    setURLBlacklist(urls: string[]): Promise<void>;
    enableSynchronization(): Promise<void>;
    disableSynchronization(): Promise<void>;
    setOrientation(orientation: 'portrait' | 'landscape'): Promise<void>;
    setOffline(offline: boolean): Promise<void>;
  }

  export interface Element {
    tap(): Promise<void>;
    tapAtPoint(point: { x: number; y: number }): Promise<void>;
    longPress(duration?: number): Promise<void>;
    multiTap(times: number): Promise<void>;
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
      speed?: 'slow' | 'fast',
      percentage?: number
    ): Promise<void>;
    setDatePickerDate(dateString: string, format?: string): Promise<void>;
    setSliderValue(value: number): Promise<void>;
    pinch(
      scale: number,
      speed?: 'slow' | 'fast',
      angle?: number
    ): Promise<void>;
    getAttributes(): Promise<{
      text: string;
      label: string;
      placeholder: string;
      value: string;
      enabled: boolean;
      identifier: string;
      visible: boolean;
    }>;
  }

  export interface ExpectElement {
    toBeVisible(): Promise<void>;
    toExist(): Promise<void>;
    toHaveText(text: string): Promise<void>;
    toHaveLabel(label: string): Promise<void>;
    toHaveId(id: string): Promise<void>;
    toHaveValue(value: string): Promise<void>;
    toHaveToggleEnabled(): Promise<void>;
    toBeEnabled(): Promise<void>;
    toBeDisabled(): Promise<void>;
    toBeFocused(): Promise<void>;
    toBeNotVisible(): Promise<void>;
    toNotExist(): Promise<void>;
    toBeSecureTextEntry(): Promise<void>;
    toHaveSliderPosition(position: number): Promise<void>;
    toBeNotFocused(): Promise<void>;
  }

  export interface WaitForOptions {
    timeout?: number;
    interval?: number;
  }

  export interface WaitFor {
    (element: Element): {
      toBeVisible(options?: WaitForOptions): Promise<void>;
      toExist(options?: WaitForOptions): Promise<void>;
      toHaveText(text: string, options?: WaitForOptions): Promise<void>;
      toHaveValue(value: string, options?: WaitForOptions): Promise<void>;
      toNotExist(options?: WaitForOptions): Promise<void>;
      toBeNotVisible(options?: WaitForOptions): Promise<void>;
    };
  }

  export interface By {
    id(id: string): Element;
    label(label: string): Element;
    text(text: string): Element;
    type(type: string): Element;
    traits(traits: string[]): Element;
  }

  export interface Expect {
    (element: Element): ExpectElement;
  }

  export const device: Device;
  export const element: By;
  export const expect: Expect;
  export const waitFor: WaitFor;

  export function init(config?: any): Promise<void>;
  export function cleanup(): Promise<void>;
  export function beforeEach(): Promise<void>;
  export function afterEach(): Promise<void>;
}
