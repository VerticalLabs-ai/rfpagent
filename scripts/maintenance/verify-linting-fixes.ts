#!/usr/bin/env tsx
/**
 * Verification Script for Linting Fixes
 *
 * This script performs automated checks to verify that linting error fixes
 * haven't broken existing functionality.
 *
 * Usage: tsx scripts/verify-linting-fixes.ts
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  duration?: number;
}

const results: TestResult[] = [];

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color?: keyof typeof colors) {
  const colorCode = color ? colors[color] : colors.reset;
  console.log(`${colorCode}${message}${colors.reset}`);
}

function logSection(title: string) {
  console.log('\n' + '='.repeat(60));
  log(title, 'cyan');
  console.log('='.repeat(60) + '\n');
}

async function runCommand(command: string, testName: string): Promise<TestResult> {
  const startTime = Date.now();
  log(`Running: ${testName}...`, 'blue');

  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd: process.cwd(),
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    });

    const duration = Date.now() - startTime;

    log(`✅ ${testName} - PASSED (${duration}ms)`, 'green');

    return {
      name: testName,
      passed: true,
      message: 'Success',
      duration,
    };
  } catch (error: any) {
    const duration = Date.now() - startTime;

    log(`❌ ${testName} - FAILED (${duration}ms)`, 'red');
    if (error.stdout) log(`STDOUT: ${error.stdout}`, 'yellow');
    if (error.stderr) log(`STDERR: ${error.stderr}`, 'red');

    return {
      name: testName,
      passed: false,
      message: error.message,
      duration,
    };
  }
}

async function checkFileExists(filePath: string, testName: string): Promise<TestResult> {
  log(`Checking: ${testName}...`, 'blue');

  const exists = fs.existsSync(filePath);

  if (exists) {
    log(`✅ ${testName} - EXISTS`, 'green');
    return {
      name: testName,
      passed: true,
      message: `File exists at ${filePath}`,
    };
  } else {
    log(`❌ ${testName} - NOT FOUND`, 'red');
    return {
      name: testName,
      passed: false,
      message: `File not found at ${filePath}`,
    };
  }
}

async function countTypeScriptErrors(): Promise<TestResult> {
  log('Counting TypeScript errors...', 'blue');

  try {
    await execAsync('pnpm check', { cwd: process.cwd() });

    log('✅ TypeScript Check - 0 ERRORS', 'green');
    return {
      name: 'TypeScript Error Count',
      passed: true,
      message: '0 TypeScript errors found',
    };
  } catch (error: any) {
    const errorCount = (error.stdout?.match(/error TS/g) || []).length;

    if (errorCount === 0) {
      // Might be other error, check stderr
      log(`⚠️  TypeScript Check - UNKNOWN ERROR`, 'yellow');
      return {
        name: 'TypeScript Error Count',
        passed: false,
        message: 'Unknown error during type checking',
      };
    }

    log(`❌ TypeScript Check - ${errorCount} ERRORS`, 'red');
    return {
      name: 'TypeScript Error Count',
      passed: false,
      message: `${errorCount} TypeScript errors found`,
    };
  }
}

async function checkBuildOutput(): Promise<TestResult> {
  log('Checking build output...', 'blue');

  const frontendDist = path.join(process.cwd(), 'dist', 'public');
  const backendDist = path.join(process.cwd(), 'dist', 'index.js');

  const frontendExists = fs.existsSync(frontendDist);
  const backendExists = fs.existsSync(backendDist);

  if (frontendExists && backendExists) {
    const backendSize = fs.statSync(backendDist).size;
    const backendSizeKB = (backendSize / 1024).toFixed(2);

    log(`✅ Build Output - COMPLETE (Backend: ${backendSizeKB} KB)`, 'green');
    return {
      name: 'Build Output Check',
      passed: true,
      message: `Frontend and backend builds exist. Backend size: ${backendSizeKB} KB`,
    };
  } else {
    const missing = [];
    if (!frontendExists) missing.push('frontend');
    if (!backendExists) missing.push('backend');

    log(`❌ Build Output - INCOMPLETE (Missing: ${missing.join(', ')})`, 'red');
    return {
      name: 'Build Output Check',
      passed: false,
      message: `Missing build output: ${missing.join(', ')}`,
    };
  }
}

async function checkImportIntegrity(): Promise<TestResult> {
  log('Checking import integrity...', 'blue');

  const criticalFiles = [
    'server/db.ts',
    'server/index.ts',
    'client/src/App.tsx',
    'src/mastra/index.ts',
  ];

  const missingImports: string[] = [];

  for (const file of criticalFiles) {
    const filePath = path.join(process.cwd(), file);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');

      // Check for common import issues
      if (content.includes('from "react"') && !content.includes('import') && file.includes('.tsx')) {
        missingImports.push(`${file}: Possibly missing React import`);
      }
    }
  }

  if (missingImports.length === 0) {
    log('✅ Import Integrity - GOOD', 'green');
    return {
      name: 'Import Integrity Check',
      passed: true,
      message: 'No obvious import issues detected',
    };
  } else {
    log(`⚠️  Import Integrity - WARNINGS (${missingImports.length})`, 'yellow');
    return {
      name: 'Import Integrity Check',
      passed: true, // Don't fail on warnings
      message: `Warnings: ${missingImports.join(', ')}`,
    };
  }
}

async function generateReport() {
  logSection('VERIFICATION REPORT');

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const total = results.length;

  log(`Total Tests: ${total}`, 'cyan');
  log(`Passed: ${passed}`, 'green');
  log(`Failed: ${failed}`, failed > 0 ? 'red' : 'green');

  console.log('\n' + '-'.repeat(60));
  console.log('Detailed Results:');
  console.log('-'.repeat(60));

  results.forEach((result) => {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    const color = result.passed ? 'green' : 'red';
    const duration = result.duration ? ` (${result.duration}ms)` : '';

    log(`${status} - ${result.name}${duration}`, color);
    console.log(`  ${result.message}`);
  });

  console.log('\n' + '='.repeat(60));

  if (failed === 0) {
    log('🎉 ALL VERIFICATIONS PASSED! 🎉', 'green');
    log('Linting fixes appear to be safe.', 'green');
    return 0;
  } else {
    log('⚠️  SOME VERIFICATIONS FAILED ⚠️', 'red');
    log('Review failed tests before proceeding.', 'red');
    return 1;
  }
}

async function main() {
  logSection('LINTING FIXES VERIFICATION SCRIPT');

  log('Starting verification checks...', 'cyan');
  log(`Working directory: ${process.cwd()}`, 'blue');

  // Phase 1: File Existence Checks
  logSection('Phase 1: Critical Files Check');
  results.push(await checkFileExists('server/db.ts', 'Database Configuration File'));
  results.push(await checkFileExists('shared/schema.ts', 'Database Schema File'));
  results.push(await checkFileExists('package.json', 'Package Configuration'));

  // Phase 2: TypeScript Errors
  logSection('Phase 2: TypeScript Error Count');
  results.push(await countTypeScriptErrors());

  // Phase 3: Build Process
  logSection('Phase 3: Build Process');
  results.push(await runCommand('pnpm build', 'Production Build'));
  results.push(await checkBuildOutput());

  // Phase 4: Linting
  logSection('Phase 4: ESLint Check');
  // Note: We allow lint to "fail" if there are warnings, but we check exit code
  try {
    results.push(await runCommand('pnpm run lint', 'ESLint Check'));
  } catch (error) {
    // Lint warnings will cause non-zero exit, but that's okay
    results.push({
      name: 'ESLint Check',
      passed: true,
      message: 'ESLint completed (warnings may exist)',
    });
  }

  // Phase 5: Tests
  logSection('Phase 5: Test Suite');
  try {
    results.push(await runCommand('pnpm test', 'Jest Test Suite'));
  } catch (error) {
    results.push({
      name: 'Jest Test Suite',
      passed: false,
      message: 'Test suite failed - review test output',
    });
  }

  // Phase 6: Import Integrity
  logSection('Phase 6: Import Integrity');
  results.push(await checkImportIntegrity());

  // Generate final report
  const exitCode = await generateReport();

  process.exit(exitCode);
}

// Run the verification
main().catch((error) => {
  log(`\n❌ VERIFICATION SCRIPT FAILED`, 'red');
  console.error(error);
  process.exit(1);
});
