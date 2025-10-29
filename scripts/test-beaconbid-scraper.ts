import { BeaconBidDocumentScraper } from '../server/services/scrapers/beaconBidDocumentScraper';

async function testBeaconBidScraper() {
  console.log('🧪 Testing BeaconBid Document Scraper\n');

  const scraper = new BeaconBidDocumentScraper();
  const testUrl = 'https://www.beaconbid.com/solicitations/city-of-houston/737f1bff-2f76-454d-94f8-6d65b7d93a47/single-family-home-development-at-stella-link';
  const testRfpId = 'test-beaconbid-' + Date.now();

  try {
    console.log('📄 Testing document extraction from BeaconBid...');
    console.log(`URL: ${testUrl}`);
    console.log(`RFP ID: ${testRfpId}\n`);

    const documents = await scraper.scrapeRFPDocuments(testRfpId, testUrl);

    console.log(`\n✅ Successfully extracted ${documents.length} documents\n`);

    if (documents.length > 0) {
      console.log('📋 Document Details:');
      documents.forEach((doc, idx) => {
        console.log(`\n${idx + 1}. ${doc.filename}`);
        console.log(`   File Type: ${doc.fileType.toUpperCase()}`);
        console.log(`   Category: ${(doc.parsedData as any)?.category || 'Unknown'}`);
        console.log(`   Needs Fill Out: ${(doc.parsedData as any)?.needsFillOut ? 'Yes' : 'No'}`);
        console.log(`   Storage Path: ${doc.objectPath}`);
        console.log(`   Download URL: ${(doc.parsedData as any)?.downloadUrl || 'N/A'}`);
      });

      // Categorize documents
      const fillable = documents.filter(d => (d.parsedData as any)?.needsFillOut);
      const readOnly = documents.filter(d => !(d.parsedData as any)?.needsFillOut);

      console.log(`\n📊 Summary:`);
      console.log(`   Total Documents: ${documents.length}`);
      console.log(`   Fillable Forms: ${fillable.length}`);
      console.log(`   Reference Docs: ${readOnly.length}`);

      if (fillable.length > 0) {
        console.log(`\n📝 Forms to Complete:`);
        fillable.forEach(d => console.log(`   - ${d.filename}`));
      }

      if (readOnly.length > 0) {
        console.log(`\n📖 Reference Documents:`);
        readOnly.forEach(d => console.log(`   - ${d.filename}`));
      }
    } else {
      console.log('⚠️ No documents found on the BeaconBid page');
    }

    console.log('\n✅ Test completed successfully');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

testBeaconBidScraper().catch(console.error);
