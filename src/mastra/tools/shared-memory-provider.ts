import { Memory } from '@mastra/memory';
import { agentMemoryService } from '../../../server/services/agents/agentMemoryService';

/**
 * Centralized Memory Provider for all Mastra agents
 * Uses agentMemoryService for persistence and provides credential security
 *
 * Note: This is a simplified implementation using Mastra's built-in memory.
 * For custom storage integration, use @mastra/pg, @mastra/upstash, etc.
 */
export class SharedMemoryProvider {
  private static instance: Memory;

  /**
   * Get or create the shared Memory instance
   *
   * Using Mastra's built-in memory with options for:
   * - lastMessages: Number of recent messages to include
   * - semanticRecall: Disabled for now (requires vector storage)
   * - workingMemory: Disabled (requires special template)
   */
  public static getSharedMemory(): Memory {
    if (!SharedMemoryProvider.instance) {
      console.log('🧠 Creating shared Memory instance with built-in storage');

      SharedMemoryProvider.instance = new Memory({
        options: {
          lastMessages: 10, // Keep last 10 messages in context
          semanticRecall: false, // Disabled - requires vector storage (PgVector, etc.)
        },
      });
    }

    return SharedMemoryProvider.instance;
  }

  /**
   * Sanitize messages to remove sensitive credentials
   */
  private static sanitizeMessage(message: any): any {
    if (!message || typeof message !== 'object') {
      return message;
    }

    const sanitized = { ...message };

    // Recursively sanitize nested objects
    for (const [key, value] of Object.entries(sanitized)) {
      const lowerKey = key.toLowerCase();

      // Remove sensitive fields with more precise matching
      if (
        lowerKey.includes('password') ||
        lowerKey.includes('secret') ||
        lowerKey.includes('token') ||
        lowerKey.includes('credential') ||
        lowerKey.includes('apikey') ||
        lowerKey.includes('api_key') ||
        lowerKey.includes('access_key') ||
        lowerKey.includes('private_key') ||
        lowerKey.includes('session_key') ||
        lowerKey.endsWith('_key') ||
        lowerKey.startsWith('key_')
      ) {
        sanitized[key] = '[REDACTED]';
      } else if (value && typeof value === 'object') {
        sanitized[key] = SharedMemoryProvider.sanitizeMessage(value);
      }
    }

    return sanitized;
  }

  /**
   * Store agent-specific knowledge for long-term retention
   * Uses the agentMemoryService for persistent storage
   */
  public static async storeAgentKnowledge(
    agentId: string,
    knowledge: {
      type:
        | 'rfp_pattern'
        | 'compliance_rule'
        | 'market_insight'
        | 'pricing_data'
        | 'strategy'
        | 'template';
      domain: string;
      title: string;
      content: any;
      confidence?: number;
    }
  ): Promise<void> {
    console.log(`💾 Storing knowledge for ${agentId}: ${knowledge.title}`);
    await agentMemoryService.storeKnowledge({
      agentId,
      knowledgeType: knowledge.type,
      domain: knowledge.domain,
      title: knowledge.title,
      description: `Knowledge acquired by ${agentId}`,
      content: knowledge.content,
      confidenceScore: knowledge.confidence || 0.7,
      sourceType: 'experience',
      tags: [knowledge.domain, knowledge.type, 'shared_memory'],
    });
  }

  /**
   * Retrieve relevant knowledge for agent decision making
   * Uses the agentMemoryService for knowledge retrieval
   */
  public static async getRelevantKnowledge(
    agentId: string,
    context: {
      domain?: string;
      keywords?: string[];
      type?: string;
    }
  ): Promise<any[]> {
    console.log(`🔍 Retrieving knowledge for ${agentId}`, context);
    return await agentMemoryService.getRelevantKnowledge(agentId, context, 10);
  }

  /**
   * Store conversation messages using agentMemoryService
   * This provides custom storage integration beyond Mastra's built-in memory
   *
   * @param sessionId - The session identifier for this conversation
   * @param messages - Array of conversation messages to store
   * @param agentId - Optional agent identifier. If provided, creates a composite key
   *                  "agent_{agentId}_session_{sessionId}" to track agent-specific
   *                  conversations. If omitted, uses "session_{sessionId}" for
   *                  session-level storage. This ensures stored memories can be
   *                  queried by real agent identity without ambiguity.
   */
  public static async storeConversation(
    sessionId: string,
    messages: any[],
    agentId?: string
  ): Promise<void> {
    // Generate safe session ID to prevent cross-contamination
    let safeSessionId = sessionId;
    if (!sessionId || sessionId.trim() === '' || sessionId === 'default') {
      safeSessionId = `anonymous_${Date.now()}_${Math.random().toString(36).substring(2)}`;
      console.warn(
        `⚠️ Using fallback session ID: ${safeSessionId}. Consider providing explicit sessionId.`
      );
    }

    // Create deterministic composite key for agentId parameter
    // - If agentId is provided: "agent_{agentId}_session_{sessionId}"
    // - If agentId is absent: "session_{sessionId}"
    // This separates agent-specific conversations from session-level conversations
    const compositeAgentId = agentId
      ? `agent_${agentId}_session_${safeSessionId}`
      : `session_${safeSessionId}`;

    // Filter out sensitive credentials before storing
    const sanitizedMessages = messages.map(msg =>
      SharedMemoryProvider.sanitizeMessage(msg)
    );

    await agentMemoryService.storeMemory({
      agentId: compositeAgentId,
      memoryType: 'working',
      contextKey: `conversation_${safeSessionId}`,
      title: agentId ? `Conversation Memory (Agent: ${agentId})` : `Conversation Memory`,
      content: { messages: sanitizedMessages, timestamp: Date.now(), agentId, sessionId: safeSessionId },
      importance: 6,
      tags: ['conversation', 'shared', ...(agentId ? [`agent:${agentId}`] : [])],
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    });
  }

  /**
   * Retrieve conversation messages using agentMemoryService
   *
   * @param sessionId - The session identifier for this conversation
   * @param limit - Maximum number of memory entries to retrieve (default: 50)
   * @param agentId - Optional agent identifier. If provided, retrieves conversation
   *                  using composite key "agent_{agentId}_session_{sessionId}".
   *                  If omitted, retrieves using "session_{sessionId}".
   *                  Must match the agentId used in storeConversation.
   */
  public static async retrieveConversation(
    sessionId: string,
    limit?: number,
    agentId?: string
  ): Promise<any[]> {
    // No fallback ID generation during retrieval to prevent cross-contamination
    if (!sessionId || sessionId.trim() === '' || sessionId === 'default') {
      console.warn(
        `⚠️ Empty sessionId provided - returning empty messages to prevent cross-contamination`
      );
      return [];
    }

    // Create the same composite key used in storeConversation
    // - If agentId is provided: "agent_{agentId}_session_{sessionId}"
    // - If agentId is absent: "session_{sessionId}"
    const compositeAgentId = agentId
      ? `agent_${agentId}_session_${sessionId}`
      : `session_${sessionId}`;

    const memories = await agentMemoryService.getAgentMemories(
      compositeAgentId,
      'working',
      limit || 50
    );

    // Sort memories by timestamp to maintain chronological order
    const sortedMemories = memories
      .filter(memory => memory.content?.messages)
      .sort((a, b) => (a.content?.timestamp || 0) - (b.content?.timestamp || 0))
      .flatMap(memory => memory.content?.messages || []);

    return sortedMemories;
  }
}

// Export singleton instance
export const sharedMemory = SharedMemoryProvider.getSharedMemory();
export const memoryProvider = SharedMemoryProvider;
