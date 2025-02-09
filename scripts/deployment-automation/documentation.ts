import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile, readdir } from 'fs/promises';
import { join } from 'path';
import { logger } from '../utils/logger';
import { CheckResult } from './types';
import { validateMarkdown } from '../utils/markdown-validator';
import { checkApiDocs } from '../utils/api-docs-checker';

const execAsync = promisify(exec);

interface DocumentationStatus {
  readme: {
    exists: boolean;
    sections: string[];
    lastUpdated: string;
  };
  api: {
    coverage: number;
    endpoints: number;
    missingDocs: string[];
  };
  changelog: {
    exists: boolean;
    lastVersion: string;
    lastUpdated: string;
  };
  deployment: {
    exists: boolean;
    environments: string[];
    complete: boolean;
  };
}

export async function runDocumentationChecks(): Promise<CheckResult> {
  const details: string[] = [];
  const errors: Error[] = [];

  try {
    // 1. README Check
    logger.info('Checking README...');
    const readmeStatus = await checkReadme();
    
    if (!readmeStatus.exists) {
      details.push('❌ README.md is missing');
      errors.push(new Error('Missing README.md'));
    } else {
      const missingRequiredSections = checkRequiredSections(readmeStatus.sections);
      if (missingRequiredSections.length > 0) {
        details.push(`❌ README missing sections: ${missingRequiredSections.join(', ')}`);
        errors.push(new Error('Incomplete README.md'));
      } else {
        details.push('✅ README.md is complete');
      }
    }

    // 2. API Documentation
    logger.info('Checking API documentation...');
    const apiStatus = await checkApiDocs();
    
    if (apiStatus.coverage < 90) {
      details.push(`❌ API documentation coverage below threshold: ${apiStatus.coverage}%`);
      errors.push(new Error('Insufficient API documentation'));
    } else {
      details.push(`✅ API documentation coverage: ${apiStatus.coverage}%`);
    }

    // 3. Changelog
    logger.info('Checking CHANGELOG...');
    const changelogStatus = await checkChangelog();
    
    if (!changelogStatus.exists) {
      details.push('❌ CHANGELOG.md is missing');
      errors.push(new Error('Missing CHANGELOG.md'));
    } else {
      details.push(`✅ CHANGELOG up to date (${changelogStatus.lastVersion})`);
    }

    // 4. Deployment Documentation
    logger.info('Checking deployment documentation...');
    const deploymentStatus = await checkDeploymentDocs();
    
    if (!deploymentStatus.complete) {
      details.push('❌ Deployment documentation incomplete');
      errors.push(new Error('Incomplete deployment documentation'));
    } else {
      details.push('✅ Deployment documentation complete');
    }

    // 5. Code Comments
    logger.info('Checking code comments...');
    const commentStatus = await checkCodeComments();
    
    if (commentStatus.coverage < 70) {
      details.push(`❌ Code documentation coverage below threshold: ${commentStatus.coverage}%`);
      errors.push(new Error('Insufficient code documentation'));
    } else {
      details.push(`✅ Code documentation coverage: ${commentStatus.coverage}%`);
    }

    // 6. Environment Setup
    logger.info('Checking environment setup docs...');
    const envSetupStatus = await checkEnvironmentSetup();
    
    if (!envSetupStatus.complete) {
      details.push('❌ Environment setup documentation incomplete');
      errors.push(new Error('Incomplete environment setup documentation'));
    } else {
      details.push('✅ Environment setup documentation complete');
    }

    // 7. Architecture Documentation
    logger.info('Checking architecture documentation...');
    const architectureStatus = await checkArchitectureDocs();
    
    if (!architectureStatus.exists) {
      details.push('❌ Architecture documentation missing');
      errors.push(new Error('Missing architecture documentation'));
    } else {
      details.push('✅ Architecture documentation complete');
    }

    return {
      status: errors.length === 0 ? 'success' : 'failure',
      details,
      errors: errors.length > 0 ? errors : undefined
    };

  } catch (error) {
    logger.error('Documentation checks failed:', error);
    return {
      status: 'failure',
      details: [...details, `❌ Error: ${error.message}`],
      errors: [error]
    };
  }
}

async function checkReadme(): Promise<DocumentationStatus['readme']> {
  try {
    const content = await readFile('README.md', 'utf8');
    const sections = content.match(/^#+\s+.+$/gm)?.map(s => s.replace(/^#+\s+/, '')) || [];
    const stats = await exec('git log -1 --format=%cd README.md');

    return {
      exists: true,
      sections,
      lastUpdated: stats.stdout.trim()
    };
  } catch {
    return {
      exists: false,
      sections: [],
      lastUpdated: ''
    };
  }
}

function checkRequiredSections(sections: string[]): string[] {
  const required = [
    'Installation',
    'Getting Started',
    'Configuration',
    'Development',
    'Deployment',
    'Testing',
    'Contributing'
  ];

  return required.filter(section => 
    !sections.some(s => s.toLowerCase().includes(section.toLowerCase()))
  );
}

async function checkChangelog(): Promise<DocumentationStatus['changelog']> {
  try {
    const content = await readFile('CHANGELOG.md', 'utf8');
    const versionMatch = content.match(/^##\s+\[?v?(\d+\.\d+\.\d+)/m);
    const stats = await exec('git log -1 --format=%cd CHANGELOG.md');

    return {
      exists: true,
      lastVersion: versionMatch ? versionMatch[1] : 'unknown',
      lastUpdated: stats.stdout.trim()
    };
  } catch {
    return {
      exists: false,
      lastVersion: '',
      lastUpdated: ''
    };
  }
}

async function checkDeploymentDocs(): Promise<DocumentationStatus['deployment']> {
  try {
    const files = await readdir('docs/deployment');
    const environments = files
      .filter(f => f.endsWith('.md'))
      .map(f => f.replace('.md', ''));

    const requiredEnvs = ['development', 'staging', 'production'];
    const complete = requiredEnvs.every(env => 
      environments.some(e => e.toLowerCase().includes(env))
    );

    return {
      exists: true,
      environments,
      complete
    };
  } catch {
    return {
      exists: false,
      environments: [],
      complete: false
    };
  }
}

interface CommentStatus {
  coverage: number;
  files: Array<{
    path: string;
    coverage: number;
  }>;
}

async function checkCodeComments(): Promise<CommentStatus> {
  try {
    const { stdout } = await execAsync('npx documentation coverage src/**/*.{ts,js}');
    const result = JSON.parse(stdout);
    
    return {
      coverage: result.coverage,
      files: result.files
    };
  } catch (error) {
    throw new Error(`Code comment check failed: ${error.message}`);
  }
}

async function checkEnvironmentSetup(): Promise<{ complete: boolean }> {
  try {
    const content = await readFile('ENVIRONMENT_SETUP.md', 'utf8');
    const requiredSections = [
      'Prerequisites',
      'Dependencies',
      'Environment Variables',
      'Database Setup',
      'Local Development'
    ];

    const complete = requiredSections.every(section =>
      content.toLowerCase().includes(section.toLowerCase())
    );

    return { complete };
  } catch {
    return { complete: false };
  }
}

async function checkArchitectureDocs(): Promise<{ exists: boolean }> {
  try {
    const files = await readdir('docs/architecture');
    const hasRequiredFiles = [
      'overview.md',
      'components.md',
      'data-flow.md'
    ].every(file => files.includes(file));

    return { exists: hasRequiredFiles };
  } catch {
    return { exists: false };
  }
} 