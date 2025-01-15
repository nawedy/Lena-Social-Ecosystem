# Environment Setup Guide

This guide explains how to obtain and configure the environment variables required for TikTokToe.

## Core Services

### Firebase Configuration
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or select existing project
3. Navigate to Project Settings > General
4. Under "Your apps", create a new web app
5. Copy the configuration values:
   - `FIREBASE_API_KEY`
   - `FIREBASE_AUTH_DOMAIN`
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_STORAGE_BUCKET`
   - `FIREBASE_MESSAGING_SENDER_ID`
   - `FIREBASE_APP_ID`

### OpenAI Configuration
1. Visit [OpenAI Platform](https://platform.openai.com/)
2. Create an account or sign in
3. Go to API Keys section
4. Create a new API key
5. Copy the key as `OPENAI_API_KEY`
6. Find your Organization ID in Organization Settings as `OPENAI_ORG_ID`

### Bluesky Configuration
1. Go to [Bluesky](https://bsky.app)
2. Sign in to your account
3. Navigate to Settings > App Passwords
4. Create a new app password
5. Copy your handle as `BSKY_HANDLE`
6. Save the generated password as `BSKY_APP_PASSWORD`

## Social Media Integration

### Twitter API
1. Go to [Twitter Developer Portal](https://developer.twitter.com/)
2. Create a Developer Account
3. Create a new Project and App
4. Navigate to Keys and Tokens
5. Generate and copy:
   - `TWITTER_API_KEY`
   - `TWITTER_API_SECRET`
   - `TWITTER_ACCESS_TOKEN`
   - `TWITTER_ACCESS_SECRET`

### Instagram API
1. Visit [Meta for Developers](https://developers.facebook.com/)
2. Create a new app or select existing app
3. Add Instagram Basic Display
4. Generate and copy `INSTAGRAM_ACCESS_TOKEN`

### TikTok API
1. Go to [TikTok for Developers](https://developers.tiktok.com/)
2. Create a new app
3. Copy the following:
   - `TIKTOK_CLIENT_KEY`
   - `TIKTOK_CLIENT_SECRET`
4. Generate access token and save as `TIKTOK_ACCESS_TOKEN`

## Security and Authentication

### JWT Configuration
1. Generate a strong secret key:
   ```bash
   openssl rand -base64 32
   ```
2. Save as `JWT_SECRET`
3. Set `JWT_EXPIRY` (e.g., "24h", "7d")

### Encryption
1. Generate encryption key:
   ```bash
   openssl rand -base64 32
   ```
2. Save as `ENCRYPTION_KEY`

## Email and Notifications

### SMTP Configuration
1. Choose an email service provider (e.g., SendGrid, Amazon SES)
2. Set up an account and verify domain
3. Configure the following:
   - `SMTP_HOST`
   - `SMTP_PORT`
   - `SMTP_USER`
   - `SMTP_PASS`
   - `EMAIL_FROM`

### Slack Integration
1. Go to [Slack API](https://api.slack.com/apps)
2. Create a new app
3. Add Incoming Webhooks
4. Copy webhook URL as `SLACK_WEBHOOK_URL`

### Discord Integration
1. Open Discord Server Settings
2. Navigate to Integrations > Webhooks
3. Create a new webhook
4. Copy webhook URL as `DISCORD_WEBHOOK_URL`

## Monitoring and Analytics

### Sentry
1. Sign up at [Sentry.io](https://sentry.io)
2. Create a new project
3. Copy DSN as `SENTRY_DSN`

### DataDog
1. Sign up at [DataDog](https://www.datadoghq.com/)
2. Navigate to Organization Settings
3. Copy API key as `DATADOG_API_KEY`

### New Relic
1. Sign up at [New Relic](https://newrelic.com/)
2. Create a new application
3. Copy license key as `NEWRELIC_LICENSE_KEY`

## Storage and Caching

### Redis
1. Set up Redis instance (local or cloud service)
2. Configure connection URL as `REDIS_URL`

### AWS S3 (Backup Storage)
1. Create AWS account
2. Create S3 bucket
3. Configure:
   - `BACKUP_STORAGE_PROVIDER=aws`
   - `BACKUP_BUCKET`

## Development Setup

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Fill in the values following this guide

3. For development, set:
   ```
   DEBUG=true
   DEV_PORT=3000
   API_BASE_URL=http://localhost:3000
   ```

## Testing Configuration

1. Set up test environment:
   ```
   TEST_MODE=true
   TEST_DATABASE_URL=your_test_db_url
   MOCK_SERVICES=true
   ```

2. Configure test parameters:
   ```
   TEST_TIMEOUT=5000
   TEST_RETRY_COUNT=3
   TEST_PARALLEL_RUNS=4
   ```

## Validation

Run the environment validation script:
```bash
npm run validate-env
```

## Security Notes

1. Never commit `.env` file to version control
2. Rotate secrets periodically
3. Use different values for development, staging, and production
4. Enable MFA where possible
5. Regularly audit access and permissions

## Troubleshooting

If you encounter issues:

1. Check if all required variables are set
2. Verify API keys and secrets are valid
3. Ensure services are accessible from your network
4. Check rate limits and quotas
5. Review service status pages
6. Check application logs

## Support

For additional help:
- Create an issue in the repository
- Contact support@tiktoktoe.com
- Join our Discord community
