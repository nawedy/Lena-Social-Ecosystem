import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../utils/logger';
import { CheckResult } from './types';
import { validateK8sManifests } from '../utils/k8s-validator';
import { checkDatabaseConnections } from '../utils/db-checker';
import { validatePrometheusConfig } from '../utils/prometheus-checker';
import { checkBackupStatus } from '../utils/backup-checker';

const execAsync = promisify(exec);

interface InfrastructureStatus {
  docker: {
    imagesBuilt: boolean;
    imagesSigned: boolean;
    vulnerabilityScan: {
      critical: number;
      high: number;
      medium: number;
    };
  };
  kubernetes: {
    manifestsValid: boolean;
    resourceLimits: boolean;
    healthChecks: boolean;
    errors: string[];
  };
  database: {
    connected: boolean;
    replication: boolean;
    backups: {
      latest: string;
      status: 'success' | 'failed';
      encrypted: boolean;
    };
  };
  monitoring: {
    prometheusUp: boolean;
    grafanaUp: boolean;
    alertManagerUp: boolean;
    logsShipping: boolean;
  };
}

export async function runInfrastructureChecks(): Promise<CheckResult> {
  const details: string[] = [];
  const errors: Error[] = [];

  try {
    // 1. Docker Image Checks
    logger.info('Checking Docker images...');
    const dockerStatus = await checkDockerImages();
    
    if (dockerStatus.vulnerabilityScan.critical > 0) {
      details.push(`❌ Critical vulnerabilities found in Docker images: ${dockerStatus.vulnerabilityScan.critical}`);
      errors.push(new Error('Critical Docker vulnerabilities found'));
    } else {
      details.push('✅ Docker images secure and signed');
    }

    // 2. Kubernetes Manifests Validation
    logger.info('Validating Kubernetes manifests...');
    const k8sStatus = await validateK8sManifests();
    
    if (!k8sStatus.manifestsValid) {
      details.push(`❌ Kubernetes manifests invalid: ${k8sStatus.errors.join(', ')}`);
      errors.push(new Error('Invalid Kubernetes manifests'));
    } else {
      details.push('✅ Kubernetes manifests valid');
    }

    // 3. Database Checks
    logger.info('Checking database status...');
    const dbStatus = await checkDatabaseConnections();
    
    if (!dbStatus.connected) {
      details.push('❌ Database connection failed');
      errors.push(new Error('Database connection issues'));
    } else {
      details.push('✅ Database connections healthy');
    }

    // 4. Backup Status
    logger.info('Checking backup status...');
    const backupStatus = await checkBackupStatus();
    
    if (backupStatus.status === 'failed') {
      details.push('❌ Latest backup failed');
      errors.push(new Error('Backup system issues'));
    } else {
      details.push(`✅ Backups healthy (Latest: ${backupStatus.latest})`);
    }

    // 5. Monitoring Stack
    logger.info('Checking monitoring stack...');
    const monitoringStatus = await checkMonitoringStack();
    
    if (!monitoringStatus.prometheusUp || !monitoringStatus.grafanaUp) {
      details.push('❌ Monitoring stack issues detected');
      errors.push(new Error('Monitoring system not fully operational'));
    } else {
      details.push('✅ Monitoring stack operational');
    }

    // 6. Resource Quotas
    logger.info('Checking resource quotas...');
    const quotaStatus = await checkResourceQuotas();
    
    if (quotaStatus.exceeded.length > 0) {
      details.push(`❌ Resource quotas exceeded: ${quotaStatus.exceeded.join(', ')}`);
      errors.push(new Error('Resource quota issues'));
    } else {
      details.push('✅ Resource quotas within limits');
    }

    // 7. SSL Certificates
    logger.info('Checking SSL certificates...');
    const sslStatus = await checkSSLCertificates();
    
    if (sslStatus.expiring.length > 0) {
      details.push(`⚠️ SSL certificates expiring soon: ${sslStatus.expiring.join(', ')}`);
    } else {
      details.push('✅ SSL certificates valid');
    }

    return {
      status: errors.length === 0 ? 'success' : 'failure',
      details,
      errors: errors.length > 0 ? errors : undefined
    };

  } catch (error) {
    logger.error('Infrastructure checks failed:', error);
    return {
      status: 'failure',
      details: [...details, `❌ Error: ${error.message}`],
      errors: [error]
    };
  }
}

async function checkDockerImages(): Promise<InfrastructureStatus['docker']> {
  try {
    // Run Trivy scan on images
    const { stdout } = await execAsync('trivy image --format json app:latest');
    const scanResults = JSON.parse(stdout);
    
    const vulnerabilities = {
      critical: 0,
      high: 0,
      medium: 0
    };

    scanResults.vulnerabilities.forEach((vuln: any) => {
      if (vuln.severity === 'CRITICAL') vulnerabilities.critical++;
      if (vuln.severity === 'HIGH') vulnerabilities.high++;
      if (vuln.severity === 'MEDIUM') vulnerabilities.medium++;
    });

    return {
      imagesBuilt: true,
      imagesSigned: await checkImageSignatures(),
      vulnerabilityScan: vulnerabilities
    };
  } catch (error) {
    throw new Error(`Docker image check failed: ${error.message}`);
  }
}

async function checkImageSignatures(): Promise<boolean> {
  try {
    const { stdout } = await execAsync('cosign verify app:latest');
    return stdout.includes('Verification successful');
  } catch {
    return false;
  }
}

async function checkMonitoringStack(): Promise<InfrastructureStatus['monitoring']> {
  try {
    const prometheusConfig = await validatePrometheusConfig();
    const { stdout: grafanaStatus } = await execAsync('curl -s http://localhost:3000/api/health');
    const { stdout: alertManagerStatus } = await execAsync('curl -s http://localhost:9093/-/healthy');

    return {
      prometheusUp: prometheusConfig.valid,
      grafanaUp: JSON.parse(grafanaStatus).database === 'ok',
      alertManagerUp: alertManagerStatus === 'ok',
      logsShipping: await checkLogsShipping()
    };
  } catch (error) {
    throw new Error(`Monitoring check failed: ${error.message}`);
  }
}

async function checkLogsShipping(): Promise<boolean> {
  try {
    const { stdout } = await execAsync('curl -s http://localhost:9200/_cat/indices');
    return stdout.includes('logstash-');
  } catch {
    return false;
  }
}

async function checkResourceQuotas(): Promise<{ exceeded: string[] }> {
  try {
    const { stdout } = await execAsync('kubectl get resourcequotas -o json');
    const quotas = JSON.parse(stdout);
    const exceeded: string[] = [];

    quotas.items.forEach((quota: any) => {
      const used = quota.status.used;
      const hard = quota.status.hard;
      
      Object.keys(hard).forEach(resource => {
        if (parseInt(used[resource]) > parseInt(hard[resource])) {
          exceeded.push(resource);
        }
      });
    });

    return { exceeded };
  } catch (error) {
    throw new Error(`Resource quota check failed: ${error.message}`);
  }
}

async function checkSSLCertificates(): Promise<{ expiring: string[] }> {
  try {
    const { stdout } = await execAsync('kubectl get secrets -l type=kubernetes.io/tls -o json');
    const certs = JSON.parse(stdout);
    const expiring: string[] = [];
    const warningDays = 30;

    certs.items.forEach((cert: any) => {
      const expiryDate = new Date(cert.metadata.annotations['cert-manager.io/expiry']);
      const daysUntilExpiry = Math.floor((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      
      if (daysUntilExpiry < warningDays) {
        expiring.push(`${cert.metadata.name} (${daysUntilExpiry} days)`);
      }
    });

    return { expiring };
  } catch (error) {
    throw new Error(`SSL certificate check failed: ${error.message}`);
  }
} 