# End-to-End Testing Documentation

## Overview

This directory contains end-to-end tests for the core platform using Playwright. The tests cover all major functionality including authentication, feed, profile, settings, notifications, analytics, and payments.

## Test Structure

```
tests/e2e/
├── README.md
├── fixtures.ts
├── global-setup.ts
├── global-teardown.ts
├── utils.ts
├── test.env
├── auth.test.ts
├── feed.test.ts
├── profile.test.ts
├── settings.test.ts
├── notifications.test.ts
├── analytics.test.ts
└── payment.test.ts
```

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set up test environment:
```bash
cp test.env .env.test
```

3. Configure test environment variables in `.env.test`

4. Start test database:
```bash
docker-compose -f docker-compose.test.yml up -d
```

## Running Tests

### Run all tests:
```bash
npm run test:e2e
```

### Run specific test file:
```bash
npm run test:e2e tests/e2e/auth.test.ts
```

### Run tests in headed mode:
```bash
npm run test:e2e -- --headed
```

### Run tests in debug mode:
```bash
npm run test:e2e -- --debug
```

## Test Categories

### Authentication Tests
- Sign up flow
- Sign in flow
- Password reset
- OAuth authentication
- Session management

### Feed Tests
- Feed loading
- Infinite scroll
- Content filtering
- Content interaction (likes, comments, shares)
- Content creation

### Profile Tests
- Profile information display
- Profile editing
- Privacy settings
- Activity history
- Followers/Following management

### Settings Tests
- Account settings
- Privacy settings
- Notification preferences
- Security settings
- Language preferences
- Accessibility settings

### Notification Tests
- Notification display
- Real-time updates
- Notification preferences
- Notification actions
- Notification filtering

### Analytics Tests
- Dashboard display
- Metrics calculation
- Date range filtering
- Data export
- Real-time analytics

### Payment Tests
- Payment method management
- Subscription handling
- One-time purchases
- Refund processing
- Billing history

## Test Utilities

### Fixtures (`fixtures.ts`)
- Common test fixtures
- Test data setup
- Test cleanup

### Utils (`utils.ts`)
- Helper functions
- Test data generation
- Common assertions
- UI interaction helpers

### Global Setup (`global-setup.ts`)
- Test environment setup
- Database initialization
- Test user creation

### Global Teardown (`global-teardown.ts`)
- Test environment cleanup
- Database cleanup
- File cleanup

## Best Practices

1. **Test Independence**
   - Each test should be independent
   - Clean up test data after each test
   - Don't rely on test order

2. **Test Data**
   - Use unique test data for each test
   - Clean up test data after use
   - Use meaningful test data names

3. **Assertions**
   - Use explicit assertions
   - Check both positive and negative cases
   - Verify state changes

4. **Performance**
   - Minimize test duration
   - Use parallel test execution
   - Optimize test setup/teardown

5. **Maintenance**
   - Use data-testid for selectors
   - Keep tests focused and simple
   - Document complex test scenarios

## Common Issues

1. **Flaky Tests**
   - Use proper wait conditions
   - Handle async operations correctly
   - Add retry logic for unstable operations

2. **Database State**
   - Clean up test data properly
   - Use transactions for data operations
   - Handle foreign key constraints

3. **Network Issues**
   - Mock external services
   - Handle network errors
   - Use proper timeouts

## Debugging

1. **Visual Debugging**
   ```bash
   npm run test:e2e -- --headed --debug
   ```

2. **Test Reports**
   - HTML reports in `test-results/`
   - Screenshots in `test-results/screenshots/`
   - Videos in `test-results/videos/`

3. **Logs**
   - Test logs in `test-results/logs/`
   - Browser console logs
   - Network request logs

## CI/CD Integration

1. **GitHub Actions**
   ```yaml
   - name: Run E2E Tests
     run: npm run test:e2e
     env:
       CI: true
   ```

2. **Test Reports**
   - Upload test results as artifacts
   - Generate test summary
   - Track test coverage

## Contributing

1. **Adding Tests**
   - Follow existing test patterns
   - Add proper documentation
   - Include both positive and negative cases

2. **Code Review**
   - Ensure test independence
   - Check for proper cleanup
   - Verify error handling

3. **Maintenance**
   - Keep tests up to date
   - Remove obsolete tests
   - Update documentation

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Testing Best Practices](https://playwright.dev/docs/best-practices)
- [API Reference](https://playwright.dev/docs/api/class-test)
- [Test Examples](https://github.com/microsoft/playwright/tree/main/examples)

## Support

For issues and questions:
- Create an issue in the repository
- Contact the development team
- Check the troubleshooting guide