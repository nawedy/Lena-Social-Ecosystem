# Contributing to TikTokToe

First off, thank you for considering contributing to TikTokToe! It's people like you that make TikTokToe such a great platform.

## Code of Conduct

By participating in this project, you are expected to uphold our [Code of Conduct](./CODE_OF_CONDUCT.md).

## Development Process

We use GitHub to host code, to track issues and feature requests, as well as accept pull requests.

1. Fork the repo and create your branch from `main`.
2. If you've added code that should be tested, add tests.
3. If you've changed APIs, update the documentation.
4. Ensure the test suite passes.
5. Make sure your code lints.
6. Issue that pull request!

## Pull Request Process

1. Update the README.md with details of changes to the interface, if applicable.
2. Update the documentation with details of any changes to functionality.
3. The PR will be merged once you have the sign-off of at least one other developer.

## Development Setup

1. Install dependencies:
```bash
npm install
```

2. Set up pre-commit hooks:
```bash
npm run prepare
```

3. Start the development environment:
```bash
npm run dev
```

## Coding Style

- We use Prettier for code formatting
- We follow the TypeScript strict mode guidelines
- Components should be written in Svelte
- Use functional programming principles where possible
- Write self-documenting code with clear variable names

## Testing

- Write unit tests for all new functionality
- Include integration tests for API endpoints
- Add E2E tests for critical user paths
- Maintain test coverage above 80%

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:e2e
```

## Commit Messages

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation only changes
- `style:` Changes that don't affect the meaning of the code
- `refactor:` Code change that neither fixes a bug nor adds a feature
- `perf:` Code change that improves performance
- `test:` Adding missing tests
- `chore:` Changes to the build process or auxiliary tools

Example:
```bash
feat(auth): add OAuth2 support for social login
```

## Branch Naming

- Feature branches: `feature/description`
- Bug fixes: `fix/description`
- Documentation: `docs/description`
- Performance improvements: `perf/description`

## Issue Reporting

- Use the issue templates when creating new issues
- Provide clear reproduction steps for bugs
- Include relevant logs and screenshots
- Tag issues appropriately

## Documentation

- Keep README.md up to date
- Document all public APIs
- Include JSDoc comments for functions
- Update changelog for significant changes

## Security

- Never commit sensitive credentials
- Report security vulnerabilities privately
- Follow secure coding practices
- Use approved security libraries

## Review Process

1. Code review checklist:
   - [ ] Tests pass
   - [ ] Code follows style guide
   - [ ] Documentation is updated
   - [ ] No security vulnerabilities
   - [ ] Performance impact considered

2. Review response time:
   - First response within 2 business days
   - Complete review within 5 business days

## Getting Help

- Join our [Discord community](https://discord.gg/tiktok-toe)
- Check the [documentation](https://docs.tiktok-toe.com)
- Ask in GitHub Discussions
- Email the maintainers

## Recognition

Contributors will be:
- Added to the Contributors list
- Mentioned in release notes
- Invited to the core team (for significant contributions)

Thank you for contributing to TikTokToe! 🎉 