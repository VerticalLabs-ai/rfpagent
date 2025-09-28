// Generated script for workflow 3dd831f5-6b81-46d1-9f05-d5afcdf74351
// Generated at 2025-09-22T16:45:30.809Z

import { Stagehand } from "@browserbasehq/stagehand";
import { z } from 'zod';
import StagehandConfig from "./stagehand.config.js";

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

    const variables = {
      input1: 'services',
    };

    // Step 1: Navigate to URL
    console.log('Navigating to: https://findrfp.com/');
    await page.goto('https://findrfp.com/');

    // Step 2: Perform action
    console.log(`Performing action: click the My Find RFP link`);
    await page.act(`click the My Find RFP link`);

    // Step 3: Perform action
    console.log(
      `Performing action: type 'vrodriguez@ibyteent.com' into the User ID field`,
    );
    await page.act(`type 'vrodriguez@ibyteent.com' into the User ID field`);

    // Step 4: Perform action
    console.log(`Performing action: click the Login button`);
    await page.act(`click the Login button`);

    // Step 5: Perform action
    console.log(`Performing action: click the Search RFPs link`);
    await page.act(`click the Search RFPs link`);

    // Step 6: Perform action
    console.log(`Performing action: click the state dropdown`);
    await page.act(`click the state dropdown`);

    // Step 7: Perform action
    console.log(`Performing action: click the Texas option`);
    await page.act(`click the Texas option`);

    // Step 8: Perform action
    console.log(`Performing action: click the Search button`);
    await page.act(`click the Search button`);

    // Step 9: Perform action
    console.log(
      `Performing action: type ${variables.input1} into the search textbox`,
    );
    await page.act(`type ${variables.input1} into the search textbox`);

    // Step 10: Perform action
    console.log(`Performing action: click the Search button`);
    await page.act(`click the Search button`);

    // Step 11: Extract data
    console.log(
      `Extracting: extract all RFP information from the current page including ID, title, agency, location, and issued date`,
    );
    const extractedData11 = await page.extract({
      instruction: `extract all RFP information from the current page including ID, title, agency, location, and issued date`,
      schema: z.object({
        rfps: z.array(
          z.object({
            id: z.string().optional(),
            title: z.string().optional(),
            agency: z.string().optional(),
            location: z.string().optional(),
            issued_date: z.string().optional(),
          }),
        ),
      }),
    });
    console.log('Extracted:', extractedData11);

    // Step 12: Perform action
    console.log(`Performing action: click the page 2 link`);
    await page.act(`click the page 2 link`);

    // Step 13: Extract data
    console.log(
      `Extracting: extract all RFP information from the current page including ID, title, agency, location, and issued date`,
    );
    const extractedData13 = await page.extract({
      instruction: `extract all RFP information from the current page including ID, title, agency, location, and issued date`,
      schema: z.object({
        rfps: z.array(
          z.object({
            id: z.string().optional(),
            title: z.string().optional(),
            agency: z.string().optional(),
            location: z.string().optional(),
            issued_date: z.string().optional(),
          }),
        ),
      }),
    });
    console.log('Extracted:', extractedData13);

    // Step 14: Perform action
    console.log(`Performing action: click the page 3 link`);
    await page.act(`click the page 3 link`);

    // Step 15: Extract data
    console.log(
      `Extracting: extract all RFP information from the current page including ID, title, agency, location, and issued date`,
    );
    const extractedData15 = await page.extract({
      instruction: `extract all RFP information from the current page including ID, title, agency, location, and issued date`,
      schema: z.object({
        rfps: z.array(
          z.object({
            id: z.string().optional(),
            title: z.string().optional(),
            agency: z.string().optional(),
            location: z.string().optional(),
            issued_date: z.string().optional(),
          }),
        ),
      }),
    });
    console.log('Extracted:', extractedData15);

    // Step 16: Perform action
    console.log(`Performing action: click the page 4 link`);
    await page.act(`click the page 4 link`);

    // Step 17: Extract data
    console.log(
      `Extracting: extract all RFP information from the current page including ID, title, agency, location, and issued date`,
    );
    const extractedData17 = await page.extract({
      instruction: `extract all RFP information from the current page including ID, title, agency, location, and issued date`,
      schema: z.object({
        rfps: z.array(
          z.object({
            id: z.string().optional(),
            title: z.string().optional(),
            agency: z.string().optional(),
            location: z.string().optional(),
            issued_date: z.string().optional(),
          }),
        ),
      }),
    });
    console.log('Extracted:', extractedData17);

    // Step 18: Perform action
    console.log(`Performing action: click the page 5 link`);
    await page.act(`click the page 5 link`);

    // Step 19: Extract data
    console.log(
      `Extracting: extract all RFP information from the current page including ID, title, agency, location, and issued date`,
    );
    const extractedData19 = await page.extract({
      instruction: `extract all RFP information from the current page including ID, title, agency, location, and issued date`,
      schema: z.object({
        rfps: z.array(
          z.object({
            id: z.string().optional(),
            title: z.string().optional(),
            agency: z.string().optional(),
            location: z.string().optional(),
            issued_date: z.string().optional(),
          }),
        ),
      }),
    });
    console.log('Extracted:', extractedData19);

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

runWorkflow();