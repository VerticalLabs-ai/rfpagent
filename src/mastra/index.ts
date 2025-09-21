import { Mastra } from '@mastra/core/mastra';
import { rfpDiscoveryAgent } from './agents/rfp-discovery-agent';
import { rfpAnalysisAgent } from './agents/rfp-analysis-agent';
import { rfpSubmissionAgent } from './agents/rfp-submission-agent';

// Simplified Mastra configuration for Phase 1 - will enhance with proper storage/logging later
export const mastra = new Mastra({
  // Basic configuration without problematic dependencies for now
  agents: { 
    rfpDiscoveryAgent,
    rfpAnalysisAgent, 
    rfpSubmissionAgent 
  },
});