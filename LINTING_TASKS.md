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
