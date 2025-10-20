#!/usr/bin/env tsx
/**
 * Standalone MCP Server Entry Point
 *
 * This script starts the RFP Agent MCP server without using `mastra dev`.
 * This bypasses the Mastra bundler issues with AI SDK packages.
 *
 * Usage (as MCP server):
 *   Add to Claude Code MCP config:
 *   claude mcp add rfp-agent tsx /absolute/path/to/rfpagent/scripts/start-mcp-server.ts
 *
 * The MCP server communicates via stdin/stdout using the MCP protocol.
 */

import { rfpMcpServer } from '../src/mastra/mcp/server';

async function startServer() {
  try {
    console.error('🚀 Starting RFP Agent MCP Server via stdio...');
    console.error('');
    console.error('📋 Available MCP tools:');
    console.error('   - delegateToManager');
    console.error('   - checkTaskStatus');
    console.error('   - requestSpecialist');
    console.error('   - sendAgentMessage');
    console.error('   - getAgentMessages');
    console.error('   - createCoordinatedWorkflow');
    console.error('   - updateWorkflowProgress');
    console.error('');
    console.error('🤖 Available agents (via ask_<agent> tools):');
    console.error('   - primaryOrchestrator, portalManager, proposalManager');
    console.error('   - researchManager, portalScanner, portalMonitor');
    console.error('   - contentGenerator, complianceChecker, documentProcessor');
    console.error('   - marketAnalyst, historicalAnalyzer');
    console.error('');
    console.error('📝 Available workflows (via run_<workflow> tools):');
    console.error('   - masterOrchestration, documentProcessing');
    console.error('   - rfpDiscovery, bonfireAuth, proposalPDFAssembly');
    console.error('');

    // Start MCP server with stdio transport
    // This connects the server to stdin/stdout for MCP communication
    await rfpMcpServer.startStdio();

    console.error('✅ RFP Agent MCP Server is running via stdio\n');

  } catch (error) {
    console.error('❌ Failed to start MCP server:', error);
    console.error('Stack:', (error as Error).stack);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.error('\n⏹️  Shutting down MCP server...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.error('\n⏹️  Shutting down MCP server...');
  process.exit(0);
});

// Start the server
startServer().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
