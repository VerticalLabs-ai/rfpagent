import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';

/**
 * Model Configuration for Multi-Agent System
 *
 * REAL, CURRENT AI MODELS (Updated January 2025):
 * - OpenAI GPT-5: Latest unified model (Released August 2025)
 * - Claude Sonnet 4.5: Anthropic's best coding model (Released September 2025)
 * - Claude Opus 4.1: Maximum capability reasoning model
 *
 * Different agents can use different models based on their requirements:
 * - GPT-5: Unified model with reasoning + fast responses, multimodal
 * - Claude Sonnet 4.5: Best for coding, complex agents, long tasks (30+ hours focus)
 * - Claude Opus 4.1: Maximum capability for critical reasoning
 */

// OpenAI GPT-5 (Latest unified model - Released August 7, 2025)
export const gpt5 = openai('gpt-5');
export const gpt5Thinking = openai('gpt-5-thinking'); // Deep reasoning variant

// Claude Sonnet 4.5 (Best coding model - Released September 29, 2025)
export const claudeSonnet45 = anthropic('claude-sonnet-4-5-20250929');
export const claudeSonnet45Thinking = anthropic('claude-sonnet-4-5-20250929-thinking'); // Extended reasoning

// Claude Opus 4.1 (Maximum capability - Released August 2025)
export const claudeOpus41 = anthropic('claude-opus-4-1-20250805');

// Claude Sonnet 4 (Previous generation - Released May 2025)
export const claudeSonnet4 = anthropic('claude-sonnet-4-20250514');

// Claude Opus 4 (Previous generation - Released May 2025)
export const claudeOpus4 = anthropic('claude-opus-4-20250514');

// Legacy Claude 3.x models (for compatibility)
export const claudeSonnet37 = anthropic('claude-3-7-sonnet-20250219');
export const claudeHaiku35 = anthropic('claude-3-5-haiku-20241022');
export const claudeHaiku3 = anthropic('claude-3-haiku-20240307');

/**
 * Model Selection Strategy
 *
 * Choose models based on task requirements:
 */

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
 * Recommended: Claude Opus 4.1
 */
export const maximumCapabilityModel = claudeOpus41;

/**
 * Default model for general purposes
 */
export const defaultModel = gpt5;

/**
 * Deep reasoning model for complex problems
 */
export const reasoningModel = gpt5Thinking;

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
 * Model capabilities and pricing information (As of January 2025)
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
  gpt5Thinking: {
    name: 'GPT-5 Thinking',
    provider: 'OpenAI',
    released: 'August 7, 2025',
    contextWindow: 128000,
    strengths: [
      'Deep reasoning for hard problems',
      'Extended thinking time',
      'Complex multi-step reasoning',
    ],
    pricing: {
      input: '$5.00/1M tokens',
      output: '$20.00/1M tokens',
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
  claudeSonnet45Thinking: {
    name: 'Claude Sonnet 4.5 Thinking',
    provider: 'Anthropic',
    released: 'September 29, 2025',
    contextWindow: 200000,
    strengths: [
      'Extended reasoning capabilities',
      'Complex problem solving',
      'Long-context reasoning',
    ],
    pricing: {
      input: '$6.00/1M tokens',
      output: '$30.00/1M tokens',
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
  claudeOpus4: {
    name: 'Claude Opus 4',
    provider: 'Anthropic',
    released: 'May 14, 2025',
    contextWindow: 200000,
    strengths: [
      'High capability reasoning',
      'Complex analysis',
      'Long context',
    ],
    pricing: {
      input: '$15.00/1M tokens',
      output: '$75.00/1M tokens',
    },
  },
};

export default {
  // Current models
  gpt5,
  gpt5Thinking,
  claudeSonnet45,
  claudeSonnet45Thinking,
  claudeOpus41,
  claudeSonnet4,
  claudeOpus4,
  // Legacy Claude 3.x
  claudeSonnet37,
  claudeHaiku35,
  claudeHaiku3,
  // Purpose-based exports
  creativeModel,
  analyticalModel,
  coordinationModel,
  codeModel,
  maximumCapabilityModel,
  defaultModel,
  reasoningModel,
  // Utilities
  getModelForAgent,
  modelCapabilities,
};
