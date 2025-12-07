import { Router } from 'express';
import { z, ZodError } from 'zod';
import { agentSettingsRepository } from '../repositories/AgentSettingsRepository';
import { ApiResponse } from '../utils/apiResponse';
import { handleAsyncError } from '../middleware/errorHandling';
import { rateLimiter } from '../middleware/rateLimiting';

const router = Router();

// Available agents that can be customized
const CUSTOMIZABLE_AGENTS = [
  {
    agentId: 'content-generator',
    displayName: 'Content Generator',
    tier: 'specialist',
    description: 'Generates proposal narratives and technical content',
    supportsCustomPrompt: true,
  },
  {
    agentId: 'compliance-checker',
    displayName: 'Compliance Checker',
    tier: 'specialist',
    description: 'Validates proposal compliance with RFP requirements',
    supportsCustomPrompt: true,
  },
  {
    agentId: 'document-processor',
    displayName: 'Document Processor',
    tier: 'specialist',
    description: 'Parses RFP documents and extracts requirements',
    supportsCustomPrompt: false,
  },
  {
    agentId: 'market-analyst',
    displayName: 'Market Analyst',
    tier: 'specialist',
    description: 'Analyzes market conditions and competitive landscape',
    supportsCustomPrompt: true,
  },
  {
    agentId: 'historical-analyzer',
    displayName: 'Historical Analyzer',
    tier: 'specialist',
    description: 'Analyzes past bid performance and win probability',
    supportsCustomPrompt: false,
  },
  {
    agentId: 'proposal-manager',
    displayName: 'Proposal Manager',
    tier: 'manager',
    description: 'Coordinates proposal generation and quality assurance',
    supportsCustomPrompt: true,
  },
  {
    agentId: 'research-manager',
    displayName: 'Research Manager',
    tier: 'manager',
    description: 'Coordinates market research and competitive intelligence',
    supportsCustomPrompt: true,
  },
] as const;

const updateSettingsSchema = z.object({
  customPrompt: z.string().max(2000).optional(),
  priority: z.number().int().min(1).max(10).optional(),
  isEnabled: z.boolean().optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
});

// Get all available agents that can be customized
router.get(
  '/agents/available',
  rateLimiter,
  handleAsyncError(async (req, res) => {
    return ApiResponse.success(res, { agents: CUSTOMIZABLE_AGENTS });
  })
);

// Get agent settings for a company
router.get(
  '/company/:companyId/agent-settings',
  rateLimiter,
  handleAsyncError(async (req, res) => {
    const { companyId } = req.params;
    const settings =
      await agentSettingsRepository.getSettingsForCompany(companyId);

    // Merge with available agents to show all options
    const mergedSettings = CUSTOMIZABLE_AGENTS.map(agent => {
      const companySetting = settings.find(s => s.agentId === agent.agentId);
      return {
        ...agent,
        customPrompt: companySetting?.customPrompt ?? null,
        priority: companySetting?.priority ?? 5,
        isEnabled: companySetting?.isEnabled ?? true,
        settings: companySetting?.settings ?? null,
        hasCustomization: !!companySetting,
      };
    });

    return ApiResponse.success(res, { settings: mergedSettings });
  })
);

// Update/create agent settings for a company
router.put(
  '/company/:companyId/agent-settings/:agentId',
  rateLimiter,
  handleAsyncError(async (req, res) => {
    const { companyId, agentId } = req.params;
    const validatedData = updateSettingsSchema.parse(req.body);

    const agent = CUSTOMIZABLE_AGENTS.find(a => a.agentId === agentId);
    if (!agent) {
      return ApiResponse.error(
        res,
        {
          code: 'INVALID_AGENT',
          message: 'Invalid agent ID',
        },
        400
      );
    }

    if (validatedData.customPrompt && !agent.supportsCustomPrompt) {
      return ApiResponse.error(
        res,
        {
          code: 'CUSTOM_PROMPT_NOT_SUPPORTED',
          message: 'This agent does not support custom prompts',
        },
        400
      );
    }

    const setting = await agentSettingsRepository.upsertSettings(
      companyId,
      agentId,
      validatedData
    );

    return ApiResponse.success(res, { setting });
  })
);

// Delete agent customization (reset to defaults)
router.delete(
  '/company/:companyId/agent-settings/:agentId',
  rateLimiter,
  handleAsyncError(async (req, res) => {
    const { companyId, agentId } = req.params;
    const existing = await agentSettingsRepository.getSettingsByAgentAndCompany(
      companyId,
      agentId
    );

    if (existing) {
      await agentSettingsRepository.deleteSettings(existing.id);
    }

    return ApiResponse.success(res, {
      message: 'Settings reset to defaults',
    });
  })
);

export default router;
