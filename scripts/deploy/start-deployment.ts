import { EnvironmentDeployer } from './environment-deployer';
import { AutomatedRecovery } from '../recovery/automated-recovery';
import { DeploymentSafeguards } from './deployment-safeguards';
import { Logger } from '../utils/logger';

async function startDeployment() {
  const logger = new Logger('Deployment');
  const environment = process.env.DEPLOY_ENV || 'staging';
  const recovery = new AutomatedRecovery();
  const safeguards = new DeploymentSafeguards();

  try {
    logger.info(`Starting deployment to ${environment}`);

    // Run pre-deployment safeguard checks
    logger.info('Running safeguard checks');
    await safeguards.performPreDeploymentChecks();

    // Initialize deployer
    const deployer = new EnvironmentDeployer(environment);

    // Start monitoring before deployment
    logger.info('Initializing monitoring');
    await deployer.setupMonitoring();

    // Start safeguard monitoring
    const stopMonitoring = await safeguards.monitorDeployment();

    try {
      // Execute deployment
      logger.info('Executing deployment');
      await deployer.deploy();

      // Verify deployment
      logger.info('Verifying deployment');
      await deployer.verifyDeployment();

      logger.info('Deployment completed successfully');
      process.exit(0);
    } finally {
      // Ensure monitoring is stopped
      stopMonitoring();
    }
  } catch (error) {
    logger.error('Deployment failed:', error);

    try {
      // Attempt automated recovery
      await recovery.handleIncident({
        type: 'deployment_failed',
        environment,
        error,
        timestamp: new Date().toISOString()
      });
    } catch (recoveryError) {
      logger.error('Recovery failed:', recoveryError);
    }

    process.exit(1);
  }
}

// Start the deployment
logger.info('Initiating deployment process');
startDeployment(); 