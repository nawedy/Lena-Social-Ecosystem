import { Deployer } from './deploy';
import { resolve } from 'path';
import * as yaml from 'js-yaml';
import { readFileSync } from 'fs';

interface EnvironmentConfig extends DeploymentConfig {
  monitoring: {
    enabled: boolean;
    scrapeInterval: string;
    retentionDays: number;
  };
  scaling: {
    minReplicas: number;
    maxReplicas: number;
    targetCPUUtilization: number;
  };
  security: {
    enableNetworkPolicy: boolean;
    enablePodSecurityPolicy: boolean;
    scanImages: boolean;
  };
}

class EnvironmentDeployer {
  private config: EnvironmentConfig;
  private deployer: Deployer;

  constructor(environment: string) {
    this.config = this.loadEnvironmentConfig(environment);
    this.deployer = new Deployer(this.config);
  }

  private loadEnvironmentConfig(environment: string): EnvironmentConfig {
    const configPath = resolve(__dirname, `../../k8s/environments/${environment}.yaml`);
    const envConfig = yaml.load(readFileSync(configPath, 'utf8')) as any;

    return {
      environment,
      registry: process.env.REGISTRY || 'ghcr.io/your-org',
      imageTag: process.env.IMAGE_TAG || 'latest',
      namespace: 'game-services',
      domain: process.env.DOMAIN || `${environment}.tiktok-toe.example.com`,
      replicas: envConfig.spec.replicas,
      monitoring: {
        enabled: true,
        scrapeInterval: '15s',
        retentionDays: environment === 'production' ? 30 : 7
      },
      scaling: {
        minReplicas: environment === 'production' ? 3 : 1,
        maxReplicas: environment === 'production' ? 10 : 5,
        targetCPUUtilization: 70
      },
      security: {
        enableNetworkPolicy: environment === 'production',
        enablePodSecurityPolicy: environment === 'production',
        scanImages: true
      }
    };
  }

  async deploy(): Promise<void> {
    try {
      // Apply environment-specific configurations
      await this.applyEnvironmentConfig();

      // Set up monitoring if enabled
      if (this.config.monitoring.enabled) {
        await this.setupMonitoring();
      }

      // Apply security policies
      if (this.config.security.enableNetworkPolicy) {
        await this.applyNetworkPolicies();
      }

      // Deploy the application
      await this.deployer.deploy();

      // Verify the deployment
      await this.verifyEnvironment();

    } catch (error) {
      console.error(`Environment deployment failed: ${error.message}`);
      throw error;
    }
  }

  private async applyEnvironmentConfig(): Promise<void> {
    const envConfigPath = resolve(__dirname, `../../k8s/environments/${this.config.environment}.yaml`);
    await this.deployer.executeCommand(`kubectl apply -f ${envConfigPath}`);
  }

  private async setupMonitoring(): Promise<void> {
    const monitoringPath = resolve(__dirname, '../../k8s/monitoring');
    await this.deployer.executeCommand(`kubectl apply -f ${monitoringPath}`);
  }

  private async applyNetworkPolicies(): Promise<void> {
    const networkPolicyPath = resolve(__dirname, '../../k8s/security/network-policies.yaml');
    await this.deployer.executeCommand(`kubectl apply -f ${networkPolicyPath}`);
  }

  private async verifyEnvironment(): Promise<void> {
    // Verify monitoring setup
    if (this.config.monitoring.enabled) {
      const metricsEndpoint = await this.deployer.executeCommand(
        `kubectl get service tiktok-toe-metrics -n ${this.config.namespace} -o jsonpath='{.status.loadBalancer.ingress[0].ip}'`
      );
      if (!metricsEndpoint) {
        throw new Error('Metrics endpoint not available');
      }
    }

    // Verify security policies
    if (this.config.security.enableNetworkPolicy) {
      const networkPolicies = await this.deployer.executeCommand(
        `kubectl get networkpolicy -n ${this.config.namespace} -o json`
      );
      const policies = JSON.parse(networkPolicies);
      if (!policies.items.length) {
        throw new Error('Network policies not applied');
      }
    }
  }
}

// Usage
const environment = process.env.DEPLOY_ENV || 'staging';
const environmentDeployer = new EnvironmentDeployer(environment);

environmentDeployer.deploy()
  .then(() => {
    console.log(`Successfully deployed to ${environment}`);
    process.exit(0);
  })
  .catch(error => {
    console.error(`Deployment to ${environment} failed:`, error);
    process.exit(1);
  }); 