import { TestDeployment } from './setup';
import axios from 'axios';
import * as k8s from '@kubernetes/client-node';

describe('Deployment Validation Tests', () => {
  let testDeployment: TestDeployment;
  let k8sApi: k8s.CoreV1Api;

  beforeAll(async () => {
    const kc = new k8s.KubeConfig();
    kc.loadFromDefault();
    k8sApi = kc.makeApiClient(k8s.CoreV1Api);

    testDeployment = new TestDeployment({
      name: 'validation-test',
      region: process.env.TEST_REGION || 'us-east1',
      scale: 'small',
      features: ['api', 'monitoring', 'logging']
    });
  });

  describe('Infrastructure Tests', () => {
    test('all required pods should be running', async () => {
      const pods = await k8sApi.listNamespacedPod('game-services');
      const runningPods = pods.body.items.filter(
        pod => pod.status?.phase === 'Running'
      );
      expect(runningPods.length).toBeGreaterThanOrEqual(3);
    });

    test('services should have endpoints', async () => {
      const endpoints = await k8sApi.listNamespacedEndpoints('game-services');
      const serviceEndpoints = endpoints.body.items.find(
        ep => ep.metadata?.name === 'tiktok-toe'
      );
      expect(serviceEndpoints?.subsets?.[0].addresses?.length).toBeGreaterThan(0);
    });

    test('ingress should be configured correctly', async () => {
      const ingress = await k8sApi.listNamespacedIngress('game-services');
      const appIngress = ingress.body.items.find(
        ing => ing.metadata?.name === 'tiktok-toe'
      );
      expect(appIngress?.status?.loadBalancer?.ingress?.length).toBe(1);
    });
  });

  describe('Application Health Tests', () => {
    test('health endpoint should return OK', async () => {
      const response = await axios.get('http://localhost:3000/health');
      expect(response.status).toBe(200);
      expect(response.data.status).toBe('ok');
    });

    test('metrics endpoint should be accessible', async () => {
      const response = await axios.get('http://localhost:9090/metrics');
      expect(response.status).toBe(200);
      expect(response.data).toContain('http_requests_total');
    });

    test('application should handle load', async () => {
      const requests = Array(100).fill(null).map(() => 
        axios.get('http://localhost:3000/api/game')
      );
      const responses = await Promise.all(requests);
      expect(responses.every(r => r.status === 200)).toBe(true);
    });
  });

  describe('Security Tests', () => {
    test('should have required security headers', async () => {
      const response = await axios.get('http://localhost:3000');
      expect(response.headers['strict-transport-security']).toBeDefined();
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
    });

    test('should reject invalid requests', async () => {
      await expect(
        axios.post('http://localhost:3000/api/game', { invalid: 'data' })
      ).rejects.toThrow();
    });
  });

  describe('Monitoring Tests', () => {
    test('prometheus metrics should be properly formatted', async () => {
      const response = await axios.get('http://localhost:9090/metrics');
      expect(response.data).toMatch(/^# HELP/m);
      expect(response.data).toMatch(/^# TYPE/m);
    });

    test('grafana dashboards should be accessible', async () => {
      const response = await axios.get('http://localhost:3000/grafana/api/dashboards');
      expect(response.status).toBe(200);
      expect(response.data).toContainEqual(
        expect.objectContaining({ title: 'TikTokToe Service Dashboard' })
      );
    });
  });

  describe('Logging Tests', () => {
    test('logs should be shipped to elasticsearch', async () => {
      const response = await axios.get('http://localhost:9200/_cat/indices');
      expect(response.data).toContain('logstash-');
    });

    test('kibana should have required index patterns', async () => {
      const response = await axios.get('http://localhost:5601/api/index_patterns');
      expect(response.data.patterns).toContainEqual(
        expect.objectContaining({ title: 'logstash-*' })
      );
    });
  });

  afterAll(async () => {
    await testDeployment.cleanup();
  });
}); 