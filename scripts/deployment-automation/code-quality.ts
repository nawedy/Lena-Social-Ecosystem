import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../utils/logger';
import { CheckResult } from './types';

const execAsync = promisify(exec);

interface CodeCoverage {
  lines: number;
  functions: number;
  statements: number;
  branches: number;
}

interface LintResult {
  errorCount: number;
  warningCount: number;
  files: Array<{
    filePath: string;
    errors: number;
    warnings: number;
  }>;
}

export async function runCodeQualityChecks(): Promise<CheckResult> {
  const details: string[] = [];
  const errors: Error[] = [];

  try {
    // 1. Type Checking
    logger.info('Running type checks...');
    const typeCheckResult = await execAsync('pnpm typecheck');
    details.push('✅ Type checking passed');

    // 2. Linting
    logger.info('Running linting...');
    const lintResult = await runLintChecks();
    if (lintResult.errorCount === 0) {
      details.push(`✅ Linting passed (${lintResult.warningCount} warnings)`);
    } else {
      details.push(`❌ Linting failed: ${lintResult.errorCount} errors`);
      errors.push(new Error(`Linting failed with ${lintResult.errorCount} errors`));
    }

    // 3. Unit Tests
    logger.info('Running unit tests...');
    const unitTestResult = await execAsync('pnpm test:unit');
    details.push('✅ Unit tests passed');

    // 4. E2E Tests
    logger.info('Running E2E tests...');
    const e2eTestResult = await execAsync('pnpm test:e2e');
    details.push('✅ E2E tests passed');

    // 5. Code Coverage
    logger.info('Checking code coverage...');
    const coverage = await checkCodeCoverage();
    const coveragePass = validateCoverage(coverage);
    if (coveragePass) {
      details.push(`✅ Code coverage meets thresholds (${coverage.lines}% lines)`);
    } else {
      details.push(`❌ Code coverage below thresholds (${coverage.lines}% lines)`);
      errors.push(new Error('Code coverage below required thresholds'));
    }

    // 6. Dependency Audit
    logger.info('Running dependency audit...');
    const auditResult = await execAsync('pnpm audit');
    details.push('✅ Dependency audit passed');

    // 7. Bundle Size Check
    logger.info('Checking bundle size...');
    const bundleResult = await checkBundleSize();
    details.push(`✅ Bundle size check passed (${bundleResult.totalSize}MB)`);

    return {
      status: errors.length === 0 ? 'success' : 'failure',
      details,
      errors: errors.length > 0 ? errors : undefined
    };

  } catch (error) {
    logger.error('Code quality checks failed:', error);
    return {
      status: 'failure',
      details: [...details, `❌ Error: ${error.message}`],
      errors: [error]
    };
  }
}

async function runLintChecks(): Promise<LintResult> {
  try {
    const { stdout } = await execAsync('pnpm lint --format json');
    const result = JSON.parse(stdout);
    return {
      errorCount: result.errorCount,
      warningCount: result.warningCount,
      files: result.files.map(file => ({
        filePath: file.filePath,
        errors: file.errorCount,
        warnings: file.warningCount
      }))
    };
  } catch (error) {
    throw new Error(`Lint check failed: ${error.message}`);
  }
}

async function checkCodeCoverage(): Promise<CodeCoverage> {
  try {
    const { stdout } = await execAsync('pnpm test:coverage');
    const coverage = JSON.parse(stdout);
    return {
      lines: coverage.total.lines.pct,
      functions: coverage.total.functions.pct,
      statements: coverage.total.statements.pct,
      branches: coverage.total.branches.pct
    };
  } catch (error) {
    throw new Error(`Coverage check failed: ${error.message}`);
  }
}

function validateCoverage(coverage: CodeCoverage): boolean {
  const thresholds = {
    lines: 80,
    functions: 80,
    statements: 80,
    branches: 70
  };

  return (
    coverage.lines >= thresholds.lines &&
    coverage.functions >= thresholds.functions &&
    coverage.statements >= thresholds.statements &&
    coverage.branches >= thresholds.branches
  );
}

async function checkBundleSize(): Promise<{ totalSize: number }> {
  try {
    const { stdout } = await execAsync('pnpm build');
    // Parse build output to get bundle size
    // This is a simplified example - actual implementation would depend on your build tool
    const sizeMatch = stdout.match(/Total size: (\d+\.?\d*)MB/);
    const totalSize = sizeMatch ? parseFloat(sizeMatch[1]) : 0;
    
    if (totalSize > 10) { // 10MB threshold
      throw new Error(`Bundle size (${totalSize}MB) exceeds 10MB threshold`);
    }

    return { totalSize };
  } catch (error) {
    throw new Error(`Bundle size check failed: ${error.message}`);
  }
} 