import { createStep, createWorkflow } from '@mastra/core';
import { z } from 'zod';
import { agentMemoryService } from '../../../server/services/agents/agentMemoryService';
import { storage } from '../../../server/storage';
import { proposalGenerationOrchestrator } from '../../../server/services/orchestrators/proposalGenerationOrchestrator';
import { bonfireAuthWorkflow } from './bonfire-auth-workflow';
import { documentProcessingWorkflow } from './document-processing-workflow';
import { rfpDiscoveryWorkflow } from './rfp-discovery-workflow';

// Input schema for master orchestration
const MasterOrchestrationInputSchema = z.object({
  mode: z.enum(['discovery', 'proposal', 'full_pipeline']),
  portalIds: z.array(z.string()).optional(),
  rfpId: z.string().optional(),
  companyProfileId: z.string().optional(),
  options: z
    .object({
      deepScan: z.boolean().default(true),
      autoSubmit: z.boolean().default(false),
      parallel: z.boolean().default(true),
      notifyOnCompletion: z.boolean().default(true),
    })
    .optional(),
});

const executeWorkflowStep = createStep({
  id: 'execute-workflow',
  inputSchema: MasterOrchestrationInputSchema,
  outputSchema: z.any(),
  execute: async ({ input, step, parallel }: any) => {
    const { mode, portalIds, rfpId, companyProfileId, options = {} } = input;
    const startTime = Date.now();
    const results: any = {
      mode,
      startTime: new Date().toISOString(),
      workflows: [],
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
          const allPortals = await storage.getAllPortals();
          const bonfirePortals = allPortals.filter(
            (p: any) => p.type === 'bonfirehub'
          );
          const bonfireIds = bonfirePortals
            .map((p: any) => p.id)
            .filter((id: string) => portalIds.includes(id));

          if (bonfireIds.length > 0) {
            // Authenticate BonfireHub portals first
            const authResults = await parallel(
              bonfireIds.map((portalId: string) =>
                step.run(`auth-bonfire-${portalId}`, async () => {
                  const portal =
                    await storage.getPortalWithCredentials(portalId);
                  if (!portal) return null;

                  // Check authentication state from Memory API
                  const authContextKey = `bonfire_auth_state_${portalId}`;
                  const existingAuthState =
                    await agentMemoryService.getMemoryByContext(
                      'master-orchestrator',
                      authContextKey
                    );

                  // Validate existing authentication state
                  if (existingAuthState?.content) {
                    const { authenticated, timestamp, expiresAt } =
                      existingAuthState.content;
                    const now = Date.now();
                    const authTimestamp = new Date(timestamp).getTime();
                    const authExpiry = expiresAt
                      ? new Date(expiresAt).getTime()
                      : null;

                    // Check if auth is valid (authenticated, not expired, and within 24 hours)
                    const isValid =
                      authenticated &&
                      (!authExpiry || authExpiry > now) &&
                      now - authTimestamp < 24 * 60 * 60 * 1000;

                    if (isValid) {
                      console.log(
                        `✅ Valid authentication found for ${portal.name}, skipping re-auth`
                      );
                      return {
                        success: true,
                        portalId,
                        authenticated: true,
                        cached: true,
                        timestamp: existingAuthState.content.timestamp,
                      };
                    } else {
                      console.log(
                        `⏰ Authentication expired for ${portal.name}, re-authenticating...`
                      );
                    }
                  } else {
                    console.log(
                      `🔐 No authentication state found for ${portal.name}, authenticating...`
                    );
                  }

                  // Run authentication workflow if no valid session exists
                  const authResult = await bonfireAuthWorkflow.execute({
                    input: {
                      portalId,
                      username: (portal as any).username || '',
                      password: (portal as any).password || '',
                      companyName: portal.name,
                      retryCount: 0,
                      maxRetries: 3,
                    },
                  } as any);

                  // Store authentication state in Memory API for future checks
                  if (authResult.success && authResult.authenticated) {
                    await agentMemoryService.storeMemory({
                      agentId: 'master-orchestrator',
                      memoryType: 'working',
                      contextKey: authContextKey,
                      title: `BonfireHub Auth State: ${portal.name}`,
                      content: {
                        portalId,
                        authenticated: true,
                        timestamp: new Date().toISOString(),
                        expiresAt: new Date(
                          Date.now() + 24 * 60 * 60 * 1000
                        ).toISOString(), // 24 hours
                        sessionId: authResult.sessionId,
                      },
                      importance: 8,
                      tags: ['authentication', 'bonfirehub', portalId],
                      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours TTL
                    });
                    console.log(
                      `💾 Stored authentication state for ${portal.name}`
                    );
                  }

                  return authResult;
                })
              )
            );

            results.workflows.push({
              type: 'bonfire-auth',
              results: authResults,
            });
          }

          // Execute discovery workflow
          const discoveryOutput = await rfpDiscoveryWorkflow.execute({
            input: {
              maxPortals: portalIds?.length || 10,
            },
          } as any);

          results.workflows.push({
            type: 'rfp-discovery',
            output: discoveryOutput,
          });

          return discoveryOutput;
        });

        results.discoveredRfps = discoveryResult.rfps || [];
        break;

      case 'proposal':
        // Proposal mode: Generate proposal for specific RFP
        if (!rfpId || !companyProfileId) {
          throw new Error(
            'RFP ID and Company Profile ID required for proposal mode'
          );
        }

        const proposalResult = await step.run('proposal-phase', async () => {
          console.log('📝 Starting proposal generation phase...');

          // Get RFP details
          const rfp = await storage.getRFP(rfpId);
          if (!rfp) {
            throw new Error(`RFP ${rfpId} not found`);
          }

          // Process documents if needed
          const rfpAny = rfp as any;
          if (rfpAny.documentUrls && rfpAny.documentUrls.length > 0) {
            const docResults = await parallel(
              rfpAny.documentUrls.map((url: string, index: number) =>
                step.run(`process-doc-${index}`, async () => {
                  return await documentProcessingWorkflow.execute({
                    documentUrl: url,
                    forceReprocess: false,
                  } as any);
                })
              )
            );

            results.workflows.push({
              type: 'document-processing',
              results: docResults,
            });
          }

          // Generate proposal using orchestrator in fast mode
          const proposalOutput =
            await proposalGenerationOrchestrator.createProposalGenerationPipeline(
              {
                rfpId: rfpId!,
                companyProfileId,
                executionMode: 'fast',
                enableProgressTracking: false,
              }
            );

          results.workflows.push({
            type: 'proposal-generation',
            output: proposalOutput,
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
        const pipelineDiscovery = await step.run(
          'pipeline-discovery',
          async () => {
            console.log('🚀 Phase 1: RFP Discovery');

            return await rfpDiscoveryWorkflow.execute({
              input: {
                maxPortals: portalIds?.length || 10,
              },
            } as any);
          }
        );

        results.workflows.push({
          type: 'rfp-discovery',
          output: pipelineDiscovery,
        });

        // Phase 2: Process discovered RFPs
        if (pipelineDiscovery.rfps && pipelineDiscovery.rfps.length > 0) {
          const rfpProcessingResults = await step.run(
            'pipeline-process-rfps',
            async () => {
              console.log(
                `📊 Phase 2: Processing ${pipelineDiscovery.rfps.length} RFPs`
              );

              // Process RFPs in parallel (limit to 3 concurrent)
              const batchSize = 3;
              const processedRfps = [];

              for (
                let i = 0;
                i < pipelineDiscovery.rfps.length;
                i += batchSize
              ) {
                const batch = pipelineDiscovery.rfps.slice(i, i + batchSize);

                const batchResults = await parallel(
                  batch.map((rfp: any) =>
                    step.run(`process-rfp-${rfp.id}`, async () => {
                      // Process documents
                      if (rfp.documentUrls && rfp.documentUrls.length > 0) {
                        await documentProcessingWorkflow.execute({
                          documentUrl: rfp.documentUrls[0],
                          forceReprocess: false,
                        } as any);
                      }

                      // Generate proposal if company profile exists
                      if (companyProfileId) {
                        const proposal =
                          await proposalGenerationOrchestrator.createProposalGenerationPipeline(
                            {
                              rfpId: rfp.id,
                              companyProfileId,
                              executionMode: 'fast',
                              enableProgressTracking: false,
                            }
                          );

                        return {
                          rfpId: rfp.id,
                          pipelineId: proposal.pipelineId,
                          status: 'processed',
                        };
                      }

                      return {
                        rfpId: rfp.id,
                        status: 'analyzed',
                      };
                    })
                  )
                );

                processedRfps.push(...batchResults);
              }

              return processedRfps;
            }
          );

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
        proposalsGenerated: results.proposal ? 1 : 0,
      };
    });

    // Step 3: Store orchestration results
    await step.run('store-results', async () => {
      console.log('💾 Storing orchestration results...');

      // Results stored via Memory provider
      console.log(
        `Orchestration ${mode} completed with ${results.workflows.length} workflows`
      );

      // Log to database
      if (results.discoveredRfps?.length > 0) {
        for (const rfp of results.discoveredRfps) {
          await storage.createNotification({
            type: 'info',
            title: 'New RFP Discovered',
            message: `Found: ${rfp.title}`,
            relatedEntityType: 'rfp',
            relatedEntityId: rfp.id,
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
      proposal: results.proposal,
    };
  },
});

export const masterOrchestrationWorkflow: any = createWorkflow({
  id: 'master-orchestration',
  description:
    'Coordinates all RFP workflows end-to-end from discovery to submission',
  inputSchema: MasterOrchestrationInputSchema,
} as any)
  .then(executeWorkflowStep as any)
  .commit();
