import { LoadTest } from '../../scripts/load/load-test';

describe('Load Testing', () => {
  let loadTest: LoadTest;

  beforeAll(() => {
    loadTest = new LoadTest({
      baseUrl: process.env.TEST_URL || 'http://localhost:3000',
      duration: '5m',
      users: 100,
      rampUp: '30s'
    });
  });

  test('should handle sustained load', async () => {
    const results = await loadTest.run();
    expect(results.errorRate).toBeLessThan(0.01);
    expect(results.p95ResponseTime).toBeLessThan(200);
    expect(results.successfulRequests).toBeGreaterThan(10000);
  });

  test('should handle traffic spikes', async () => {
    const results = await loadTest.runSpike({
      baseLoad: 100,
      spikeLoad: 500,
      spikeDuration: '30s'
    });
    expect(results.errorRate).toBeLessThan(0.05);
    expect(results.maxResponseTime).toBeLessThan(1000);
  });
}); 