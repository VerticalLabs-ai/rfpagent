#!/usr/bin/env tsx
import { storage } from '../server/storage';

async function checkUrls() {
  const portals = await storage.getAllPortals();
  const austinPortal = portals.find(p => p.url.includes('financeonline.austintexas.gov'));

  if (!austinPortal) {
    console.log('No Austin portal found');
    return;
  }

  const rfps = await storage.getRFPsByPortal(austinPortal.id);
  console.log(`\n📊 Found ${rfps.length} RFPs for Austin portal\n`);

  if (rfps.length > 0) {
    console.log('Sample RFPs with URL analysis:\n');
    console.log('═══════════════════════════════════════════════════════');

    for (let i = 0; i < Math.min(5, rfps.length); i++) {
      const rfp = rfps[i];
      console.log(`\n${i + 1}. Title: ${rfp.title || 'No title'}`);
      console.log(`   Solicitation ID: ${rfp.solicitationId || 'N/A'}`);
      console.log(`   Source URL: ${rfp.sourceUrl || 'N/A'}`);
      console.log(`   Link: ${rfp.link || 'N/A'}`);

      // Check if URL contains "View Details" (bad) or actual URL (good)
      const sourceUrl = rfp.sourceUrl || '';
      const hasViewDetails = sourceUrl.includes('View Details');
      const hasSid = sourceUrl.includes('sid=');
      const hasValidUrl = sourceUrl.startsWith('http');

      console.log(`   Validations:`);
      console.log(`     - Has valid URL format: ${hasValidUrl ? '✅' : '❌'}`);
      console.log(`     - Contains sid parameter: ${hasSid ? '✅' : '❌'}`);
      console.log(`     - NOT "View Details" text: ${!hasViewDetails ? '✅' : '❌'}`);
    }

    console.log('\n═══════════════════════════════════════════════════════');

    // Summary statistics
    const totalRfps = rfps.length;
    const rfpsWithViewDetails = rfps.filter(r => (r.sourceUrl || '').includes('View Details')).length;
    const rfpsWithValidUrls = rfps.filter(r => {
      const url = r.sourceUrl || '';
      return url.startsWith('http') && url.includes('sid=') && !url.includes('View Details');
    }).length;

    console.log('\n📈 URL Quality Summary:');
    console.log(`   Total RFPs: ${totalRfps}`);
    console.log(`   Valid URLs with sid: ${rfpsWithValidUrls} (${((rfpsWithValidUrls/totalRfps)*100).toFixed(1)}%)`);
    console.log(`   "View Details" errors: ${rfpsWithViewDetails} (${((rfpsWithViewDetails/totalRfps)*100).toFixed(1)}%)`);

    if (rfpsWithViewDetails > 0) {
      console.log('\n⚠️  Some RFPs still have "View Details" in URL field - extraction needs improvement');
    } else {
      console.log('\n✅ All RFPs have valid URLs!');
    }
  }
}

checkUrls()
  .catch(console.error)
  .finally(() => process.exit(0));
