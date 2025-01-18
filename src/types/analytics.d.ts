declare module '../utils/analytics' {
  export interface AnalyticsEvent {
    name: string;
    properties?: Record<string, any>;
    timestamp?: number;
  }

  export interface AnalyticsUser {
    id: string;
    traits?: Record<string, any>;
  }

  export function track(event: AnalyticsEvent): void;
  export function identify(user: AnalyticsUser): void;
  export function page(name: string, properties?: Record<string, any>): void;
  export function reset(): void;
}
