#!/usr/bin/env node

/**
 * Copy WASM file to Mastra output directory
 * This ensures the @1password/sdk WASM file is available at runtime
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const wasmSource = path.join(__dirname, '../public/core_bg.wasm');
const wasmDest = path.join(__dirname, '../.mastra/output/core_bg.wasm');

try {
  // Check if source file exists
  if (!fs.existsSync(wasmSource)) {
    console.error('❌ Source WASM file not found:', wasmSource);
    process.exit(1);
  }

  // Check if output directory exists, create if needed
  const outputDir = path.dirname(wasmDest);
  if (!fs.existsSync(outputDir)) {
    console.log('⚠️  Creating .mastra/output directory...');
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Copy the file
  fs.copyFileSync(wasmSource, wasmDest);
  console.log('✅ Copied core_bg.wasm to .mastra/output/');

  // Verify the copy
  const stats = fs.statSync(wasmDest);
  console.log(`   Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

} catch (error) {
  console.error('❌ Error copying WASM file:', error.message);
  // Don't exit with error if this is optional
  console.log('⚠️  Continuing without WASM file in .mastra/output (may be copied later)');
}
