import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';

/**
 * Model Configuration for Multi-Agent System
 *
 * CURRENT AI MODELS (Updated November 2025):
 *
 * Anthropic Models:
 * - Claude Opus 4.5: Most intelligent model, maximum capability (Released November 2025)
 * - Claude Sonnet 4.5: Best coding model, general use (Released September 2025)
 * - Claude Haiku 4.5: Fast/quick tasks
 *
 * OpenAI Models:
 * - GPT-5.1: Latest general use model with enhanced reasoning (Released November 2025)
 * - GPT-5 Pro: Hardest tasks, deep reasoning
 * - GPT-5 Mini: Smaller tasks
 * - GPT-5 Nano: Fastest/smallest model
 *
 * Extended Thinking Mode (Claude 4.5 models):
 * - Sonnet 4.5: Up to 10,000 budget_tokens for complex reasoning
 * - Opus 4.5: Up to 32,000 budget_tokens for maximum capability
 * - Enable with thinking: { type: 'enabled', budget_tokens: N }
 */

// ============================================================================
// ANTHROPIC MODELS
// ============================================================================

// Claude Opus 4.5 (Most intelligent model, maximum capability)
export const claudeOpus45 = anthropic('claude-opus-4-5-20251101');

// Claude Sonnet 4.5 (Best coding model, general use)
export const claudeSonnet45 = anthropic('claude-sonnet-4-5-20250929');

// Claude Haiku 4.5 (Fast/quick tasks)
export const claudeHaiku45 = anthropic('claude-haiku-4-5-20251001');

// Legacy alias for backward compatibility
export const claudeOpus41 = claudeOpus45;

// ============================================================================
// OPENAI MODELS
// ============================================================================

// GPT-5.1 (Latest general use model with enhanced reasoning)
export const gpt51 = openai('gpt-5.1');

// GPT-5 Pro (Hardest tasks, deep reasoning)
export const gpt5Pro = openai('gpt-5-pro');

// GPT-5 Mini (Smaller tasks)
export const gpt5Mini = openai('gpt-5-mini');

// GPT-5 Nano (Fastest/smallest)
export const gpt5Nano = openai('gpt-5-nano');

// ============================================================================
// PURPOSE-BASED MODEL SELECTION
// ============================================================================

/**
 * For Creative Content Generation:
 * - Proposal narratives
 * - Marketing content
 * - Executive summaries
 * Recommended: GPT-5.1 (latest model with enhanced reasoning)
 */
export const creativeModel = gpt51;

/**
 * For Technical Analysis & Coding:
 * - Document parsing
 * - Compliance checking
 * - Requirements extraction
 * - Code generation
 * Recommended: Claude Sonnet 4.5 (best coding model)
 */
export const analyticalModel = claudeSonnet45;

/**
 * For Coordination & Orchestration:
 * - Multi-agent coordination
 * - Workflow planning
 * - Decision making
 * Recommended: Claude Sonnet 4.5 (30+ hour focus capability)
 */
export const coordinationModel = claudeSonnet45;

/**
 * For Code Generation & Review:
 * - Scraping script generation
 * - Automation code
 * - Testing
 * Recommended: Claude Sonnet 4.5
 */
export const codeModel = claudeSonnet45;

/**
 * For Maximum Capability Tasks:
 * - Complex reasoning
 * - Multi-step problem solving
 * - Critical decisions
 * Recommended: Claude Opus 4.5 (with extended thinking for best results)
 */
export const maximumCapabilityModel = claudeOpus45;

/**
 * For Proposal Generation (Standard):
 * - High-quality proposal narratives
 * - Executive summaries
 * - Technical approaches
 * Recommended: Claude Sonnet 4.5 with extended thinking
 */
export const proposalModel = claudeSonnet45;

/**
 * For Critical Proposals (Premium):
 * - Final RFP submissions
 * - High-value contract proposals
 * - Maximum quality and depth
 * Recommended: Claude Opus 4.5 with maximum thinking budget
 */
export const criticalProposalModel = claudeOpus45;

/**
 * For Fast/Quick Tasks:
 * - Simple operations
 * - Quick responses
 * - Lightweight processing
 * Recommended: Claude Haiku 4.5 or GPT-5 Nano
 */
export const fastModel = claudeHaiku45;

/**
 * Default model for general purposes
 */
export const defaultModel = gpt51;

/**
 * Deep reasoning model for hardest problems
 */
export const reasoningModel = gpt5Pro;

/**
 * Lightweight guardrail model used for moderation, PII detection, and prompt injection checks.
 * Uses GPT-5 Nano to keep latency and cost extremely low while preserving accuracy.
 */
export const guardrailModel = gpt5Nano;

/**
 * Get optimal model for specific agent type
 */
export function getModelForAgent(agentType: string) {
  switch (agentType) {
    case 'primary-orchestrator':
      return coordinationModel; // Claude Sonnet 4.5 for superior coordination

    case 'portal-manager':
    case 'research-manager':
      return analyticalModel; // Claude Sonnet 4.5 for analysis

    case 'proposal-manager':
      return creativeModel; // GPT-5.1 for creative writing

    case 'portal-scanner':
    case 'portal-monitor':
      return codeModel; // Claude Sonnet 4.5 for technical tasks

    case 'content-generator':
      return creativeModel; // GPT-5.1 for content generation

    case 'compliance-checker':
    case 'document-processor':
      return analyticalModel; // Claude Sonnet 4.5 for compliance

    case 'market-analyst':
    case 'historical-analyzer':
      return analyticalModel; // Claude Sonnet 4.5 for research

    default:
      return defaultModel;
  }
}

/**
 * Model capabilities and pricing information (As of November 2025)
 */
export const modelCapabilities = {
  gpt51: {
    name: 'GPT-5.1',
    provider: 'OpenAI',
    released: 'November 2025',
    contextWindow: 128000,
    strengths: [
      'Enhanced reasoning capabilities',
      'Improved performance on complex tasks',
      'State-of-the-art across coding, math, writing',
      'Better instruction following',
      'Multimodal (vision, audio)',
      'Real-time intelligent routing',
    ],
    pricing: {
      input: '$2.50/1M tokens',
      output: '$10.00/1M tokens',
    },
  },
  gpt5Pro: {
    name: 'GPT-5 Pro',
    provider: 'OpenAI',
    released: 'August 7, 2025',
    contextWindow: 128000,
    strengths: [
      'Deep reasoning for hardest problems',
      'Extended thinking time',
      'Complex multi-step reasoning',
      'Maximum capability',
    ],
    pricing: {
      input: '$5.00/1M tokens',
      output: '$20.00/1M tokens',
    },
  },
  gpt5Mini: {
    name: 'GPT-5 Mini',
    provider: 'OpenAI',
    released: 'August 7, 2025',
    contextWindow: 128000,
    strengths: [
      'Fast responses',
      'Cost-effective',
      'Good for smaller tasks',
      'Low latency',
    ],
    pricing: {
      input: '$0.50/1M tokens',
      output: '$2.00/1M tokens',
    },
  },
  gpt5Nano: {
    name: 'GPT-5 Nano',
    provider: 'OpenAI',
    released: 'August 7, 2025',
    contextWindow: 128000,
    strengths: [
      'Fastest model',
      'Extremely low cost',
      'Ideal for guardrails',
      'Minimal latency',
    ],
    pricing: {
      input: '$0.10/1M tokens',
      output: '$0.50/1M tokens',
    },
  },
  claudeSonnet45: {
    name: 'Claude Sonnet 4.5',
    provider: 'Anthropic',
    released: 'September 29, 2025',
    contextWindow: 200000,
    strengths: [
      'Best coding model in the world',
      'Maintains focus for 30+ hours',
      'Leads SWE-bench Verified, OSWorld',
      'Advanced computer use capabilities',
      'Extended thinking up to 10,000 tokens',
      'Ideal for standard proposal generation',
    ],
    thinking: {
      supported: true,
      maxBudgetTokens: 10000,
      recommendedBudget: 8000,
    },
    pricing: {
      input: '$3.00/1M tokens',
      output: '$15.00/1M tokens',
      thinkingTokens: '$3.00/1M tokens',
    },
  },
  claudeHaiku45: {
    name: 'Claude Haiku 4.5',
    provider: 'Anthropic',
    released: 'November 2025',
    contextWindow: 200000,
    strengths: [
      'Extremely fast responses',
      'Cost-effective for quick tasks',
      'High accuracy despite speed',
      'Perfect for simple operations',
    ],
    pricing: {
      input: '$0.80/1M tokens',
      output: '$4.00/1M tokens',
    },
  },
  claudeOpus45: {
    name: 'Claude Opus 4.5',
    provider: 'Anthropic',
    released: 'November 1, 2025',
    contextWindow: 200000,
    strengths: [
      'Most intelligent model',
      'Maximum capability with practical performance',
      'Best-in-class reasoning and coding',
      'Extended thinking up to 32,000 tokens',
      'Ideal for critical proposals and complex analysis',
      'Long-running agent capabilities',
    ],
    thinking: {
      supported: true,
      maxBudgetTokens: 32000,
      recommendedBudget: 16000,
    },
    pricing: {
      input: '$15.00/1M tokens',
      output: '$75.00/1M tokens',
      thinkingTokens: '$15.00/1M tokens',
    },
  },
};

/**
 * Extended Thinking Configuration for Claude 4.5 Models
 *
 * Use these configurations when generating proposals to enable
 * deeper reasoning and more thorough content generation.
 */
export const thinkingConfigs = {
  // Standard proposal generation with Sonnet
  standard: {
    model: 'claude-sonnet-4-5-20250929',
    maxTokens: 16000,
    thinking: {
      type: 'enabled' as const,
      budget_tokens: 10000,
    },
  },
  // Enhanced proposal generation for important RFPs
  enhanced: {
    model: 'claude-sonnet-4-5-20250929',
    maxTokens: 32000,
    thinking: {
      type: 'enabled' as const,
      budget_tokens: 16000,
    },
  },
  // Premium/Critical proposal generation with Opus
  premium: {
    model: 'claude-opus-4-5-20251101',
    maxTokens: 32000,
    thinking: {
      type: 'enabled' as const,
      budget_tokens: 24000,
    },
  },
  // Maximum capability for highest-value proposals
  maximum: {
    model: 'claude-opus-4-5-20251101',
    maxTokens: 64000,
    thinking: {
      type: 'enabled' as const,
      budget_tokens: 32000,
    },
  },
  // Fast mode without thinking (for drafts/previews)
  fast: {
    model: 'claude-sonnet-4-5-20250929',
    maxTokens: 8000,
    thinking: undefined,
  },
};

export type ThinkingConfigKey = keyof typeof thinkingConfigs;
export type ThinkingConfig = (typeof thinkingConfigs)[ThinkingConfigKey];

export default {
  // Anthropic models
  claudeOpus45,
  claudeSonnet45,
  claudeHaiku45,
  claudeOpus41, // Legacy alias
  // OpenAI models
  gpt51,
  gpt5Pro,
  gpt5Mini,
  gpt5Nano,
  // Purpose-based exports
  creativeModel,
  analyticalModel,
  coordinationModel,
  codeModel,
  maximumCapabilityModel,
  fastModel,
  defaultModel,
  reasoningModel,
  guardrailModel,
  // Proposal-specific exports
  proposalModel,
  criticalProposalModel,
  // Thinking configurations
  thinkingConfigs,
  // Utilities
  getModelForAgent,
  modelCapabilities,
};
