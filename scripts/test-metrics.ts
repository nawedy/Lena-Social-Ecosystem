import { updateBetaTesterStatus, recordFeatureUsage, recordFeedback } from '../src/monitoring/BetaMetrics';

async function testMetrics() {
  try {
    console.log('Testing beta metrics...');

    // Test beta tester status metrics
    console.log('Testing beta tester status updates...');
    updateBetaTesterStatus(5, 10, 2);
    console.log('✓ Beta tester status metrics updated');

    // Test feature usage metrics
    console.log('Testing feature usage metrics...');
    const features = ['core_gameplay', 'tiktok_migration', 'social_features'];
    features.forEach(feature => {
      recordFeatureUsage(feature);
    });
    console.log('✓ Feature usage metrics recorded');

    // Test feedback metrics
    console.log('Testing feedback metrics...');
    const feedbackTypes = ['bug', 'feature', 'improvement', 'general'];
    feedbackTypes.forEach(type => {
      recordFeedback(type);
    });
    console.log('✓ Feedback metrics recorded');

    console.log('All metrics tests completed successfully!');
  } catch (error) {
    console.error('Error testing metrics:', error);
    process.exit(1);
  }
}

// Run the tests
testMetrics();
