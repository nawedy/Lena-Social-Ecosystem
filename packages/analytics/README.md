# @lena/analytics

A privacy-focused analytics package for tracking content engagement and user behavior, with support for multiple analytics providers and advanced reporting capabilities.

## Features

- 🔒 Privacy-First Analytics
  - GDPR-compliant tracking
  - IP anonymization
  - Respect Do Not Track
  - Self-hosted options

- 📊 Multiple Analytics Providers
  - Plausible Analytics (default)
  - PostHog
  - Ackee
  - Mixpanel
  - Amplitude
  - Supabase

- 📈 Content Analytics
  - View tracking
  - Engagement metrics
  - Watch time analysis
  - Retention curves
  - Demographics
  - Device analytics
  - Referrer tracking

- 👥 User Analytics
  - Session tracking
  - User preferences
  - Viewing history
  - Interaction patterns
  - Engagement scoring

- 📋 Advanced Reporting
  - Custom date ranges
  - Trend analysis
  - Comparative metrics
  - Real-time analytics
  - Segmentation

## Installation

```bash
pnpm add @lena/analytics
```

## Usage

### Basic Usage

```typescript
import { AnalyticsService, DEFAULT_ANALYTICS_CONFIG } from '@lena/analytics';

// Initialize the service
const analytics = new AnalyticsService({
  ...DEFAULT_ANALYTICS_CONFIG,
  plausible: {
    domain: 'your-domain.com'
  }
});

// Initialize (required before tracking)
await analytics.initialize();

// Track an event
await analytics.trackEvent('button_click', {
  buttonId: 'signup',
  location: 'header'
});
```

### Content Engagement Tracking

```typescript
// Track content view
await analytics.trackContentEngagement({
  contentId: '123',
  userId: 'user-456',
  sessionId: 'session-789',
  type: 'view',
  timestamp: new Date()
});

// Track watch time
await analytics.trackContentEngagement({
  contentId: '123',
  userId: 'user-456',
  sessionId: 'session-789',
  type: 'watch',
  duration: 180, // seconds
  progress: 0.75, // 75% watched
  timestamp: new Date()
});
```

### User Identification

```typescript
// Identify a user
await analytics.identifyUser({
  id: 'user-123',
  email: 'user@example.com',
  name: 'John Doe',
  plan: 'premium',
  signupDate: '2024-01-01'
});
```

### Analytics Reports

```typescript
// Get content analytics
const contentStats = await analytics.getContentAnalytics('content-123');
console.log(contentStats);
// {
//   views: 1000,
//   uniqueViews: 800,
//   likes: 150,
//   shares: 50,
//   comments: 75,
//   totalWatchTime: 50000,
//   averageWatchTime: 62.5,
//   completionRate: 0.85,
//   engagementRate: 0.275,
//   ...
// }

// Get user analytics
const userStats = await analytics.getUserAnalytics('user-123');
console.log(userStats);
// {
//   totalViews: 100,
//   totalLikes: 25,
//   totalShares: 10,
//   totalComments: 15,
//   averageEngagementRate: 0.5,
//   contentPreferences: [...],
//   viewingHistory: [...],
//   ...
// }

// Generate a report
const report = await analytics.generateReport(
  new Date('2024-01-01'),
  new Date('2024-01-31'),
  'day'
);
console.log(report);
// {
//   period: 'day',
//   startDate: '2024-01-01',
//   endDate: '2024-01-31',
//   metrics: {
//     totalEvents: { current: 5000, previous: 4500, change: 11.11 },
//     uniqueUsers: { current: 1200, previous: 1000, change: 20 },
//     ...
//   },
//   trends: {
//     events: { data: [...], trend: 15.5 },
//     users: { data: [...], trend: 22.3 }
//   }
// }
```

### Real-time Analytics

```typescript
// Get real-time analytics
const realtime = await analytics.getRealtimeAnalytics();
console.log(realtime);
// {
//   activeUsers: 150,
//   currentViews: 75,
//   popularContent: [
//     { contentId: '123', activeViews: 25, engagementRate: 0.8 },
//     ...
//   ],
//   recentEvents: [
//     { type: 'content_view', contentId: '456', timestamp: '...' },
//     ...
//   ]
// }
```

## API Reference

### AnalyticsService

The main class for tracking analytics.

```typescript
class AnalyticsService {
  constructor(config: AnalyticsConfig);
  
  async initialize(): Promise<void>;
  
  async trackEvent(
    eventName: string,
    properties?: EventProperties,
    userId?: string
  ): Promise<void>;
  
  async identifyUser(properties: UserProperties): Promise<void>;
  
  async trackContentEngagement(engagement: ContentEngagement): Promise<void>;
  
  async getContentAnalytics(contentId: string): Promise<ContentAnalytics>;
  
  async getUserAnalytics(userId: string): Promise<UserAnalytics>;
  
  async generateReport(
    startDate: Date,
    endDate: Date,
    period?: 'day' | 'week' | 'month' | 'year' | 'custom'
  ): Promise<AnalyticsReport>;
  
  async getRealtimeAnalytics(): Promise<RealtimeAnalytics>;
}
```

### AnalyticsConfig

Configuration options for the analytics service.

```typescript
interface AnalyticsConfig {
  provider: 'plausible' | 'posthog' | 'ackee' | 'mixpanel' | 'amplitude' | 'supabase';
  plausible?: {
    domain: string;
    apiHost?: string;
  };
  posthog?: {
    apiKey: string;
    host?: string;
  };
  ackee?: {
    server: string;
    domainId: string;
  };
  mixpanel?: {
    token: string;
  };
  amplitude?: {
    apiKey: string;
  };
  supabase?: {
    url: string;
    key: string;
  };
  options?: {
    debug?: boolean;
    disableInDevelopment?: boolean;
    anonymizeIp?: boolean;
    respectDoNotTrack?: boolean;
  };
}
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details. 