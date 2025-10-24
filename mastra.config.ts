import { config } from '@mastra/core/config';
import { mastra } from './src/mastra';

/**
 * Mastra Configuration File
 *
 * This is the required root-level configuration file for Mastra Cloud Dashboard.
 * It exports the mastra instance for cloud deployment and MCP server integration.
 *
 * Required for:
 * - Mastra Cloud Dashboard tool discovery
 * - MCP server tool registration
 * - Agent and workflow visibility
 */

export default config({
  name: 'rfp-agent-platform',
  mastra,
  publicDir: 'public',
});
