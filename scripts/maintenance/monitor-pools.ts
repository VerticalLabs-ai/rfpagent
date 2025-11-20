#!/usr/bin/env node
/**
 * Agent Pool Monitoring Script
 *
 * Real-time monitoring dashboard for agent pools
 * Usage: node scripts/monitor-pools.ts [options]
 *
 * Options:
 *   --interval <ms>    Monitoring interval in milliseconds (default: 5000)
 *   --pool <name>      Monitor specific pool only
 *   --once             Run once and exit (no continuous monitoring)
 */

import {
  logPoolHealth,
  logPerformanceSummary,
  startPoolMonitoring,
} from '../src/mastra/utils/pool-monitoring';

// Parse command line arguments
const args = process.argv.slice(2);
const options: {
  interval?: number;
  pool?: string;
  once?: boolean;
} = {};

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--interval':
      options.interval = parseInt(args[++i], 10);
      break;
    case '--pool':
      options.pool = args[++i];
      break;
    case '--once':
      options.once = true;
      break;
    case '--help':
      console.log(`
Agent Pool Monitoring Script

Usage: node scripts/monitor-pools.ts [options]

Options:
  --interval <ms>    Monitoring interval in milliseconds (default: 5000)
  --pool <name>      Monitor specific pool only
  --once             Run once and exit (no continuous monitoring)
  --help             Show this help message

Examples:
  node scripts/monitor-pools.ts
    # Monitor all pools every 5 seconds

  node scripts/monitor-pools.ts --interval 10000
    # Monitor all pools every 10 seconds

  node scripts/monitor-pools.ts --pool scanner-pool
    # Monitor only scanner-pool every 5 seconds

  node scripts/monitor-pools.ts --once
    # Show current pool health and exit

  node scripts/monitor-pools.ts --pool proposal-workers --interval 3000
    # Monitor proposal-workers pool every 3 seconds
      `);
      process.exit(0);
  }
}

const interval = options.interval || 5000; // Default: 5 seconds
const poolName = options.pool;
const once = options.once || false;

console.log('🔍 Agent Pool Monitor');
console.log(`   Mode: ${once ? 'Single check' : 'Continuous monitoring'}`);
console.log(`   Interval: ${interval}ms`);
console.log(`   Pools: ${poolName || 'All pools'}`);
console.log('');

// Handle Ctrl+C gracefully
let cleanup: (() => void) | null = null;
process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down pool monitor...');
  if (cleanup) cleanup();
  process.exit(0);
});

// Run monitoring
if (once) {
  // Single check mode
  logPerformanceSummary();
  logPoolHealth(poolName);
  process.exit(0);
} else {
  // Continuous monitoring mode
  cleanup = startPoolMonitoring(interval, poolName);
}
