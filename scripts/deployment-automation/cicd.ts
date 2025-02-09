import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile } from 'fs/promises';
import { logger } from '../utils/logger';
import { CheckResult } from './types';

const execAsync = promisify(exec);

interface PipelineStatus {
  name: string;
  status: 'success' | 'failure' | 'running' | 'skipped';
  duration: number;
  steps: Array<{
    name: string;
    status: 'success' | 'failure' | 'running' | 'skipped';
    duration: number;
    logs?: string[];
  }>;
  artifacts?: Array<{
    name: string;
    size: number;
    url: string;
  }>;
  coverage?: {
    lines: number;
    functions: number;
    branches: number;
  };
  tests?: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    duration: number;
  };
}

interface BranchProtection {
  requiredReviews: number;
  requiredChecks: string[];
  enforceAdmins: boolean;
  linearHistory: boolean;
  allowForcePush: boolean;
  allowDeletion: boolean;
}

interface DeploymentEnvironment {
  name: string;
  url: string;
  protected: boolean;
  requiredReviewers: string[];
  autoDeployment: boolean;
  lastDeployment?: {
    status: 'success' | 'failure';
    timestamp: string;
    version: string;
  };
}

export async function runCICDChecks(): Promise<CheckResult> {
  const details: string[] = [];
  const errors: Error[] = [];

  try {
    // 1. Pipeline Status Check
    logger.info('Checking pipeline status...');
    const pipelineStatus = await checkPipelineStatus();
    
    if (pipelineStatus.status === 'failure') {
      details.push(`❌ Pipeline '${pipelineStatus.name}' failed`);
      errors.push(new Error('Pipeline failure detected'));
    } else {
      details.push(`✅ Pipeline '${pipelineStatus.name}' passing`);
    }

    // 2. Branch Protection Rules
    logger.info('Checking branch protection rules...');
    const branchProtection = await checkBranchProtection();
    
    if (!validateBranchProtection(branchProtection)) {
      details.push('❌ Branch protection rules not properly configured');
      errors.push(new Error('Invalid branch protection configuration'));
    } else {
      details.push('✅ Branch protection rules properly configured');
    }

    // 3. Deployment Environments
    logger.info('Checking deployment environments...');
    const environments = await checkDeploymentEnvironments();
    
    const envIssues = validateEnvironments(environments);
    if (envIssues.length > 0) {
      details.push(`❌ Environment issues found: ${envIssues.join(', ')}`);
      errors.push(new Error('Deployment environment issues detected'));
    } else {
      details.push('✅ Deployment environments properly configured');
    }

    // 4. Artifact Verification
    logger.info('Verifying build artifacts...');
    const artifactStatus = await verifyArtifacts();
    
    if (!artifactStatus.valid) {
      details.push(`❌ Artifact issues: ${artifactStatus.issues.join(', ')}`);
      errors.push(new Error('Build artifact verification failed'));
    } else {
      details.push('✅ Build artifacts verified');
    }

    // 5. Rollback Capability
    logger.info('Checking rollback capability...');
    const rollbackStatus = await checkRollbackCapability();
    
    if (!rollbackStatus.ready) {
      details.push(`❌ Rollback issues: ${rollbackStatus.issues.join(', ')}`);
      errors.push(new Error('Rollback capability not properly configured'));
    } else {
      details.push('✅ Rollback capability verified');
    }

    // 6. Secret Management
    logger.info('Checking secret management...');
    const secretStatus = await checkSecretManagement();
    
    if (secretStatus.exposed.length > 0) {
      details.push(`❌ Exposed secrets found: ${secretStatus.exposed.length}`);
      errors.push(new Error('Secret management issues detected'));
    } else {
      details.push('✅ Secret management properly configured');
    }

    // 7. Pipeline Performance
    logger.info('Checking pipeline performance...');
    const performanceMetrics = await checkPipelinePerformance();
    
    if (performanceMetrics.issues.length > 0) {
      details.push(`❌ Pipeline performance issues: ${performanceMetrics.issues.join(', ')}`);
      errors.push(new Error('Pipeline performance issues detected'));
    } else {
      details.push(`✅ Pipeline performance within thresholds (${performanceMetrics.averageDuration}s)`);
    }

    return {
      status: errors.length === 0 ? 'success' : 'failure',
      details,
      errors: errors.length > 0 ? errors : undefined
    };

  } catch (error) {
    logger.error('CI/CD checks failed:', error);
    return {
      status: 'failure',
      details: [...details, `❌ Error: ${error.message}`],
      errors: [error]
    };
  }
}

async function checkPipelineStatus(): Promise<PipelineStatus> {
  try {
    const { stdout } = await execAsync('gh run list --limit 1 --json status,name,conclusion,jobs');
    const runs = JSON.parse(stdout);
    const latestRun = runs[0];

    return {
      name: latestRun.name,
      status: latestRun.conclusion,
      duration: latestRun.jobs.reduce((total: number, job: any) => total + job.duration, 0),
      steps: latestRun.jobs.map((job: any) => ({
        name: job.name,
        status: job.conclusion,
        duration: job.duration,
        logs: job.logs
      }))
    };
  } catch (error) {
    throw new Error(`Failed to check pipeline status: ${error.message}`);
  }
}

async function checkBranchProtection(): Promise<BranchProtection> {
  try {
    const { stdout } = await execAsync('gh api repos/:owner/:repo/branches/main/protection');
    const protection = JSON.parse(stdout);

    return {
      requiredReviews: protection.required_pull_request_reviews.required_approving_review_count,
      requiredChecks: protection.required_status_checks.contexts,
      enforceAdmins: protection.enforce_admins.enabled,
      linearHistory: protection.required_linear_history.enabled,
      allowForcePush: protection.allow_force_pushes.enabled,
      allowDeletion: protection.allow_deletions.enabled
    };
  } catch (error) {
    throw new Error(`Failed to check branch protection: ${error.message}`);
  }
}

function validateBranchProtection(protection: BranchProtection): boolean {
  return (
    protection.requiredReviews >= 1 &&
    protection.requiredChecks.length >= 3 &&
    protection.enforceAdmins &&
    protection.linearHistory &&
    !protection.allowForcePush &&
    !protection.allowDeletion
  );
}

async function checkDeploymentEnvironments(): Promise<DeploymentEnvironment[]> {
  try {
    const { stdout } = await execAsync('gh api repos/:owner/:repo/environments');
    const environments = JSON.parse(stdout).environments;

    return environments.map((env: any) => ({
      name: env.name,
      url: env.url,
      protected: env.protected,
      requiredReviewers: env.reviewers.map((r: any) => r.login),
      autoDeployment: env.auto_deploy,
      lastDeployment: env.last_deployment && {
        status: env.last_deployment.status,
        timestamp: env.last_deployment.created_at,
        version: env.last_deployment.ref
      }
    }));
  } catch (error) {
    throw new Error(`Failed to check deployment environments: ${error.message}`);
  }
}

function validateEnvironments(environments: DeploymentEnvironment[]): string[] {
  const issues: string[] = [];
  const requiredEnvs = ['development', 'staging', 'production'];

  requiredEnvs.forEach(env => {
    const environment = environments.find(e => e.name.toLowerCase().includes(env));
    if (!environment) {
      issues.push(`Missing ${env} environment`);
    } else if (env === 'production' && !environment.protected) {
      issues.push('Production environment not protected');
    }
  });

  return issues;
}

async function verifyArtifacts(): Promise<{ valid: boolean; issues: string[] }> {
  try {
    const { stdout } = await execAsync('gh run download --name build-artifacts');
    const artifacts = JSON.parse(stdout);
    const issues: string[] = [];

    const requiredArtifacts = ['app.js', 'app.css', 'index.html'];
    requiredArtifacts.forEach(artifact => {
      if (!artifacts.some((a: any) => a.name === artifact)) {
        issues.push(`Missing required artifact: ${artifact}`);
      }
    });

    return {
      valid: issues.length === 0,
      issues
    };
  } catch (error) {
    return {
      valid: false,
      issues: [`Failed to verify artifacts: ${error.message}`]
    };
  }
}

async function checkRollbackCapability(): Promise<{ ready: boolean; issues: string[] }> {
  try {
    const issues: string[] = [];

    // Check for rollback scripts
    const hasRollbackScript = await fileExists('scripts/rollback.sh');
    if (!hasRollbackScript) {
      issues.push('Missing rollback script');
    }

    // Check for backup configurations
    const hasBackupConfig = await fileExists('config/backup.json');
    if (!hasBackupConfig) {
      issues.push('Missing backup configuration');
    }

    // Check previous deployment versions
    const { stdout } = await execAsync('gh release list --limit 5');
    const releases = stdout.split('\n');
    if (releases.length < 2) {
      issues.push('Insufficient release history for rollback');
    }

    return {
      ready: issues.length === 0,
      issues
    };
  } catch (error) {
    return {
      ready: false,
      issues: [`Failed to check rollback capability: ${error.message}`]
    };
  }
}

async function checkSecretManagement(): Promise<{ exposed: string[] }> {
  try {
    const { stdout } = await execAsync('gh secret list');
    const secrets = stdout.split('\n');
    const exposed: string[] = [];

    // Check for required secrets
    const requiredSecrets = [
      'SUPABASE_URL',
      'SUPABASE_KEY',
      'STRIPE_SECRET_KEY',
      'JWT_SECRET'
    ];

    requiredSecrets.forEach(secret => {
      if (!secrets.some(s => s.includes(secret))) {
        exposed.push(`Missing required secret: ${secret}`);
      }
    });

    // Check for secrets in code
    const { stdout: grepResult } = await execAsync('git grep -l "secret|key|password|token" -- "*.{ts,js,json}"');
    const suspiciousFiles = grepResult.split('\n').filter(Boolean);

    if (suspiciousFiles.length > 0) {
      exposed.push(`Found potential secrets in ${suspiciousFiles.length} files`);
    }

    return { exposed };
  } catch (error) {
    return {
      exposed: [`Failed to check secret management: ${error.message}`]
    };
  }
}

async function checkPipelinePerformance(): Promise<{
  averageDuration: number;
  issues: string[];
}> {
  try {
    const { stdout } = await execAsync('gh run list --limit 10 --json durationMs');
    const runs = JSON.parse(stdout);
    const issues: string[] = [];

    const durations = runs.map((run: any) => run.durationMs);
    const averageDuration = durations.reduce((a: number, b: number) => a + b, 0) / durations.length / 1000;

    // Check for performance regressions
    const threshold = 600; // 10 minutes
    if (averageDuration > threshold) {
      issues.push(`Pipeline duration (${averageDuration.toFixed(0)}s) exceeds threshold (${threshold}s)`);
    }

    // Check for long-running steps
    const longSteps = runs.flatMap((run: any) =>
      run.jobs.filter((job: any) => job.duration > 300).map((job: any) => job.name)
    );

    if (longSteps.length > 0) {
      issues.push(`Long-running steps detected: ${longSteps.join(', ')}`);
    }

    return {
      averageDuration,
      issues
    };
  } catch (error) {
    return {
      averageDuration: 0,
      issues: [`Failed to check pipeline performance: ${error.message}`]
    };
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await readFile(path);
    return true;
  } catch {
    return false;
  }
} 