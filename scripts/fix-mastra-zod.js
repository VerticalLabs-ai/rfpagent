#!/usr/bin/env node

/**
 * Post-build script to copy WASM files to Mastra output
 *
 * This script ensures the core_bg.wasm file required by @1password/sdk
 * is available in the Mastra output directory.
 *
 * The prebuild-mastra-deps.js script (runs before ANY build) ensures
 * zod 3.25.67 and @1password/sdk are installed correctly in node_modules.
 *
 * This post-build script (runs after mastra build) copies the WASM file
 * from the public/ directory to the .mastra/output/ directory.
 */

import { readFile, writeFile, copyFile, access } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

const outputDir = join(process.cwd(), '.mastra', 'output');
const packageJsonPath = join(outputDir, 'package.json');

async function ensureDependencies() {
  try {
    // Read and update the Mastra output package.json
    const content = await readFile(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(content);

    console.log('🔍 Ensuring Mastra output has required dependencies...');

    let updated = false;

    // Ensure zod 3.25.67
    if (!packageJson.dependencies.zod) {
      console.log('📦 Adding zod@3.25.67 to bundled dependencies');
      packageJson.dependencies.zod = '3.25.67';
      updated = true;
    } else {
      console.log(`✅ zod: ${packageJson.dependencies.zod}`);
    }

    // Ensure @1password/sdk
    if (!packageJson.dependencies['@1password/sdk']) {
      console.log('📦 Adding @1password/sdk@^0.3.1 to bundled dependencies');
      packageJson.dependencies['@1password/sdk'] = '^0.3.1';
      updated = true;
    } else {
      console.log(`✅ @1password/sdk: ${packageJson.dependencies['@1password/sdk']}`);
    }

    if (updated) {
      await writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
      console.log('✅ Updated .mastra/output/package.json with missing dependencies');
    }
  } catch (error) {
    console.error('⚠️  Could not update dependencies:', error.message);
    throw error;
  }
}

async function copyWasmFile() {
  try {
    // Source: WASM file from public directory (committed to repo)
    const publicWasm = join(process.cwd(), 'public', 'core_bg.wasm');
    const destWasm = join(outputDir, 'core_bg.wasm');

    // Check if public WASM file exists
    if (!existsSync(publicWasm)) {
      console.log('⚠️  Warning: public/core_bg.wasm not found - will be needed for 1Password SDK');
      return;
    }

    // Copy WASM file to output root
    await copyFile(publicWasm, destWasm);
    console.log('✅ Copied core_bg.wasm to .mastra/output/');
  } catch (error) {
    console.error('❌ Failed to copy WASM file:', error.message);
    throw error;
  }
}

async function main() {
  try {
    await ensureDependencies();
    await copyWasmFile();
    console.log('\n✨ Post-build fixes completed successfully!\n');
  } catch (error) {
    console.error('\n❌ Post-build fixes failed\n');
    process.exit(1);
  }
}

main();
