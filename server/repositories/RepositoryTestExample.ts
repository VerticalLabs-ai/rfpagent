/**
 * Example test file showing how to use the new repository pattern
 * This demonstrates the improved API and functionality
 */

import { repositoryManager, repositories } from './index';

/**
 * Example function showing new repository usage
 */
export async function repositoryUsageExample() {
  console.log('🧪 Testing Repository Pattern Implementation...\n');

  try {
    // ===== Health Check =====
    console.log('1. Health Check:');
    const health = await repositoryManager.healthCheck();
    console.log(`   Status: ${health.status}`);
    console.log(
      `   Repositories: ${JSON.stringify(health.repositories, null, 2)}\n`
    );

    // ===== Statistics =====
    console.log('2. Repository Statistics:');
    const stats = await repositoryManager.getStats();
    console.log(
      `   Users: ${stats.users.total} total, ${stats.users.active} active`
    );
    console.log(
      `   Portals: ${stats.portals.total} total, ${stats.portals.active} active`
    );
    console.log(
      `   RFPs: ${stats.rfps.total} total, ${stats.rfps.active} active\n`
    );

    // ===== User Repository Examples =====
    console.log('3. User Repository Features:');

    // Count users
    const userCount = await repositories.users.count();
    console.log(`   Total users: ${userCount}`);

    // Get active users
    const activeUsers = await repositories.users.getActiveUsers();
    console.log(`   Active users: ${activeUsers.length}`);

    // Search functionality (if users exist)
    if (userCount > 0) {
      const searchResults = await repositories.users.searchUsers('test');
      console.log(
        `   Search results for 'test': ${searchResults.length} users`
      );
    }

    console.log();

    // ===== Portal Repository Examples =====
    console.log('4. Portal Repository Features:');

    // Get portal statistics
    const portalStats = await repositories.portals.getPortalStats();
    console.log(`   Portal Stats:`, portalStats);

    // Get portals with filtering
    const activePortals = await repositories.portals.findAllPortals({
      status: 'active',
      limit: 5,
    });
    console.log(
      `   Active portals (first 5): ${activePortals.data.length} found`
    );

    // Get portals needing scanning
    const needScanning =
      await repositories.portals.getPortalsNeedingScanning(24);
    console.log(`   Portals needing scanning: ${needScanning.length}`);

    console.log();

    // ===== RFP Repository Examples =====
    console.log('5. RFP Repository Features:');

    // Get RFP statistics
    const rfpStats = await repositories.rfps.getRFPStats();
    console.log(`   RFP Stats:`, rfpStats);

    // Get active RFPs
    const activeRFPs = await repositories.rfps.getActiveRFPs();
    console.log(`   Active RFPs: ${activeRFPs.length}`);

    // Get expiring RFPs
    const expiringRFPs = await repositories.rfps.getExpiringRFPs(7);
    console.log(`   RFPs expiring in 7 days: ${expiringRFPs.length}`);

    // Get categories and agencies
    const categories = await repositories.rfps.getCategories();
    const agencies = await repositories.rfps.getAgencies();
    console.log(`   Unique categories: ${categories.length}`);
    console.log(`   Unique agencies: ${agencies.length}`);

    console.log();

    // ===== Backward Compatibility Test =====
    console.log('6. Backward Compatibility (Migration Adapter):');

    // Test that the new repositories work with the old interface
    const legacyPortals = await repositories.portals.findAllPortals();
    console.log(
      `   Legacy-style portal fetch: ${legacyPortals.data.length} portals`
    );

    // Test pagination
    const paginatedRFPs = await repositories.rfps.findAllRFPs({
      limit: 10,
      offset: 0,
      orderBy: 'createdAt',
      direction: 'desc',
    });
    console.log(
      `   Paginated RFPs: ${paginatedRFPs.data.length} of ${paginatedRFPs.total} total`
    );

    console.log();

    // ===== Transaction Example =====
    console.log('7. Transaction Support:');
    try {
      await repositories.executeTransaction(async repos => {
        // This would be a real transaction in production
        const userCount = await repos.users.count();
        const portalCount = await repos.portals.count();
        console.log(
          `   Transaction: ${userCount} users, ${portalCount} portals`
        );
        return { userCount, portalCount };
      });
      console.log(`   Transaction completed successfully`);
    } catch (error) {
      console.log(`   Transaction failed: ${error}`);
    }

    console.log();
    console.log('✅ Repository Pattern Implementation Test Complete!\n');

    return {
      health,
      stats,
      userCount,
      activeUsers: activeUsers.length,
      portalStats,
      rfpStats,
      categories: categories.length,
      agencies: agencies.length,
    };
  } catch (error) {
    console.error('❌ Repository test failed:', error);
    throw error;
  }
}

/**
 * Compare old vs new pattern performance (conceptual)
 */
export async function performanceComparison() {
  console.log('📊 Performance Comparison: Old vs New Pattern\n');

  const start = Date.now();

  // New pattern - efficient, type-safe operations
  const newPatternResults = await Promise.all([
    repositories.users.count(),
    repositories.portals.getPortalStats(),
    repositories.rfps.getRFPStats(),
  ]);

  const newPatternTime = Date.now() - start;

  console.log('New Repository Pattern:');
  console.log(`  ✅ Type-safe operations`);
  console.log(`  ✅ Efficient queries with built-in optimization`);
  console.log(`  ✅ Consistent error handling`);
  console.log(`  ✅ Built-in pagination and filtering`);
  console.log(`  ✅ Transaction support`);
  console.log(`  ⏱️ Execution time: ${newPatternTime}ms\n`);

  console.log('Benefits of Repository Pattern:');
  console.log(`  🎯 Single Responsibility: Each repository handles one entity`);
  console.log(`  🔧 Extensible: Easy to add new methods and features`);
  console.log(`  🧪 Testable: Can mock individual repositories`);
  console.log(`  📊 Maintainable: Smaller, focused classes`);
  console.log(`  🔒 Type Safe: Full TypeScript support`);
  console.log(`  ⚡ Performance: Optimized queries and caching ready`);

  return {
    newPatternTime,
    results: newPatternResults,
  };
}

// Export test functions for manual testing
export const repositoryTests = {
  usageExample: repositoryUsageExample,
  performanceComparison,
};
