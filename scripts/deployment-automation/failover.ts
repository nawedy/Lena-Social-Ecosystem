import { logger } from '../utils/logger';
import { exec } from 'child_process';
import { promisify } from 'util';
import { SlackNotifier } from '../utils/notifications';

const execAsync = promisify(exec);

interface FailoverConfig {
  regions: {
    primary: string;
    secondary: string[];
    priority: Record<string, number>;
  };
  services: {
    [key: string]: {
      dependencies: string[];
      minReplicas: number;
      healthEndpoint: string;
    };
  };
  database: {
    replicationLag: number;
    maxDowntime: number;
    syncMode: 'sync' | 'async';
  };
}

interface RegionHealth {
  region: string;
  status: 'healthy' | 'degraded' | 'failed';
  services: Record<string, boolean>;
  latency: number;
  load: number;
}

export class FailoverService {
  private notifier: SlackNotifier;
  private config: FailoverConfig;
  private readonly HEALTH_CHECK_INTERVAL = 30000; // 30 seconds
  private readonly MAX_FAILOVER_TIME = 300000; // 5 minutes

  constructor(config: FailoverConfig) {
    this.notifier = new SlackNotifier();
    this.config = config;
    this.startHealthChecks();
  }

  private async startHealthChecks(): Promise<void> {
    setInterval(async () => {
      try {
        const healthStatus = await this.checkRegionsHealth();
        if (this.needsFailover(healthStatus)) {
          await this.initiateFailover(healthStatus);
        }
      } catch (error) {
        logger.error('Health check failed:', error);
      }
    }, this.HEALTH_CHECK_INTERVAL);
  }

  async initiateFailover(healthStatus: RegionHealth[]): Promise<void> {
    const primaryRegion = this.config.regions.primary;
    const primaryHealth = healthStatus.find(h => h.region === primaryRegion);

    if (!primaryHealth || primaryHealth.status === 'failed') {
      const bestSecondary = this.selectBestSecondaryRegion(healthStatus);
      if (bestSecondary) {
        await this.executeFailover(bestSecondary.region);
      } else {
        throw new Error('No healthy secondary region available for failover');
      }
    }
  }

  private async executeFailover(targetRegion: string): Promise<void> {
    logger.info(`Initiating failover to region: ${targetRegion}`);
    const startTime = Date.now();

    try {
      // 1. Prepare target region
      await this.prepareTargetRegion(targetRegion);

      // 2. Switch database primary
      await this.switchDatabasePrimary(targetRegion);

      // 3. Update DNS and load balancers
      await this.updateTrafficRouting(targetRegion);

      // 4. Scale up services in target region
      await this.scaleUpServices(targetRegion);

      // 5. Verify failover
      await this.verifyFailover(targetRegion);

      const duration = Date.now() - startTime;
      if (duration > this.MAX_FAILOVER_TIME) {
        logger.warn(`Failover took longer than expected: ${duration}ms`);
      }

      await this.notifyFailoverSuccess(targetRegion, duration);
    } catch (error) {
      logger.error('Failover failed:', error);
      await this.notifyFailoverFailure(targetRegion, error);
      throw error;
    }
  }

  private async prepareTargetRegion(region: string): Promise<void> {
    // Ensure target region has sufficient capacity
    await execAsync(`kubectl --context=${region} scale deployment --all --replicas=0`);
    
    // Pre-warm caches and services
    await Promise.all([
      this.warmupCaches(region),
      this.prepareServices(region),
      this.verifyResources(region)
    ]);
  }

  private async switchDatabasePrimary(region: string): Promise<void> {
    // Promote secondary to primary
    await execAsync(`
      PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
        SELECT pg_promote_secondary();
        SELECT pg_wal_replay_resume();
      "
    `);

    // Verify promotion
    const { stdout } = await execAsync(`
      PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
        SELECT pg_is_in_recovery();
      "
    `);

    if (stdout.includes('t')) {
      throw new Error('Database promotion failed');
    }
  }

  private async updateTrafficRouting(region: string): Promise<void> {
    // Update Cloud DNS
    await execAsync(`
      gcloud dns record-sets transaction start
      gcloud dns record-sets transaction remove --name="app.example.com." --type="A" --ttl=300 "$OLD_IP"
      gcloud dns record-sets transaction add --name="app.example.com." --type="A" --ttl=300 "$NEW_IP"
      gcloud dns record-sets transaction execute
    `);

    // Update load balancer configuration
    await execAsync(`
      kubectl patch service main-service -p '{"spec":{"loadBalancerSourceRanges":["0.0.0.0/0"]}}'
    `);
  }

  private async scaleUpServices(region: string): Promise<void> {
    const services = Object.keys(this.config.services);
    
    // Scale up services in dependency order
    for (const service of services) {
      const config = this.config.services[service];
      await execAsync(`
        kubectl --context=${region} scale deployment ${service} --replicas=${config.minReplicas}
      `);
      
      // Wait for service to be ready
      await this.waitForService(region, service);
    }
  }

  private async verifyFailover(region: string): Promise<void> {
    const checks = [
      this.verifyDatabaseConnectivity(region),
      this.verifyServiceHealth(region),
      this.verifyDataReplication(region),
      this.verifyNetworkLatency(region)
    ];

    await Promise.all(checks);
  }

  private selectBestSecondaryRegion(healthStatus: RegionHealth[]): RegionHealth | null {
    return healthStatus
      .filter(h => 
        h.region !== this.config.regions.primary && 
        h.status === 'healthy' &&
        h.latency < 100 // max 100ms latency
      )
      .sort((a, b) => 
        (this.config.regions.priority[a.region] || 0) - 
        (this.config.regions.priority[b.region] || 0)
      )[0] || null;
  }

  private async notifyFailoverSuccess(region: string, duration: number): Promise<void> {
    const message = `
🔄 Failover Completed Successfully
Target Region: ${region}
Duration: ${duration}ms
Status: All systems operational
    `;
    await this.notifier.sendToChannel('failover-alerts', message);
  }

  private async notifyFailoverFailure(region: string, error: Error): Promise<void> {
    const message = `
🚨 Failover Failed
Target Region: ${region}
Error: ${error.message}
Required: Immediate manual intervention
    `;
    await this.notifier.sendToChannel('failover-alerts', message);
  }

  private async waitForService(region: string, service: string): Promise<void> {
    const maxAttempts = 30;
    const interval = 10000; // 10 seconds

    for (let i = 0; i < maxAttempts; i++) {
      try {
        const { stdout } = await execAsync(`
          kubectl --context=${region} get deployment ${service} -o jsonpath='{.status.readyReplicas}'
        `);

        if (parseInt(stdout) >= this.config.services[service].minReplicas) {
          return;
        }
      } catch (error) {
        logger.warn(`Service ${service} not ready, attempt ${i + 1}/${maxAttempts}`);
      }

      await new Promise(resolve => setTimeout(resolve, interval));
    }

    throw new Error(`Service ${service} failed to become ready`);
  }
} 