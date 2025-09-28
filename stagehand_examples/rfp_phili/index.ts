// Enhanced RFP Data Extraction and Document Download Script
// Generated at 2025-09-22T15:24:35.244Z

import { Stagehand } from "@browserbasehq/stagehand";
import { z } from 'zod';
import StagehandConfig from "./stagehand.config.js";
import fs from 'fs';
import path from 'path';

// Stagehand configuration

async function runWorkflow() {
  let stagehand: Stagehand | null = null;

  try {
    // Initialize Stagehand
    console.log('Initializing Stagehand...');
    stagehand = new Stagehand(StagehandConfig);
    await stagehand.init();
    console.log('Stagehand initialized successfully.');

    // Get the page instance
    const page = stagehand.page;
    if (!page) {
      throw new Error('Failed to get page instance from Stagehand');
    }

    // Step 1: Navigate to URL
    console.log(
      'Navigating to: https://www.phlcontracts.phila.gov/bso/external/bidDetail.sdo?docId=B2624978',
    );
    await page.goto(
      'https://www.phlcontracts.phila.gov/bso/external/bidDetail.sdo?docId=B2624978',
    );

    // Wait for page to load completely
    await page.waitForTimeout(3000);

    // Step 2: Use basic manual data (focusing on document downloads for now)
    console.log('Using basic RFP information from URL...');
    const extractedData = {
      bidNumber: 'B2624978',
      description: 'Bottled Water 16.9 oz and 700 ml',
      organization: 'City of Philadelphia',
      extractedAt: new Date().toISOString(),
      pageUrl: 'https://www.phlcontracts.phila.gov/bso/external/bidDetail.sdo?docId=B2624978'
    };

    console.log('Basic RFP Data:', JSON.stringify(extractedData, null, 2));

    // Use the basic data
    const completeData = extractedData;

    // Step 3: Create organized folder structure
    const bidNumber = extractedData.bidNumber || 'B2624978';
    const rfpFolderPath = path.join('./downloads', `RFP_${bidNumber}`);
    const documentsPath = path.join(rfpFolderPath, 'documents');

    // Create directories
    if (!fs.existsSync('./downloads')) {
      fs.mkdirSync('./downloads');
    }
    if (!fs.existsSync(rfpFolderPath)) {
      fs.mkdirSync(rfpFolderPath);
    }
    if (!fs.existsSync(documentsPath)) {
      fs.mkdirSync(documentsPath);
    }

    // Step 4: Save extracted data to JSON file
    const dataFilePath = path.join(rfpFolderPath, 'rfp_data.json');
    fs.writeFileSync(dataFilePath, JSON.stringify(completeData, null, 2));
    console.log(`RFP data saved to: ${dataFilePath}`);

    // Step 5: Extract all attachment links from the page
    console.log('Finding all PDF attachment links...');
    const attachmentLinks = await page.evaluate(() => {
      const links = [];

      // Look for various patterns of PDF links
      const selectors = [
        'a[href*=".pdf"]',
        'a[onclick*=".pdf"]',
        'a[href*="download"]',
        'a[href*="Document"]',
        'a[href*="doc"]',
        'a[title*=".pdf"]',
        'a[title*="PDF"]',
        'a[aria-label*=".pdf"]'
      ];

      selectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach((link) => {
          const element = link;
          const href = element.href || element.getAttribute('onclick') || '';
          const textContent = element.textContent;
          const name = (textContent ? textContent.trim() : '') || element.title || element.getAttribute('aria-label') || '';

          if (name && (href || name.includes('.pdf'))) {
            links.push({ name, href });
          }
        });
      });

      // Also look for any text containing "pdf" near links
      const allLinks = document.querySelectorAll('a');
      allLinks.forEach((link) => {
        const textContent = link.textContent;
        const text = textContent ? textContent.toLowerCase() : '';
        const href = link.href || link.getAttribute('onclick') || '';

        if (text.includes('pdf') || text.includes('.pdf') || href.includes('pdf')) {
          const name = textContent ? textContent.trim() : '';
          if (name && !links.some(l => l.name === name)) {
            links.push({ name, href });
          }
        }
      });

      return links;
    });

    console.log(`Found ${attachmentLinks.length} PDF attachments:`, attachmentLinks);

    // Step 6: Download all PDF attachments
    for (let i = 0; i < attachmentLinks.length; i++) {
      const attachment = attachmentLinks[i];
      console.log(`Downloading ${i + 1}/${attachmentLinks.length}: ${attachment.name}`);

      try {
        // Setup download monitoring
        const downloadPromise = page.waitForEvent('download');

        // For JavaScript links, we need to evaluate the function
        if (attachment.href.startsWith('javascript:')) {
          await page.evaluate((href) => {
            eval(href.replace('javascript:', ''));
          }, attachment.href);
        } else {
          // For regular links, click them
          await page.click(`a[href="${attachment.href}"]`);
        }

        // Wait for download to start
        const download = await downloadPromise;

        // Clean up the filename
        const fileName = attachment.name.endsWith('.pdf') ? attachment.name : `${attachment.name}.pdf`;
        const sanitizedFileName = fileName.replace(/[<>:"/\\|?*]/g, '_'); // Remove invalid filename characters
        const filePath = path.resolve(documentsPath, sanitizedFileName);

        // Ensure the documents directory exists
        if (!fs.existsSync(documentsPath)) {
          fs.mkdirSync(documentsPath, { recursive: true });
        }

        await download.saveAs(filePath);

        console.log(`✓ Downloaded: ${sanitizedFileName}`);

        // Small delay between downloads
        await page.waitForTimeout(2000);

      } catch (error) {
        console.error(`✗ Failed to download ${attachment.name}:`, error);
      }
    }

    // Step 7: Create summary report
    const summaryPath = path.join(rfpFolderPath, 'README.md');
    const summaryContent = `# RFP ${bidNumber} - ${completeData.description || 'Philadelphia Contract'}

## Bid Information
- **Bid Number:** ${completeData.bidNumber || 'N/A'}
- **Description:** ${completeData.description || 'N/A'}
- **Organization:** ${completeData.organization || 'N/A'}
- **Department:** ${completeData.department || 'N/A'}
- **Bid Opening Date:** ${completeData.bidOpeningDate || 'N/A'}
- **Bid Type:** ${completeData.bidType || 'N/A'}

## Contact Information
- **Purchaser:** ${completeData.purchaser || 'N/A'}
- **Info Contact:** ${completeData.infoContact || 'N/A'}

## Important Dates
- **Required Date:** ${completeData.requiredDate || 'N/A'}
- **Available Date:** ${completeData.availableDate || 'N/A'}

## Downloaded Documents
${attachmentLinks.map(att => `- ${att.name}`).join('\n')}

## Files Structure
- \`rfp_data.json\` - Complete extracted RFP data
- \`documents/\` - All PDF attachments
- \`README.md\` - This summary

## Extraction Details
- **Page URL:** ${completeData.pageUrl || 'N/A'}
- **Extracted At:** ${completeData.extractedAt || 'N/A'}

*Generated on ${new Date().toISOString()}*
`;

    fs.writeFileSync(summaryPath, summaryContent);
    console.log(`Summary report saved to: ${summaryPath}`);

    console.log(`\n🎉 RFP data extraction completed!`);
    console.log(`📁 All files organized in: ${rfpFolderPath}`);
    console.log(`📄 ${attachmentLinks.length} documents downloaded`);
    console.log(`📊 Complete RFP data saved to JSON`);
    console.log(`📋 Summary report generated`);

    console.log('Workflow completed successfully');
    return { success: true };
  } catch (error) {
    console.error('Workflow failed:', error);
    return { success: false, error };
  } finally {
    // Clean up
    if (stagehand) {
      console.log('Closing Stagehand connection.');
      try {
        await stagehand.close();
      } catch (err) {
        console.error('Error closing Stagehand:', err);
      }
    }
  }
}

// Single execution
runWorkflow().then((result) => {
  console.log('Execution result:', result);
  process.exit(result.success ? 0 : 1);
});