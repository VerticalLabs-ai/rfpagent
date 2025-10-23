#!/usr/bin/env node

/**
 * Pre-build script to ensure Mastra dependencies are installed correctly
 *
 * This script runs BEFORE any build process (including Mastra Cloud builds)
 * to ensure the correct versions of critical dependencies are installed.
 *
 * Critical dependencies:
 * 1. zod 3.25.67 - Must be <3.25.68 for @browserbasehq/stagehand compatibility
 * 2. @1password/sdk - Required by page-auth-tool but may not be auto-detected
 *
 * This runs as a "prebuild" script, which npm/pnpm automatically executes
 * before the "build" script, ensuring it runs in all environments including
 * Mastra Cloud deployments.
 */

import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { execSync } from 'child_process';

const packageJsonPath = join(process.cwd(), 'package.json');

async function ensureDependencies() {
  try {
    console.log('🔍 Checking package.json dependencies...');

    // Read package.json
    const content = await readFile(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(content);

    let updated = false;

    // Ensure zod 3.25.67 is explicitly listed
    if (packageJson.dependencies.zod !== '3.25.67') {
      console.log(`📦 Setting zod to 3.25.67 (was: ${packageJson.dependencies.zod})`);
      packageJson.dependencies.zod = '3.25.67';
      updated = true;
    } else {
      console.log('✅ zod@3.25.67 is correctly specified');
    }

    // Ensure @1password/sdk is explicitly listed
    if (!packageJson.dependencies['@1password/sdk']) {
      console.log('📦 Adding @1password/sdk@^0.3.1');
      packageJson.dependencies['@1password/sdk'] = '^0.3.1';
      updated = true;
    } else {
      console.log(`✅ @1password/sdk is correctly specified (${packageJson.dependencies['@1password/sdk']})`);
    }

    // Update package.json if needed
    if (updated) {
      await writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
      console.log('✅ Updated package.json with correct dependencies');

      // Reinstall dependencies
      console.log('📦 Reinstalling dependencies...');
      try {
        // Detect package manager
        const isCI = process.env.CI === 'true';
        const hasLockfile = require('fs').existsSync(join(process.cwd(), 'pnpm-lock.yaml'));

        if (hasLockfile) {
          console.log('Using pnpm...');
          execSync('pnpm install --no-frozen-lockfile', { stdio: 'inherit' });
        } else {
          console.log('Using npm...');
          execSync('npm install', { stdio: 'inherit' });
        }
        console.log('✅ Dependencies reinstalled successfully');
      } catch (error) {
        console.error('⚠️  Warning: Failed to reinstall dependencies:', error.message);
        console.error('You may need to run npm/pnpm install manually');
      }
    } else {
      console.log('✅ All dependencies are correctly specified');
    }

    console.log('\n✨ Pre-build dependency check completed!\n');
  } catch (error) {
    console.error('❌ Failed to ensure dependencies:', error.message);
    throw error;
  }
}

ensureDependencies();
