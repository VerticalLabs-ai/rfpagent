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
const isLocal =
  process.env.DATABASE_URL.includes('localhost') ||
  process.env.DATABASE_URL.includes('127.0.0.1');

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

export { db, pool };
