/**
 * Test script to scan Austin portal and verify RFP capture
 *
 * This script tests the incremental portal scanning service
 * against the Austin Finance Online portal to validate that
 * it captures all available RFPs.
 */

import { incrementalPortalScanService } from '../server/services/incrementalPortalScanService';
import { storage } from '../server/storage';

async function testAustinPortalScan() {
  console.log('🚀 Starting Austin Portal Scan Test\n');
  console.log('Portal URL: https://financeonline.austintexas.gov/\n');

  try {
    // Step 1: Check if portal exists in database
    console.log('📋 Step 1: Checking portal configuration...');
    const portals = await storage.getAllPortals();
    const austinPortal = portals.find(p =>
      p.url.includes('financeonline.austintexas.gov') ||
      p.name.toLowerCase().includes('austin')
    );

    if (!austinPortal) {
      console.log('❌ Austin portal not found in database');
      console.log('Available portals:');
      portals.forEach(p => console.log(`  - ${p.name}: ${p.url}`));

      // Create portal if it doesn't exist
      console.log('\n📝 Creating Austin portal...');
      const newPortal = await storage.createPortal({
        name: 'Austin Finance Online',
        url: 'https://financeonline.austintexas.gov/',
        type: 'government',
        isActive: true,
        monitoringEnabled: true,
        scanFrequency: 'daily',
        lastScanned: null,
        searchFilters: {
          maxResults: 100,
          includeCategories: ['rfp', 'rfq', 'procurement'],
        }
      });

      console.log(`✅ Portal created with ID: ${newPortal.id}`);
      return testAustinPortalScan(); // Retry with created portal
    }

    console.log(`✅ Found portal: ${austinPortal.name} (ID: ${austinPortal.id})`);
    console.log(`   URL: ${austinPortal.url}`);
    console.log(`   Last Scanned: ${austinPortal.lastScanned || 'Never'}`);
    console.log(`   Is Active: ${austinPortal.isActive}`);

    // Step 2: Get existing RFPs count before scan
    console.log('\n📊 Step 2: Checking existing RFPs...');
    const existingRfps = await storage.getRFPsByPortal(austinPortal.id);
    console.log(`   Existing RFPs in database: ${existingRfps.length}`);
    if (existingRfps.length > 0) {
      console.log(`   First RFP: ${existingRfps[0].title}`);
      console.log(`   Last RFP: ${existingRfps[existingRfps.length - 1].title}`);
    }

    // Step 3: Run incremental scan
    console.log('\n🔍 Step 3: Running incremental portal scan...');
    console.log('⏳ This may take several minutes depending on portal size...\n');

    const scanResult = await incrementalPortalScanService.scanPortal({
      portalId: austinPortal.id,
      forceFullScan: false, // Use incremental mode
      maxRfpsToScan: 100, // Capture up to 100 RFPs
    });

    // Step 4: Display results
    console.log('\n✅ Step 4: Scan Complete!\n');
    console.log('═══════════════════════════════════════════');
    console.log('📈 SCAN RESULTS');
    console.log('═══════════════════════════════════════════');
    console.log(`Portal: ${scanResult.portalName}`);
    console.log(`Scan ID: ${scanResult.scanId}`);
    console.log(`Duration: ${(scanResult.duration / 1000).toFixed(2)}s`);
    console.log('');
    console.log(`🆕 New RFPs: ${scanResult.newRfpsCount}`);
    console.log(`🔄 Updated RFPs: ${scanResult.updatedRfpsCount}`);
    console.log(`➡️  Unchanged RFPs: ${scanResult.unchangedRfpsCount}`);
    console.log(`❌ Errors: ${scanResult.errorCount}`);
    console.log('═══════════════════════════════════════════\n');

    if (scanResult.errors.length > 0) {
      console.log('⚠️  Errors encountered:');
      scanResult.errors.forEach((err, idx) => {
        console.log(`   ${idx + 1}. ${err}`);
      });
      console.log('');
    }

    // Step 5: Verify final count
    console.log('📊 Step 5: Verifying final RFP count...');
    const finalRfps = await storage.getRFPsByPortal(austinPortal.id);
    console.log(`   Total RFPs now in database: ${finalRfps.length}`);
    console.log(`   Expected: ${existingRfps.length + scanResult.newRfpsCount}`);

    const expectedCount = existingRfps.length + scanResult.newRfpsCount;
    if (finalRfps.length === expectedCount) {
      console.log('   ✅ Count matches expected value!');
    } else {
      console.log(`   ⚠️  Count mismatch (expected ${expectedCount}, got ${finalRfps.length})`);
    }

    // Step 6: Sample some RFPs
    if (finalRfps.length > 0) {
      console.log('\n📋 Step 6: Sample RFPs captured:\n');
      const sampleSize = Math.min(5, finalRfps.length);
      for (let i = 0; i < sampleSize; i++) {
        const rfp = finalRfps[i];
        console.log(`${i + 1}. ${rfp.title}`);
        console.log(`   Agency: ${rfp.agency || 'N/A'}`);
        console.log(`   Deadline: ${rfp.deadline ? new Date(rfp.deadline).toLocaleDateString() : 'N/A'}`);
        console.log(`   URL: ${rfp.sourceUrl || 'N/A'}`);
        console.log('');
      }
    }

    // Step 7: Validation summary
    console.log('═══════════════════════════════════════════');
    console.log('✅ VALIDATION SUMMARY');
    console.log('═══════════════════════════════════════════');

    const validations = [
      {
        name: 'Portal scan completed',
        passed: true,
      },
      {
        name: 'RFPs captured',
        passed: finalRfps.length > 0,
      },
      {
        name: 'Expected dozen+ RFPs',
        passed: finalRfps.length >= 12,
      },
      {
        name: 'No critical errors',
        passed: scanResult.errorCount === 0,
      },
      {
        name: 'Data quality check',
        passed: finalRfps.length > 0 && finalRfps[0].title && finalRfps[0].title.length > 0,
      },
    ];

    validations.forEach(v => {
      console.log(`${v.passed ? '✅' : '❌'} ${v.name}`);
    });
    console.log('═══════════════════════════════════════════\n');

    const allPassed = validations.every(v => v.passed);
    if (allPassed) {
      console.log('🎉 All validations passed! Portal scanning is working correctly.\n');
    } else {
      console.log('⚠️  Some validations failed. Review the results above.\n');
    }

    return {
      success: allPassed,
      scanResult,
      totalRfps: finalRfps.length,
      validations,
    };

  } catch (error) {
    console.error('❌ Error during test:');
    console.error(error);
    throw error;
  }
}

// Run the test
testAustinPortalScan()
  .then(result => {
    console.log('Test completed');
    process.exit(result.success ? 0 : 1);
  })
  .catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
  });
