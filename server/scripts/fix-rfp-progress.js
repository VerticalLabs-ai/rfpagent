#!/usr/bin/env node

/**
 * Script to fix RFP progress values that were incorrectly set to 100%
 * This script updates RFPs based on their status to have appropriate progress values
 */

import { storage } from '../storage';

async function fixRFPProgress() {
  console.log('🔧 Starting RFP progress fix script...');

  try {
    // Get all RFPs
    const { rfps } = await storage.getAllRFPs({ limit: 1000 });
    console.log(`📊 Found ${rfps.length} RFPs to check`);

    let updatedCount = 0;

    for (const rfp of rfps) {
      let newProgress = rfp.progress;

      // Determine correct progress based on status
      switch (rfp.status) {
        case 'open':
          newProgress = 10;  // RFP discovered but not yet processed
          break;
        case 'discovered':
          newProgress = 15;  // Just discovered and scraped
          break;
        case 'parsing':
          newProgress = 25;  // Documents being processed
          break;
        case 'review':
          newProgress = 40;  // Analysis complete, pending review
          break;
        case 'drafting':
          newProgress = 60;  // Proposal being generated
          break;
        case 'approved':
          newProgress = 80;  // Proposal approved, ready for submission
          break;
        case 'submitted':
          newProgress = 100; // Actually submitted - this should be 100%
          break;
        case 'closed':
          newProgress = 100; // Process complete
          break;
        default:
          // Keep existing progress if status is unknown
          continue;
      }

      // Only update if progress is different
      if (rfp.progress !== newProgress) {
        await storage.updateRFP(rfp.id, { progress: newProgress });
        console.log(`✅ Updated RFP "${rfp.title}" (${rfp.status}): ${rfp.progress}% → ${newProgress}%`);
        updatedCount++;
      }
    }

    console.log(`🎉 Progress fix complete! Updated ${updatedCount} out of ${rfps.length} RFPs`);

  } catch (error) {
    console.error('❌ Error fixing RFP progress:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  fixRFPProgress()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { fixRFPProgress };