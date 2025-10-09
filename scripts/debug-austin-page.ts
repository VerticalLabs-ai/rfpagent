/**
 * Debug script to check what's on the Austin portal page
 */

import { sessionManager } from '../src/mastra/tools/session-manager';

async function debugAustinPage() {
  console.log('🔍 Debugging Austin Portal Page\n');

  const sessionId = `debug-${Date.now()}`;

  try {
    console.log('1. Initializing Browserbase session...');
    const stagehand = await sessionManager.ensureStagehand(sessionId);
    const page = stagehand.page;

    // Try different URLs
    const urlsToTry = [
      'https://financeonline.austintexas.gov/',
      'https://financeonline.austintexas.gov/afo/account_services/solicitation/solicitation_search.cfm',
      'https://financeonline.austintexas.gov/afo/account_services/solicitation/solicitation_search.cfm?action=search&status=open',
    ];

    for (const url of urlsToTry) {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`📄 Testing URL: ${url}`);
      console.log('='.repeat(80));

      await page.goto(url);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(3000);

      const content = await page.content();

      console.log(`\n📊 Page Stats:`);
      console.log(`  - Content length: ${content.length} characters`);
      console.log(`  - Page title: ${await page.title()}`);
      console.log(`  - Current URL: ${page.url()}`);

      // Check for solicitation-related content
      const hasDetailLinks = content.includes('solicitation_details.cfm');
      const hasSolicitationWord = content.toLowerCase().includes('solicitation');
      const hasTableTags = content.includes('<table');
      const hasFormTags = content.includes('<form');

      console.log(`\n🔍 Content Analysis:`);
      console.log(`  - Has detail links: ${hasDetailLinks}`);
      console.log(`  - Has 'solicitation' text: ${hasSolicitationWord}`);
      console.log(`  - Has tables: ${hasTableTags}`);
      console.log(`  - Has forms: ${hasFormTags}`);

      // Count specific elements
      const detailLinkCount = (content.match(/solicitation_details\.cfm/g) || []).length;
      const tableCount = (content.match(/<table/g) || []).length;
      const formCount = (content.match(/<form/g) || []).length;

      console.log(`\n📈 Element Counts:`);
      console.log(`  - Detail links: ${detailLinkCount}`);
      console.log(`  - Tables: ${tableCount}`);
      console.log(`  - Forms: ${formCount}`);

      // Extract a sample of visible text
      const bodyText = await page.evaluate(() => {
        return document.body?.innerText || '';
      });

      console.log(`\n📝 Visible Text Sample (first 500 chars):`);
      console.log(bodyText.substring(0, 500));
      console.log('...\n');

      // Check for specific patterns
      const rfpPatterns = [
        /IFQ\s*#?\d+/gi,
        /IFB\s*#?\d+/gi,
        /RFP\s*#?\d+/gi,
        /solicitation\s*#?\d+/gi,
      ];

      console.log(`🎯 RFP Pattern Matches:`);
      for (const pattern of rfpPatterns) {
        const matches = bodyText.match(pattern);
        if (matches && matches.length > 0) {
          console.log(`  - ${pattern}: ${matches.slice(0, 5).join(', ')}${matches.length > 5 ? '...' : ''}`);
        } else {
          console.log(`  - ${pattern}: No matches`);
        }
      }
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log('✅ Debug complete');

  } catch (error) {
    console.error('❌ Error during debug:', error);
  } finally {
    await sessionManager.cleanupSession(sessionId);
  }
}

debugAustinPage()
  .then(() => {
    console.log('\nDone');
    process.exit(0);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
