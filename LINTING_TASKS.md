# Linting Tasks

## High Priority

### Remove Explicit `any` Types
1. `src/middleware/upload.ts`:
   - Line 16: Replace `_req: any, file: any, cb: any` with proper types
   - Add proper type definitions for multer and callback functions

2. `src/types/bigquery.d.ts`:
   - Replace all `any` types with proper BigQuery types
   - Add proper type definitions for metadata, query results, and table operations

3. `src/middleware/rateLimiter.ts`:
   - Line 68: Replace `req: any, _res: any, next: any` with Express types
   - Add proper request, response, and next function types

4. `src/App.tsx`:
   - Line 23: Replace `navigation: any` with proper navigation type from React Navigation

### Clean Up Unused Variables
1. `src/middleware/upload.ts`:
   - Remove or use `CloudinaryStorage` import
   - Remove or use `uuidv4` import

2. `src/core/identity/did.ts`:
   - Remove or use `AtpAgent` import

## Medium Priority

### Code Organization
1. Review and organize imports across all files
2. Ensure consistent naming conventions
3. Remove commented-out code

### Type Safety
1. Add proper return types to all functions
2. Add proper parameter types to all functions
3. Remove non-null assertions and handle nullability properly

## Low Priority

### Documentation
1. Add JSDoc comments to all exported functions and types
2. Document complex business logic
3. Add inline comments for non-obvious code

## Completed Tasks
- ✅ Set up Rome linting
- ✅ Configure pre-commit hooks
- ✅ Fix critical issues in AppealManager.tsx
- ✅ Fix critical issues in appeal.ts

## Notes
- Run `npm run lint` to check for linting issues
- Run `npm run format` to automatically fix formatting issues
- All new code should follow the established linting rules
- Pre-commit hooks will prevent commits with linting errors
- Make sure to review `docs/capacity/capacity-forecast.md`

## Upcoming Releases
2. **Migration**: Prepare for TikTok user migration, refine the process.
3. **Performance**: Conduct load testing, optimize performance, set up monitoring.
4. **Security**: Perform security penetration testing, audit security implementations and best practices.
5. **Core Features**: Finalize and polish core features.
6. **Launch Plan**: Plan marketing strategy and final launch plan.
7. **Capacity Plan**: Review the capacity plan document.

## Go-to-Market Priorities

This section outlines the key priorities for a rapid go-to-market strategy.

*   **Robustness and Scalability**
    *   **Extensive Load Testing:** We need to push our load testing to the extreme to ensure the infrastructure can handle the expected load and potential spikes.
    *   **Scalability Review:** We need to review and potentially enhance our scaling policies and mechanisms.
    *   **Performance Optimization:** Every bit of performance improvement will count when dealing with a large user base.
    *   **Capacity Plan Review**: We should be reviewing the document docs/capacity/capacity-forecast.md to make sure it is in line with our current ambitions.

*   **Security Hardening**
    *   **Comprehensive Penetration Testing:** We need to do more than just basic security checks.
    *   **Security Audits:** Ensure that our security implementations and best practices are solid.
    *   **Incident Response Plan:** A well-defined plan for handling security incidents is crucial.

*   **Feature Completeness**
    *   **Core Feature Review:** Ensure all core features are fully functional and polished.
    *   **User Experience (UX) Polish:** The UX needs to be as intuitive and bug-free as possible for a positive first impression.

*   **Marketing and Communication**
    *   **Launch Campaign:** A comprehensive marketing campaign is crucial for a successful big launch.
    *   **Public Relations (PR):** We need to manage the public perception of the launch effectively.
    *   **Community Building:** Start building a community around the game as early as possible.

* **User Migration**
    * Make sure the migration is ready to accept users. Since the beta program is being cancelled, we need to be ready for all users.

*   **Prepare for Migration**
    *   **Refine Migration Process:** The TikTok migration process needs to be as smooth as possible.
    *   **Communicate with Users:** Plan how you will communicate the migration process to users.

*   **Performance and Stability**
    *   **Load Testing:** Conduct rigorous load testing to ensure the app can handle a large influx of users.
    *   **Optimize:** Address any performance bottlenecks discovered during load testing.    
*   **Monitoring and Analytics**
    *   **Real-Time Monitoring:** Set up extensive monitoring to catch any issues as they happen during the launch.
    *   **Analytics Tracking:** Track key metrics to assess the success of the launch and inform future development.