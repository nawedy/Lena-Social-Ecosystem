import { errorService } from '../error/ErrorService';
import { configService } from '../config/GlobalConfig';

describe('Error Service', () => {
  beforeEach(async () => {
    // Reset error service state
    await errorService.clearResolvedErrors();
    await errorService.initialize();
  });

  describe('Error Handling', () => {
    it('should handle and categorize errors', async () => {
      const networkError = new Error('Network connection failed');
      await errorService.handleError(networkError);

      const errors = await errorService.getErrors();
      expect(errors.length).toBe(1);
      expect(errors[0].error.message).toBe('Network connection failed');
      expect(errors[0].severity).toBe('high');
    });

    it('should handle non-Error objects', async () => {
      await errorService.handleError('String error message');

      const errors = await errorService.getErrors();
      expect(errors.length).toBe(1);
      expect(errors[0].error.message).toBe('String error message');
    });

    it('should enrich error metadata', async () => {
      const error = new Error('Test error');
      await errorService.handleError(error, {
        userId: 'test-user',
        component: 'test-component'
      });

      const errors = await errorService.getErrors();
      expect(errors[0].metadata.userId).toBe('test-user');
      expect(errors[0].metadata.component).toBe('test-component');
      expect(errors[0].metadata.environment).toBe(configService.get('platform').environment);
    });
  });

  describe('Error Patterns', () => {
    it('should correctly identify network errors', async () => {
      const error = new Error('Network timeout occurred');
      await errorService.handleError(error);

      const errors = await errorService.getErrors();
      expect(errors[0].severity).toBe('high');
    });

    it('should correctly identify database errors', async () => {
      const error = new Error('Database connection lost');
      await errorService.handleError(error);

      const errors = await errorService.getErrors();
      expect(errors[0].severity).toBe('critical');
    });

    it('should correctly identify auth errors', async () => {
      const error = new Error('Authentication token expired');
      await errorService.handleError(error);

      const errors = await errorService.getErrors();
      expect(errors[0].severity).toBe('high');
    });
  });

  describe('Error Resolution', () => {
    it('should resolve errors', async () => {
      const error = new Error('Test error');
      await errorService.handleError(error);

      const errors = await errorService.getErrors();
      const errorId = errors[0].id;

      await errorService.resolveError(errorId, {
        resolvedBy: 'test-user',
        resolution: 'Fixed the issue'
      });

      const resolvedErrors = await errorService.getErrors({ status: 'resolved' });
      expect(resolvedErrors.length).toBe(1);
      expect(resolvedErrors[0].resolution.resolvedBy).toBe('test-user');
    });

    it('should clear resolved errors', async () => {
      const error = new Error('Test error');
      await errorService.handleError(error);

      const errors = await errorService.getErrors();
      const errorId = errors[0].id;

      await errorService.resolveError(errorId, {
        resolvedBy: 'test-user',
        resolution: 'Fixed'
      });

      await errorService.clearResolvedErrors();
      const remainingErrors = await errorService.getErrors();
      expect(remainingErrors.length).toBe(0);
    });
  });

  describe('Error Filtering', () => {
    beforeEach(async () => {
      // Add test errors
      await errorService.handleError(new Error('Network error'), { tags: ['network'] });
      await errorService.handleError(new Error('Auth error'), { tags: ['auth'] });
      await errorService.handleError(new Error('Database error'), { tags: ['database'] });
    });

    it('should filter by severity', async () => {
      const criticalErrors = await errorService.getErrors({ severity: 'critical' });
      const highErrors = await errorService.getErrors({ severity: 'high' });

      expect(criticalErrors.length).toBe(1); // Database error
      expect(highErrors.length).toBe(2); // Network and Auth errors
    });

    it('should filter by tags', async () => {
      const networkErrors = await errorService.getErrors({ tags: ['network'] });
      expect(networkErrors.length).toBe(1);
      expect(networkErrors[0].metadata.tags).toContain('network');
    });

    it('should filter by date range', async () => {
      const now = Date.now();
      const errors = await errorService.getErrors({
        startDate: now - 1000,
        endDate: now + 1000
      });
      expect(errors.length).toBe(3);
    });
  });

  describe('Error Statistics', () => {
    beforeEach(async () => {
      // Add test errors with different severities
      await errorService.handleError(new Error('Low severity error'));
      await errorService.handleError(new Error('Network timeout occurred'));
      await errorService.handleError(new Error('Database connection lost'));
    });

    it('should calculate error statistics', () => {
      const stats = errorService.getErrorStats();
      expect(stats.total).toBe(3);
      expect(stats.bySeverity.critical).toBe(1); // Database error
      expect(stats.bySeverity.high).toBe(1); // Network error
      expect(stats.bySeverity.medium).toBe(1); // Low severity error
    });

    it('should track error patterns', () => {
      const stats = errorService.getErrorStats();
      expect(stats.byPattern.network).toBe(1);
      expect(stats.byPattern.database).toBe(1);
    });
  });

  describe('Error Thresholds', () => {
    it('should detect when error threshold is exceeded', async () => {
      const thresholdExceeded = jest.fn();
      errorService.on('threshold_exceeded', thresholdExceeded);

      // Generate errors to exceed threshold
      const threshold = configService.get('monitoring').alerts.thresholds.errors;
      for (let i = 0; i < threshold + 1; i++) {
        await errorService.handleError(new Error(`Error ${i}`));
      }

      expect(thresholdExceeded).toHaveBeenCalled();
    });
  });

  describe('Custom Error Handlers', () => {
    it('should allow registering custom error handlers', async () => {
      const customHandler = jest.fn();
      errorService.registerErrorHandler('custom', customHandler);

      const error = new Error('Custom error type');
      await errorService.handleError(error);

      // Custom handler should be called if error matches pattern
      expect(customHandler).toHaveBeenCalledWith(error, expect.any(Object));
    });
  });

  describe('Global Error Handling', () => {
    it('should handle unhandled rejections', async () => {
      const promise = Promise.reject(new Error('Unhandled rejection'));
      const event = new Event('unhandledrejection') as any;
      event.reason = promise;

      window.dispatchEvent(event);

      const errors = await errorService.getErrors();
      expect(errors.some(e => e.metadata.type === 'unhandledrejection')).toBe(true);
    });

    it('should handle uncaught errors', () => {
      const error = new Error('Uncaught error');
      window.onerror('Error message', 'test.js', 1, 1, error);

      const errors = await errorService.getErrors();
      expect(errors.some(e => e.metadata.type === 'window.onerror')).toBe(true);
    });
  });
}); 