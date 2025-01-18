import * as React from 'react';
import * as ReactNative from 'react-native';

declare global {
  // React Native types
  type TextInput = ReactNative.TextInput;
  type ActivityIndicator = ReactNative.ActivityIndicator;
  type Platform = ReactNative.Platform;
  type View = ReactNative.View;
  type Image = ReactNative.Image;

  // DOM types
  type File = globalThis.File;
  type HTMLCanvasElement = globalThis.HTMLCanvasElement;
  type CanvasRenderingContext2D = globalThis.CanvasRenderingContext2D;
  type HTMLImageElement = globalThis.HTMLImageElement;
  type PushSubscription = globalThis.PushSubscription;
  type Request = globalThis.Request;
  type HandlebarsTemplateDelegate<T = any> = (context: T) => string;
  type HTMLInputElement = globalThis.HTMLInputElement;
}
