# Lena Audio Platform

A decentralized music streaming platform built with SvelteKit, featuring Web3 integration, IPFS storage, and privacy-focused design.

## Features

- 🎵 Decentralized music streaming with IPFS storage
- 🔒 Web3 authentication with Sign-in with Ethereum (SIWE)
- 💰 NFT-based monetization and licensing
- 🌐 Progressive Web App (PWA) support
- 🎨 Beautiful, responsive UI with Tailwind CSS
- 📱 Cross-platform compatibility
- 🔄 Offline support with service workers
- 🔍 Advanced search and discovery
- 📊 Privacy-focused analytics
- 🎚️ Professional audio processing

## Tech Stack

- **Frontend**: SvelteKit, Tailwind CSS
- **Backend**: Supabase
- **Storage**: IPFS via Web3.Storage
- **Authentication**: Magic.link, SIWE
- **Database**: PostgreSQL
- **Analytics**: Plausible
- **Payments**: Stripe Connect, Lightning Network
- **CI/CD**: GitHub Actions
- **Hosting**: Vercel

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm 8+
- PostgreSQL 15+
- Git

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/lena-audio.git
   cd lena-audio
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. Start the development server:
   ```bash
   pnpm dev
   ```

5. Open [http://localhost:5173](http://localhost:5173) in your browser.

### Environment Variables

Required environment variables:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/lena_audio
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
WEB3_STORAGE_TOKEN=your_web3_storage_token
MAGIC_PUBLISHABLE_KEY=your_magic_publishable_key
STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
STRIPE_SECRET_KEY=your_stripe_secret_key
```

## Development

### Project Structure

```
apps/audio/
├── src/
│   ├── lib/
│   │   ├── components/    # Reusable components
│   │   ├── services/      # Business logic
│   │   ├── stores/        # State management
│   │   ├── types/         # TypeScript types
│   │   └── utils/         # Helper functions
│   ├── routes/            # SvelteKit routes
│   └── static/            # Static assets
├── tests/                 # Test files
└── package.json
```

### Commands

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm preview` - Preview production build
- `pnpm test` - Run tests
- `pnpm lint` - Lint code
- `pnpm format` - Format code

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support, email support@lena.app or join our [Discord community](https://discord.gg/lena-audio).

## Acknowledgments

- [SvelteKit](https://kit.svelte.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Supabase](https://supabase.com/)
- [IPFS](https://ipfs.io/)
- [Web3.Storage](https://web3.storage/)
- [Magic.link](https://magic.link/)
- [Stripe](https://stripe.com/)
- [Lightning Network](https://lightning.network/) 