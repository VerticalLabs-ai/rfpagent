import { Router } from 'express';
import { z } from 'zod';
import {
  insertAiConversationSchema,
  insertConversationMessageSchema,
  insertResearchFindingSchema,
  type AiConversation,
  type ConversationMessage,
  type ResearchFinding,
} from '@shared/schema';
import { storage } from '../storage';
import { AIService } from '../services/core/aiService';
import { aiProposalService } from '../services/proposals/ai-proposal-service';

const router = Router();

// Zod schemas for AI API endpoints
const AnalyzeRFPRequestSchema = z.object({
  rfpText: z.string().min(1).max(50000),
});

const MapCompanyDataRequestSchema = z.object({
  analysis: z.object({
    requirements: z.object({
      businessType: z.array(z.string()).optional(),
      certifications: z.array(z.string()).optional(),
      insurance: z
        .object({
          types: z.array(z.string()),
          minimumCoverage: z.number().optional(),
        })
        .optional(),
      contactRoles: z.array(z.string()).optional(),
      businessSize: z.enum(['small', 'large', 'any']).optional(),
      socioEconomicPreferences: z.array(z.string()).optional(),
      geographicRequirements: z.array(z.string()).optional(),
      experienceRequirements: z.array(z.string()).optional(),
    }),
    complianceItems: z.array(
      z.object({
        item: z.string(),
        category: z.string(),
        required: z.boolean(),
        description: z.string(),
      })
    ),
    riskFlags: z.array(
      z.object({
        type: z.enum(['deadline', 'complexity', 'requirements', 'financial']),
        severity: z.enum(['low', 'medium', 'high']),
        description: z.string(),
      })
    ),
    keyDates: z.object({
      deadline: z
        .string()
        .refine(
          str => {
            const date = new Date(str);
            return !isNaN(date.getTime());
          },
          {
            message: 'Invalid deadline date format',
          }
        )
        .transform(str => new Date(str)),
      prebidMeeting: z
        .string()
        .refine(
          str => {
            const date = new Date(str);
            return !isNaN(date.getTime());
          },
          {
            message: 'Invalid prebid meeting date format',
          }
        )
        .transform(str => new Date(str))
        .optional(),
      questionsDeadline: z
        .string()
        .refine(
          str => {
            const date = new Date(str);
            return !isNaN(date.getTime());
          },
          {
            message: 'Invalid questions deadline date format',
          }
        )
        .transform(str => new Date(str))
        .optional(),
      sampleSubmission: z
        .string()
        .refine(
          str => {
            const date = new Date(str);
            return !isNaN(date.getTime());
          },
          {
            message: 'Invalid sample submission date format',
          }
        )
        .transform(str => new Date(str))
        .optional(),
    }),
  }),
  companyProfileId: z.string().uuid(),
});

const GenerateProposalRequestSchema = z.object({
  rfpText: z.string().min(1).max(50000),
  companyProfileId: z.string().uuid(),
  proposalType: z
    .enum(['standard', 'technical', 'construction', 'professional_services'])
    .optional(),
});

// AI Conversation Schemas
const ProcessQueryRequestSchema = z.object({
  query: z.string().min(1).max(10000),
  conversationId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  conversationType: z
    .enum(['general', 'rfp_search', 'bid_crafting', 'research'])
    .optional(),
});

const ExecuteActionRequestSchema = z.object({
  suggestionId: z.string().min(1),
  conversationId: z.string().uuid(),
  suggestion: z.object({
    id: z.string(),
    label: z.string(),
    action: z.string(),
    parameters: z.record(z.string(), z.any()).optional(),
  }),
});

/**
 * Analyze RFP document using AI
 */
router.post('/analyze-rfp', async (req, res) => {
  try {
    const validationResult = AnalyzeRFPRequestSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Invalid request data',
        details: validationResult.error.issues,
      });
    }

    const { rfpText } = validationResult.data;
    const analysis = await aiProposalService.analyzeRFPDocument(rfpText);
    res.json(analysis);
  } catch (error) {
    console.error('Error analyzing RFP document:', error);
    res.status(500).json({
      error: 'Failed to analyze RFP document',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Map company profile data to RFP requirements
 */
router.post('/map-company-data', async (req, res) => {
  try {
    const validationResult = MapCompanyDataRequestSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Invalid request data',
        details: validationResult.error.issues,
      });
    }

    const { analysis, companyProfileId } = validationResult.data;

    // Get company profile and related data
    const companyProfile = await storage.getCompanyProfile(companyProfileId);
    if (!companyProfile) {
      return res.status(404).json({ error: 'Company profile not found' });
    }

    const certifications =
      await storage.getCompanyCertifications(companyProfileId);
    const insurance = await storage.getCompanyInsurance(companyProfileId);
    const contacts = await storage.getCompanyContacts(companyProfileId);

    const companyMapping = await aiProposalService.mapCompanyDataToRequirements(
      analysis,
      companyProfile,
      certifications,
      insurance,
      contacts
    );

    res.json(companyMapping);
  } catch (error) {
    console.error('Error mapping company data:', error);
    res.status(500).json({
      error: 'Failed to map company data',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Generate comprehensive proposal content using AI
 */
router.post('/generate-proposal', async (req, res) => {
  try {
    const validationResult = GenerateProposalRequestSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Invalid request data',
        details: validationResult.error.issues,
      });
    }

    const { rfpText, companyProfileId, proposalType } = validationResult.data;

    // Step 1: Analyze RFP document
    const analysis = await aiProposalService.analyzeRFPDocument(rfpText);

    // Step 2: Get company profile and related data
    const companyProfile = await storage.getCompanyProfile(companyProfileId);
    if (!companyProfile) {
      return res.status(404).json({ error: 'Company profile not found' });
    }

    const certifications =
      await storage.getCompanyCertifications(companyProfileId);
    const insurance = await storage.getCompanyInsurance(companyProfileId);
    const contacts = await storage.getCompanyContacts(companyProfileId);

    // Step 3: Map company data to requirements
    const companyMapping = await aiProposalService.mapCompanyDataToRequirements(
      analysis,
      companyProfile,
      certifications,
      insurance,
      contacts
    );

    // Step 4: Generate proposal content
    const proposalContent = await aiProposalService.generateProposalContent(
      analysis,
      companyMapping,
      proposalType || 'standard'
    );

    res.json({
      analysis,
      companyMapping,
      proposalContent,
      metadata: {
        generatedAt: new Date().toISOString(),
        proposalType: proposalType || 'standard',
        companyProfileId,
      },
    });
  } catch (error) {
    console.error('Error generating proposal:', error);
    res.status(500).json({
      error: 'Failed to generate proposal',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Get all company profiles for AI services
 */
router.get('/company-profiles', async (req, res) => {
  try {
    const profiles = await storage.getAllCompanyProfiles();

    // Add analysis data for AI context
    const enrichedProfiles = await Promise.all(
      profiles.map(async profile => {
        const certifications = await storage.getCompanyCertifications(
          profile.id
        );
        const insurance = await storage.getCompanyInsurance(profile.id);
        return {
          ...profile,
          certificationsCount: certifications.length,
          insuranceCount: insurance.length,
          lastUpdated: profile.updatedAt || profile.createdAt,
        };
      })
    );

    res.json(enrichedProfiles);
  } catch (error) {
    console.error('Error fetching company profiles for AI:', error);
    res.status(500).json({ error: 'Failed to fetch company profiles' });
  }
});

/**
 * Get detailed company profile for AI analysis
 */
router.get('/company-profiles/:id/details', async (req, res) => {
  try {
    const { id } = req.params;

    const profile = await storage.getCompanyProfile(id);
    if (!profile) {
      return res.status(404).json({ error: 'Company profile not found' });
    }

    // Get all related data for comprehensive AI analysis
    const [addresses, contacts, identifiers, certifications, insurance] =
      await Promise.all([
        storage.getCompanyAddresses(id),
        storage.getCompanyContacts(id),
        storage.getCompanyIdentifiers(id),
        storage.getCompanyCertifications(id),
        storage.getCompanyInsurance(id),
      ]);

    const detailedProfile = {
      ...profile,
      addresses,
      contacts,
      identifiers,
      certifications,
      insurance,
      metadata: {
        totalContacts: contacts.length,
        totalCertifications: certifications.length,
        totalInsurance: insurance.length,
        lastUpdated: profile.updatedAt || profile.createdAt,
      },
    };

    res.json(detailedProfile);
  } catch (error) {
    console.error('Error fetching detailed company profile for AI:', error);
    res.status(500).json({ error: 'Failed to fetch detailed company profile' });
  }
});

/**
 * Process AI chat query
 */
router.post('/chat', async (req, res) => {
  try {
    const validationResult = ProcessQueryRequestSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Invalid request data',
        details: validationResult.error.issues,
      });
    }

    const { query, conversationId, userId, conversationType } =
      validationResult.data;

    const aiService = new AIService();
    const normalizedType = (conversationType ?? 'general') as
      | 'general'
      | 'rfp_search'
      | 'bid_crafting'
      | 'research';

    const response = await aiService.processQuery(
      query,
      conversationId,
      userId,
      normalizedType
    );

    res.json(response);
  } catch (error) {
    console.error('Error processing AI chat query:', error);
    res.status(500).json({
      error: 'Failed to process query',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Execute AI suggestion/action
 */
router.post('/execute-action', async (req, res) => {
  try {
    const validationResult = ExecuteActionRequestSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Invalid request data',
        details: validationResult.error.issues,
      });
    }

    const { suggestionId, conversationId, suggestion } = validationResult.data;

    const aiService = new AIService();
    const result = await aiService.executeSuggestion(
      suggestionId,
      conversationId,
      suggestion
    );

    res.json(result);
  } catch (error) {
    console.error('Error executing AI action:', error);
    res.status(500).json({
      error: 'Failed to execute action',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Get AI conversation by ID
 */
router.get('/conversations/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { includeMessages = 'true' } = req.query;

    const conversation = await storage.getAiConversation(conversationId);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    let result: any = conversation;

    if (includeMessages === 'true') {
      const messages = await storage.getConversationMessages(conversationId);
      result = {
        ...conversation,
        messages,
      };
    }

    res.json(result);
  } catch (error) {
    console.error('Error fetching AI conversation:', error);
    res.status(500).json({ error: 'Failed to fetch conversation' });
  }
});

/**
 * Get all AI conversations
 */
router.get('/conversations', async (req, res) => {
  try {
    const { limit = '20', userId } = req.query;

    const limitValue = Number.parseInt(limit as string, 10);
    const conversations = await storage.getAiConversations(
      (userId as string | undefined) || undefined,
      Number.isNaN(limitValue) ? 50 : limitValue
    );

    res.json(conversations);
  } catch (error) {
    console.error('Error fetching AI conversations:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

/**
 * Delete AI conversation
 */
router.delete('/conversations/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params;

    // Check if conversation exists
    const conversation = await storage.getAiConversation(conversationId);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    await storage.deleteAiConversation(conversationId);

    res.json({ success: true, message: 'Conversation deleted successfully' });
  } catch (error) {
    console.error('Error deleting AI conversation:', error);
    res.status(500).json({ error: 'Failed to delete conversation' });
  }
});

/**
 * Get AI research findings
 */
router.get('/research-findings', async (req, res) => {
  try {
    const { limit = '50', category, rfpId } = req.query;

    const limitValue = Number.parseInt(limit as string, 10);
    const findings = await storage.getResearchFindings(
      Number.isNaN(limitValue) ? 50 : limitValue,
      (category as string | undefined) || undefined,
      (rfpId as string | undefined) || undefined
    );

    res.json(findings);
  } catch (error) {
    console.error('Error fetching research findings:', error);
    res.status(500).json({ error: 'Failed to fetch research findings' });
  }
});

export default router;
