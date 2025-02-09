import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../utils/logger';
import { CheckResult } from './types';
import { runLighthouse } from '../utils/lighthouse';
import { checkAccessibility } from '../utils/accessibility-checker';
import { measurePerformance } from '../utils/performance-checker';

const execAsync = promisify(exec);

interface AccessibilityViolation {
  impact: 'critical' | 'serious' | 'moderate' | 'minor';
  description: string;
  nodes: Array<{
    html: string;
    failureSummary: string;
  }>;
  helpUrl: string;
}

interface PerformanceMetrics {
  fcp: number; // First Contentful Paint
  lcp: number; // Largest Contentful Paint
  fid: number; // First Input Delay
  cls: number; // Cumulative Layout Shift
  ttfb: number; // Time to First Byte
  speedIndex: number;
  interactive: number;
  totalBlockingTime: number;
}

interface CrossBrowserResult {
  browser: string;
  version: string;
  platform: string;
  status: 'pass' | 'fail';
  errors: string[];
  screenshots: string[];
}

interface ResponsivenessResult {
  viewport: string;
  width: number;
  height: number;
  status: 'pass' | 'fail';
  issues: string[];
  screenshot: string;
}

interface UserFlowResult {
  name: string;
  steps: Array<{
    name: string;
    status: 'pass' | 'fail';
    duration: number;
    errors: string[];
    screenshot: string;
  }>;
  totalDuration: number;
}

export async function runUXChecks(): Promise<CheckResult> {
  const details: string[] = [];
  const errors: Error[] = [];

  try {
    // 1. Accessibility Check
    logger.info('Running accessibility checks...');
    const accessibilityResults = await checkAccessibility();
    
    if (accessibilityResults.violations.length > 0) {
      const criticalViolations = accessibilityResults.violations.filter(v => v.impact === 'critical');
      details.push(`❌ Found ${accessibilityResults.violations.length} accessibility issues (${criticalViolations.length} critical)`);
      errors.push(new Error('Accessibility violations detected'));
    } else {
      details.push('✅ No accessibility issues found');
    }

    // 2. Performance Check
    logger.info('Running performance checks...');
    const performanceResults = await measurePerformance();
    
    const performanceIssues = validatePerformanceMetrics(performanceResults);
    if (performanceIssues.length > 0) {
      details.push(`❌ Performance issues: ${performanceIssues.join(', ')}`);
      errors.push(new Error('Performance metrics below threshold'));
    } else {
      details.push('✅ Performance metrics within acceptable range');
    }

    // 3. Cross-browser Testing
    logger.info('Running cross-browser tests...');
    const browserResults = await runCrossBrowserTests();
    
    const failedBrowsers = browserResults.filter(r => r.status === 'fail');
    if (failedBrowsers.length > 0) {
      details.push(`❌ Cross-browser issues in: ${failedBrowsers.map(b => b.browser).join(', ')}`);
      errors.push(new Error('Cross-browser compatibility issues'));
    } else {
      details.push('✅ Cross-browser compatibility verified');
    }

    // 4. Responsive Design
    logger.info('Checking responsive design...');
    const responsiveResults = await checkResponsiveness();
    
    const failedViewports = responsiveResults.filter(r => r.status === 'fail');
    if (failedViewports.length > 0) {
      details.push(`❌ Responsive design issues at: ${failedViewports.map(v => v.viewport).join(', ')}`);
      errors.push(new Error('Responsive design issues'));
    } else {
      details.push('✅ Responsive design verified');
    }

    // 5. User Flow Testing
    logger.info('Testing critical user flows...');
    const userFlowResults = await testUserFlows();
    
    const failedFlows = userFlowResults.filter(f => f.steps.some(s => s.status === 'fail'));
    if (failedFlows.length > 0) {
      details.push(`❌ Failed user flows: ${failedFlows.map(f => f.name).join(', ')}`);
      errors.push(new Error('User flow tests failed'));
    } else {
      details.push('✅ Critical user flows verified');
    }

    // 6. Error Handling
    logger.info('Checking error handling...');
    const errorHandlingResults = await checkErrorHandling();
    
    if (errorHandlingResults.issues.length > 0) {
      details.push(`❌ Error handling issues: ${errorHandlingResults.issues.join(', ')}`);
      errors.push(new Error('Error handling issues detected'));
    } else {
      details.push('✅ Error handling verified');
    }

    // 7. Loading States
    logger.info('Checking loading states...');
    const loadingStateResults = await checkLoadingStates();
    
    if (loadingStateResults.issues.length > 0) {
      details.push(`❌ Loading state issues: ${loadingStateResults.issues.join(', ')}`);
      errors.push(new Error('Loading state issues detected'));
    } else {
      details.push('✅ Loading states properly implemented');
    }

    return {
      status: errors.length === 0 ? 'success' : 'failure',
      details,
      errors: errors.length > 0 ? errors : undefined
    };

  } catch (error) {
    logger.error('UX checks failed:', error);
    return {
      status: 'failure',
      details: [...details, `❌ Error: ${error.message}`],
      errors: [error]
    };
  }
}

function validatePerformanceMetrics(metrics: PerformanceMetrics): string[] {
  const issues: string[] = [];
  const thresholds = {
    fcp: 1800,    // 1.8s
    lcp: 2500,    // 2.5s
    fid: 100,     // 100ms
    cls: 0.1,     // 0.1
    ttfb: 600,    // 600ms
    speedIndex: 3000,  // 3s
    interactive: 3500,  // 3.5s
    totalBlockingTime: 300  // 300ms
  };

  if (metrics.fcp > thresholds.fcp) {
    issues.push(`First Contentful Paint (${metrics.fcp}ms) exceeds threshold (${thresholds.fcp}ms)`);
  }
  if (metrics.lcp > thresholds.lcp) {
    issues.push(`Largest Contentful Paint (${metrics.lcp}ms) exceeds threshold (${thresholds.lcp}ms)`);
  }
  if (metrics.fid > thresholds.fid) {
    issues.push(`First Input Delay (${metrics.fid}ms) exceeds threshold (${thresholds.fid}ms)`);
  }
  if (metrics.cls > thresholds.cls) {
    issues.push(`Cumulative Layout Shift (${metrics.cls}) exceeds threshold (${thresholds.cls})`);
  }
  if (metrics.ttfb > thresholds.ttfb) {
    issues.push(`Time to First Byte (${metrics.ttfb}ms) exceeds threshold (${thresholds.ttfb}ms)`);
  }
  if (metrics.speedIndex > thresholds.speedIndex) {
    issues.push(`Speed Index (${metrics.speedIndex}ms) exceeds threshold (${thresholds.speedIndex}ms)`);
  }
  if (metrics.interactive > thresholds.interactive) {
    issues.push(`Time to Interactive (${metrics.interactive}ms) exceeds threshold (${thresholds.interactive}ms)`);
  }
  if (metrics.totalBlockingTime > thresholds.totalBlockingTime) {
    issues.push(`Total Blocking Time (${metrics.totalBlockingTime}ms) exceeds threshold (${thresholds.totalBlockingTime}ms)`);
  }

  return issues;
}

async function runCrossBrowserTests(): Promise<CrossBrowserResult[]> {
  try {
    const { stdout } = await execAsync('playwright test --list');
    const browsers = ['chromium', 'firefox', 'webkit'];
    const results: CrossBrowserResult[] = [];

    for (const browser of browsers) {
      const { stdout: testOutput } = await execAsync(`playwright test --browser=${browser}`);
      const testResults = JSON.parse(testOutput);

      results.push({
        browser,
        version: testResults.browserVersion,
        platform: process.platform,
        status: testResults.status,
        errors: testResults.errors || [],
        screenshots: testResults.screenshots || []
      });
    }

    return results;
  } catch (error) {
    throw new Error(`Cross-browser testing failed: ${error.message}`);
  }
}

async function checkResponsiveness(): Promise<ResponsivenessResult[]> {
  try {
    const viewports = [
      { name: 'mobile', width: 375, height: 667 },
      { name: 'tablet', width: 768, height: 1024 },
      { name: 'desktop', width: 1440, height: 900 }
    ];

    const results: ResponsivenessResult[] = [];

    for (const viewport of viewports) {
      const { stdout } = await execAsync(
        `playwright test responsive.spec.ts --viewport="${viewport.width},${viewport.height}"`
      );
      const testResults = JSON.parse(stdout);

      results.push({
        viewport: viewport.name,
        width: viewport.width,
        height: viewport.height,
        status: testResults.status,
        issues: testResults.issues || [],
        screenshot: testResults.screenshot
      });
    }

    return results;
  } catch (error) {
    throw new Error(`Responsiveness testing failed: ${error.message}`);
  }
}

async function testUserFlows(): Promise<UserFlowResult[]> {
  try {
    const flows = [
      'authentication',
      'content-creation',
      'social-interaction',
      'settings-management',
      'checkout-process'
    ];

    const results: UserFlowResult[] = [];

    for (const flow of flows) {
      const { stdout } = await execAsync(`playwright test ${flow}.spec.ts`);
      const testResults = JSON.parse(stdout);

      results.push({
        name: flow,
        steps: testResults.steps.map((step: any) => ({
          name: step.name,
          status: step.status,
          duration: step.duration,
          errors: step.errors || [],
          screenshot: step.screenshot
        })),
        totalDuration: testResults.duration
      });
    }

    return results;
  } catch (error) {
    throw new Error(`User flow testing failed: ${error.message}`);
  }
}

async function checkErrorHandling(): Promise<{ issues: string[] }> {
  try {
    const testCases = [
      'network-error',
      'validation-error',
      'authentication-error',
      'server-error',
      'timeout-error'
    ];

    const issues: string[] = [];

    for (const testCase of testCases) {
      const { stdout } = await execAsync(`playwright test error-handling/${testCase}.spec.ts`);
      const results = JSON.parse(stdout);

      if (results.status === 'fail') {
        issues.push(`${testCase}: ${results.error}`);
      }
    }

    return { issues };
  } catch (error) {
    return {
      issues: [`Error handling tests failed: ${error.message}`]
    };
  }
}

async function checkLoadingStates(): Promise<{ issues: string[] }> {
  try {
    const components = [
      'feed',
      'profile',
      'media-upload',
      'comments',
      'search-results'
    ];

    const issues: string[] = [];

    for (const component of components) {
      const { stdout } = await execAsync(`playwright test loading-states/${component}.spec.ts`);
      const results = JSON.parse(stdout);

      if (results.status === 'fail') {
        issues.push(`${component}: ${results.error}`);
      }
    }

    return { issues };
  } catch (error) {
    return {
      issues: [`Loading state tests failed: ${error.message}`]
    };
  }
} 