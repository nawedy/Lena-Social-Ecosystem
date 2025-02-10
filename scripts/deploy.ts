import { DeploymentPipeline } from './deployment/deployment-pipeline';
import * as yaml from 'js-yaml';
import { readFileSync } from 'fs';
import { resolve } from 'path';

async function deploy(environment: string) {
  try {
    // Load deployment configuration
    const configPath = resolve(__dirname, '../config/deployment.yaml');
    const config = yaml.load(readFileSync(configPath, 'utf8')) as any;

    if (!config.environments[environment]) {
      throw new Error(`Environment ${environment} not found in configuration`);
    }

    const envConfig = config.environments[environment];
    const pipeline = new DeploymentPipeline({
      environment,
      region: envConfig.region,
      scale: envConfig.scale,
      features: envConfig.features,
      testing: envConfig.testing,
      rollout: envConfig.rollout
    });

    // Execute deployment
    await pipeline.deploy();

    console.log(`Deployment to ${environment} completed successfully`);
    process.exit(0);
  } catch (error) {
    console.error(`Deployment to ${environment} failed:`, error);
    process.exit(1);
  }
}

// Get environment from command line argument
const environment = process.argv[2];
if (!environment) {
  console.error('Please specify an environment (development, staging, or production)');
  process.exit(1);
}

deploy(environment); 