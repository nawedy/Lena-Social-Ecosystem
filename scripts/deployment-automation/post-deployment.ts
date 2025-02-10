import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../utils/logger';
import { CheckResult } from './types';
import { runSmokeTests } from '../utils/smoke-tester';
import { checkEndpoints } from '../utils/endpoint-checker';
import { validateDatabase } from '../utils/db-validator';

const execAsync = promisify(exec);

interface EndpointStatus {
  url: string;
  method: string;
  status: number;
  responseTime: number;
  error?: string;
}

interface DatabaseStatus {
  connected: boolean;
  migrations: {
    pending: number;
    applied: number;
    failed: number;
  };
  replication: {
    lag: number;
    status: 'healthy' | 'degraded' | 'failed';
  };
  connections: {
    active: number;
    idle: number;
    max: number;
  };
}

interface CacheStatus {
  connected: boolean;
  hitRate: number;
  memoryUsage: number;
  evictions: number;
  keys: number;
}

interface ServiceHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  latency: number;
  dependencies: Array<{
    name: string;
    status: 'healthy' | 'degraded' | 'down';
  }>;
}

interface UserSession {
  id: string;
  status: 'active' | 'expired';
  createdAt: string;
  lastActivity: string;
  device: string;
  location: string;
}

interface BackupStatus {
  lastBackup: string;
  status: 'success' | 'failed';
  size: number;
  duration: number;
  location: string;
}

export async function runPostDeploymentChecks(): Promise<CheckResult> {
  const details: string[] = [];
  const errors: Error[] = [];

  try {
    // 1. Smoke Tests
    logger.info('Running smoke tests...');
    const smokeTestResults = await runSmokeTests();
    
    if (smokeTestResults.failed.length > 0) {
      details.push(`❌ Failed smoke tests: ${smokeTestResults.failed.join(', ')}`);
      errors.push(new Error('Smoke tests failed'));
    } else {
      details.push(`✅ All smoke tests passed (${smokeTestResults.passed.length} tests)`);
    }

    // 2. API Health Check
    logger.info('Checking API endpoints...');
    const endpointResults = await checkEndpoints();
    
    const failedEndpoints = endpointResults.filter(e => e.status !== 200);
    if (failedEndpoints.length > 0) {
      details.push(`❌ Failed endpoints: ${failedEndpoints.map(e => e.url).join(', ')}`);
      errors.push(new Error('API endpoint checks failed'));
    } else {
      details.push('✅ All API endpoints responding correctly');
    }

    // 3. Database Status
    logger.info('Checking database status...');
    const dbStatus = await checkDatabaseStatus();
    
    if (!dbStatus.connected || dbStatus.migrations.failed > 0) {
      details.push(`❌ Database issues: ${dbStatus.migrations.failed} failed migrations`);
      errors.push(new Error('Database issues detected'));
    } else {
      details.push('✅ Database healthy and migrations applied');
    }

    // 4. Cache Status
    logger.info('Checking cache status...');
    const cacheStatus = await checkCacheStatus();
    
    if (!cacheStatus.connected || cacheStatus.hitRate < 0.8) {
      details.push(`❌ Cache issues: Hit rate ${(cacheStatus.hitRate * 100).toFixed(1)}%`);
      errors.push(new Error('Cache performance issues'));
    } else {
      details.push('✅ Cache system healthy');
    }

    // 5. Service Dependencies
    logger.info('Checking service dependencies...');
    const serviceStatus = await checkServiceDependencies();
    
    const unhealthyServices = serviceStatus.filter(s => s.status !== 'healthy');
    if (unhealthyServices.length > 0) {
      details.push(`❌ Unhealthy services: ${unhealthyServices.map(s => s.name).join(', ')}`);
      errors.push(new Error('Service dependency issues'));
    } else {
      details.push('✅ All service dependencies healthy');
    }

    // 6. User Sessions
    logger.info('Checking user sessions...');
    const sessionStatus = await checkUserSessions();
    
    if (sessionStatus.issues.length > 0) {
      details.push(`❌ Session issues: ${sessionStatus.issues.join(', ')}`);
      errors.push(new Error('User session issues'));
    } else {
      details.push('✅ User sessions validated');
    }

    // 7. Backup Verification
    logger.info('Verifying backup status...');
    const backupStatus = await verifyBackups();
    
    if (backupStatus.status !== 'success') {
      details.push(`❌ Backup issues: Last backup ${backupStatus.status}`);
      errors.push(new Error('Backup verification failed'));
    } else {
      details.push(`✅ Backup verified (${formatBytes(backupStatus.size)})`);
    }

    // 8. Social Platform Specific Checks
    logger.info('Verifying social platform features...');
    const socialChecks = await verifySocialFeatures();
    
    if (socialChecks.status === 'failure') {
      details.push(`❌ Social platform issues: ${socialChecks.details.join(', ')}`);
      errors.push(new Error('Social platform issues detected'));
    } else {
      details.push('✅ Social platform features verified');
    }

    return {
      status: errors.length === 0 ? 'success' : 'failure',
      details,
      errors: errors.length > 0 ? errors : undefined
    };

  } catch (error) {
    logger.error('Post-deployment checks failed:', error);
    return {
      status: 'failure',
      details: [...details, `❌ Error: ${error.message}`],
      errors: [error]
    };
  }
}

async function checkDatabaseStatus(): Promise<DatabaseStatus> {
  try {
    const { stdout: pgStatus } = await execAsync('pg_isready');
    const { stdout: migrations } = await execAsync('pnpm db:status');
    const { stdout: replication } = await execAsync('psql -c "SELECT * FROM pg_stat_replication"');
    const { stdout: connections } = await execAsync('psql -c "SELECT count(*) FROM pg_stat_activity"');

    return {
      connected: pgStatus.includes('accepting connections'),
      migrations: {
        pending: parseInt(migrations.match(/pending: (\d+)/)?.[1] || '0'),
        applied: parseInt(migrations.match(/applied: (\d+)/)?.[1] || '0'),
        failed: parseInt(migrations.match(/failed: (\d+)/)?.[1] || '0')
      },
      replication: {
        lag: parseInt(replication.match(/lag: (\d+)/)?.[1] || '0'),
        status: replication.includes('streaming') ? 'healthy' : 'degraded'
      },
      connections: {
        active: parseInt(connections.match(/active: (\d+)/)?.[1] || '0'),
        idle: parseInt(connections.match(/idle: (\d+)/)?.[1] || '0'),
        max: parseInt(connections.match(/max: (\d+)/)?.[1] || '0')
      }
    };
  } catch (error) {
    throw new Error(`Failed to check database status: ${error.message}`);
  }
}

async function checkCacheStatus(): Promise<CacheStatus> {
  try {
    const { stdout } = await execAsync('redis-cli info');
    const info = stdout.split('\n').reduce((acc: Record<string, string>, line) => {
      const [key, value] = line.split(':');
      if (key && value) acc[key.trim()] = value.trim();
      return acc;
    }, {});

    return {
      connected: info.connected_clients !== '0',
      hitRate: parseInt(info.keyspace_hits) / (parseInt(info.keyspace_hits) + parseInt(info.keyspace_misses)),
      memoryUsage: parseInt(info.used_memory),
      evictions: parseInt(info.evicted_keys),
      keys: parseInt(info.total_keys)
    };
  } catch (error) {
    throw new Error(`Failed to check cache status: ${error.message}`);
  }
}

async function checkServiceDependencies(): Promise<ServiceHealth[]> {
  try {
    const services = [
      { name: 'auth', url: 'http://localhost:3001/health' },
      { name: 'payments', url: 'http://localhost:3002/health' },
      { name: 'notifications', url: 'http://localhost:3003/health' },
      { name: 'storage', url: 'http://localhost:3004/health' }
    ];

    const results: ServiceHealth[] = [];

    for (const service of services) {
      const startTime = Date.now();
      const { stdout } = await execAsync(`curl -s ${service.url}`);
      const latency = Date.now() - startTime;

      const health = JSON.parse(stdout);
      results.push({
        name: service.name,
        status: health.status,
        latency,
        dependencies: health.dependencies || []
      });
    }

    return results;
  } catch (error) {
    throw new Error(`Failed to check service dependencies: ${error.message}`);
  }
}

async function checkUserSessions(): Promise<{ issues: string[] }> {
  try {
    const { stdout } = await execAsync('psql -c "SELECT * FROM user_sessions"');
    const sessions = JSON.parse(stdout) as UserSession[];
    const issues: string[] = [];

    // Check for expired sessions still marked as active
    const now = new Date();
    sessions.forEach(session => {
      const lastActivity = new Date(session.lastActivity);
      if (session.status === 'active' && now.getTime() - lastActivity.getTime() > 24 * 60 * 60 * 1000) {
        issues.push(`Session ${session.id} marked active but inactive for >24h`);
      }
    });

    // Check for duplicate active sessions
    const activeSessions = sessions.filter(s => s.status === 'active');
    const userSessionCount = activeSessions.reduce((acc, session) => {
      acc[session.id] = (acc[session.id] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    Object.entries(userSessionCount).forEach(([userId, count]) => {
      if (count > 5) {
        issues.push(`User ${userId} has ${count} active sessions`);
      }
    });

    return { issues };
  } catch (error) {
    return {
      issues: [`Failed to check user sessions: ${error.message}`]
    };
  }
}

async function verifyBackups(): Promise<BackupStatus> {
  try {
    const { stdout } = await execAsync('psql -c "SELECT * FROM backup_history ORDER BY created_at DESC LIMIT 1"');
    const lastBackup = JSON.parse(stdout);

    return {
      lastBackup: lastBackup.created_at,
      status: lastBackup.status,
      size: lastBackup.size_bytes,
      duration: lastBackup.duration_seconds,
      location: lastBackup.location
    };
  } catch (error) {
    throw new Error(`Failed to verify backups: ${error.message}`);
  }
}

function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unit = 0;

  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit++;
  }

  return `${size.toFixed(2)} ${units[unit]}`;
}

// Add social platform specific checks
async function verifySocialFeatures(): Promise<CheckResult> {
  const checks = [
    await verifyContentCreation(),
    await verifyUserInteractions(),
    await verifyATProtocolIntegration()
  ];
  return aggregateResults(checks);
} 