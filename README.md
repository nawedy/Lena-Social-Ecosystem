# Lena Ecosystem

A decentralized social networking ecosystem integrating multiple content-sharing platforms.

## Project Structure

```
lena/
├── apps/                # Platform-specific applications
│   ├── short-video/    # TikTok-style platform
│   ├── image-sharing/  # Instagram-style platform
│   ├── long-video/    # YouTube-style platform
│   ├── audio/         # Spotify-style platform
│   ├── discourse/     # Twitter-style debates
│   ├── creators/      # Patreon-style creator platform
│   ├── echo/          # Microblogging & news
│   ├── connect/       # Professional networking
│   └── agora/         # Marketplace & commerce
├── packages/           # Shared packages
│   ├── ui/            # Shared UI components
│   ├── auth/          # Authentication
│   ├── storage/       # IPFS integration
│   ├── blockchain/    # Web3 functionality
│   ├── feed/          # Shared feed logic
│   └── shared/        # Common utilities
└── services/          # Backend services
    ├── user/          # User management
    ├── content/       # Content handling
    └── analytics/     # Privacy-first analytics
```

## Tech Stack

- **Frontend**: Svelte, Flutter Web
- **Backend**: Supabase, Hasura (GraphQL)
- **Authentication**: AT Protocol, Magic.link, Web3
- **Storage**: IPFS, Fleek
- **Database**: PostgreSQL (via Supabase)
- **Analytics**: Privacy-first analytics with Plausible

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Build all packages:
   ```bash
   npm run build
   ```

3. Start development server:
   ```bash
   npm run dev
   ```

## Development Guidelines

- Follow the Secure AI Developer Guidelines for all implementations
- Use TypeScript for type safety
- Write tests for all new features
- Follow the established design system
- Ensure privacy-first approach in all features

## UI Components

The shared UI components package (`@lena/ui-components`) provides a consistent design system across all platforms. To use components in your app:

```typescript
import { Button } from '@lena/ui-components';
```

## Contributing

1. Create a new branch for your feature
2. Make your changes
3. Submit a pull request
4. Ensure all tests pass
5. Get code review

## License

MIT
