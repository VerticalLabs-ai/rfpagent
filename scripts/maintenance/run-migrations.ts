#!/usr/bin/env tsx
/**
 * Database Migration Script
 * Runs drizzle-kit push to sync schema with database
 */

import { execSync } from 'child_process';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables - .env first, then .env.local overrides (matching server/db.ts pattern)
const envLocalPath = path.join(process.cwd(), '.env.local');
const envPath = path.join(process.cwd(), '.env');
dotenv.config({ path: envPath });
dotenv.config({ path: envLocalPath, override: true });

async function runMigrations() {
  console.log('🔄 Running database migrations...');
  console.log(`📊 Database: ${process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] || 'configured'}`);

  try {
    // Run drizzle-kit push with auto-confirmation
    const result = execSync('echo "yes" | npx drizzle-kit push', {
      stdio: 'pipe',
      env: process.env,
      cwd: process.cwd(),
    });

    console.log('✅ Migrations completed successfully');
    console.log(result.toString());
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:');
    if (error && typeof error === 'object') {
      if ('stdout' in error) {
        console.error('Output:', (error as any).stdout?.toString());
      }
      if ('stderr' in error) {
        console.error('Error:', (error as any).stderr?.toString());
      }
    }
    console.error(error);
    process.exit(1);
  }
}

runMigrations();
