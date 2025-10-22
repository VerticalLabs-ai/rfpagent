import dotenv from 'dotenv';
import path from 'path';

// Load environment variables before anything else - .env first, then .env.local overrides
const envLocalPath = path.join(process.cwd(), '.env.local');
const envPath = path.join(process.cwd(), '.env');
dotenv.config({ path: envPath });
dotenv.config({ path: envLocalPath, override: true });

import * as schema from '@shared/schema';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL must be set. Did you forget to provision a database?'
  );
}

// Use standard PostgreSQL driver for both local (Docker) and production (Fly.io managed Postgres)
// Neon serverless driver has been deprecated in favor of standard pg driver
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Connection pool configuration for better performance
  max: 20, // Maximum pool size
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 5000, // Return an error after 5 seconds if connection could not be established
});

// Initialize Drizzle ORM with the connection pool
const db = drizzle(pool, { schema });

/**
 * Gracefully shutdown database connection pool
 * Should be called during application shutdown to prevent connection leaks
 */
export async function shutdownDb(): Promise<void> {
  try {
    if (pool) {
      await pool.end();
      console.log('PostgreSQL connection pool closed');
    }
  } catch (error) {
    console.error('Error closing database connection pool:', error);
    throw error;
  }
}

export { db, pool };
