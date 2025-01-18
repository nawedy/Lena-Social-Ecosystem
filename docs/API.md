# TikTokToe API Documentation

## AT Protocol Integration

TikTokToe is built on top of the AT Protocol, providing a seamless migration path from TikTok to the decentralized social network.

### Migration Service

#### Start Migration
```typescript
POST /api/migration/start
{
  "tiktokUsername": string,
  "options": {
    "importVideos": boolean,
    "importFollowers": boolean,
    "importAnalytics": boolean,
    "preserveMetadata": boolean,
    "optimizeContent": boolean,
    "scheduleContent": boolean,
    "crossPostToTikTok": boolean
  }
}
```

Response:
```typescript
{
  "uri": string,
  "cid": string,
  "status": "pending" | "in_progress" | "completed" | "failed",
  "sourceUsername": string,
  "targetDid": string,
  "progress": {
    "current": number,
    "total": number,
    "currentStep": string
  }
}
```

#### Get Migration Status
```typescript
GET /api/migration/:uri
```

Response:
```typescript
{
  "uri": string,
  "cid": string,
  "status": "pending" | "in_progress" | "completed" | "failed",
  "progress": {
    "current": number,
    "total": number,
    "currentStep": string
  },
  "stats": {
    "videosImported": number,
    "followersImported": number,
    "engagementMetricsImported": boolean,
    "scheduledPosts": number
  }
}
```

### Error Handling

#### Error Record Structure
```typescript
{
  "uri": string,
  "cid": string,
  "type": "api" | "network" | "validation" | "auth" | "unknown",
  "code": string,
  "message": string,
  "context"?: Record<string, any>,
  "stackTrace"?: string,
  "timestamp": string,
  "resolved": boolean,
  "resolution"?: {
    "action": string,
    "timestamp": string,
    "notes"?: string
  }
}
```

### Caching and Rate Limiting

The API implements intelligent caching and rate limiting:

- Cache TTL: 5 minutes by default
- Rate Limit: 100 requests per minute per user
- Offline support with cached data
- Real-time updates via AT Protocol subscriptions

## Authentication

TikTokToe uses AT Protocol's authentication system:

```typescript
const agent = new BskyAgent({
  service: 'https://bsky.social'
});

await agent.login({
  identifier: 'username',
  password: 'password'
});
```

## WebSocket Events

Real-time updates are available through WebSocket connections:

```typescript
const subscription = await agent.api.app.bsky.feed.subscribeToUpdates({
  filter: { key: 'migration-status' }
});

subscription.on('update', (data) => {
  // Handle real-time update
});
```

## Error Codes

| Code | Description |
|------|-------------|
| `MIGRATION_001` | Invalid TikTok username |
| `MIGRATION_002` | Failed to fetch TikTok data |
| `MIGRATION_003` | AT Protocol connection error |
| `MIGRATION_004` | Rate limit exceeded |
| `MIGRATION_005` | Invalid migration options |

## Best Practices

1. **Rate Limiting**
   - Implement exponential backoff
   - Cache frequently accessed data
   - Use bulk operations when possible

2. **Error Handling**
   - Always check response status
   - Implement retry logic
   - Log errors with context

3. **Offline Support**
   - Cache essential data
   - Queue operations when offline
   - Sync when connection restored

4. **Performance**
   - Use pagination for large datasets
   - Implement request batching
   - Optimize payload size
