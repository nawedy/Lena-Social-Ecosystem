import { tracingService } from '../monitoring/TracingService';
import { configService } from '../config/GlobalConfig';

describe('Tracing Service', () => {
  describe('Span Management', () => {
    it('should create and end spans', () => {
      const span = tracingService.startSpan('test-operation');
      expect(span).toBeDefined();
      expect(span.getContext().traceId).toBeDefined();
      expect(span.getContext().spanId).toBeDefined();
      expect(span.getData().name).toBe('test-operation');
      expect(span.getData().status).toBe('ok');

      span.end();
      expect(span.getData().endTime).toBeDefined();
    });

    it('should support span attributes', () => {
      const span = tracingService.startSpan('test-operation', {
        attributes: {
          'test.key': 'test-value'
        }
      });

      expect(span.getData().attributes['test.key']).toBe('test-value');
      expect(span.getData().attributes['service.name']).toBe(configService.get('platform').name);

      span.setAttributes({
        'another.key': 'another-value'
      });

      expect(span.getData().attributes['another.key']).toBe('another-value');
      span.end();
    });

    it('should support span events', () => {
      const span = tracingService.startSpan('test-operation');
      
      span.addEvent('test-event', {
        'event.key': 'event-value'
      });

      const events = span.getData().events;
      expect(events.length).toBe(1);
      expect(events[0].name).toBe('test-event');
      expect(events[0].attributes?.['event.key']).toBe('event-value');
      
      span.end();
    });

    it('should support span links', () => {
      const span1 = tracingService.startSpan('operation-1');
      const span2 = tracingService.startSpan('operation-2');

      span2.addLink(span1.getContext(), {
        'link.type': 'caused_by'
      });

      const links = span2.getData().links;
      expect(links.length).toBe(1);
      expect(links[0].context.traceId).toBe(span1.getContext().traceId);
      expect(links[0].attributes?.['link.type']).toBe('caused_by');

      span1.end();
      span2.end();
    });
  });

  describe('Trace Context Propagation', () => {
    it('should propagate trace context', () => {
      const parentSpan = tracingService.startSpan('parent-operation');
      const childSpan = tracingService.startSpan('child-operation', {
        parentContext: parentSpan.getContext()
      });

      expect(childSpan.getContext().traceId).toBe(parentSpan.getContext().traceId);
      expect(childSpan.getContext().parentSpanId).toBe(parentSpan.getContext().spanId);

      childSpan.end();
      parentSpan.end();
    });

    it('should maintain baggage across spans', () => {
      const parentContext = {
        traceId: 'test-trace-id',
        spanId: 'test-span-id',
        sampled: true,
        baggage: {
          'user.id': 'test-user'
        }
      };

      const span = tracingService.startSpan('test-operation', {
        parentContext
      });

      expect(span.getContext().baggage['user.id']).toBe('test-user');
      span.end();
    });
  });

  describe('Error Handling', () => {
    it('should handle errors in spans', async () => {
      const error = new Error('Test error');
      
      try {
        await tracingService.trace('failing-operation', async (span) => {
          throw error;
        });
      } catch (e) {
        expect(e).toBe(error);
      }

      // Get the last span from the tracer
      const tracer = tracingService.getTracer();
      const spans = Array.from((tracer as any).spans.values());
      const lastSpan = spans[spans.length - 1];

      expect(lastSpan.getData().status).toBe('error');
      expect(lastSpan.getData().attributes['error.message']).toBe('Test error');
    });
  });

  describe('Custom Tracers', () => {
    it('should support custom tracers', () => {
      const mockExporter = {
        export: jest.fn()
      };

      tracingService.registerTracer('custom', () => true, mockExporter);
      
      const span = tracingService.startSpan('test-operation', {
        tracer: 'custom'
      });
      span.end();

      expect(mockExporter.export).toHaveBeenCalled();
    });

    it('should prevent duplicate tracer registration', () => {
      expect(() => {
        tracingService.registerTracer('default', () => true, {
          export: () => {}
        });
      }).toThrow('Tracer default already exists');
    });
  });

  describe('HTTP Middleware', () => {
    it('should create middleware for HTTP request tracing', () => {
      const middleware = tracingService.createMiddleware();
      
      const req = {
        method: 'GET',
        path: '/test',
        url: '/test?q=1',
        headers: {
          host: 'test.com',
          'user-agent': 'test-agent',
          'x-request-id': '123'
        }
      };

      const res = {
        setHeader: jest.fn(),
        getHeader: jest.fn().mockReturnValue('100'),
        statusCode: 200,
        end: jest.fn()
      };

      const next = jest.fn();

      middleware(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith('x-trace-id', expect.any(String));
      expect(res.setHeader).toHaveBeenCalledWith('x-span-id', expect.any(String));
      expect(next).toHaveBeenCalled();

      // Simulate response end
      res.end();
    });

    it('should handle request filtering', () => {
      const middleware = tracingService.createMiddleware({
        shouldTrace: (req) => req.path === '/trace-this'
      });

      const req = {
        path: '/dont-trace-this'
      };

      const res = {};
      const next = jest.fn();

      middleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Async Operation Tracing', () => {
    it('should trace async operations', async () => {
      const result = await tracingService.trace('async-operation', async (span) => {
        span.addEvent('processing');
        await new Promise(resolve => setTimeout(resolve, 10));
        span.addEvent('completed');
        return 'success';
      });

      expect(result).toBe('success');

      // Get the last span from the tracer
      const tracer = tracingService.getTracer();
      const spans = Array.from((tracer as any).spans.values());
      const lastSpan = spans[spans.length - 1];

      const events = lastSpan.getData().events;
      expect(events.length).toBe(2);
      expect(events[0].name).toBe('processing');
      expect(events[1].name).toBe('completed');
    });

    it('should handle concurrent operations', async () => {
      const operations = Array.from({ length: 5 }, (_, i) => 
        tracingService.trace(`operation-${i}`, async (span) => {
          await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
          return i;
        })
      );

      const results = await Promise.all(operations);
      expect(results).toEqual([0, 1, 2, 3, 4]);

      // Verify all spans were created and completed
      const tracer = tracingService.getTracer();
      const spans = Array.from((tracer as any).spans.values());
      expect(spans.length).toBeGreaterThanOrEqual(5);
      spans.slice(-5).forEach(span => {
        expect(span.getData().endTime).toBeDefined();
        expect(span.getData().status).toBe('ok');
      });
    });
  });
}); 