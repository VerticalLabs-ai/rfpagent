#!/usr/bin/env node

/**
 * Post-build script to fix zod dependency in Mastra output
 *
 * This script adds an explicit zod 3.25.67 dependency to .mastra/output/package.json
 * to prevent npm from installing an incompatible version during Mastra Cloud deployment.
 *
 * Context: @browserbasehq/stagehand requires zod <3.25.68, but npm tends to install
 * zod 3.25.76+ which breaks the build.
 */

import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

const packageJsonPath = join(process.cwd(), '.mastra', 'output', 'package.json');

async function fixZodDependency() {
  try {
    // Read the package.json
    const content = await readFile(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(content);

    // Add zod 3.25.67 as an explicit dependency
    if (!packageJson.dependencies.zod) {
      packageJson.dependencies.zod = '3.25.67';
      console.log('✅ Added zod@3.25.67 to .mastra/output/package.json');
    } else {
      console.log(`ℹ️ zod already exists in package.json: ${packageJson.dependencies.zod}`);
    }

    // Write back
    await writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
    console.log('✅ Successfully updated .mastra/output/package.json');
  } catch (error) {
    console.error('❌ Failed to fix zod dependency:', error.message);
    process.exit(1);
  }
}

fixZodDependency();
