import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { MastraScrapingService } from '../../../server/services/mastraScrapingService';
import { storage } from '../../../server/storage';
import { pageAuthTool, pageExtractTool } from '../tools';

/**
 * Calculate dynamic confidence score for extracted RFP opportunity
 * @param opportunity - Extracted opportunity data
 * @param extractionMetadata - Optional metadata from extraction tool
 * @returns Confidence score between 0 and 1
 */
export function calculateConfidence(
  opportunity: {
    title?: string;
    description?: string;
    agency?: string;
    deadline?: string;
    estimatedValue?: string;
    url?: string;
    category?: string;
  },
  extractionMetadata?: {
    confidence?: number;
    extractionQuality?: number;
  }
): number {
  let confidence = 0.5; // Base score

  // Critical field: Title (required for all opportunities)
  if (opportunity.title && opportunity.title.trim().length > 0) {
    confidence += 0.2;
    // Bonus for descriptive titles (longer, more informative)
    if (opportunity.title.length > 20) {
      confidence += 0.05;
    }
  } else {
    // Significantly penalize missing title
    confidence -= 0.3;
  }

  // Important field: URL
  if (opportunity.url && opportunity.url.trim().length > 0) {
    try {
      const url = new URL(opportunity.url);
      // Valid URL format
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        confidence += 0.15;
      }
    } catch {
      // Invalid URL format - minor penalty
      confidence -= 0.05;
    }
  }

  // Important field: Deadline
  if (opportunity.deadline && opportunity.deadline.trim().length > 0) {
    const deadlineDate = new Date(opportunity.deadline);
    // Valid, parseable date
    if (!isNaN(deadlineDate.getTime())) {
      confidence += 0.1;
      // Bonus for future deadlines (not expired)
      if (deadlineDate > new Date()) {
        confidence += 0.05;
      }
    } else {
      // Invalid date format - minor penalty
      confidence -= 0.03;
    }
  }

  // Supporting field: Agency
  if (opportunity.agency && opportunity.agency.trim().length > 0) {
    confidence += 0.08;
  }

  // Supporting field: Description
  if (opportunity.description && opportunity.description.trim().length > 0) {
    confidence += 0.05;
    // Bonus for detailed descriptions
    if (opportunity.description.length > 100) {
      confidence += 0.03;
    }
  }

  // Supporting field: Category
  if (opportunity.category && opportunity.category.trim().length > 0) {
    confidence += 0.04;
  }

  // Supporting field: Estimated Value
  if (
    opportunity.estimatedValue &&
    opportunity.estimatedValue.trim().length > 0
  ) {
    confidence += 0.04;
  }

  // Incorporate extraction tool confidence if available
  if (extractionMetadata?.confidence !== undefined) {
    // Weight the extraction tool confidence at 20% of final score
    confidence = confidence * 0.8 + extractionMetadata.confidence * 0.2;
  }

  // Incorporate extraction quality if available
  if (extractionMetadata?.extractionQuality !== undefined) {
    // Weight the extraction quality at 10% of final score
    confidence = confidence * 0.9 + extractionMetadata.extractionQuality * 0.1;
  }

  // Clamp to valid range [0, 1]
  return Math.max(0, Math.min(1, confidence));
}

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
          confidence: calculateConfidence(opp, {
            confidence: extractionResult.confidence,
            extractionQuality: extractionResult.quality,
          }),
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
    portalsScanned: z.number(),
  }),
  outputSchema: z.object({
    newRfps: z.number(),
    updatedRfps: z.number(),
    totalProcessed: z.number(),
    portalsScanned: z.number(),
  }),
  execute: async ({ inputData }) => {
    const { allOpportunities, portalsScanned } = inputData;
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
      portalsScanned,
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
        maxPortals: z.number().optional(),
      }),
      outputSchema: z.object({
        portalBatches: z.array(portalConfigSchema),
      }),
      execute: async ({ inputData, mastra }) => {
        // Read maxPortals from inputData, default to 5, validate bounds
        const rawMaxPortals = inputData.maxPortals ?? 5;
        const maxPortals = Math.max(1, Math.min(Math.floor(rawMaxPortals), 50));
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
      execute: async ({ inputData, mastra }) => {
        // Execute scraping in parallel for each portal
        const scrapePromises = inputData.portalBatches.map(portal =>
          scrapePortalStep.execute({
            inputData: portal,
            mastra,
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
        portalsScanned: z.number(),
      }),
      outputSchema: z.object({
        newRfps: z.number(),
        updatedRfps: z.number(),
        totalProcessed: z.number(),
        portalsScanned: z.number(),
      }),
      execute: async ({ inputData }) => {
        return {
          ...inputData,
        };
      },
    })
  )
  .commit();
