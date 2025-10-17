import { MCPClient, type MastraMCPServerDefinition } from '@mastra/mcp';

/**
 * Build the MCP server configuration from environment variables.
 * Servers remain optional so local development can run without remote dependencies.
 */
function buildServerConfig(): Record<string, MastraMCPServerDefinition> {
  const servers: Record<string, MastraMCPServerDefinition> = {};

  const { RFP_MCP_RUN_SSE_URL, AMPERSAND_MCP_SSE_URL, AMPERSAND_API_KEY, AMPERSAND_PROJECT_ID, AMPERSAND_INTEGRATION_NAME, AMPERSAND_GROUP_REF, SMITHERY_API_KEY } =
    process.env;

  if (RFP_MCP_RUN_SSE_URL) {
    try {
      servers.rfpDiscovery = {
        url: new URL(RFP_MCP_RUN_SSE_URL),
      };
    } catch (error) {
      console.warn('⚠️ Invalid RFP MCP Run SSE URL, skipping registration.', error);
    }
  }

  if (AMPERSAND_MCP_SSE_URL) {
    try {
      servers.ampersand = {
        url: new URL(AMPERSAND_MCP_SSE_URL),
      };
    } catch (error) {
      console.warn('⚠️ Invalid Ampersand MCP SSE URL, skipping registration.', error);
    }
  } else if (AMPERSAND_API_KEY && AMPERSAND_PROJECT_ID && AMPERSAND_INTEGRATION_NAME) {
    const params = new URLSearchParams({
      apiKey: AMPERSAND_API_KEY,
      project: AMPERSAND_PROJECT_ID,
      integrationName: AMPERSAND_INTEGRATION_NAME,
    });

    if (AMPERSAND_GROUP_REF) {
      params.set('groupRef', AMPERSAND_GROUP_REF);
    }

    servers.ampersand = {
      url: new URL(`https://mcp.withampersand.com/v1/sse?${params.toString()}`),
    };
  }

  if (SMITHERY_API_KEY) {
    servers.smitherySequential = {
      command: 'npx',
      args: [
        '-y',
        '@smithery/cli@latest',
        'run',
        '@smithery-ai/server-sequential-thinking',
        '--config',
        JSON.stringify({ api_key: SMITHERY_API_KEY }),
      ],
      env: {
        SMITHERY_API_KEY,
      },
    };
  }

  return servers;
}

let externalClientPromise: Promise<MCPClient | null> | null = null;

async function createExternalClient(): Promise<MCPClient | null> {
  const servers = buildServerConfig();
  if (Object.keys(servers).length === 0) {
    return null;
  }

  return new MCPClient({
    id: 'rfp-external-mcp',
    servers,
    timeout: 60_000,
  });
}

export async function getExternalMcpClient(): Promise<MCPClient | null> {
  if (!externalClientPromise) {
    externalClientPromise = createExternalClient();
  }

  return externalClientPromise;
}

export async function loadExternalMcpTools() {
  const client = await getExternalMcpClient();
  if (!client) {
    return {};
  }

  try {
    return await client.getTools();
  } catch (error) {
    console.warn('⚠️ Failed to load external MCP tools, continuing without them.', error);
    return {};
  }
}

export async function loadExternalMcpToolsets() {
  const client = await getExternalMcpClient();
  if (!client) {
    return {};
  }

  try {
    return await client.getToolsets();
  } catch (error) {
    console.warn('⚠️ Failed to load external MCP toolsets, returning empty set.', error);
    return {};
  }
}

export async function disconnectExternalMcpClient() {
  const client = await getExternalMcpClient();
  if (client && typeof client.disconnect === 'function') {
    await client.disconnect();
  }
  externalClientPromise = null;
}

