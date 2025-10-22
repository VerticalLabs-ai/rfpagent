#!/usr/bin/env node
/**
 * Apply GIN indexes to production database
 * Run this on the deployed app: node server/scripts/apply-gin-indexes.js
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function applyGinIndexes() {
  console.log('🔍 Applying GIN indexes to database...');
  console.log('');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    // Test connection
    const versionResult = await pool.query('SELECT version()');
    console.log('✅ Connected to database');
    console.log(`   ${versionResult.rows[0].version.split(',')[0]}`);
    console.log('');

    // Read and apply GIN indexes SQL
    const sqlPath = path.join(__dirname, '../../migrations/add_gin_indexes.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');

    console.log('📝 Creating GIN indexes...');
    await pool.query(sql);
    console.log('✅ GIN indexes created successfully');
    console.log('');

    // Verify indexes
    const indexCheck = await pool.query(`
      SELECT tablename, indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
      AND (indexname LIKE 'idx_%_gin' OR indexdef LIKE '%USING gin%')
      ORDER BY tablename, indexname
    `);

    console.log(`🔍 Found ${indexCheck.rows.length} GIN indexes:`);
    indexCheck.rows.forEach(row => {
      console.log(`   ✓ ${row.tablename}.${row.indexname}`);
    });
    console.log('');
    console.log('✅ All done!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

applyGinIndexes();
