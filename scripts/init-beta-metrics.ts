import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { initializeApp } from 'firebase/app';
import {
  updateBetaTesterStatus,
  recordFeatureUsage,
  recordFeedback,
  recordMigrationAttempt,
} from '../src/monitoring/BetaMetrics';

// Initialize Firebase
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

interface BetaTester {
  status: 'active' | 'invited' | 'inactive';
  feedback?: Array<{
    type: 'bug' | 'feature' | 'improvement' | 'general';
  }>;
}

interface FeatureUsage {
  [key: string]: number;
}

interface Migration {
  duration: number;
  status: 'success' | 'failure';
}

async function initializeBetaMetrics() {
  try {
    logger.info('Initializing beta metrics...');

    // Get current beta tester counts
    const testers = await getDocs(collection(db, 'beta_testers'));
    const counts = {
      active: 0,
      invited: 0,
      inactive: 0,
    };

    testers.forEach(doc => {
      const tester = doc.data() as BetaTester;
      counts[tester.status]++;
    });

    // Update beta tester status metrics
    updateBetaTesterStatus(counts.active, counts.invited, counts.inactive);
    logger.info('Updated beta tester status metrics:', counts);

    // Initialize feature usage metrics from historical data
    const features = ['core_gameplay', 'tiktok_migration', 'social_features'];
    const usageSnapshot = await getDocs(collection(db, 'feature_usage'));
    usageSnapshot.forEach(doc => {
      const data = doc.data() as FeatureUsage;
      features.forEach(feature => {
        if (data[feature]) {
          recordFeatureUsage(feature);
        }
      });
    });
    logger.info('Initialized feature usage metrics');

    // Initialize feedback metrics
    const feedbackSnapshot = await getDocs(collection(db, 'beta_testers'));
    const feedbackCounts = {
      bug: 0,
      feature: 0,
      improvement: 0,
      general: 0,
    };

    feedbackSnapshot.forEach(doc => {
      const tester = doc.data() as BetaTester;
      (tester.feedback || []).forEach(item => {
        feedbackCounts[item.type]++;
      });
    });

    Object.entries(feedbackCounts).forEach(([type, count]) => {
      for (let i = 0; i < count; i++) {
        recordFeedback(type);
      }
    });
    logger.info('Initialized feedback metrics:', feedbackCounts);

    // Initialize migration metrics
    const migrationSnapshot = await getDocs(collection(db, 'migrations'));
    let totalDuration = 0;
    let successCount = 0;

    migrationSnapshot.forEach(doc => {
      const migration = doc.data() as Migration;
      recordMigrationAttempt(
        migration.duration,
        migration.status === 'success'
      );
      if (migration.status === 'success') {
        successCount++;
        totalDuration += migration.duration;
      }
    });

    const avgDuration = successCount > 0 ? totalDuration / successCount : 0;
    console.log('Initialized migration metrics:', {
      total: migrationSnapshot.size,
      successful: successCount,
      averageDuration: `${avgDuration}ms`,
    });

    logger.info('Beta metrics initialization complete!');
  } catch (error) {
    console.error('Error initializing beta metrics:', error);
    process.exit(1);
  }
}

// Run the initialization
initializeBetaMetrics();
