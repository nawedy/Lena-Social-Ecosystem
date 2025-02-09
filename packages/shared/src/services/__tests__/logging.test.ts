import { loggingService } from '../logging/LoggingService';
import { errorService } from '../error/ErrorService';
import { configService } from '../config/GlobalConfig';

describe('Logging Service', () => {
  beforeEach(async () => {
    // Clear logs before each test
    await loggingService.clearLogs();
  });

  describe('Log Levels', () => {
    it('should log messages at different levels', async () => {
      await loggingService.debug('Debug message');
      await loggingService.info('Info message');
      await loggingService.warn('Warning message');
      await loggingService.error('Error message');
      await loggingService.fatal('Fatal message');

      const logs = await loggingService.getLogs();
      expect(logs.length).toBe(5);
      expect(logs.map(log => log.metadata.level)).toEqual([
        'debug',
        'info',
        'warn',
        'error',
        'fatal'
      ]);
    });

    it('should respect configured log level', async () => {
      // Set log level to warn
      const originalLevel = configService.get('monitoring').logLevel;
      await configService.update('monitoring', {
        ...configService.get('monitoring'),
        logLevel: 'warn'
      });

      await loggingService.debug('Debug message');
      await loggingService.info('Info message');
      await loggingService.warn('Warning message');
      await loggingService.error('Error message');

      const logs = await loggingService.getLogs();
      expect(logs.length).toBe(2); // Only warn and error should be logged

      // Restore original level
      await configService.update('monitoring', {
        ...configService.get('monitoring'),
        logLevel: originalLevel
      });
    });
  });

  describe('Log Metadata', () => {
    it('should include default metadata', async () => {
      await loggingService.info('Test message');

      const logs = await loggingService.getLogs();
      expect(logs[0].metadata).toMatchObject({
        level: 'info',
        environment: configService.get('platform').environment,
        platform: configService.get('platform').name,
        timestamp: expect.any(Number)
      });
    });

    it('should allow custom metadata', async () => {
      await loggingService.info('Test message', {
        userId: 'test-user',
        component: 'test-component',
        tags: ['test']
      });

      const logs = await loggingService.getLogs();
      expect(logs[0].metadata).toMatchObject({
        userId: 'test-user',
        component: 'test-component',
        tags: ['test']
      });
    });

    it('should include duration for performance logs', async () => {
      await loggingService.info('Operation completed', {
        duration: 1234,
        action: 'test-operation'
      });

      const logs = await loggingService.getLogs();
      expect(logs[0].metadata.duration).toBe(1234);
    });
  });

  describe('Log Transports', () => {
    it('should add and remove transports', () => {
      const mockTransport = {
        name: 'mock',
        log: jest.fn()
      };

      loggingService.addTransport(mockTransport);
      loggingService.info('Test message');

      expect(mockTransport.log).toHaveBeenCalled();

      loggingService.removeTransport('mock');
      loggingService.info('Another message');

      expect(mockTransport.log).toHaveBeenCalledTimes(1);
    });

    it('should handle transport errors gracefully', async () => {
      const failingTransport = {
        name: 'failing',
        log: jest.fn().mockRejectedValue(new Error('Transport failed'))
      };

      loggingService.addTransport(failingTransport);
      await loggingService.info('Test message');

      // Log should still be stored even if transport fails
      const logs = await loggingService.getLogs();
      expect(logs.length).toBe(1);
    });
  });

  describe('Log Buffering', () => {
    it('should buffer logs when enabled', async () => {
      const mockTransport = {
        name: 'mock',
        log: jest.fn()
      };
      loggingService.addTransport(mockTransport);

      loggingService.setBuffering(true, { size: 2 });

      await loggingService.info('Message 1');
      expect(mockTransport.log).not.toHaveBeenCalled();

      await loggingService.info('Message 2');
      expect(mockTransport.log).toHaveBeenCalledTimes(2);
    });

    it('should flush buffer on interval', async () => {
      const mockTransport = {
        name: 'mock',
        log: jest.fn()
      };
      loggingService.addTransport(mockTransport);

      loggingService.setBuffering(true, { interval: 100 });
      await loggingService.info('Test message');

      expect(mockTransport.log).not.toHaveBeenCalled();

      // Wait for flush interval
      await new Promise(resolve => setTimeout(resolve, 150));
      expect(mockTransport.log).toHaveBeenCalled();
    });
  });

  describe('Log Filtering', () => {
    beforeEach(async () => {
      await loggingService.info('Info message', { component: 'auth' });
      await loggingService.warn('Warning message', { component: 'api' });
      await loggingService.error('Error message', { component: 'db' });
    });

    it('should filter by level', async () => {
      const errorLogs = await loggingService.getLogs({ level: 'error' });
      expect(errorLogs.length).toBe(1);
      expect(errorLogs[0].message).toBe('Error message');
    });

    it('should filter by component', async () => {
      const authLogs = await loggingService.getLogs({ component: 'auth' });
      expect(authLogs.length).toBe(1);
      expect(authLogs[0].metadata.component).toBe('auth');
    });

    it('should filter by date range', async () => {
      const now = Date.now();
      const logs = await loggingService.getLogs({
        startDate: now - 1000,
        endDate: now + 1000
      });
      expect(logs.length).toBe(3);
    });

    it('should filter by search term', async () => {
      const logs = await loggingService.getLogs({ search: 'warning' });
      expect(logs.length).toBe(1);
      expect(logs[0].message).toBe('Warning message');
    });
  });

  describe('Log Statistics', () => {
    beforeEach(async () => {
      await loggingService.debug('Debug message');
      await loggingService.info('Info message');
      await loggingService.warn('Warning message');
      await loggingService.error('Error message');
      await loggingService.fatal('Fatal message');
    });

    it('should calculate log statistics', () => {
      const stats = loggingService.getLogStats();
      expect(stats.total).toBe(5);
      expect(stats.byLevel).toEqual({
        debug: 1,
        info: 1,
        warn: 1,
        error: 1,
        fatal: 1
      });
    });

    it('should track recent errors', () => {
      const stats = loggingService.getLogStats();
      expect(stats.recentErrors).toBe(2); // error and fatal
    });
  });

  describe('Error Service Integration', () => {
    it('should log errors from error service', async () => {
      const error = new Error('Test error');
      await errorService.handleError(error);

      const logs = await loggingService.getLogs({ level: 'error' });
      expect(logs.length).toBe(1);
      expect(logs[0].message).toBe('Test error');
    });

    it('should include error metadata in logs', async () => {
      const error = new Error('Test error');
      await errorService.handleError(error, {
        component: 'test',
        userId: 'test-user'
      });

      const logs = await loggingService.getLogs({ level: 'error' });
      expect(logs[0].metadata).toMatchObject({
        component: 'test',
        userId: 'test-user'
      });
    });
  });

  describe('Context Handling', () => {
    it('should include context in log entries', async () => {
      const context = { requestId: '123', params: { id: 456 } };
      await loggingService.info('API request', {}, context);

      const logs = await loggingService.getLogs();
      expect(logs[0].context).toEqual(context);
    });
  });

  describe('Log Cleanup', () => {
    it('should clear all logs', async () => {
      await loggingService.info('Test message');
      await loggingService.clearLogs();

      const logs = await loggingService.getLogs();
      expect(logs.length).toBe(0);
    });

    it('should clear logs by filter', async () => {
      await loggingService.info('Keep this');
      await loggingService.error('Clear this');

      await loggingService.clearLogs({ level: 'error' });
      const logs = await loggingService.getLogs();
      expect(logs.length).toBe(1);
      expect(logs[0].message).toBe('Keep this');
    });
  });
}); 