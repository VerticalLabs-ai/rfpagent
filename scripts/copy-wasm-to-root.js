#!/usr/bin/env node

/**
 * Copy WASM file to multiple locations for Mastra Cloud
 *
 * This script runs AFTER `pnpm run build` via npm's postbuild hook.
 * It copies the @1password/sdk WASM file to both:
 * 1. Project root - in case Mastra's bundler looks there
 * 2. src/mastra/ - to ensure it's included in the bundle
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const wasmSource = path.join(__dirname, '../public/core_bg.wasm');
const destinations = [
  path.join(__dirname, '../core_bg.wasm'),           // Project root
  path.join(__dirname, '../src/mastra/core_bg.wasm'), // Mastra source dir
];

try {
  // Check if source file exists
  if (!fs.existsSync(wasmSource)) {
    console.error('❌ Source WASM file not found:', wasmSource);
    process.exit(1);
  }

  const stats = fs.statSync(wasmSource);
  const sizeMB = (stats.size / 1024 / 1024).toFixed(2);

  console.log('✅ Copying core_bg.wasm for Mastra Cloud...');
  console.log(`   Source: ${wasmSource} (${sizeMB} MB)`);

  // Copy to all destinations
  destinations.forEach(dest => {
    const dir = path.dirname(dest);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.copyFileSync(wasmSource, dest);
    console.log(`   ✓ Copied to: ${dest}`);
  });

} catch (error) {
  console.error('❌ Error copying WASM file:', error.message);
  process.exit(1);
}
