import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile } from 'fs/promises';
import { logger } from '../utils/logger';
import { CheckResult } from './types';
import { scanSecrets } from '../utils/secret-scanner';
import { validateHeaders } from '../utils/security-headers';
import { checkCORS } from '../utils/cors-checker';

const execAsync = promisify(exec);

interface SecurityScanResult {
  vulnerabilities: Array<{
    severity: 'low' | 'medium' | 'high' | 'critical';
    package: string;
    description: string;
  }>;
  secretsFound: Array<{
    file: string;
    line: number;
    type: string;
  }>;
  configIssues: Array<{
    type: string;
    description: string;
  }>;
}

export async function runSecurityChecks(): Promise<CheckResult> {
  const details: string[] = [];
  const errors: Error[] = [];

  try {
    // 1. Dependencies Security Audit
    logger.info('Running dependency security audit...');
    const auditResult = await execAsync('pnpm audit --json');
    const auditData = JSON.parse(auditResult.stdout);
    
    if (auditData.vulnerabilities > 0) {
      details.push(`❌ Found ${auditData.vulnerabilities} security vulnerabilities`);
      errors.push(new Error('Security vulnerabilities found in dependencies'));
    } else {
      details.push('✅ No security vulnerabilities found in dependencies');
    }

    // 2. Secret Scanning
    logger.info('Scanning for secrets...');
    const secretScanResult = await scanSecrets();
    if (secretScanResult.length > 0) {
      details.push(`❌ Found ${secretScanResult.length} potential secrets in code`);
      errors.push(new Error('Secrets found in codebase'));
    } else {
      details.push('✅ No secrets found in codebase');
    }

    // 3. Environment Variables Check
    logger.info('Checking environment variables...');
    const envCheck = await validateEnvironmentVariables();
    if (envCheck.missing.length > 0) {
      details.push(`❌ Missing required environment variables: ${envCheck.missing.join(', ')}`);
      errors.push(new Error('Missing required environment variables'));
    } else {
      details.push('✅ All required environment variables are set');
    }

    // 4. Security Headers Check
    logger.info('Checking security headers...');
    const headerCheck = await validateHeaders();
    if (headerCheck.issues.length > 0) {
      details.push(`❌ Security header issues found: ${headerCheck.issues.length}`);
      errors.push(new Error('Security header configuration issues found'));
    } else {
      details.push('✅ Security headers properly configured');
    }

    // 5. CORS Configuration Check
    logger.info('Checking CORS configuration...');
    const corsCheck = await checkCORS();
    if (corsCheck.issues.length > 0) {
      details.push(`❌ CORS configuration issues found: ${corsCheck.issues.length}`);
      errors.push(new Error('CORS configuration issues found'));
    } else {
      details.push('✅ CORS configuration is secure');
    }

    // 6. SSL/TLS Configuration Check
    logger.info('Checking SSL/TLS configuration...');
    const sslCheck = await checkSSLConfiguration();
    if (!sslCheck.valid) {
      details.push('❌ SSL/TLS configuration issues found');
      errors.push(new Error('SSL/TLS configuration issues found'));
    } else {
      details.push('✅ SSL/TLS configuration is secure');
    }

    // 7. API Rate Limiting Check
    logger.info('Checking rate limiting configuration...');
    const rateLimitCheck = await checkRateLimiting();
    if (!rateLimitCheck.configured) {
      details.push('❌ Rate limiting not properly configured');
      errors.push(new Error('Rate limiting configuration issues found'));
    } else {
      details.push('✅ Rate limiting properly configured');
    }

    // 8. Authentication/Authorization Check
    logger.info('Checking auth configuration...');
    const authCheck = await checkAuthConfiguration();
    if (authCheck.issues.length > 0) {
      details.push(`❌ Authentication/Authorization issues found: ${authCheck.issues.length}`);
      errors.push(new Error('Auth configuration issues found'));
    } else {
      details.push('✅ Authentication/Authorization properly configured');
    }

    return {
      status: errors.length === 0 ? 'success' : 'failure',
      details,
      errors: errors.length > 0 ? errors : undefined
    };

  } catch (error) {
    logger.error('Security checks failed:', error);
    return {
      status: 'failure',
      details: [...details, `❌ Error: ${error.message}`],
      errors: [error]
    };
  }
}

async function validateEnvironmentVariables(): Promise<{ missing: string[] }> {
  const requiredVars = [
    'PUBLIC_SUPABASE_URL',
    'PUBLIC_SUPABASE_ANON_KEY',
    'PUBLIC_WEB3_STORAGE_TOKEN',
    'PUBLIC_PLAUSIBLE_DOMAIN',
    'PUBLIC_MAGIC_PUBLISHABLE_KEY',
    'PUBLIC_ETHEREUM_NETWORK',
    'PUBLIC_INFURA_PROJECT_ID'
  ];

  const missing: string[] = [];
  for (const variable of requiredVars) {
    if (!process.env[variable]) {
      missing.push(variable);
    }
  }

  return { missing };
}

async function checkSSLConfiguration(): Promise<{ valid: boolean; issues?: string[] }> {
  try {
    // Check SSL certificate validity and configuration
    const { stdout } = await execAsync('openssl s_client -connect localhost:443 -tls1_2');
    
    const issues: string[] = [];
    if (!stdout.includes('Protocol  : TLSv1.2')) {
      issues.push('TLS 1.2 not supported');
    }
    if (!stdout.includes('Certificate chain')) {
      issues.push('Invalid certificate chain');
    }

    return {
      valid: issues.length === 0,
      issues: issues.length > 0 ? issues : undefined
    };
  } catch (error) {
    return {
      valid: false,
      issues: ['SSL check failed: ' + error.message]
    };
  }
}

async function checkRateLimiting(): Promise<{ configured: boolean; details?: string }> {
  try {
    // Check rate limiting configuration in various files
    const nginxConfig = await readFile('nginx/nginx.conf', 'utf8');
    const hasRateLimit = nginxConfig.includes('limit_req_zone') || 
                        nginxConfig.includes('limit_conn_zone');

    return {
      configured: hasRateLimit,
      details: hasRateLimit ? 'Rate limiting configured in nginx' : 'No rate limiting found'
    };
  } catch (error) {
    return {
      configured: false,
      details: 'Failed to check rate limiting: ' + error.message
    };
  }
}

async function checkAuthConfiguration(): Promise<{ issues: string[] }> {
  const issues: string[] = [];

  try {
    // Check authentication configuration
    const authConfig = await readFile('config/auth.json', 'utf8');
    const config = JSON.parse(authConfig);

    if (!config.jwtSecret) {
      issues.push('JWT secret not configured');
    }
    if (!config.sessionTimeout) {
      issues.push('Session timeout not configured');
    }
    if (!config.passwordPolicy || !config.passwordPolicy.minLength) {
      issues.push('Password policy not properly configured');
    }

    return { issues };
  } catch (error) {
    return {
      issues: ['Failed to check auth configuration: ' + error.message]
    };
  }
} 