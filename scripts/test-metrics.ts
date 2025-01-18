import {
  updateBetaTesterStatus,
  recordFeatureUsage,
  recordFeedback,
} from '../src/monitoring/BetaMetrics';

async function testMetrics() {
  try {
    logger.info('Testing beta metrics...');

    // Test beta tester status metrics
    logger.info('Testing beta tester status updates...');
    updateBetaTesterStatus(5, 10, 2);
    logger.info('✓ Beta tester status metrics updated');

    // Test feature usage metrics
    logger.info('Testing feature usage metrics...');
    const features = ['core_gameplay', 'tiktok_migration', 'social_features'];
    features.forEach(feature => {
      recordFeatureUsage(feature);
    });
    logger.info('✓ Feature usage metrics recorded');

    // Test feedback metrics
    logger.info('Testing feedback metrics...');
    const feedbackTypes = ['bug', 'feature', 'improvement', 'general'];
    feedbackTypes.forEach(type => {
      recordFeedback(type);
    });
    logger.info('✓ Feedback metrics recorded');

    logger.info('All metrics tests completed successfully!');
  } catch (error) {
    console.error('Error testing metrics:', error);
    process.exit(1);
  }
}

// Run the tests
testMetrics();
