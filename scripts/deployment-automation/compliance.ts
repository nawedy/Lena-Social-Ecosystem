import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile } from 'fs/promises';
import { logger } from '../utils/logger';
import { CheckResult } from './types';
import { scanPrivacyPolicy } from '../utils/privacy-scanner';
import { validateGDPRCompliance } from '../utils/gdpr-validator';
import { checkAccessibility } from '../utils/accessibility-checker';

const execAsync = promisify(exec);

interface ComplianceStatus {
  gdpr: {
    compliant: boolean;
    issues: string[];
    dataProtection: boolean;
    userConsent: boolean;
    dataRetention: boolean;
  };
  accessibility: {
    score: number;
    violations: Array<{
      impact: 'critical' | 'serious' | 'moderate' | 'minor';
      description: string;
      elements: string[];
    }>;
  };
  security: {
    dataEncryption: boolean;
    secureTransport: boolean;
    authProtection: boolean;
  };
  privacy: {
    policyExists: boolean;
    lastUpdated: string;
    missingClauses: string[];
  };
}

export async function runComplianceChecks(): Promise<CheckResult> {
  const details: string[] = [];
  const errors: Error[] = [];

  try {
    // 1. GDPR Compliance
    logger.info('Checking GDPR compliance...');
    const gdprStatus = await validateGDPRCompliance();
    
    if (!gdprStatus.compliant) {
      details.push(`❌ GDPR compliance issues: ${gdprStatus.issues.join(', ')}`);
      errors.push(new Error('GDPR compliance issues found'));
    } else {
      details.push('✅ GDPR compliant');
    }

    // 2. Accessibility
    logger.info('Checking accessibility compliance...');
    const accessibilityStatus = await checkAccessibility();
    
    if (accessibilityStatus.score < 90) {
      details.push(`❌ Accessibility score below threshold: ${accessibilityStatus.score}`);
      errors.push(new Error('Accessibility issues found'));
    } else {
      details.push(`✅ Accessibility score: ${accessibilityStatus.score}`);
    }

    // 3. Privacy Policy
    logger.info('Checking privacy policy...');
    const privacyStatus = await checkPrivacyPolicy();
    
    if (!privacyStatus.policyExists || privacyStatus.missingClauses.length > 0) {
      details.push('❌ Privacy policy issues found');
      errors.push(new Error('Privacy policy incomplete or missing'));
    } else {
      details.push('✅ Privacy policy up to date');
    }

    // 4. Data Protection
    logger.info('Checking data protection measures...');
    const dataProtectionStatus = await checkDataProtection();
    
    if (!dataProtectionStatus.compliant) {
      details.push(`❌ Data protection issues: ${dataProtectionStatus.issues.join(', ')}`);
      errors.push(new Error('Data protection issues found'));
    } else {
      details.push('✅ Data protection measures in place');
    }

    // 5. Cookie Compliance
    logger.info('Checking cookie compliance...');
    const cookieStatus = await checkCookieCompliance();
    
    if (!cookieStatus.compliant) {
      details.push(`❌ Cookie compliance issues: ${cookieStatus.issues.join(', ')}`);
      errors.push(new Error('Cookie compliance issues found'));
    } else {
      details.push('✅ Cookie usage compliant');
    }

    // 6. Terms of Service
    logger.info('Checking terms of service...');
    const tosStatus = await checkTermsOfService();
    
    if (!tosStatus.exists || tosStatus.missingClauses.length > 0) {
      details.push('❌ Terms of service issues found');
      errors.push(new Error('Terms of service incomplete or missing'));
    } else {
      details.push('✅ Terms of service up to date');
    }

    // 7. Data Retention
    logger.info('Checking data retention policies...');
    const retentionStatus = await checkDataRetention();
    
    if (!retentionStatus.compliant) {
      details.push(`❌ Data retention issues: ${retentionStatus.issues.join(', ')}`);
      errors.push(new Error('Data retention issues found'));
    } else {
      details.push('✅ Data retention policies compliant');
    }

    return {
      status: errors.length === 0 ? 'success' : 'failure',
      details,
      errors: errors.length > 0 ? errors : undefined
    };

  } catch (error) {
    logger.error('Compliance checks failed:', error);
    return {
      status: 'failure',
      details: [...details, `❌ Error: ${error.message}`],
      errors: [error]
    };
  }
}

async function checkPrivacyPolicy(): Promise<ComplianceStatus['privacy']> {
  try {
    const scanResult = await scanPrivacyPolicy();
    const stats = await exec('git log -1 --format=%cd docs/legal/privacy-policy.md');

    return {
      policyExists: true,
      lastUpdated: stats.stdout.trim(),
      missingClauses: scanResult.missingClauses
    };
  } catch {
    return {
      policyExists: false,
      lastUpdated: '',
      missingClauses: ['Policy file not found']
    };
  }
}

interface DataProtectionResult {
  compliant: boolean;
  issues: string[];
}

async function checkDataProtection(): Promise<DataProtectionResult> {
  const issues: string[] = [];

  try {
    // Check encryption at rest
    const dbConfig = await readFile('config/database.json', 'utf8');
    if (!dbConfig.includes('"encryption": true')) {
      issues.push('Database encryption not enabled');
    }

    // Check secure transport
    const apiConfig = await readFile('config/api.json', 'utf8');
    if (!apiConfig.includes('"forceHttps": true')) {
      issues.push('HTTPS not enforced');
    }

    // Check data anonymization
    const dataConfig = await readFile('config/data-processing.json', 'utf8');
    if (!dataConfig.includes('"anonymizeData": true')) {
      issues.push('Data anonymization not configured');
    }

    return {
      compliant: issues.length === 0,
      issues
    };
  } catch (error) {
    return {
      compliant: false,
      issues: ['Failed to check data protection configuration']
    };
  }
}

interface CookieComplianceResult {
  compliant: boolean;
  issues: string[];
}

async function checkCookieCompliance(): Promise<CookieComplianceResult> {
  const issues: string[] = [];

  try {
    // Check cookie banner
    const { stdout: cookieBannerCheck } = await execAsync('grep -r "cookie-consent" src/');
    if (!cookieBannerCheck) {
      issues.push('Cookie consent banner not implemented');
    }

    // Check cookie policy
    const cookiePolicy = await readFile('docs/legal/cookie-policy.md', 'utf8');
    const requiredSections = ['Essential Cookies', 'Analytics Cookies', 'Marketing Cookies'];
    
    requiredSections.forEach(section => {
      if (!cookiePolicy.includes(section)) {
        issues.push(`Missing cookie policy section: ${section}`);
      }
    });

    return {
      compliant: issues.length === 0,
      issues
    };
  } catch (error) {
    return {
      compliant: false,
      issues: ['Failed to check cookie compliance']
    };
  }
}

interface TermsOfServiceResult {
  exists: boolean;
  missingClauses: string[];
}

async function checkTermsOfService(): Promise<TermsOfServiceResult> {
  try {
    const content = await readFile('docs/legal/terms-of-service.md', 'utf8');
    const requiredClauses = [
      'User Obligations',
      'Acceptable Use',
      'Intellectual Property',
      'Limitation of Liability',
      'Termination',
      'Governing Law'
    ];

    const missingClauses = requiredClauses.filter(clause =>
      !content.toLowerCase().includes(clause.toLowerCase())
    );

    return {
      exists: true,
      missingClauses
    };
  } catch {
    return {
      exists: false,
      missingClauses: ['Terms of service file not found']
    };
  }
}

interface DataRetentionResult {
  compliant: boolean;
  issues: string[];
}

async function checkDataRetention(): Promise<DataRetentionResult> {
  const issues: string[] = [];

  try {
    const retentionConfig = await readFile('config/data-retention.json', 'utf8');
    const config = JSON.parse(retentionConfig);

    if (!config.enabled) {
      issues.push('Data retention not enabled');
    }

    if (!config.policies || Object.keys(config.policies).length === 0) {
      issues.push('No data retention policies defined');
    }

    if (!config.automation || !config.automation.enabled) {
      issues.push('Automated data cleanup not configured');
    }

    return {
      compliant: issues.length === 0,
      issues
    };
  } catch {
    return {
      compliant: false,
      issues: ['Failed to check data retention configuration']
    };
  }
} 