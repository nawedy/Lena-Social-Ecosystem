declare module 'detox' {
  export interface Device {
    setOffline: any;
    selectImages: any;
    selectImage: any;
    launchApp(params?: {}): Promise<void>;
    reloadReactNative(): Promise<void>;
    getPlatform(): string;
  }

  export interface Element {
    tap(): Promise<void>;
    typeText(text: string): Promise<void>;
    setDate(date: string): Promise<void>;
    setTime(time: string): Promise<void>;
    setDateTime(datetime: string): Promise<void>;
  }

  export interface ExpectElement {
    toBeVisible(): Promise<void>;
    toHaveText(text: string): Promise<void>;
    toHaveProps(props: object): Promise<void>;
    not: ExpectElement;
  }

  export interface By {
    id(id: string): any;
    type(type: string): any;
    text(text: string): any;
  }

  export const device: Device;
  export const element: (matcher: any) => Element;
  export const expect: (element: Element) => ExpectElement;
  export const by: By;
}
