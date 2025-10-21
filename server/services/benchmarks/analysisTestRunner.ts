import { analysisOrchestrator } from '../orchestrators/analysisOrchestrator';
import { analysisProgressTracker } from '../monitoring/analysisProgressTracker';
import { storage } from '../../storage';
import { nanoid } from 'nanoid';
import type { RFP, Document } from '@shared/schema';

/**
 * Test Runner for Analysis Pipeline Integration
 *
 * Provides comprehensive testing of the analysis pipeline with real RFP documents,
 * verifying end-to-end functionality including data persistence and progress tracking.
 */

export interface AnalysisTestCase {
  name: string;
  rfpData: {
    title: string;
    description: string;
    deadline?: Date;
    agency?: string;
    requirements?: string[];
  };
  documents: {
    filename: string;
    content: string;
    fileType: string;
  }[];
  expectedResults: {
    requirementsExtracted: boolean;
    complianceItemsGenerated: boolean;
    riskFlagsIdentified: boolean;
    progressTracked: boolean;
    dataPersisted: boolean;
  };
}

export interface TestResult {
  testName: string;
  success: boolean;
  duration: number;
  results: {
    rfpCreated: boolean;
    documentsUploaded: boolean;
    workflowExecuted: boolean;
    progressTracked: boolean;
    dataValidated: boolean;
    complianceGenerated: boolean;
  };
  errors: string[];
  metrics: {
    documentsProcessed: number;
    requirementsExtracted: number;
    complianceItems: number;
    riskFlags: number;
    processingTime: number;
  };
}

export class AnalysisTestRunner {
  private analysisOrchestrator = analysisOrchestrator;

  /**
   * Run comprehensive analysis pipeline tests
   */
  async runAnalysisTests(): Promise<TestResult[]> {
    console.log('🧪 Starting Analysis Pipeline Integration Tests');

    const testCases = this.getTestCases();
    const results: TestResult[] = [];

    for (const testCase of testCases) {
      console.log(`\n🔬 Running test: ${testCase.name}`);
      const result = await this.runSingleTest(testCase);
      results.push(result);

      if (result.success) {
        console.log(`✅ ${testCase.name} - PASSED`);
      } else {
        console.log(
          `❌ ${testCase.name} - FAILED: ${result.errors.join(', ')}`
        );
      }
    }

    console.log('\n📊 Test Summary:');
    const passed = results.filter(r => r.success).length;
    const total = results.length;
    console.log(`Tests Passed: ${passed}/${total}`);

    return results;
  }

  /**
   * Run a single test case
   */
  private async runSingleTest(testCase: AnalysisTestCase): Promise<TestResult> {
    const startTime = Date.now();
    const sessionId = nanoid();

    const result: TestResult = {
      testName: testCase.name,
      success: false,
      duration: 0,
      results: {
        rfpCreated: false,
        documentsUploaded: false,
        workflowExecuted: false,
        progressTracked: false,
        dataValidated: false,
        complianceGenerated: false,
      },
      errors: [],
      metrics: {
        documentsProcessed: 0,
        requirementsExtracted: 0,
        complianceItems: 0,
        riskFlags: 0,
        processingTime: 0,
      },
    };

    // Declare cleanup variables before try block
    let rfp: RFP | null = null;
    let documents: Document[] = [];

    try {
      // Step 1: Create test RFP
      console.log('📄 Creating test RFP...');
      rfp = await this.createTestRFP(testCase.rfpData);
      result.results.rfpCreated = true;
      console.log(`✅ Created RFP: ${rfp.id}`);

      // Step 2: Upload test documents
      console.log('📎 Uploading test documents...');
      documents = await this.uploadTestDocuments(rfp.id, testCase.documents);
      result.results.documentsUploaded = true;
      result.metrics.documentsProcessed = documents.length;
      console.log(`✅ Uploaded ${documents.length} documents`);

      // Step 3: Execute analysis workflow
      console.log('⚙️ Executing analysis workflow...');
      const workflowResult =
        await this.analysisOrchestrator.executeAnalysisWorkflow({
          rfpId: rfp.id,
          sessionId,
          priority: 1,
        });

      if (workflowResult.success) {
        result.results.workflowExecuted = true;
        console.log('✅ Analysis workflow completed successfully');
      } else {
        result.errors.push(`Workflow failed: ${workflowResult.error}`);
      }

      // Step 4: Verify progress tracking
      console.log('📈 Verifying progress tracking...');
      const progressData = analysisProgressTracker.getRFPProgress(rfp.id);
      if (progressData.length > 0) {
        result.results.progressTracked = true;
        console.log(`✅ Progress tracked: ${progressData.length} workflow(s)`);
      } else {
        result.errors.push('No progress tracking data found');
      }

      // Step 5: Validate data persistence
      console.log('💾 Validating data persistence...');
      const updatedRfp = await storage.getRFP(rfp.id);
      const updatedDocuments = await storage.getDocumentsByRFP(rfp.id);

      if (
        updatedRfp &&
        this.validateDataPersistence(updatedRfp, updatedDocuments)
      ) {
        result.results.dataValidated = true;
        console.log('✅ Data persistence validated');

        // Extract metrics
        result.metrics.requirementsExtracted = Array.isArray(
          updatedRfp.requirements
        )
          ? updatedRfp.requirements.length
          : 0;
        result.metrics.complianceItems = Array.isArray(
          updatedRfp.complianceItems
        )
          ? updatedRfp.complianceItems.length
          : 0;
        result.metrics.riskFlags = Array.isArray(updatedRfp.riskFlags)
          ? updatedRfp.riskFlags.length
          : 0;
      } else {
        result.errors.push('Data persistence validation failed');
      }

      // Step 6: Verify compliance generation
      console.log('⚖️ Verifying compliance generation...');
      if (
        updatedRfp?.complianceItems &&
        Array.isArray(updatedRfp.complianceItems) &&
        updatedRfp.complianceItems.length > 0
      ) {
        result.results.complianceGenerated = true;
        console.log(
          `✅ Generated ${updatedRfp.complianceItems.length} compliance items`
        );
      } else {
        result.errors.push('No compliance items generated');
      }

      // Check overall success
      result.success =
        result.errors.length === 0 &&
        Object.values(result.results).every(v => v);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      result.errors.push(`Test execution failed: ${errorMessage}`);
      console.error('❌ Test execution failed:', error);
    } finally {
      // Clean up test data
      if (rfp) {
        try {
          console.log(`🧹 Cleaning up test data for RFP: ${rfp.id}`);

          // Delete documents first
          // Note: deleteDocument method doesn't exist in storage interface - skipping deletion
          // for (const doc of documents) {
          //   try {
          //     await storage.deleteDocument(doc.id);
          //   } catch (deleteError) {
          //     console.warn(
          //       `⚠️ Failed to delete document ${doc.id}:`,
          //       deleteError
          //     );
          //   }
          // }

          // Delete RFP
          try {
            await storage.deleteRFP(rfp.id);
            console.log(`✅ Cleanup completed for RFP: ${rfp.id}`);
          } catch (deleteError) {
            console.warn(`⚠️ Failed to delete RFP ${rfp.id}:`, deleteError);
          }
        } catch (cleanupError) {
          console.warn(
            `⚠️ Cleanup error for test ${testCase.name}:`,
            cleanupError
          );
        }
      }
    }

    result.duration = Date.now() - startTime;
    result.metrics.processingTime = result.duration;

    return result;
  }

  /**
   * Create a test RFP with sample data
   */
  private async createTestRFP(
    rfpData: AnalysisTestCase['rfpData']
  ): Promise<RFP> {
    const rfp = await storage.createRFP({
      title: rfpData.title,
      description: rfpData.description,
      deadline:
        rfpData.deadline || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      agency: rfpData.agency || 'Test Agency',
      status: 'discovered',
      sourceUrl: `https://test-portal.gov/rfp/${nanoid()}`,
      portalId: 'test-portal',
    });

    return rfp;
  }

  /**
   * Upload test documents for analysis
   */
  private async uploadTestDocuments(
    rfpId: string,
    documentData: AnalysisTestCase['documents']
  ): Promise<Document[]> {
    const documents: Document[] = [];

    for (const docData of documentData) {
      // Create a test document record
      const document = await storage.createDocument({
        rfpId,
        filename: docData.filename,
        fileType: docData.fileType,
        extractedText: docData.content, // Pre-populate for testing
        objectPath: `test-documents/${nanoid()}-${docData.filename}`,
      });

      documents.push(document);
    }

    return documents;
  }

  /**
   * Validate that analysis results are properly persisted
   */
  private validateDataPersistence(rfp: RFP, documents: Document[]): boolean {
    let isValid = true;

    // Check RFP has been updated with analysis results
    if (!Array.isArray(rfp.requirements) || rfp.requirements.length === 0) {
      console.warn('⚠️ No requirements found in RFP');
      isValid = false;
    }

    if (
      !Array.isArray(rfp.complianceItems) ||
      rfp.complianceItems.length === 0
    ) {
      console.warn('⚠️ No compliance items found in RFP');
      isValid = false;
    }

    // Check documents have been processed
    const processedDocuments = documents.filter(
      doc => doc.extractedText && doc.parsedData
    );

    if (processedDocuments.length === 0) {
      console.warn('⚠️ No documents appear to have been processed');
      isValid = false;
    }

    // Check for analysis metadata
    const documentsWithAnalysis = documents.filter(
      doc => doc.parsedData && typeof doc.parsedData === 'object'
    );

    if (documentsWithAnalysis.length === 0) {
      console.warn('⚠️ No analysis metadata found in documents');
      isValid = false;
    }

    return isValid;
  }

  /**
   * Get predefined test cases for various scenarios
   */
  private getTestCases(): AnalysisTestCase[] {
    return [
      {
        name: 'Simple RFP Analysis',
        rfpData: {
          title: 'Software Development Services',
          description:
            'Request for proposal for custom software development services including web applications and mobile apps.',
          agency: 'Department of Technology',
          requirements: [
            'Minimum 5 years experience',
            'Security clearance required',
            'Agile methodology',
          ],
        },
        documents: [
          {
            filename: 'requirements.txt',
            content: `SOFTWARE DEVELOPMENT SERVICES RFP

MANDATORY REQUIREMENTS:
- Minimum 5 years of software development experience
- Security clearance at Secret level or higher
- Experience with Agile/Scrum methodology
- Proficiency in JavaScript, Python, or Java
- Previous government contracting experience

EVALUATION CRITERIA:
- Technical approach (40%)
- Past performance (30%)
- Cost (20%)
- Key personnel qualifications (10%)

SUBMISSION DEADLINE: 30 days from RFP release
CONTRACT VALUE: $100,000 - $500,000

COMPLIANCE REQUIREMENTS:
- All personnel must pass background checks
- SOC 2 Type II certification required
- NIST cybersecurity framework compliance`,
            fileType: 'text/plain',
          },
        ],
        expectedResults: {
          requirementsExtracted: true,
          complianceItemsGenerated: true,
          riskFlagsIdentified: true,
          progressTracked: true,
          dataPersisted: true,
        },
      },
      {
        name: 'Complex Multi-Document RFP',
        rfpData: {
          title: 'IT Infrastructure Modernization',
          description:
            'Comprehensive modernization of legacy IT systems including cloud migration, security enhancements, and system integration.',
          agency: 'General Services Administration',
        },
        documents: [
          {
            filename: 'technical_requirements.txt',
            content: `TECHNICAL REQUIREMENTS

CLOUD MIGRATION:
- Migrate 50+ legacy applications to AWS or Azure
- Ensure 99.9% uptime during transition
- Implement disaster recovery with RPO < 1 hour

SECURITY REQUIREMENTS:
- FedRAMP High authorization required
- Multi-factor authentication implementation
- Zero-trust architecture design

INTEGRATION REQUIREMENTS:
- API-first architecture
- RESTful services implementation
- Real-time data synchronization`,
            fileType: 'text/plain',
          },
          {
            filename: 'compliance_matrix.txt',
            content: `COMPLIANCE MATRIX

MANDATORY COMPLIANCE ITEMS:
☐ FedRAMP High Authorization
☐ NIST 800-53 Security Controls
☐ Section 508 Accessibility
☐ FISMA Compliance
☐ SOC 2 Type II Audit Report

RISK ASSESSMENT:
HIGH RISK: Legacy system integration complexity
MEDIUM RISK: Timeline constraints (6 months)
LOW RISK: Cloud provider selection

EVALUATION WEIGHTS:
Technical Approach: 50%
Past Performance: 25%
Cost: 15%
Management Approach: 10%`,
            fileType: 'text/plain',
          },
        ],
        expectedResults: {
          requirementsExtracted: true,
          complianceItemsGenerated: true,
          riskFlagsIdentified: true,
          progressTracked: true,
          dataPersisted: true,
        },
      },
    ];
  }

  /**
   * Run a quick smoke test to verify basic functionality
   */
  async runSmokeTest(): Promise<boolean> {
    console.log('🔥 Running Analysis Pipeline Smoke Test');

    try {
      // Test progress tracker
      const workflowId = nanoid();
      const rfpId = nanoid();

      await analysisProgressTracker.initializeProgress({
        rfpId,
        workflowId,
        totalSteps: 4,
      });

      await analysisProgressTracker.updateProgress({
        workflowId,
        currentStep: 'Testing progress tracking',
        progress: 25,
      });

      const progress = analysisProgressTracker.getProgress(workflowId);

      if (!progress || progress.progress !== 25) {
        console.error('❌ Progress tracking test failed');
        return false;
      }

      await analysisProgressTracker.completeWorkflow(workflowId, {
        test: 'completed',
      });

      console.log('✅ Smoke test passed');
      return true;
    } catch (error) {
      console.error('❌ Smoke test failed:', error);
      return false;
    }
  }
}

// Export singleton for easy testing
export const analysisTestRunner = new AnalysisTestRunner();
