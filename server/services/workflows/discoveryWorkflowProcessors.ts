import { discoveryManager } from '../portals/discoveryManager';
import { discoveryOrchestrator } from '../orchestrators/discoveryOrchestrator';
import type { WorkItem } from '@shared/schema';

export interface WorkflowResult {
  success: boolean;
  data?: any;
  error?: string;
  nextPhase?: string;
  suggestions?: any[];
}

/**
 * Discovery Workflow Processing Methods
 * These methods are integrated into the WorkflowCoordinator to handle discovery tasks
 */
export class DiscoveryWorkflowProcessors {
  /**
   * Process portal authentication task using DiscoveryManager with enhanced error handling
   */
  static async processPortalAuthentication(
    workItem: WorkItem
  ): Promise<WorkflowResult> {
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(
          `🔐 Processing portal authentication task: ${workItem.id} (attempt ${attempt}/${maxRetries})`
        );

        const result =
          await discoveryManager.executePortalAuthentication(workItem);

        // Trigger next step in workflow sequence
        await discoveryOrchestrator.executeNextWorkflowStep(
          workItem.id,
          result
        );

        return {
          success: true,
          data: { ...result, attempt },
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        console.warn(
          `❌ Portal authentication attempt ${attempt} failed:`,
          lastError.message
        );

        if (attempt < maxRetries) {
          // Wait with exponential backoff
          const delay = Math.pow(2, attempt - 1) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    return {
      success: false,
      error: `Portal authentication failed after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`,
    };
  }

  /**
   * Process portal scanning task using DiscoveryManager
   */
  static async processPortalScanning(
    workItem: WorkItem
  ): Promise<WorkflowResult> {
    try {
      console.log(`🔍 Processing portal scanning task: ${workItem.id}`);

      const result = await discoveryManager.executePortalScanning(workItem);

      // Trigger next step in workflow sequence
      await discoveryOrchestrator.executeNextWorkflowStep(workItem.id, result);

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Portal scanning failed',
      };
    }
  }

  /**
   * Process RFP extraction task using DiscoveryManager
   */
  static async processRFPExtraction(
    workItem: WorkItem
  ): Promise<WorkflowResult> {
    try {
      console.log(`📄 Processing RFP extraction task: ${workItem.id}`);

      const result = await discoveryManager.executeRFPExtraction(workItem);

      // Trigger next step in workflow sequence
      await discoveryOrchestrator.executeNextWorkflowStep(workItem.id, result);

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'RFP extraction failed',
      };
    }
  }

  /**
   * Process portal monitoring V2 task using DiscoveryManager
   */
  static async processPortalMonitoring(
    workItem: WorkItem
  ): Promise<WorkflowResult> {
    try {
      console.log(`👁️ Processing portal monitoring V2 task: ${workItem.id}`);

      const result = await discoveryManager.executePortalMonitoring(workItem);

      // Complete workflow sequence - this is the final step
      await discoveryOrchestrator.executeNextWorkflowStep(workItem.id, result);

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Portal monitoring failed',
      };
    }
  }
}
