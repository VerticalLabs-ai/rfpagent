import dotenv from 'dotenv';
import path from 'path';

// Load environment variables before anything else - .env first, then .env.local overrides
const envLocalPath = path.join(process.cwd(), '.env.local');
const envPath = path.join(process.cwd(), '.env');
dotenv.config({ path: envPath });
dotenv.config({ path: envLocalPath, override: true });

import { Pool as NeonPool, neonConfig } from '@neondatabase/serverless';
import * as schema from '@shared/schema';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless';
import { drizzle as drizzleNode } from 'drizzle-orm/node-postgres';
import { Pool as PgPool } from 'pg';
import ws from 'ws';

if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL must be set. Did you forget to provision a database?'
  );
}

// Use regular PostgreSQL driver for local development (localhost)
// Use Neon serverless driver for production (remote Neon database)

/**
 * Determines if the DATABASE_URL points to a local database
 */
function isLocalDatabase(databaseUrl: string): boolean {
  // Allow explicit override via environment variable
  if (process.env.USE_NEON === 'true') {
    return false;
  }
  if (process.env.USE_NEON === 'false') {
    return true;
  }

  try {
    const url = new URL(databaseUrl);
    const hostname = url.hostname.toLowerCase();

    // Check for common local hostnames
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0'
    ) {
      return true;
    }

    // Check for IPv6 loopback
    if (hostname === '::1' || hostname === '[::1]') {
      return true;
    }

    // Check for .local or .dev domains
    if (hostname.endsWith('.local') || hostname.endsWith('.dev')) {
      return true;
    }

    return false;
  } catch {
    // Fallback to simple string checks if URL parsing fails
    const lower = databaseUrl.toLowerCase();
    return (
      lower.includes('localhost') ||
      lower.includes('127.0.0.1') ||
      lower.includes('0.0.0.0') ||
      lower.includes('::1') ||
      lower.includes('.local') ||
      lower.includes('.dev')
    );
  }
}

const isLocal = isLocalDatabase(process.env.DATABASE_URL);

let pool: NeonPool | PgPool;
let db: ReturnType<typeof drizzleNeon> | ReturnType<typeof drizzleNode>;

if (isLocal) {
  // Use node-postgres for local PostgreSQL/Supabase
  pool = new PgPool({ connectionString: process.env.DATABASE_URL });
  db = drizzleNode(pool as any, { schema });
} else {
  // Use Neon serverless for production
  neonConfig.webSocketConstructor = ws;
  pool = new NeonPool({ connectionString: process.env.DATABASE_URL });
  db = drizzleNeon({ client: pool as NeonPool, schema });
}

/**
 * Gracefully shutdown database connection pool
 * Should be called during application shutdown to prevent connection leaks
 */
export async function shutdownDb(): Promise<void> {
  try {
    if (pool) {
      // Check if it's a PgPool (has 'end' method) or NeonPool
      if ('end' in pool && typeof pool.end === 'function') {
        // node-postgres Pool
        await pool.end();
        console.log('PostgreSQL connection pool closed');
      } else if ('close' in pool && typeof pool.close === 'function') {
        // Neon Pool (if it has a close method)
        await (pool as any).close();
        console.log('Neon connection pool closed');
      } else {
        // Try to call end() as fallback
        await (pool as any).end?.();
        console.log('Database connection pool closed');
      }
    }
  } catch (error) {
    console.error('Error closing database connection pool:', error);
    throw error;
  }
}

export { db, pool };
