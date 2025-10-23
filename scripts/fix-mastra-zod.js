#!/usr/bin/env node

/**
 * Post-build script to fix Mastra output dependencies
 *
 * This script adds missing dependencies that the Mastra bundler fails to detect:
 * 1. zod 3.25.67 - Prevents npm from installing incompatible zod 3.25.76+
 * 2. @1password/sdk - Required by page-auth-tool but missing from bundle
 *
 * Context:
 * - @browserbasehq/stagehand requires zod <3.25.68
 * - @1password/sdk provides core_bg.wasm file needed at runtime
 */

import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

const outputDir = join(process.cwd(), '.mastra', 'output');
const packageJsonPath = join(outputDir, 'package.json');

async function fixDependencies() {
  try {
    // Read the package.json
    const content = await readFile(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(content);

    let updated = false;

    // Add zod 3.25.67 as an explicit dependency
    if (!packageJson.dependencies.zod) {
      packageJson.dependencies.zod = '3.25.67';
      console.log('✅ Added zod@3.25.67');
      updated = true;
    } else {
      console.log(`ℹ️  zod already exists: ${packageJson.dependencies.zod}`);
    }

    // Add 1Password SDK (missing from bundler analysis)
    if (!packageJson.dependencies['@1password/sdk']) {
      packageJson.dependencies['@1password/sdk'] = '^0.3.1';
      console.log('✅ Added @1password/sdk@^0.3.1');
      updated = true;
    } else {
      console.log(`ℹ️  @1password/sdk already exists: ${packageJson.dependencies['@1password/sdk']}`);
    }

    if (updated) {
      // Write back
      await writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
      console.log('✅ Successfully updated .mastra/output/package.json');
    } else {
      console.log('ℹ️  No dependency updates needed');
    }
  } catch (error) {
    console.error('❌ Failed to fix dependencies:', error.message);
    throw error;
  }
}

async function main() {
  try {
    await fixDependencies();
    console.log('\n✨ Post-build fixes completed successfully!\n');
    console.log('📝 Note: Mastra Cloud will install @1password/sdk during deployment');
  } catch (error) {
    console.error('\n❌ Post-build fixes failed\n');
    process.exit(1);
  }
}

main();
