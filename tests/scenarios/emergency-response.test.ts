import { EmergencyResponseHandler } from '../../scripts/deployment-automation/emergency';
import { DisasterRecoveryService } from '../../scripts/deployment-automation/disaster-recovery';
import { MockMetricsService } from '../mocks/metrics-service';
import { MockNotifier } from '../mocks/notifier';
import { TestContext } from '../utils/test-context';

describe('Emergency Response System Tests', () => {
  let emergencyHandler: EmergencyResponseHandler;
  let disasterRecovery: DisasterRecoveryService;
  let testContext: TestContext;

  beforeEach(async () => {
    testContext = await TestContext.create({
      mockServices: true,
      recordMetrics: true
    });

    emergencyHandler = new EmergencyResponseHandler();
    disasterRecovery = new DisasterRecoveryService();
  });

  afterEach(async () => {
    await testContext.cleanup();
  });

  describe('Incident Detection', () => {
    test('should detect critical service failures', async () => {
      // Arrange
      const mockFailure = {
        service: 'api-gateway',
        error: new Error('Connection timeout'),
        timestamp: new Date()
      };

      // Act
      const result = await emergencyHandler.handleDeploymentFailure({
        status: 'failure',
        details: ['API Gateway connection timeout'],
        errors: [mockFailure.error]
      });

      // Assert
      expect(result.incident).toBeDefined();
      expect(result.severity).toBe('critical');
      expect(result.actions).toContain('Rollback initiated');
    });

    test('should properly escalate based on severity', async () => {
      // Arrange
      const mockMetrics = new MockMetricsService();
      mockMetrics.setErrorRate(0.75); // 75% error rate

      // Act
      const response = await emergencyHandler.assessIncident('high-error-rate');

      // Assert
      expect(response.severity).toBe('high');
      expect(response.actions).toContain('Notification sent to infrastructure team');
    });
  });

  describe('Recovery Actions', () => {
    test('should execute rollback when needed', async () => {
      // Arrange
      const mockDeployment = {
        version: '2.0.0',
        timestamp: new Date(),
        services: ['api', 'auth', 'database']
      };

      // Act
      const rollbackResult = await emergencyHandler.executeRollback(mockDeployment);

      // Assert
      expect(rollbackResult.success).toBe(true);
      expect(rollbackResult.version).toBe('1.9.0'); // Previous version
    });

    test('should handle database recovery scenarios', async () => {
      // Arrange
      const dbFailure = {
        type: 'database_corruption',
        affectedTables: ['users', 'transactions'],
        timestamp: new Date()
      };

      // Act
      const recoveryResult = await disasterRecovery.initiateRecovery(dbFailure);

      // Assert
      expect(recoveryResult.status).toBe('success');
      expect(recoveryResult.dataIntegrity).toBe(100);
    });
  });

  describe('Notification System', () => {
    test('should notify all required stakeholders', async () => {
      // Arrange
      const mockNotifier = new MockNotifier();
      const criticalIncident = {
        type: 'service_outage',
        severity: 'critical',
        timestamp: new Date()
      };

      // Act
      await emergencyHandler.notifyStakeholders(criticalIncident);

      // Assert
      expect(mockNotifier.getNotificationCount()).toBe(3); // SRE, Manager, Executive
      expect(mockNotifier.getNotificationsByPriority('critical')).toHaveLength(1);
    });
  });

  describe('Integration with Disaster Recovery', () => {
    test('should trigger DR for qualifying incidents', async () => {
      // Arrange
      const catastrophicFailure = {
        type: 'region_failure',
        affectedServices: ['all'],
        timestamp: new Date()
      };

      // Act
      const response = await emergencyHandler.handleDeploymentFailure({
        status: 'failure',
        details: ['Complete region failure'],
        errors: [new Error('Region unreachable')]
      });

      // Assert
      expect(response.actions).toContain('Disaster recovery initiated');
      expect(disasterRecovery.getStatus().isActive).toBe(true);
    });

    test('should maintain system state during recovery', async () => {
      // Arrange
      const systemState = {
        activeConnections: 1000,
        pendingTransactions: 50,
        dataConsistency: 100
      };

      // Act
      await emergencyHandler.initiateEmergencyResponse('system_failure');

      // Assert
      const currentState = await testContext.getSystemState();
      expect(currentState.dataConsistency).toBeGreaterThanOrEqual(99);
      expect(currentState.pendingTransactions).toBe(0);
    });
  });

  describe('Performance Under Load', () => {
    test('should handle multiple concurrent incidents', async () => {
      // Arrange
      const incidents = [
        { type: 'api_failure', severity: 'high' },
        { type: 'database_lag', severity: 'medium' },
        { type: 'cache_miss', severity: 'low' }
      ];

      // Act
      const results = await Promise.all(
        incidents.map(incident => emergencyHandler.handleIncident(incident))
      );

      // Assert
      expect(results.every(r => r.status === 'handled')).toBe(true);
      expect(emergencyHandler.getActiveIncidents()).toHaveLength(3);
    });
  });

  describe('Error Handling', () => {
    test('should handle notification failures gracefully', async () => {
      // Arrange
      const mockNotifier = new MockNotifier();
      mockNotifier.simulateFailure(true);

      // Act
      const result = await emergencyHandler.notifyStakeholders({
        type: 'test_incident',
        severity: 'high',
        timestamp: new Date()
      });

      // Assert
      expect(result.notificationStatus).toBe('fallback_used');
      expect(result.fallbackNotifications).toHaveLength(1);
    });

    test('should maintain audit trail of all actions', async () => {
      // Arrange
      const incidentId = 'TEST-001';

      // Act
      await emergencyHandler.handleIncident({
        id: incidentId,
        type: 'test_incident',
        severity: 'medium'
      });

      // Assert
      const auditTrail = await testContext.getAuditTrail(incidentId);
      expect(auditTrail).toHaveLength(5); // All actions logged
      expect(auditTrail[0].action).toBe('incident_received');
    });
  });
}); 