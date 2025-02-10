import { execSync } from 'child_process';
import { resolve } from 'path';
import * as yaml from 'js-yaml';
import { readFileSync, writeFileSync } from 'fs';

interface DeploymentConfig {
  environment: string;
  registry: string;
  imageTag: string;
  namespace: string;
  domain: string;
  replicas: number;
}

class Deployer {
  private config: DeploymentConfig;
  private k8sDir: string;

  constructor(config: DeploymentConfig) {
    this.config = config;
    this.k8sDir = resolve(__dirname, '../../k8s');
  }

  async deploy(): Promise<void> {
    try {
      console.log(`Starting deployment to ${this.config.environment}...`);

      // Create namespace if it doesn't exist
      this.executeCommand(`kubectl create namespace ${this.config.namespace} --dry-run=client -o yaml | kubectl apply -f -`);

      // Apply ConfigMaps and Secrets
      await this.applyConfigMaps();
      await this.applySecrets();

      // Apply Kubernetes manifests
      await this.applyKubernetesManifests();

      // Verify deployment
      await this.verifyDeployment();

      console.log('Deployment completed successfully!');
    } catch (error) {
      console.error('Deployment failed:', error);
      await this.handleDeploymentFailure();
      throw error;
    }
  }

  private async applyConfigMaps(): Promise<void> {
    const configMap = {
      apiVersion: 'v1',
      kind: 'ConfigMap',
      metadata: {
        name: 'tiktok-toe-config',
        namespace: this.config.namespace
      },
      data: {
        NODE_ENV: this.config.environment,
        API_URL: `https://${this.config.domain}/api`,
        // Add other configuration values
      }
    };

    const configMapPath = resolve(this.k8sDir, 'configmap.yaml');
    writeFileSync(configMapPath, yaml.dump(configMap));
    this.executeCommand(`kubectl apply -f ${configMapPath}`);
  }

  private async applySecrets(): Promise<void> {
    // Apply secrets from secure storage (e.g., AWS Secrets Manager, HashiCorp Vault)
    // Implementation depends on your secrets management solution
  }

  private async applyKubernetesManifests(): Promise<void> {
    const files = ['deployment.yaml', 'service.yaml', 'ingress.yaml'];
    
    for (const file of files) {
      const filePath = resolve(this.k8sDir, file);
      let content = readFileSync(filePath, 'utf8');
      
      // Replace variables
      content = content.replace('${REGISTRY}', this.config.registry)
                      .replace('${IMAGE_NAME}', 'tiktok-toe')
                      .replace('${IMAGE_TAG}', this.config.imageTag);
      
      const tempPath = resolve(this.k8sDir, `temp-${file}`);
      writeFileSync(tempPath, content);
      
      this.executeCommand(`kubectl apply -f ${tempPath}`);
    }
  }

  private async verifyDeployment(): Promise<void> {
    // Wait for deployment to be ready
    this.executeCommand(
      `kubectl rollout status deployment/tiktok-toe -n ${this.config.namespace} --timeout=300s`
    );

    // Verify service health
    const healthCheck = await this.checkServiceHealth();
    if (!healthCheck.healthy) {
      throw new Error(`Service health check failed: ${healthCheck.reason}`);
    }

    // Verify ingress
    const ingressCheck = await this.checkIngress();
    if (!ingressCheck.ready) {
      throw new Error(`Ingress not ready: ${ingressCheck.reason}`);
    }
  }

  private async checkServiceHealth(): Promise<{ healthy: boolean; reason?: string }> {
    try {
      const result = this.executeCommand(
        `kubectl exec deploy/tiktok-toe -n ${this.config.namespace} -- curl -s http://localhost:3000/health`
      );
      const health = JSON.parse(result);
      return { healthy: health.status === 'ok' };
    } catch (error) {
      return { healthy: false, reason: error.message };
    }
  }

  private async checkIngress(): Promise<{ ready: boolean; reason?: string }> {
    try {
      const result = this.executeCommand(
        `kubectl get ingress tiktok-toe -n ${this.config.namespace} -o json`
      );
      const ingress = JSON.parse(result);
      return {
        ready: ingress.status.loadBalancer?.ingress?.length > 0,
        reason: 'Ingress address not assigned'
      };
    } catch (error) {
      return { ready: false, reason: error.message };
    }
  }

  private async handleDeploymentFailure(): Promise<void> {
    console.log('Initiating rollback...');
    try {
      this.executeCommand(
        `kubectl rollout undo deployment/tiktok-toe -n ${this.config.namespace}`
      );
      console.log('Rollback completed successfully');
    } catch (error) {
      console.error('Rollback failed:', error);
    }
  }

  private executeCommand(command: string): string {
    return execSync(command, { encoding: 'utf8' });
  }
}

// Usage example
const config: DeploymentConfig = {
  environment: process.env.DEPLOY_ENV || 'staging',
  registry: process.env.REGISTRY || 'ghcr.io/your-org',
  imageTag: process.env.IMAGE_TAG || 'latest',
  namespace: 'game-services',
  domain: process.env.DOMAIN || 'staging.tiktok-toe.example.com',
  replicas: parseInt(process.env.REPLICAS || '3', 10)
};

const deployer = new Deployer(config);
deployer.deploy().catch(error => {
  console.error('Deployment failed:', error);
  process.exit(1);
}); 