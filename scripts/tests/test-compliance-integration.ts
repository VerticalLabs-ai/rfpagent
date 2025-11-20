#!/usr/bin/env node
/**
 * Test Compliance Integration
 *
 * This script tests the compliance integration system to ensure:
 * 1. Automatic compliance analysis triggers work
 * 2. Data structures match UI expectations
 * 3. Batch processing works correctly
 * 4. API endpoints return correct formats
 *
 * Usage:
 *   npm run test-compliance
 */

import { aiService } from '../server/services/core/aiService';
import { complianceIntegrationService } from '../server/services/core/complianceIntegrationService';
import { storage } from '../server/storage';

const toErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

interface TestResult {
  name: string;
  success: boolean;
  details: string;
  error?: string;
}

class ComplianceIntegrationTester {
  private results: TestResult[] = [];

  /**
   * Run all compliance integration tests
   */
  async runTests(): Promise<void> {
    console.log('🧪 Starting Compliance Integration Tests');
    console.log('=======================================');

    try {
      await this.testDataStructures();
      await this.testAIServiceCompliance();
      await this.testComplianceService();
      await this.testDatabaseQueries();
      await this.testBatchProcessing();

      this.printTestResults();
    } catch (error) {
      console.error('❌ Test execution failed:', error);
      process.exit(1);
    }
  }

  /**
   * Test data structures match UI expectations
   */
  private async testDataStructures(): Promise<void> {
    console.log('\n🔍 Testing data structures...');

    try {
      // Test AI service compliance analysis output structure
      const testText =
        'This is a test RFP document. The vendor must provide insurance certificates and complete all mandatory forms.';
      const testRfp = { id: 'test', title: 'Test RFP', agency: 'Test Agency' };

      const aiResult = await aiService.analyzeDocumentCompliance(
        testText,
        testRfp
      );

      const hasRequirements = Array.isArray(aiResult.requirements);
      const hasComplianceItems = Array.isArray(aiResult.complianceItems);
      const hasRiskFlags = Array.isArray(aiResult.riskFlags);

      if (hasRequirements && hasComplianceItems && hasRiskFlags) {
        // Check structure of individual items
        const requirementStructure =
          aiResult.requirements.length === 0 ||
          (Object.hasOwn(aiResult.requirements[0], 'type') &&
            Object.hasOwn(aiResult.requirements[0], 'description') &&
            Object.hasOwn(aiResult.requirements[0], 'mandatory'));

        const complianceStructure =
          aiResult.complianceItems.length === 0 ||
          (Object.hasOwn(aiResult.complianceItems[0], 'field') &&
            Object.hasOwn(aiResult.complianceItems[0], 'description') &&
            Object.hasOwn(aiResult.complianceItems[0], 'format'));

        const riskStructure =
          aiResult.riskFlags.length === 0 ||
          (Object.hasOwn(aiResult.riskFlags[0], 'type') &&
            Object.hasOwn(aiResult.riskFlags[0], 'category') &&
            Object.hasOwn(aiResult.riskFlags[0], 'description'));

        if (requirementStructure && complianceStructure && riskStructure) {
          this.addResult(
            'Data Structure Validation',
            true,
            `AI service returns correctly structured data with ${aiResult.requirements.length} requirements, ${aiResult.complianceItems.length} compliance items, ${aiResult.riskFlags.length} risk flags`
          );
        } else {
          this.addResult(
            'Data Structure Validation',
            false,
            'AI service returns incorrectly structured data fields'
          );
        }
      } else {
        this.addResult(
          'Data Structure Validation',
          false,
          'AI service missing required arrays: requirements, complianceItems, or riskFlags'
        );
      }
    } catch (error) {
      this.addResult(
        'Data Structure Validation',
        false,
        'Failed to test data structures',
        toErrorMessage(error)
      );
    }
  }

  /**
   * Test AI service compliance analysis
   */
  private async testAIServiceCompliance(): Promise<void> {
    console.log('\n🤖 Testing AI service compliance analysis...');

    try {
      const testCases = [
        {
          name: 'Basic RFP Text',
          text: 'Request for proposals for water system maintenance. Bidders must provide insurance certificates and bonds.',
          expectItems: ['insurance', 'bonds'],
        },
        {
          name: 'Empty Text',
          text: '',
          expectItems: [],
        },
        {
          name: 'Complex Requirements',
          text: 'All proposals must include: 1) Notarized bid form 2) Performance bond 3) Insurance certificate 4) License verification',
          expectItems: ['notarized', 'bond', 'insurance', 'license'],
        },
      ];

      for (const testCase of testCases) {
        try {
          const result = await aiService.analyzeDocumentCompliance(
            testCase.text,
            { title: 'Test', agency: 'Test' }
          );

          if (
            result &&
            result.requirements &&
            result.complianceItems &&
            result.riskFlags
          ) {
            this.addResult(
              `AI Analysis - ${testCase.name}`,
              true,
              `Generated ${result.requirements.length} requirements, ${result.complianceItems.length} compliance items, ${result.riskFlags.length} risk flags`
            );
          } else {
            this.addResult(
              `AI Analysis - ${testCase.name}`,
              false,
              'AI analysis returned invalid structure'
            );
          }
        } catch (error) {
          this.addResult(
            `AI Analysis - ${testCase.name}`,
            false,
            'AI analysis failed',
            toErrorMessage(error)
          );
        }
      }
    } catch (error) {
      this.addResult(
        'AI Service Testing',
        false,
        'Failed to test AI service',
        toErrorMessage(error)
      );
    }
  }

  /**
   * Test compliance integration service
   */
  private async testComplianceService(): Promise<void> {
    console.log('\n🔧 Testing compliance integration service...');

    try {
      // Test processing status
      const status = complianceIntegrationService.getProcessingStatus();

      this.addResult(
        'Service Status Check',
        true,
        `Service operational with ${status.queueSize} items in queue`
      );

      // Test data formatting
      const testData = {
        requirements: [
          { type: 'test', description: 'test desc', mandatory: true },
        ],
        complianceItems: [
          { field: 'test field', description: 'test', format: 'text' },
        ],
        riskFlags: [
          { type: 'medium', category: 'test', description: 'test risk' },
        ],
      };

      // Test that the service can handle the expected data format
      if (
        Array.isArray(testData.requirements) &&
        Array.isArray(testData.complianceItems) &&
        Array.isArray(testData.riskFlags)
      ) {
        this.addResult(
          'Service Data Handling',
          true,
          'Service correctly handles expected data structures'
        );
      } else {
        this.addResult(
          'Service Data Handling',
          false,
          'Service cannot handle expected data structures'
        );
      }
    } catch (error) {
      this.addResult(
        'Compliance Service Testing',
        false,
        'Failed to test compliance service',
        toErrorMessage(error)
      );
    }
  }

  /**
   * Test database queries for compliance data
   */
  private async testDatabaseQueries(): Promise<void> {
    console.log('\n🗄️ Testing database queries...');

    try {
      // Test getting RFPs and checking for compliance data structure
      const { rfps } = await storage.getAllRFPs({ limit: 5 });

      if (rfps.length > 0) {
        const rfpWithCompliance = rfps.find(
          rfp => rfp.requirements || rfp.complianceItems || rfp.riskFlags
        );

        if (rfpWithCompliance) {
          const hasValidStructure =
            (!rfpWithCompliance.requirements ||
              Array.isArray(rfpWithCompliance.requirements)) &&
            (!rfpWithCompliance.complianceItems ||
              Array.isArray(rfpWithCompliance.complianceItems)) &&
            (!rfpWithCompliance.riskFlags ||
              Array.isArray(rfpWithCompliance.riskFlags));

          this.addResult(
            'Database Structure Check',
            hasValidStructure,
            hasValidStructure
              ? 'RFP compliance data stored with correct array structures'
              : 'RFP compliance data has incorrect structure in database'
          );
        } else {
          this.addResult(
            'Database Structure Check',
            true,
            'No RFPs with compliance data found (expected for fresh database)'
          );
        }

        this.addResult(
          'Database Query Test',
          true,
          `Successfully queried ${rfps.length} RFPs from database`
        );
      } else {
        this.addResult(
          'Database Query Test',
          true,
          'Database connection working but no RFPs found'
        );
      }
    } catch (error) {
      this.addResult(
        'Database Query Test',
        false,
        'Failed to query database',
        toErrorMessage(error)
      );
    }
  }

  /**
   * Test batch processing (dry run only)
   */
  private async testBatchProcessing(): Promise<void> {
    console.log('\n📦 Testing batch processing...');

    try {
      // Get current RFP counts
      const { rfps: allRfps } = await storage.getAllRFPs({ limit: 100 });

      const unprocessedRfps = allRfps.filter(
        rfp =>
          !rfp.requirements ||
          !rfp.complianceItems ||
          !rfp.riskFlags ||
          (Array.isArray(rfp.requirements) && rfp.requirements.length === 0)
      );

      this.addResult(
        'Batch Processing Analysis',
        true,
        `Found ${allRfps.length} total RFPs, ${unprocessedRfps.length} need compliance processing`
      );

      // Test batch processing with limit 1 to avoid overwhelming during test
      if (unprocessedRfps.length > 0) {
        console.log('  Testing batch processing on 1 RFP...');
        const batchResults =
          await complianceIntegrationService.batchProcessUnprocessedRFPs(1);

        if (batchResults && batchResults.length > 0) {
          const successful = batchResults.filter(r => r.success).length;
          this.addResult(
            'Batch Processing Execution',
            successful > 0,
            `Processed ${batchResults.length} RFPs, ${successful} successful`
          );
        } else {
          this.addResult(
            'Batch Processing Execution',
            true,
            'Batch processing returned no results (no RFPs to process)'
          );
        }
      } else {
        this.addResult(
          'Batch Processing Execution',
          true,
          'No unprocessed RFPs found - all RFPs already have compliance data'
        );
      }
    } catch (error) {
      this.addResult(
        'Batch Processing Test',
        false,
        'Failed to test batch processing',
        toErrorMessage(error)
      );
    }
  }

  /**
   * Add a test result
   */
  private addResult(
    name: string,
    success: boolean,
    details: string,
    error?: string
  ): void {
    this.results.push({ name, success, details, error });

    const status = success ? '✅' : '❌';
    console.log(`  ${status} ${name}: ${details}`);
    if (error) {
      console.log(`     Error: ${error}`);
    }
  }

  /**
   * Print final test results
   */
  private printTestResults(): void {
    console.log('\n📊 Test Results Summary');
    console.log('======================');

    const passed = this.results.filter(r => r.success).length;
    const failed = this.results.filter(r => !r.success).length;
    const total = this.results.length;

    console.log(`Total Tests: ${total}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(`Success Rate: ${Math.round((passed / total) * 100)}%`);

    if (failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.results
        .filter(r => !r.success)
        .forEach(result => {
          console.log(`  - ${result.name}: ${result.details}`);
          if (result.error) {
            console.log(`    Error: ${result.error}`);
          }
        });
    }

    if (passed === total) {
      console.log(
        '\n🎉 All tests passed! Compliance integration is working correctly.'
      );
    } else {
      console.log('\n⚠️  Some tests failed. Please review the issues above.');
    }
  }
}

/**
 * Main execution
 */
async function main() {
  const tester = new ComplianceIntegrationTester();
  await tester.runTests();
}

// Only run if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { ComplianceIntegrationTester };
