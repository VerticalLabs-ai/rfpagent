/**
 * Fix Austin RFP Titles
 *
 * Removes "View Details Due Date: XX/XX/XXXX at XPM" prefix from RFP titles
 * that were incorrectly parsed from Austin Finance Online portal.
 *
 * Usage:
 *   tsx scripts/fix-austin-rfp-titles.ts
 */

import { db } from '../server/db';
import { rfps } from '../shared/schema';
import { eq } from 'drizzle-orm';

async function fixAustinRFPTitles() {
  console.log('🔧 Fixing Austin RFP titles...\n');

  try {
    // Get all City of Austin RFPs with malformed titles
    const austinRFPs = await db
      .select()
      .from(rfps)
      .where(eq(rfps.agency, 'City of Austin'));

    console.log(`📋 Found ${austinRFPs.length} City of Austin RFPs`);

    let fixedCount = 0;
    let skippedCount = 0;

    for (const rfp of austinRFPs) {
      const originalTitle = rfp.title;

      // Check if title needs fixing
      if (
        !originalTitle.match(/^view\s+details\s+due\s+date:/i) &&
        !originalTitle.match(/^\d{1,2}\/\d{1,2}\/\d{4}\s+at\s+\d{1,2}[AP]M/i)
      ) {
        skippedCount++;
        continue;
      }

      // Clean the title
      let cleanedTitle = originalTitle
        // Remove "View Details" prefix
        .replace(/^view\s+details\s*/i, '')
        // Remove "Due Date: XX/XX/XXXX at XPM" pattern
        .replace(/^due\s+date:\s*\d{1,2}\/\d{1,2}\/\d{4}\s+at\s+\d{1,2}[AP]M\s*/i, '')
        // Remove standalone date/time pattern
        .replace(/^\d{1,2}\/\d{1,2}\/\d{4}\s+at\s+\d{1,2}[AP]M\s*/i, '')
        // Remove trailing "View Details" or "Due Date" fragments
        .replace(/\s+view\s+details.*$/i, '')
        .replace(/\s+due\s+date.*$/i, '')
        .trim();

      // If cleaning resulted in empty or very short title, keep the cleaned portion
      if (!cleanedTitle || cleanedTitle.length < 10) {
        console.log(`⚠️  Skipping RFP ${rfp.id}: Cleaned title too short`);
        console.log(`   Original: "${originalTitle}"`);
        console.log(`   Cleaned: "${cleanedTitle}"\n`);
        skippedCount++;
        continue;
      }

      // Update the RFP
      await db
        .update(rfps)
        .set({ title: cleanedTitle })
        .where(eq(rfps.id, rfp.id));

      console.log(`✅ Fixed RFP ${rfp.id}`);
      console.log(`   Before: "${originalTitle}"`);
      console.log(`   After:  "${cleanedTitle}"\n`);

      fixedCount++;
    }

    console.log('\n📊 Summary:');
    console.log(`   Total RFPs processed: ${austinRFPs.length}`);
    console.log(`   ✅ Fixed: ${fixedCount}`);
    console.log(`   ⏭️  Skipped: ${skippedCount}\n`);

    if (fixedCount > 0) {
      console.log('✅ RFP titles have been cleaned successfully!');
      console.log('   Refresh your browser to see the updated titles.\n');
    } else {
      console.log('ℹ️  No RFP titles needed fixing.\n');
    }

  } catch (error) {
    console.error('❌ Error fixing RFP titles:', error);
    throw error;
  }
}

// Run the fix script
fixAustinRFPTitles()
  .then(() => {
    console.log('✅ Fix script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fix script failed:', error);
    process.exit(1);
  });
