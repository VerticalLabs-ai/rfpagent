#!/usr/bin/env tsx
/**
 * Test script for BeaconBid RFP processing and submission
 * Tests the complete workflow: RFP creation → Submission creation
 */

import { apiRequest } from '../server/utils/apiRequest';

const BEACONBID_RFP_URL =
  'https://www.beaconbid.com/solicitations/city-of-houston/737f1bff-2f76-454d-94f8-6d65b7d93a47/single-family-home-development-at-stella-link';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5001';

interface TestResult {
  test: string;
  passed: boolean;
  error?: string;
  data?: any;
}

const results: TestResult[] = [];

function logTest(test: string, passed: boolean, error?: string, data?: any) {
  results.push({ test, passed, error, data });
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} ${test}`);
  if (error) {
    console.log(`   Error: ${error}`);
  }
  if (data && !passed) {
    console.log(`   Response:`, JSON.stringify(data, null, 2));
  }
}

async function testManualRfpCreation() {
  console.log('\n📝 Testing Manual RFP Creation...');
  try {
    const response = await fetch(`${API_BASE_URL}/api/rfps/manual`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: BEACONBID_RFP_URL,
        userNotes: 'Test submission for BeaconBid RFP',
      }),
    });

    const data = await response.json();

    if (response.status === 202 && data.success && data.sessionId) {
      logTest('Manual RFP Creation', true, undefined, {
        sessionId: data.sessionId,
        message: data.message,
      });
      return { success: true, sessionId: data.sessionId };
    } else {
      logTest('Manual RFP Creation', false, `Unexpected response`, data);
      return { success: false };
    }
  } catch (error) {
    logTest(
      'Manual RFP Creation',
      false,
      error instanceof Error ? error.message : String(error)
    );
    return { success: false };
  }
}

async function waitForRfpProcessing(sessionId: string, maxWait = 60000) {
  console.log('\n⏳ Waiting for RFP processing...');
  const startTime = Date.now();
  const checkInterval = 2000; // Check every 2 seconds

  return new Promise<{ rfpId?: string; success: boolean }>((resolve) => {
    const checkStatus = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/rfps/manual/progress/${sessionId}`,
          {
            headers: {
              Accept: 'text/event-stream',
            },
          }
        );

        if (response.ok) {
          // For SSE, we'd need to parse the stream
          // For now, let's try a different approach - check if RFP was created
          const rfpsResponse = await fetch(`${API_BASE_URL}/api/rfps?limit=1`);
          const rfps = await rfpsResponse.json();
          
          if (rfps && rfps.length > 0) {
            const latestRfp = rfps[0];
            if (latestRfp.sourceUrl === BEACONBID_RFP_URL) {
              resolve({ rfpId: latestRfp.id, success: true });
              return;
            }
          }
        }

        if (Date.now() - startTime > maxWait) {
          resolve({ success: false });
          return;
        }

        setTimeout(checkStatus, checkInterval);
      } catch (error) {
        if (Date.now() - startTime > maxWait) {
          resolve({ success: false });
        } else {
          setTimeout(checkStatus, checkInterval);
        }
      }
    };

    checkStatus();
  });
}

async function testSubmissionCreation(rfpId: string) {
  console.log('\n📤 Testing Submission Creation...');

  // Test 1: Create submission with valid data
  try {
    const response = await fetch(`${API_BASE_URL}/api/submissions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        rfpId: rfpId,
        proposalData: {
          title: 'Single Family Home Development Proposal',
          description: 'Test proposal for BeaconBid RFP',
          details: {
            client: 'City of Houston',
            budget: '1000000.00',
          },
          team: [
            {
              memberName: 'John Doe',
              role: 'Project Manager',
            },
            {
              memberName: 'Jane Smith',
              role: 'Technical Lead',
            },
          ],
        },
        userNotes: 'Test submission notes',
      }),
    });

    const data = await response.json();

    if (response.status === 201 && data.success && data.data.submissionId) {
      logTest('Submission Creation - Valid Data', true, undefined, {
        submissionId: data.data.submissionId,
        rfpId: data.data.rfpId,
        proposalId: data.data.proposalId,
      });
      return { success: true, submissionId: data.data.submissionId };
    } else {
      logTest('Submission Creation - Valid Data', false, 'Unexpected response', data);
      return { success: false };
    }
  } catch (error) {
    logTest(
      'Submission Creation - Valid Data',
      false,
      error instanceof Error ? error.message : String(error)
    );
    return { success: false };
  }
}

async function testSubmissionValidation() {
  console.log('\n🔍 Testing Submission Validation...');

  // Test 1: Empty payload
  try {
    const response = await fetch(`${API_BASE_URL}/api/submissions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    const data = await response.json();

    if (response.status === 400 && data.success === false) {
      logTest('Validation - Empty Payload', true, undefined, data);
    } else {
      logTest('Validation - Empty Payload', false, 'Expected 400 error', data);
    }
  } catch (error) {
    logTest(
      'Validation - Empty Payload',
      false,
      error instanceof Error ? error.message : String(error)
    );
  }

  // Test 2: Invalid RFP ID
  try {
    const response = await fetch(`${API_BASE_URL}/api/submissions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        rfpId: '00000000-0000-0000-0000-000000000000',
        proposalData: { title: 'Test' },
      }),
    });

    const data = await response.json();

    if (response.status === 404 && data.success === false) {
      logTest('Validation - Invalid RFP ID', true, undefined, data);
    } else {
      logTest('Validation - Invalid RFP ID', false, 'Expected 404 error', data);
    }
  } catch (error) {
    logTest(
      'Validation - Invalid RFP ID',
      false,
      error instanceof Error ? error.message : String(error)
    );
  }

  // Test 3: Nested JSON (from test cases)
  try {
    const response = await fetch(`${API_BASE_URL}/api/submissions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        proposalData: {
          title: 'Cloud Infrastructure Proposal',
          details: {
            client: 'City of Philadelphia',
            budget: '1000000.00',
          },
          team: [
            {
              memberName: 'John Doe',
              role: 'Project Manager',
            },
            {
              memberName: 'Jane Smith',
              role: 'Technical Lead',
            },
          ],
        },
      }),
    });

    const data = await response.json();

    // Should fail because rfpId is required
    if (response.status === 400 && data.success === false) {
      logTest('Validation - Nested JSON (Missing RFP ID)', true, undefined, data);
    } else {
      logTest('Validation - Nested JSON', false, 'Expected validation error', data);
    }
  } catch (error) {
    logTest(
      'Validation - Nested JSON',
      false,
      error instanceof Error ? error.message : String(error)
    );
  }
}

async function test404Handler() {
  console.log('\n🔍 Testing 404 Error Handler...');

  try {
    const response = await fetch(`${API_BASE_URL}/api/submissions/invalid-endpoint`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    const data = await response.json();

    if (
      response.status === 404 &&
      data.success === false &&
      data.error === 'Route not found'
    ) {
      logTest('404 Handler - Returns JSON', true, undefined, data);
    } else {
      logTest('404 Handler - Returns JSON', false, 'Expected JSON 404 response', data);
    }
  } catch (error) {
    logTest(
      '404 Handler - Returns JSON',
      false,
      error instanceof Error ? error.message : String(error)
    );
  }
}

async function main() {
  console.log('🧪 Testing BeaconBid RFP Workflow');
  console.log(`📍 RFP URL: ${BEACONBID_RFP_URL}`);
  console.log(`🌐 API Base URL: ${API_BASE_URL}\n`);

  // Test 1: Check if server is running
  try {
    const healthResponse = await fetch(`${API_BASE_URL}/api/health`);
    if (healthResponse.ok) {
      logTest('Server Health Check', true);
    } else {
      logTest('Server Health Check', false, 'Server not responding');
      console.log('\n❌ Server is not running. Please start the server first:');
      console.log('   pnpm dev');
      process.exit(1);
    }
  } catch (error) {
    logTest('Server Health Check', false, 'Cannot connect to server');
    console.log('\n❌ Cannot connect to server. Please start the server first:');
    console.log('   pnpm dev');
    process.exit(1);
  }

  // Test 2: Manual RFP Creation
  const rfpResult = await testManualRfpCreation();
  
  if (!rfpResult.success) {
    console.log('\n⚠️  RFP creation failed. Continuing with validation tests...');
  } else {
    // Wait a bit for processing (in real scenario, would use SSE)
    console.log('\n⏳ Waiting 5 seconds for RFP processing to start...');
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Try to get the RFP ID
    try {
      const rfpsResponse = await fetch(`${API_BASE_URL}/api/rfps?limit=10`);
      const rfps = await rfpsResponse.json();
      const beaconRfp = Array.isArray(rfps)
        ? rfps.find((r: any) => r.sourceUrl === BEACONBID_RFP_URL)
        : null;

      if (beaconRfp) {
        console.log(`✅ Found RFP: ${beaconRfp.id}`);
        
        // Test 3: Submission Creation
        await testSubmissionCreation(beaconRfp.id);
      } else {
        console.log('⚠️  RFP not found yet. It may still be processing.');
        console.log('   You can check progress using the sessionId from above.');
      }
    } catch (error) {
      console.log('⚠️  Could not fetch RFPs:', error);
    }
  }

  // Test 4: Validation Tests
  await testSubmissionValidation();

  // Test 5: 404 Handler
  await test404Handler();

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Summary');
  console.log('='.repeat(60));

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const total = results.length;

  console.log(`✅ Passed: ${passed}/${total}`);
  console.log(`❌ Failed: ${failed}/${total}`);
  console.log(`📈 Success Rate: ${Math.round((passed / total) * 100)}%`);

  if (failed > 0) {
    console.log('\n❌ Failed Tests:');
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.log(`   - ${r.test}`);
        if (r.error) {
          console.log(`     Error: ${r.error}`);
        }
      });
  }

  console.log('\n' + '='.repeat(60));

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('❌ Test script failed:', error);
  process.exit(1);
});

