#!/usr/bin/env node

/**
 * Copy WASM file to project root for Mastra Cloud bundler
 *
 * This script runs AFTER `pnpm run build` via npm's postbuild hook.
 * It copies the @1password/sdk WASM file from public/ to the project root
 * so Mastra's bundler can find it when it runs its internal build process.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const wasmSource = path.join(__dirname, '../public/core_bg.wasm');
const wasmDestRoot = path.join(__dirname, '../core_bg.wasm');

try {
  // Check if source file exists
  if (!fs.existsSync(wasmSource)) {
    console.error('❌ Source WASM file not found:', wasmSource);
    process.exit(1);
  }

  // Copy to project root
  fs.copyFileSync(wasmSource, wasmDestRoot);
  console.log('✅ Copied core_bg.wasm to project root for Mastra bundler');

  // Verify the copy
  const stats = fs.statSync(wasmDestRoot);
  console.log(`   Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   Location: ${wasmDestRoot}`);

} catch (error) {
  console.error('❌ Error copying WASM file:', error.message);
  process.exit(1);
}
