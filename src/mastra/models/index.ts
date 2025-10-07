import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';

/**
 * Model Configuration for Multi-Agent System
 *
 * This module provides access to premium AI models:
 * - OpenAI GPT-5: Latest OpenAI model with advanced reasoning
 * - Claude Sonnet 4.5: Anthropic's most capable model with superior context handling
 *
 * Different agents can use different models based on their requirements:
 * - GPT-5: Better for creative tasks, proposal generation, content writing
 * - Claude Sonnet 4.5: Better for analysis, code understanding, structured reasoning
 */

// OpenAI GPT-5 (Latest and most capable OpenAI model)
export const gpt5 = openai('gpt-5');
export const gpt5Turbo = openai('gpt-5-turbo'); // Faster variant if available

// Claude Sonnet 4.5 (Anthropic's latest model - what Claude Code uses!)
export const claudeSonnet45 = anthropic('claude-sonnet-4-5');

// Claude Opus (For tasks requiring maximum capability)
export const claudeOpus4 = anthropic('claude-opus-4-20250514');

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
 * For Technical Analysis:
 * - Document parsing
 * - Compliance checking
 * - Requirements extraction
 * Recommended: Claude Sonnet 4.5
 */
export const analyticalModel = claudeSonnet45;

/**
 * For Coordination & Orchestration:
 * - Multi-agent coordination
 * - Workflow planning
 * - Decision making
 * Recommended: Claude Sonnet 4.5 (superior context handling)
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
 * Recommended: Claude Opus 4
 */
export const maximumCapabilityModel = claudeOpus4;

/**
 * Default model for general purposes
 */
export const defaultModel = gpt5;

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
 * Model capabilities and pricing information (for reference)
 */
export const modelCapabilities = {
  gpt5: {
    name: 'GPT-5',
    provider: 'OpenAI',
    contextWindow: 128000,
    strengths: [
      'Creative writing',
      'Proposals',
      'Content generation',
      'Conversational',
    ],
    pricing: {
      input: '$0.10/1K tokens', // Example pricing
      output: '$0.30/1K tokens',
    },
  },
  claudeSonnet45: {
    name: 'Claude Sonnet 4.5',
    provider: 'Anthropic',
    contextWindow: 200000,
    strengths: [
      'Analysis',
      'Code',
      'Reasoning',
      'Long context',
      'Structured output',
      'Multi-agent coordination',
    ],
    pricing: {
      input: '$0.03/1K tokens',
      output: '$0.15/1K tokens',
    },
  },
  claudeOpus4: {
    name: 'Claude Opus 4',
    provider: 'Anthropic',
    contextWindow: 200000,
    strengths: ['Maximum capability', 'Complex reasoning', 'Critical analysis'],
    pricing: {
      input: '$0.15/1K tokens',
      output: '$0.75/1K tokens',
    },
  },
};

export default {
  gpt5,
  gpt5Turbo,
  claudeSonnet45,
  claudeOpus4,
  creativeModel,
  analyticalModel,
  coordinationModel,
  codeModel,
  maximumCapabilityModel,
  defaultModel,
  getModelForAgent,
  modelCapabilities,
};
