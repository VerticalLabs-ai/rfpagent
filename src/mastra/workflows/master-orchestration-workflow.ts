import { createWorkflow } from '@mastra/core';
import { z } from 'zod';
import { storage } from '../../../server/storage';
import { documentProcessingWorkflow } from './document-processing-workflow';
import { rfpDiscoveryWorkflow } from './rfp-discovery-workflow';
import { proposalGenerationWorkflow } from './proposal-generation-workflow';
import { bonfireAuthWorkflow } from './bonfire-auth-workflow';
import { sharedMemory } from '../tools/shared-memory-provider';

// Input schema for master orchestration
const MasterOrchestrationInputSchema = z.object({
  mode: z.enum(['discovery', 'proposal', 'full_pipeline']),
  portalIds: z.array(z.string()).optional(),
  rfpId: z.string().optional(),
  companyProfileId: z.string().optional(),
  options: z.object({
    deepScan: z.boolean().default(true),
    autoSubmit: z.boolean().default(false),
    parallel: z.boolean().default(true),
    notifyOnCompletion: z.boolean().default(true)
  }).optional()
});

export const masterOrchestrationWorkflow = createWorkflow({
  id: 'master-orchestration',
  name: 'Master RFP Orchestration Workflow',
  description: 'Coordinates all RFP workflows end-to-end from discovery to submission',
  version: '1.0.0',
  inputSchema: MasterOrchestrationInputSchema,
  
  execute: async ({ input, step, parallel }) => {
    const { mode, portalIds, rfpId, companyProfileId, options = {} } = input;
    const startTime = Date.now();
    const results: any = {
      mode,
      startTime: new Date().toISOString(),
      workflows: []
    };
    
    // Step 1: Execute based on mode
    switch (mode) {
      case 'discovery':
        // Discovery mode: Find new RFPs from portals
        if (!portalIds || portalIds.length === 0) {
          throw new Error('Portal IDs required for discovery mode');
        }
        
        const discoveryResult = await step.run('discovery-phase', async () => {
          console.log('🔍 Starting RFP discovery phase...');
          
          // Handle BonfireHub authentication if needed
          const bonfirePortals = await storage.getPortalsByType('bonfirehub');
          const bonfireIds = bonfirePortals
            .map(p => p.id)
            .filter(id => portalIds.includes(id));
          
          if (bonfireIds.length > 0) {
            // Authenticate BonfireHub portals first
            const authResults = await parallel(
              bonfireIds.map(portalId => 
                step.run(`auth-bonfire-${portalId}`, async () => {
                  const portal = await storage.getPortal(portalId);
                  if (!portal) return null;
                  
                  // Check if already authenticated
                  const authState = await sharedMemory.get(`bonfire-auth-${portalId}`);
                  if (authState && authState.authenticated && new Date(authState.expiresAt) > new Date()) {
                    console.log(`✅ Using existing auth for ${portal.name}`);
                    return authState;
                  }
                  
                  // Run authentication workflow
                  return await bonfireAuthWorkflow.execute({
                    portalId,
                    username: portal.credentials?.username || '',
                    password: portal.credentials?.password || '',
                    companyName: portal.name,
                    retryCount: 0,
                    maxRetries: 3
                  });
                })
              )
            );
            
            results.workflows.push({
              type: 'bonfire-auth',
              results: authResults
            });
          }
          
          // Execute discovery workflow
          const discoveryOutput = await rfpDiscoveryWorkflow.execute({
            portalIds,
            deepScan: options.deepScan
          });
          
          results.workflows.push({
            type: 'rfp-discovery',
            output: discoveryOutput
          });
          
          return discoveryOutput;
        });
        
        results.discoveredRfps = discoveryResult.rfps || [];
        break;
        
      case 'proposal':
        // Proposal mode: Generate proposal for specific RFP
        if (!rfpId || !companyProfileId) {
          throw new Error('RFP ID and Company Profile ID required for proposal mode');
        }
        
        const proposalResult = await step.run('proposal-phase', async () => {
          console.log('📝 Starting proposal generation phase...');
          
          // Get RFP details
          const rfp = await storage.getRFP(rfpId);
          if (!rfp) {
            throw new Error(`RFP ${rfpId} not found`);
          }
          
          // Process documents if needed
          if (rfp.documentUrls && rfp.documentUrls.length > 0) {
            const docResults = await parallel(
              rfp.documentUrls.map((url, index) =>
                step.run(`process-doc-${index}`, async () => {
                  return await documentProcessingWorkflow.execute({
                    rfpId,
                    documentUrl: url,
                    forceReprocess: false
                  });
                })
              )
            );
            
            results.workflows.push({
              type: 'document-processing',
              results: docResults
            });
          }
          
          // Generate proposal
          const proposalOutput = await proposalGenerationWorkflow.execute({
            rfpId,
            companyProfileId,
            proposalType: 'standard'
          });
          
          results.workflows.push({
            type: 'proposal-generation',
            output: proposalOutput
          });
          
          return proposalOutput;
        });
        
        results.proposal = proposalResult;
        break;
        
      case 'full_pipeline':
        // Full pipeline: Discovery -> Analysis -> Proposal -> Submission
        if (!portalIds || portalIds.length === 0) {
          throw new Error('Portal IDs required for full pipeline mode');
        }
        
        // Phase 1: Discovery
        const pipelineDiscovery = await step.run('pipeline-discovery', async () => {
          console.log('🚀 Phase 1: RFP Discovery');
          
          return await rfpDiscoveryWorkflow.execute({
            portalIds,
            deepScan: options.deepScan
          });
        });
        
        results.workflows.push({
          type: 'rfp-discovery',
          output: pipelineDiscovery
        });
        
        // Phase 2: Process discovered RFPs
        if (pipelineDiscovery.rfps && pipelineDiscovery.rfps.length > 0) {
          const rfpProcessingResults = await step.run('pipeline-process-rfps', async () => {
            console.log(`📊 Phase 2: Processing ${pipelineDiscovery.rfps.length} RFPs`);
            
            // Process RFPs in parallel (limit to 3 concurrent)
            const batchSize = 3;
            const processedRfps = [];
            
            for (let i = 0; i < pipelineDiscovery.rfps.length; i += batchSize) {
              const batch = pipelineDiscovery.rfps.slice(i, i + batchSize);
              
              const batchResults = await parallel(
                batch.map(rfp => 
                  step.run(`process-rfp-${rfp.id}`, async () => {
                    // Process documents
                    if (rfp.documentUrls && rfp.documentUrls.length > 0) {
                      await documentProcessingWorkflow.execute({
                        rfpId: rfp.id,
                        documentUrl: rfp.documentUrls[0],
                        forceReprocess: false
                      });
                    }
                    
                    // Generate proposal if company profile exists
                    if (companyProfileId) {
                      const proposal = await proposalGenerationWorkflow.execute({
                        rfpId: rfp.id,
                        companyProfileId,
                        proposalType: 'standard'
                      });
                      
                      return {
                        rfpId: rfp.id,
                        proposalId: proposal.proposalId,
                        status: 'processed'
                      };
                    }
                    
                    return {
                      rfpId: rfp.id,
                      status: 'analyzed'
                    };
                  })
                )
              );
              
              processedRfps.push(...batchResults);
            }
            
            return processedRfps;
          });
          
          results.processedRfps = rfpProcessingResults;
        }
        
        break;
        
      default:
        throw new Error(`Invalid orchestration mode: ${mode}`);
    }
    
    // Step 2: Calculate execution metrics
    const metrics = await step.run('calculate-metrics', async () => {
      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000; // seconds
      
      return {
        executionTime: duration,
        workflowsExecuted: results.workflows.length,
        rfpsDiscovered: results.discoveredRfps?.length || 0,
        rfpsProcessed: results.processedRfps?.length || 0,
        proposalsGenerated: results.proposal ? 1 : 0
      };
    });
    
    // Step 3: Store orchestration results
    await step.run('store-results', async () => {
      console.log('💾 Storing orchestration results...');
      
      // Store in memory for quick access
      await sharedMemory.set(`orchestration-${Date.now()}`, {
        mode,
        startTime: results.startTime,
        endTime: new Date().toISOString(),
        metrics,
        results: results
      });
      
      // Log to database
      if (results.discoveredRfps?.length > 0) {
        for (const rfp of results.discoveredRfps) {
          await storage.createNotification({
            type: 'info',
            title: 'New RFP Discovered',
            message: `Found: ${rfp.title}`,
            metadata: { rfpId: rfp.id }
          });
        }
      }
      
      return { stored: true };
    });
    
    // Step 4: Send notifications if enabled
    if (options.notifyOnCompletion) {
      await step.run('send-notifications', async () => {
        console.log('📧 Sending completion notifications...');
        
        await storage.createNotification({
          type: 'success',
          title: 'Orchestration Complete',
          message: `${mode} workflow completed: ${metrics.rfpsDiscovered} RFPs discovered, ${metrics.rfpsProcessed} processed`,
          metadata: { 
            mode,
            metrics,
            duration: metrics.executionTime
          }
        });
        
        return { notified: true };
      });
    }
    
    // Return comprehensive results
    return {
      success: true,
      mode,
      startTime: results.startTime,
      endTime: new Date().toISOString(),
      metrics,
      workflows: results.workflows,
      discoveredRfps: results.discoveredRfps,
      processedRfps: results.processedRfps,
      proposal: results.proposal
    };
  }
});