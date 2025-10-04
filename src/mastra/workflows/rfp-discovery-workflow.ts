import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { MastraScrapingService } from '../../../server/services/mastraScrapingService';
import { storage } from '../../../server/storage';
import { pageAuthTool, pageExtractTool } from '../tools';

// Portal configuration schema
const portalConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string(),
  type: z.string(),
  requiresAuth: z.boolean(),
  credentials: z
    .object({
      username: z.string().optional(),
      password: z.string().optional(),
    })
    .optional(),
  searchFilters: z.array(z.string()).optional(),
});

// RFP opportunity schema
const opportunitySchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  agency: z.string().optional(),
  deadline: z.string().optional(),
  estimatedValue: z.string().optional(),
  url: z.string().optional(),
  category: z.string().optional(),
  confidence: z.number().min(0).max(1).default(0.8),
  portalId: z.string(),
});

// Step 1: Fetch active portals
const fetchActivePortalsStep = createStep({
  id: 'fetch-active-portals',
  description: 'Fetch all active portals from database',
  inputSchema: z.object({}),
  outputSchema: z.object({
    portals: z.array(portalConfigSchema),
  }),
  execute: async () => {
    console.log('📋 Fetching active portals...');

    const activePortals = await storage.getPortalsByStatus('active');

    const portals = activePortals.map(portal => ({
      id: portal.id,
      name: portal.name,
      url: portal.url,
      type: portal.type,
      requiresAuth: portal.requiresAuth,
      credentials: portal.credentials
        ? {
            username: portal.credentials.username || undefined,
            password: portal.credentials.password || undefined,
          }
        : undefined,
      searchFilters: portal.searchFilters,
    }));

    console.log(`✅ Found ${portals.length} active portals`);
    return { portals };
  },
});

// Step 2: Scrape individual portal
const scrapePortalStep = createStep({
  id: 'scrape-portal',
  description: 'Scrape RFP opportunities from a single portal',
  inputSchema: portalConfigSchema,
  outputSchema: z.object({
    opportunities: z.array(opportunitySchema),
    portalId: z.string(),
    status: z.enum(['success', 'error']),
    message: z.string().optional(),
  }),
  execute: async ({ inputData: portal }) => {
    console.log(`🔍 Scraping ${portal.name} (${portal.url})`);

    try {
      const scraper = new MastraScrapingService();
      const sessionId = `portal-${portal.id}`;

      // Handle authentication if needed
      if (portal.requiresAuth && portal.credentials?.username) {
        console.log(`🔐 Authenticating with ${portal.name}`);

        const authResult = await pageAuthTool.execute({
          context: {
            loginUrl: portal.url,
            username: portal.credentials.username,
            password: portal.credentials.password || '',
            targetUrl: portal.url,
            sessionId,
            portalType: portal.type,
          },
        });

        if (!authResult.success) {
          throw new Error(`Authentication failed for ${portal.name}`);
        }
      }

      // Extract RFP opportunities
      const extractionResult = await pageExtractTool.execute({
        context: {
          url: portal.url,
          instruction: portal.searchFilters?.length
            ? `Find RFP opportunities matching: ${portal.searchFilters.join(', ')}`
            : 'Extract all RFP opportunities with titles, deadlines, agencies, and descriptions',
          sessionId,
          schema: {
            opportunities: z.array(
              z.object({
                title: z.string(),
                description: z.string().optional(),
                agency: z.string().optional(),
                deadline: z.string().optional(),
                estimatedValue: z.string().optional(),
                url: z.string().optional(),
                category: z.string().optional(),
              })
            ),
          },
        },
      });

      const opportunities = (extractionResult.data?.opportunities || []).map(
        (opp: any) => ({
          ...opp,
          portalId: portal.id,
          confidence: 0.9,
        })
      );

      console.log(
        `✅ Found ${opportunities.length} opportunities from ${portal.name}`
      );

      return {
        opportunities,
        portalId: portal.id,
        status: 'success',
        message: `Scraped ${opportunities.length} opportunities`,
      };
    } catch (error) {
      console.error(`❌ Error scraping ${portal.name}:`, error);

      return {
        opportunities: [],
        portalId: portal.id,
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});

// Step 3: Process discovered RFPs
const processDiscoveredRfpsStep = createStep({
  id: 'process-discovered-rfps',
  description: 'Save discovered RFPs to database',
  inputSchema: z.object({
    allOpportunities: z.array(opportunitySchema),
  }),
  outputSchema: z.object({
    newRfps: z.number(),
    updatedRfps: z.number(),
    totalProcessed: z.number(),
  }),
  execute: async ({ inputData }) => {
    const { allOpportunities } = inputData;
    let newRfps = 0;
    let updatedRfps = 0;

    console.log(
      `💾 Processing ${allOpportunities.length} discovered opportunities`
    );

    for (const opportunity of allOpportunities) {
      try {
        // Check if RFP already exists
        const existingRfps = await storage.getRFPsByPortal(
          opportunity.portalId
        );
        const existing = existingRfps.find(
          rfp => rfp.title.toLowerCase() === opportunity.title.toLowerCase()
        );

        if (!existing) {
          // Create new RFP
          await storage.createRFP({
            title: opportunity.title,
            description: opportunity.description || '',
            portalId: opportunity.portalId,
            sourceUrl: opportunity.url || '',
            deadline: opportunity.deadline
              ? new Date(opportunity.deadline)
              : undefined,
            estimatedValue: opportunity.estimatedValue,
            status: 'discovered',
            progress: 10,
            aiAnalysis: {
              confidence: opportunity.confidence,
              category: opportunity.category,
              agency: opportunity.agency,
            },
          });
          newRfps++;
        } else if (
          opportunity.deadline &&
          existing.deadline !== opportunity.deadline
        ) {
          // Update deadline if changed
          await storage.updateRFP(existing.id, {
            deadline: new Date(opportunity.deadline),
          });
          updatedRfps++;
        }
      } catch (error) {
        console.error(
          `Failed to process opportunity: ${opportunity.title}`,
          error
        );
      }
    }

    // Create notification
    if (newRfps > 0) {
      await storage.createNotification({
        type: 'system',
        title: 'New RFPs Discovered',
        message: `${newRfps} new RFP opportunities have been discovered`,
        relatedEntityType: 'portal',
        relatedEntityId: null,
      });
    }

    console.log(`✅ Processed: ${newRfps} new, ${updatedRfps} updated`);

    return {
      newRfps,
      updatedRfps,
      totalProcessed: allOpportunities.length,
    };
  },
});

// Parallel portal scraping workflow
export const rfpDiscoveryWorkflow = createWorkflow({
  id: 'rfp-discovery',
  description: 'Discover RFP opportunities from multiple portals in parallel',
  inputSchema: z.object({
    maxPortals: z.number().optional().default(5),
  }),
  outputSchema: z.object({
    newRfps: z.number(),
    updatedRfps: z.number(),
    totalProcessed: z.number(),
    portalsScanned: z.number(),
  }),
})
  .then(fetchActivePortalsStep)
  .then(
    createStep({
      id: 'prepare-parallel-scraping',
      inputSchema: z.object({
        portals: z.array(portalConfigSchema),
      }),
      outputSchema: z.object({
        portalBatches: z.array(portalConfigSchema),
      }),
      execute: async ({ inputData, mastra }) => {
        const maxPortals = 5; // Limit concurrent scraping
        const portalBatches = inputData.portals.slice(0, maxPortals);

        console.log(
          `🚀 Preparing to scrape ${portalBatches.length} portals in parallel`
        );

        return { portalBatches };
      },
    })
  )
  .then(
    createStep({
      id: 'parallel-portal-scraping',
      inputSchema: z.object({
        portalBatches: z.array(portalConfigSchema),
      }),
      outputSchema: z.object({
        allOpportunities: z.array(opportunitySchema),
        portalsScanned: z.number(),
      }),
      execute: async ({ inputData }) => {
        // Execute scraping in parallel for each portal
        const scrapePromises = inputData.portalBatches.map(portal =>
          scrapePortalStep.execute({
            inputData: portal,
            mastra: {} as any,
          })
        );

        const results = await Promise.allSettled(scrapePromises);

        const allOpportunities: any[] = [];
        let portalsScanned = 0;

        results.forEach((result, index) => {
          if (
            result.status === 'fulfilled' &&
            result.value.status === 'success'
          ) {
            allOpportunities.push(...result.value.opportunities);
            portalsScanned++;
          } else {
            console.warn(`Portal scraping failed for batch ${index}`);
          }
        });

        return {
          allOpportunities,
          portalsScanned,
        };
      },
    })
  )
  .then(processDiscoveredRfpsStep)
  .then(
    createStep({
      id: 'finalize-discovery',
      inputSchema: z.object({
        newRfps: z.number(),
        updatedRfps: z.number(),
        totalProcessed: z.number(),
      }),
      outputSchema: z.object({
        newRfps: z.number(),
        updatedRfps: z.number(),
        totalProcessed: z.number(),
        portalsScanned: z.number(),
      }),
      execute: async ({ inputData, mastra }) => {
        return {
          ...inputData,
          portalsScanned: 0, // Will be set by workflow context
        };
      },
    })
  )
  .commit();
