declare module '@storybook/react-native' {
  import { ComponentType, ReactNode } from 'react';

  export interface StorybookConfig {
    stories: string[];
    addons: (string | { name: string; options: any })[];
    framework: string;
  }

  export interface Preview {
    parameters: any;
    decorators: any[];
  }

  export interface Meta<T> {
    title: string;
    component: ComponentType<T>;
    parameters?: {
      [key: string]: any;
      actions?: { argTypesRegex?: string };
      controls?: { expanded?: boolean };
      backgrounds?: {
        default?: string;
        values?: Array<{ name: string; value: string }>;
      };
    };
    decorators?: ((Story: any) => ReactNode)[];
    argTypes?: {
      [key: string]: {
        control?: {
          type?: string;
          options?: any[];
        };
        description?: string;
        defaultValue?: any;
        table?: {
          type?: { summary: string };
          defaultValue?: { summary: string };
        };
        action?: string;
      };
    };
    args?: Partial<T>;
  }

  export interface Story<T> {
    (args: T): ReactNode;
    args?: Partial<T>;
    decorators?: ((Story: any) => ReactNode)[];
    parameters?: {
      [key: string]: any;
    };
    play?: () => Promise<void>;
    name?: string;
  }

  export type StoryObj<T> = Story<T>;
  export type StoryFn<T> = (args: T) => ReactNode;
  export type ArgTypes<T> = Meta<T>['argTypes'];

  export function storiesOf(kind: string, module: NodeModule): StoryAPI;
  export function addDecorator(decorator: (story: any) => ReactNode): void;
  export function addParameters(parameters: any): void;
  export function configure(loader: () => void, module: NodeModule): void;

  export interface StoryAPI {
    add(storyName: string, story: (context?: any) => ReactNode): this;
    addDecorator(decorator: (story: any) => ReactNode): this;
    addParameters(parameters: any): this;
  }
}

declare module '@storybook/addon-ondevice-backgrounds' {
  export interface BackgroundConfig {
    name: string;
    value: string;
  }

  export interface BackgroundParameter {
    default?: string;
    values: BackgroundConfig[];
  }

  export const backgrounds: {
    default: string;
    values: BackgroundConfig[];
  };
}

declare module '@storybook/addon-ondevice-actions' {
  export function action(name: string): (...args: any[]) => void;
  export function actions(names: string[]): {
    [key: string]: (...args: any[]) => void;
  };
}

declare module '@storybook/addon-ondevice-controls' {
  export interface ControlConfig {
    type: string;
    options?: any[];
    min?: number;
    max?: number;
    step?: number;
  }

  export interface ControlsParameter {
    expanded?: boolean;
    sort?: 'alpha' | 'requiredFirst';
  }
}

declare module '@storybook/addon-ondevice-notes' {
  export interface NotesParameter {
    markdown?: string;
    text?: string;
  }
}
