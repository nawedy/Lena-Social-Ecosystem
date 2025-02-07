# Lena - Privacy-First Social Platform

A decentralized social networking ecosystem built with privacy and security at its core.

## Project Structure

```
lena/
├── apps/                # Platform-specific applications
│   ├── core/           # Main web application
│   ├── discourse/      # Debate & discussion platform
│   ├── creators/       # Creator platform
│   ├── echo/          # Microblogging platform
│   ├── connect/       # Professional networking
│   └── agora/         # Marketplace & commerce
├── packages/          # Shared packages
│   ├── ui/            # UI components
│   ├── auth/          # Authentication
│   ├── storage/       # IPFS & decentralized storage
│   ├── blockchain/    # Web3 functionality
│   └── shared/        # Common utilities
└── services/         # Backend services
    ├── user/         # User management
    ├── content/      # Content handling
    └── analytics/    # Privacy-first analytics
```

## Tech Stack

- **Frontend**: Svelte, TailwindCSS, Three.js
- **Backend**: Supabase, GraphQL
- **Authentication**: Web3, Magic.link, AT Protocol
- **Storage**: IPFS, Web3.Storage
- **Database**: PostgreSQL (via Supabase)
- **Build Tools**: Turbo, Vite
- **Testing**: Vitest
- **Analytics**: Plausible Analytics

## Getting Started

1. Prerequisites:
   - Node.js >= 18
   - npm >= 10
   - Git

2. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/lena.git
   cd lena
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

5. Start development server:
   ```bash
   npm run dev
   ```

## Development Workflow

- **Adding a new package**:
  ```bash
  cd packages
  mkdir my-package
  cd my-package
  npm init
  ```

- **Running tests**:
  ```bash
  npm test              # Run all tests
  npm test -- --watch  # Watch mode
  ```

- **Building**:
  ```bash
  npm run build        # Build all packages
  ```

- **Linting**:
  ```bash
  npm run lint        # Lint all files
  npm run format     # Format all files
  ```

## Contributing

1. Create a new branch:
   ```bash
   git checkout -b feature/my-feature
   ```

2. Make your changes and commit:
   ```bash
   git commit -m "feat: add new feature"
   ```

3. Push to your branch:
   ```bash
   git push origin feature/my-feature
   ```

4. Open a Pull Request

## Deployment

The project is deployed using Vercel:

- Production: [https://lena.app](https://lena.app)
- Staging: [https://staging.lena.app](https://staging.lena.app)

## License

MIT

## Security

For security issues, please email security@lena.app
