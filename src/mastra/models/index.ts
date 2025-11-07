import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';

/**
 * Model Configuration for Multi-Agent System
 *
 * CURRENT AI MODELS (Updated November 2025):
 *
 * Anthropic Models:
 * - Claude Sonnet 4.5: Best coding model, general use (Released September 2025)
 * - Claude Haiku 4.5: Fast/quick tasks
 * - Claude Opus 4.1: Backup specialized reasoning tasks (Released August 2025)
 *
 * OpenAI Models:
 * - GPT-5: General use, unified model (Released August 2025)
 * - GPT-5 Pro: Hardest tasks, deep reasoning
 * - GPT-5 Mini: Smaller tasks
 * - GPT-5 Nano: Fastest/smallest model
 */

// ============================================================================
// ANTHROPIC MODELS
// ============================================================================

// Claude Sonnet 4.5 (Best coding model, general use)
export const claudeSonnet45 = anthropic('claude-sonnet-4-5');

// Claude Haiku 4.5 (Fast/quick tasks)
export const claudeHaiku45 = anthropic('claude-haiku-4-5');

// Claude Opus 4.1 (Backup specialized reasoning)
export const claudeOpus41 = anthropic('claude-opus-4-1');

// ============================================================================
// OPENAI MODELS
// ============================================================================

// GPT-5 (General use)
export const gpt5 = openai('gpt-5');

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
 * Recommended: GPT-5
 */
export const creativeModel = gpt5;

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
 * Recommended: GPT-5 Pro or Claude Opus 4.1
 */
export const maximumCapabilityModel = gpt5Pro;

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
export const defaultModel = gpt5;

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
      return creativeModel; // GPT-5 for creative writing

    case 'portal-scanner':
    case 'portal-monitor':
      return codeModel; // Claude Sonnet 4.5 for technical tasks

    case 'content-generator':
      return creativeModel; // GPT-5 for content generation

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
  gpt5: {
    name: 'GPT-5',
    provider: 'OpenAI',
    released: 'August 7, 2025',
    contextWindow: 128000,
    strengths: [
      'Unified reasoning + fast responses',
      'State-of-the-art across coding, math, writing',
      '94.6% on AIME 2025 (math)',
      '74.9% on SWE-bench Verified (coding)',
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
      'Improved reasoning and math',
      'Most aligned frontier model',
    ],
    pricing: {
      input: '$3.00/1M tokens',
      output: '$15.00/1M tokens',
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
  claudeOpus41: {
    name: 'Claude Opus 4.1',
    provider: 'Anthropic',
    released: 'August 5, 2025',
    contextWindow: 200000,
    strengths: [
      'Maximum capability',
      'Complex reasoning',
      'Critical analysis',
      'Nuanced understanding',
    ],
    pricing: {
      input: '$15.00/1M tokens',
      output: '$75.00/1M tokens',
    },
  },
};

export default {
  // Anthropic models
  claudeSonnet45,
  claudeHaiku45,
  claudeOpus41,
  // OpenAI models
  gpt5,
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
  // Utilities
  getModelForAgent,
  modelCapabilities,
};
