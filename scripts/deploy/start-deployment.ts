import { EnvironmentDeployer } from './environment-deployer';
import { AutomatedRecovery } from '../recovery/automated-recovery';
import { Logger } from '../utils/logger';

async function startDeployment() {
  const logger = new Logger('Deployment');
  const environment = process.env.DEPLOY_ENV || 'staging';
  const recovery = new AutomatedRecovery();

  try {
    logger.info(`Starting deployment to ${environment}`);

    // Initialize deployer
    const deployer = new EnvironmentDeployer(environment);

    // Start monitoring before deployment
    logger.info('Initializing monitoring');
    await deployer.setupMonitoring();

    // Execute deployment
    logger.info('Executing deployment');
    await deployer.deploy();

    // Verify deployment
    logger.info('Verifying deployment');
    await deployer.verifyDeployment();

    logger.info('Deployment completed successfully');
    process.exit(0);
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

startDeployment(); 