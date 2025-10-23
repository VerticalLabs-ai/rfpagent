#!/usr/bin/env node
import 'dotenv/config';
/**
 * Batch Processing Script for Compliance Analysis
 *
 * This script processes all existing RFPs that don't have compliance data,
 * ensuring they are analyzed and structured correctly for the UI.
 *
 * Usage:
 *   npm run batch-compliance [limit] [dry-run]
 *
 * Examples:
 *   npm run batch-compliance 20          # Process up to 20 RFPs
 *   npm run batch-compliance 50 dry-run  # Show what would be processed without running
 *   npm run batch-compliance all         # Process all unprocessed RFPs
 */

import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { complianceIntegrationService } from '../server/services/core/complianceIntegrationService';
import { storage } from '../server/storage';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface BatchProcessOptions {
  limit: number;
  dryRun: boolean;
  verbose: boolean;
}

interface BatchProcessStats {
  totalRfps: number;
  unprocessedRfps: number;
  successfullyProcessed: number;
  errors: number;
  skipped: number;
  startTime: Date;
  endTime?: Date;
  duration?: number;
}

class ComplianceBatchProcessor {
  private stats: BatchProcessStats = {
    totalRfps: 0,
    unprocessedRfps: 0,
    successfullyProcessed: 0,
    errors: 0,
    skipped: 0,
    startTime: new Date(),
  };

  /**
   * Run the batch processing
   */
  async run(options: BatchProcessOptions): Promise<void> {
    console.log('🚀 Starting Compliance Batch Processing');
    console.log('=====================================');
    console.log(`Limit: ${options.limit === Infinity ? 'ALL' : options.limit}`);
    console.log(`Dry Run: ${options.dryRun ? 'YES' : 'NO'}`);
    console.log(`Verbose: ${options.verbose ? 'YES' : 'NO'}`);
    console.log('');

    try {
      // Get all RFPs to analyze current state
      await this.analyzeCurrentState();

      if (options.dryRun) {
        console.log('🔍 DRY RUN MODE - No changes will be made');
        await this.performDryRun(options);
      } else {
        console.log('⚡ PROCESSING MODE - Changes will be made');
        await this.performProcessing(options);
      }

      this.printFinalReport();
    } catch (error) {
      console.error('❌ Batch processing failed:', error);
      process.exit(1);
    }
  }

  /**
   * Analyze current state of RFPs
   */
  private async analyzeCurrentState(): Promise<void> {
    console.log('📊 Analyzing current state...');

    try {
      const { rfps: allRfps } = await storage.getAllRFPs({ limit: 10000 });
      this.stats.totalRfps = allRfps.length;

      const unprocessedRfps = allRfps.filter(
        rfp =>
          !rfp.requirements ||
          !rfp.complianceItems ||
          !rfp.riskFlags ||
          (Array.isArray(rfp.requirements) && rfp.requirements.length === 0)
      );

      this.stats.unprocessedRfps = unprocessedRfps.length;

      console.log(`Total RFPs in database: ${this.stats.totalRfps}`);
      console.log(
        `RFPs missing compliance data: ${this.stats.unprocessedRfps}`
      );
      console.log(
        `RFPs with compliance data: ${this.stats.totalRfps - this.stats.unprocessedRfps}`
      );
      console.log(
        `Compliance coverage: ${(((this.stats.totalRfps - this.stats.unprocessedRfps) / this.stats.totalRfps) * 100).toFixed(1)}%`
      );
      console.log('');

      if (this.stats.unprocessedRfps === 0) {
        console.log(
          '✅ All RFPs already have compliance data! Nothing to process.'
        );
        process.exit(0);
      }
    } catch (error) {
      console.error('❌ Failed to analyze current state:', error);
      throw error;
    }
  }

  /**
   * Perform dry run to show what would be processed
   */
  private async performDryRun(options: BatchProcessOptions): Promise<void> {
    console.log('🔍 Dry run analysis...');

    try {
      const { rfps: allRfps } = await storage.getAllRFPs({ limit: 10000 });

      const unprocessedRfps = allRfps
        .filter(
          rfp =>
            !rfp.requirements ||
            !rfp.complianceItems ||
            !rfp.riskFlags ||
            (Array.isArray(rfp.requirements) && rfp.requirements.length === 0)
        )
        .slice(0, options.limit);

      console.log(`Would process ${unprocessedRfps.length} RFPs:`);
      console.log('');

      for (let i = 0; i < Math.min(unprocessedRfps.length, 10); i++) {
        const rfp = unprocessedRfps[i];
        const documents = await storage.getDocumentsByRFP(rfp.id);
        const documentsWithText = documents.filter(d => d.extractedText);

        console.log(`${i + 1}. ${rfp.title}`);
        console.log(`   Agency: ${rfp.agency}`);
        console.log(`   Status: ${rfp.status}`);
        console.log(
          `   Documents: ${documents.length} (${documentsWithText.length} with text)`
        );
        console.log(
          `   Strategy: ${this.determineProcessingStrategy(rfp, documents, documentsWithText)}`
        );
        console.log('');
      }

      if (unprocessedRfps.length > 10) {
        console.log(`... and ${unprocessedRfps.length - 10} more RFPs`);
      }
    } catch (error) {
      console.error('❌ Dry run failed:', error);
      throw error;
    }
  }

  /**
   * Perform actual processing
   */
  private async performProcessing(options: BatchProcessOptions): Promise<void> {
    console.log('⚡ Starting batch processing...');

    try {
      const results =
        await complianceIntegrationService.batchProcessUnprocessedRFPs(
          options.limit
        );

      this.stats.successfullyProcessed = results.filter(r => r.success).length;
      this.stats.errors = results.filter(r => !r.success).length;

      if (options.verbose) {
        console.log('\n📋 Detailed Results:');
        console.log('====================');

        results.forEach((result, index) => {
          console.log(
            `\n${index + 1}. RFP ${result.rfpId}: ${result.success ? '✅ SUCCESS' : '❌ FAILED'}`
          );

          if (result.success) {
            if (result.complianceData) {
              console.log(
                `   Requirements: ${result.complianceData.requirements.length}`
              );
              console.log(
                `   Compliance Items: ${result.complianceData.complianceItems.length}`
              );
              console.log(
                `   Risk Flags: ${result.complianceData.riskFlags.length}`
              );
            }
            if (result.metadata) {
              console.log(
                `   Analysis Type: ${result.metadata.analysisType || 'unknown'}`
              );
              if (result.metadata.documentsAnalyzed) {
                console.log(
                  `   Documents Analyzed: ${result.metadata.documentsAnalyzed}`
                );
              }
            }
          } else {
            console.log(`   Error: ${result.error}`);
          }
        });
      }
    } catch (error) {
      console.error('❌ Processing failed:', error);
      throw error;
    }
  }

  /**
   * Determine what processing strategy would be used for an RFP
   */
  private determineProcessingStrategy(
    rfp: any,
    documents: any[],
    documentsWithText: any[]
  ): string {
    if (documents.length === 0) {
      return 'Basic Analysis (no documents)';
    }

    if (documentsWithText.length === 0) {
      return 'Full Workflow (text extraction needed)';
    }

    return 'Direct Analysis (text available)';
  }

  /**
   * Print final report
   */
  private printFinalReport(): void {
    this.stats.endTime = new Date();
    this.stats.duration =
      this.stats.endTime.getTime() - this.stats.startTime.getTime();

    console.log('\n🎯 Final Report');
    console.log('===============');
    console.log(`Total RFPs in database: ${this.stats.totalRfps}`);
    console.log(`RFPs needing processing: ${this.stats.unprocessedRfps}`);
    console.log(`Successfully processed: ${this.stats.successfullyProcessed}`);
    console.log(`Errors: ${this.stats.errors}`);
    console.log(`Skipped: ${this.stats.skipped}`);
    console.log(
      `Processing time: ${(this.stats.duration / 1000).toFixed(1)} seconds`
    );

    const successRate =
      this.stats.unprocessedRfps > 0
        ? (
            (this.stats.successfullyProcessed / this.stats.unprocessedRfps) *
            100
          ).toFixed(1)
        : '0';
    console.log(`Success rate: ${successRate}%`);

    const newCoverage =
      this.stats.totalRfps > 0
        ? (
            ((this.stats.totalRfps -
              this.stats.unprocessedRfps +
              this.stats.successfullyProcessed) /
              this.stats.totalRfps) *
            100
          ).toFixed(1)
        : '0';
    console.log(`New compliance coverage: ${newCoverage}%`);

    if (this.stats.errors > 0) {
      console.log(
        '\n⚠️  Some RFPs failed to process. Check the logs above for details.'
      );
    }

    if (this.stats.successfullyProcessed > 0) {
      console.log('\n✅ Batch processing completed successfully!');
      console.log(
        '   The compliance page should now show updated data for processed RFPs.'
      );
    }
  }
}

/**
 * Parse command line arguments
 */
function parseArguments(): BatchProcessOptions {
  const args = process.argv.slice(2);

  let limit = 50; // Default limit
  let dryRun = false;
  let verbose = false;

  for (const arg of args) {
    if (arg === 'dry-run') {
      dryRun = true;
    } else if (arg === 'verbose' || arg === '-v') {
      verbose = true;
    } else if (arg === 'all') {
      limit = Infinity;
    } else if (/^\d+$/.test(arg)) {
      limit = parseInt(arg, 10);
    }
  }

  return { limit, dryRun, verbose };
}

/**
 * Main execution
 */
async function main() {
  const options = parseArguments();
  const processor = new ComplianceBatchProcessor();

  try {
    await processor.run(options);
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }
}

// Only run if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { ComplianceBatchProcessor, parseArguments };
