#!/usr/bin/env node

/**
 * Post-Mastra-Build Hook for Mastra Cloud
 *
 * This script runs AFTER Mastra Cloud completes its build process.
 * It ensures the @1password/sdk WASM file is in the correct location.
 *
 * Mastra Cloud build process:
 * 1. Runs `pnpm install`
 * 2. Runs `pnpm run build` (vite + esbuild + postbuild script)
 * 3. Runs Mastra bundler → creates `.mastra/output/`
 * 4. Copies `public/` → `.mastra/output/`
 * 5. THIS SCRIPT should run here to verify/fix WASM location
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Possible WASM source locations (in order of preference)
const wasmSources = [
  path.join(__dirname, '../public/core_bg.wasm'),      // Original location
  path.join(__dirname, '../core_bg.wasm'),            // Project root
  path.join(__dirname, '../src/mastra/core_bg.wasm'), // Mastra source
];

const wasmDest = path.join(__dirname, '../.mastra/output/core_bg.wasm');

try {
  console.log('🔧 Post-Mastra-Build: Ensuring WASM file is in correct location...');

  // Find the first existing WASM source
  let foundSource = null;
  for (const source of wasmSources) {
    if (fs.existsSync(source)) {
      foundSource = source;
      break;
    }
  }

  if (!foundSource) {
    console.error('❌ WASM file not found in any expected location:');
    wasmSources.forEach(src => console.error(`   - ${src}`));
    process.exit(1);
  }

  console.log(`✅ Found WASM source: ${foundSource}`);

  // Check if output directory exists
  const outputDir = path.dirname(wasmDest);
  if (!fs.existsSync(outputDir)) {
    console.error(`❌ Mastra output directory does not exist: ${outputDir}`);
    console.error('   This script should run AFTER Mastra build completes.');
    process.exit(1);
  }

  // Check if WASM is already in the correct location
  if (fs.existsSync(wasmDest)) {
    const sourceStats = fs.statSync(foundSource);
    const destStats = fs.statSync(wasmDest);

    if (sourceStats.size === destStats.size) {
      console.log(`✅ WASM file already exists in .mastra/output/ (${(destStats.size / 1024 / 1024).toFixed(2)} MB)`);
      process.exit(0);
    }
  }

  // Copy WASM to output directory
  fs.copyFileSync(foundSource, wasmDest);

  const stats = fs.statSync(wasmDest);
  console.log(`✅ Copied WASM to .mastra/output/ (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
  console.log(`   From: ${foundSource}`);
  console.log(`   To: ${wasmDest}`);

} catch (error) {
  console.error('❌ Error in post-Mastra-build hook:', error.message);
  console.error('   Stack:', error.stack);
  process.exit(1);
}
