import { storage } from '../storage';
import { nanoid } from 'nanoid';

export interface AgentMemoryEntry {
  id?: string;
  agentId: string;
  memoryType: 'episodic' | 'semantic' | 'procedural' | 'working';
  contextKey: string;
  title: string;
  content: any;
  importance: number;
  tags?: string[];
  metadata?: any;
  expiresAt?: Date;
}

export interface AgentKnowledgeEntry {
  id?: string;
  agentId: string;
  knowledgeType:
    | 'rfp_pattern'
    | 'compliance_rule'
    | 'market_insight'
    | 'pricing_data'
    | 'strategy'
    | 'template';
  domain: string;
  title: string;
  description?: string;
  content: any;
  confidenceScore?: number;
  sourceType: 'experience' | 'training' | 'research' | 'feedback';
  sourceId?: string;
  tags?: string[];
}

export interface CoordinationRequest {
  sessionId: string;
  initiatorAgentId: string;
  targetAgentId: string;
  coordinationType: 'handoff' | 'collaboration' | 'consultation' | 'delegation';
  context: any;
  request: any;
  priority?: number;
  metadata?: any;
}

export class AgentMemoryService {
  private static instance: AgentMemoryService;

  public static getInstance(): AgentMemoryService {
    if (!AgentMemoryService.instance) {
      AgentMemoryService.instance = new AgentMemoryService();
    }
    return AgentMemoryService.instance;
  }

  // Memory Management
  async storeMemory(entry: AgentMemoryEntry): Promise<any> {
    // Validate using insert schema
    const memoryData = {
      id: entry.id || nanoid(),
      agentId: entry.agentId,
      memoryType: entry.memoryType,
      contextKey: entry.contextKey,
      title: entry.title,
      content: entry.content,
      importance: entry.importance,
      tags: entry.tags || [],
      metadata: entry.metadata || {},
      expiresAt: entry.expiresAt,
    };

    // Basic validation
    if (!memoryData.agentId || !memoryData.contextKey || !memoryData.title) {
      throw new Error(
        'Missing required fields: agentId, contextKey, and title are required'
      );
    }

    if (memoryData.importance < 1 || memoryData.importance > 10) {
      throw new Error('Importance must be between 1 and 10');
    }

    return await storage.createAgentMemory(memoryData);
  }

  async getMemory(memoryId: string): Promise<any> {
    const memory = await storage.getAgentMemory(memoryId);
    if (memory) {
      await storage.recordMemoryAccess(memoryId);
    }
    return memory;
  }

  async getAgentMemories(
    agentId: string,
    memoryType?: string,
    limit?: number
  ): Promise<any[]> {
    return await storage.getAgentMemoryByAgent(agentId, memoryType, limit);
  }

  async getMemoryByContext(agentId: string, contextKey: string): Promise<any> {
    const memory = await storage.getAgentMemoryByContext(agentId, contextKey);
    if (memory) {
      await storage.recordMemoryAccess(memory.id);
    }
    return memory;
  }

  async updateMemory(
    memoryId: string,
    updates: Partial<AgentMemoryEntry>
  ): Promise<any> {
    return await storage.updateAgentMemory(memoryId, updates);
  }

  async deleteMemory(memoryId: string): Promise<void> {
    await storage.deleteAgentMemory(memoryId);
  }

  // Knowledge Base Management
  async storeKnowledge(entry: AgentKnowledgeEntry): Promise<any> {
    const knowledgeData = {
      id: entry.id || nanoid(),
      agentId: entry.agentId,
      knowledgeType: entry.knowledgeType,
      domain: entry.domain,
      title: entry.title,
      description: entry.description,
      content: entry.content,
      confidenceScore: entry.confidenceScore || 0.5,
      validationStatus: 'pending',
      sourceType: entry.sourceType,
      sourceId: entry.sourceId,
      tags: entry.tags || [],
    };

    // Basic validation
    if (
      !knowledgeData.agentId ||
      !knowledgeData.title ||
      !knowledgeData.domain
    ) {
      throw new Error(
        'Missing required fields: agentId, title, and domain are required'
      );
    }

    if (
      knowledgeData.confidenceScore < 0 ||
      knowledgeData.confidenceScore > 1
    ) {
      throw new Error('Confidence score must be between 0 and 1');
    }

    const validKnowledgeTypes = [
      'rfp_pattern',
      'compliance_rule',
      'market_insight',
      'pricing_data',
      'strategy',
      'template',
    ];
    if (!validKnowledgeTypes.includes(knowledgeData.knowledgeType)) {
      throw new Error(
        `Invalid knowledge type. Must be one of: ${validKnowledgeTypes.join(', ')}`
      );
    }

    const validSourceTypes = ['experience', 'training', 'research', 'feedback'];
    if (!validSourceTypes.includes(knowledgeData.sourceType)) {
      throw new Error(
        `Invalid source type. Must be one of: ${validSourceTypes.join(', ')}`
      );
    }

    return await storage.createAgentKnowledge(knowledgeData);
  }

  async getKnowledge(knowledgeId: string): Promise<any> {
    return await storage.getAgentKnowledge(knowledgeId);
  }

  async getAgentKnowledge(
    agentId: string,
    knowledgeType?: string,
    domain?: string,
    limit?: number
  ): Promise<any[]> {
    return await storage.getAgentKnowledgeByAgent(
      agentId,
      knowledgeType,
      domain,
      limit
    );
  }

  async updateKnowledge(
    knowledgeId: string,
    updates: Partial<AgentKnowledgeEntry>
  ): Promise<any> {
    return await storage.updateAgentKnowledge(knowledgeId, updates);
  }

  async validateKnowledge(knowledgeId: string, isValid: boolean): Promise<any> {
    const status = isValid ? 'validated' : 'disputed';
    return await storage.validateKnowledge(knowledgeId, status);
  }

  async recordKnowledgeUsage(
    knowledgeId: string,
    success: boolean
  ): Promise<void> {
    await storage.recordKnowledgeUsage(knowledgeId, success);
  }

  // Agent Coordination
  async createCoordinationRequest(request: CoordinationRequest): Promise<any> {
    const coordinationData = {
      sessionId: request.sessionId,
      initiatorAgentId: request.initiatorAgentId,
      targetAgentId: request.targetAgentId,
      coordinationType: request.coordinationType,
      context: request.context,
      request: request.request,
      priority: request.priority || 5,
      status: 'pending',
      metadata: request.metadata || {},
    };

    return await storage.createAgentCoordination(coordinationData);
  }

  async updateCoordinationStatus(
    coordinationId: string,
    status: string,
    response?: any
  ): Promise<any> {
    const updates: any = { status };
    if (response) {
      updates.response = response;
    }
    if (status === 'completed' || status === 'failed') {
      updates.completedAt = new Date();
    }

    return await storage.updateAgentCoordination(coordinationId, updates);
  }

  async getPendingCoordinations(agentId: string): Promise<any[]> {
    return await storage.getPendingCoordinations(agentId);
  }

  async getCoordinationSession(sessionId: string): Promise<any[]> {
    return await storage.getAgentCoordinationBySession(sessionId);
  }

  // Contextual Memory Retrieval
  async getRelevantMemories(
    agentId: string,
    context: any,
    limit: number = 10
  ): Promise<any[]> {
    // Get all memories for the agent
    const memories = await this.getAgentMemories(agentId, undefined, 100);

    // Simple relevance scoring based on context matching
    const scoredMemories = memories.map(memory => {
      let relevanceScore = 0;

      // Score based on importance
      relevanceScore += memory.importance * 10;

      // Score based on recent access
      if (memory.lastAccessed) {
        const daysSinceAccess =
          (Date.now() - new Date(memory.lastAccessed).getTime()) /
          (1000 * 60 * 60 * 24);
        relevanceScore += Math.max(0, 30 - daysSinceAccess);
      }

      // Score based on access count
      relevanceScore += Math.min(memory.accessCount * 2, 20);

      // Score based on tag matching
      if (context.tags && memory.tags) {
        const matchingTags = context.tags.filter((tag: string) =>
          memory.tags.includes(tag)
        );
        relevanceScore += matchingTags.length * 15;
      }

      // Score based on content similarity (simple keyword matching)
      if (context.keywords) {
        const contentString = JSON.stringify(memory.content).toLowerCase();
        const matchingKeywords = context.keywords.filter((keyword: string) =>
          contentString.includes(keyword.toLowerCase())
        );
        relevanceScore += matchingKeywords.length * 10;
      }

      return { ...memory, relevanceScore };
    });

    // Sort by relevance and return top results
    return scoredMemories
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit);
  }

  async getRelevantKnowledge(
    agentId: string,
    context: any,
    limit: number = 10
  ): Promise<any[]> {
    // Get all knowledge for the agent
    const knowledge = await this.getAgentKnowledge(
      agentId,
      undefined,
      undefined,
      100
    );

    // Score knowledge based on relevance
    const scoredKnowledge = knowledge.map(item => {
      let relevanceScore = 0;

      // Score based on confidence
      relevanceScore += item.confidenceScore * 30;

      // Score based on usage success rate
      if (item.successRate) {
        relevanceScore += item.successRate * 25;
      }

      // Score based on usage count
      relevanceScore += Math.min(item.usageCount * 2, 20);

      // Score based on domain matching
      if (context.domain && item.domain === context.domain) {
        relevanceScore += 40;
      }

      // Score based on knowledge type matching
      if (
        context.knowledgeType &&
        item.knowledgeType === context.knowledgeType
      ) {
        relevanceScore += 35;
      }

      // Score based on tag matching
      if (context.tags && item.tags) {
        const matchingTags = context.tags.filter((tag: string) =>
          item.tags.includes(tag)
        );
        relevanceScore += matchingTags.length * 15;
      }

      return { ...item, relevanceScore };
    });

    // Sort by relevance and return top results
    return scoredKnowledge
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit);
  }

  // Learning and Adaptation
  async learnFromExperience(agentId: string, experience: any): Promise<void> {
    const { context, outcome, success, rfpId, category, domain } = experience;

    // Store episodic memory of the experience
    await this.storeMemory({
      agentId,
      memoryType: 'episodic',
      contextKey: `experience_${rfpId || nanoid()}`,
      title: `Experience: ${context.action || 'Unknown action'}`,
      content: {
        context,
        outcome,
        success,
        timestamp: new Date(),
        rfpId,
        category,
        domain,
      },
      importance: success ? 8 : 6,
      tags: [category, domain, success ? 'success' : 'failure'].filter(Boolean),
    });

    // Extract knowledge patterns if successful
    if (success && context.strategy) {
      await this.storeKnowledge({
        agentId,
        knowledgeType: 'strategy',
        domain: domain || 'general',
        title: `Successful Strategy: ${context.strategy.name || 'Unnamed'}`,
        description: `Strategy that led to success in ${category || 'unknown'} domain`,
        content: {
          strategy: context.strategy,
          conditions: context.conditions,
          outcome,
          domain,
          category,
        },
        confidenceScore: 0.7,
        sourceType: 'experience',
        sourceId: rfpId,
        tags: [category, domain, 'strategy'].filter(Boolean),
      });
    }
  }

  // Performance Tracking
  async recordPerformanceMetric(
    agentId: string,
    metricType: string,
    value: number,
    context?: any
  ): Promise<void> {
    await storage.recordAgentMetric({
      agentId,
      metricType,
      metricValue: value,
      context: context || {},
      referenceEntityType: context?.entityType,
      referenceEntityId: context?.entityId,
      aggregationPeriod: 'daily',
    });
  }

  async getAgentPerformanceSummary(agentId: string): Promise<any> {
    return await storage.getAgentPerformanceSummary(agentId);
  }

  // AGENT ACTIVITY MONITORING METHODS

  async getRecentAgentActivities(limit: number = 50): Promise<any[]> {
    // Get recent agent metrics and coordination activities
    const recentMetrics = await storage.getAllAgentPerformanceMetrics('24h');
    const recentCoordination = await this.getCoordinationLogs(limit);

    // Combine and format activities
    const activities = [
      ...recentMetrics.map(metric => ({
        id: metric.id,
        type: 'performance_metric',
        agentId: metric.agentId,
        activity: `${metric.metricType}: ${metric.metricValue}`,
        timestamp: metric.recordedAt,
        context: metric.context || {},
      })),
      ...recentCoordination.map(coord => ({
        id: coord.id,
        type: 'coordination',
        agentId: coord.initiatorAgentId,
        activity: `${coord.coordinationType} with ${coord.targetAgentId}`,
        timestamp: coord.createdAt,
        context: coord.context || {},
      })),
    ];

    // Sort by timestamp and limit
    return activities
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )
      .slice(0, limit);
  }

  async getCoordinationLogs(limit: number = 50): Promise<any[]> {
    // Get coordination logs from storage
    return await storage.getCoordinationLogs(limit);
  }

  // Memory Cleanup and Maintenance
  async cleanupExpiredMemories(): Promise<void> {
    console.log('Starting memory cleanup process...');
    // This would be called periodically to remove expired memories
    // Implementation would involve querying for expired memories and deleting them
  }

  async consolidateMemories(agentId: string): Promise<void> {
    console.log(`Consolidating memories for agent: ${agentId}`);
    // This would identify similar memories and consolidate them
    // Implementation would involve semantic similarity analysis
  }

  // Session Management for 3-Tier Agentic System
  async createSession(sessionData: {
    sessionId?: string;
    userId: string;
    orchestratorAgentId: string;
    sessionType: string;
    intent: string;
    context: any;
    metadata?: any;
  }): Promise<any> {
    const newSession = {
      sessionId: sessionData.sessionId || nanoid(),
      userId: sessionData.userId,
      orchestratorAgentId: sessionData.orchestratorAgentId,
      sessionType: sessionData.sessionType,
      intent: sessionData.intent,
      context: sessionData.context,
      status: 'active' as const,
      metadata: sessionData.metadata || {},
      startedAt: new Date(),
      lastActivity: new Date(),
    };

    return await storage.createAgentSession(newSession);
  }

  async getSession(sessionId: string): Promise<any> {
    const session = await storage.getAgentSession(sessionId);
    if (session) {
      // Update last activity timestamp
      await storage.updateAgentSession(sessionId, { lastActivity: new Date() });
    }
    return session;
  }

  async updateSession(
    sessionId: string,
    updates: {
      context?: any;
      status?: string;
      metadata?: any;
      intent?: string;
      currentAgentId?: string;
    }
  ): Promise<any> {
    const updateData = {
      ...updates,
      lastActivity: new Date(),
    };

    // If session is being completed or failed, set endedAt timestamp in metadata
    if (updates.status === 'completed' || updates.status === 'failed') {
      updateData.metadata = {
        ...updateData.metadata,
        endedAt: new Date(),
      };
    }

    return await storage.updateAgentSession(sessionId, updateData);
  }

  async getSessionContext(sessionId: string): Promise<any> {
    const session = await this.getSession(sessionId);
    return session?.context || {};
  }

  async updateSessionContext(
    sessionId: string,
    contextUpdates: any
  ): Promise<any> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const updatedContext = {
      ...session.context,
      ...contextUpdates,
    };

    return await this.updateSession(sessionId, { context: updatedContext });
  }

  async endSession(sessionId: string, reason?: string): Promise<any> {
    return await this.updateSession(sessionId, {
      status: 'completed',
      metadata: { endReason: reason || 'normal_completion' },
    });
  }

  async getActiveSessions(orchestratorAgentId?: string): Promise<any[]> {
    const allActiveSessions = await storage.getActiveAgentSessions();

    if (orchestratorAgentId) {
      return allActiveSessions.filter(
        session => session.orchestratorAgentId === orchestratorAgentId
      );
    }
    return allActiveSessions;
  }

  async getSessionHistory(userId: string, limit: number = 50): Promise<any[]> {
    const sessions = await storage.getAgentSessionsByUser(userId);
    return sessions.slice(0, limit);
  }

  // Context-aware memory retrieval for sessions
  async getSessionMemories(
    sessionId: string,
    memoryType?: string
  ): Promise<any[]> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Get memories for the orchestrator agent in this session context
    const memories = await this.getAgentMemories(
      session.orchestratorAgentId,
      memoryType
    );

    // Filter and score memories based on session context
    return this.getRelevantMemories(session.orchestratorAgentId, {
      sessionId,
      sessionType: session.sessionType,
      intent: session.intent,
      keywords: this.extractKeywords(session.context),
      tags: [session.sessionType, session.intent],
    });
  }

  // Helper method to extract keywords from context
  private extractKeywords(context: any): string[] {
    if (!context) return [];

    const text = JSON.stringify(context).toLowerCase();
    const words = text.match(/\b\w{3,}\b/g) || [];

    // Filter common words and return unique keywords
    const commonWords = [
      'the',
      'and',
      'for',
      'are',
      'but',
      'not',
      'you',
      'all',
      'can',
      'had',
      'her',
      'was',
      'one',
      'our',
      'out',
      'day',
      'get',
      'has',
      'him',
      'his',
      'how',
      'its',
      'may',
      'new',
      'now',
      'old',
      'see',
      'two',
      'who',
      'boy',
      'did',
      'man',
      'way',
      'too',
    ];

    return Array.from(
      new Set(words.filter(word => !commonWords.includes(word)))
    ).slice(0, 10);
  }

  // Helper methods for SAFLA Learning Engine compatibility
  async createMemory(
    agentId: string,
    memoryType: 'episodic' | 'semantic' | 'procedural' | 'working',
    content: any,
    options?: {
      tags?: string[];
      importance?: number;
      contextKey?: string;
      title?: string;
    }
  ): Promise<any> {
    return await this.storeMemory({
      agentId,
      memoryType,
      contextKey: options?.contextKey || `memory_${nanoid()}`,
      title: options?.title || `${memoryType} memory`,
      content,
      importance: options?.importance || 5,
      tags: options?.tags,
    });
  }

  async getMemoryById(memoryId: string): Promise<any> {
    return await this.getMemory(memoryId);
  }

  async updateMemoryMetadata(
    memoryId: string,
    metadata: Record<string, any>
  ): Promise<any> {
    return await this.updateMemory(memoryId, { metadata });
  }

  async createKnowledgeEntry(
    agentId: string,
    entry: {
      domain: string;
      knowledgeType:
        | 'rfp_pattern'
        | 'compliance_rule'
        | 'market_insight'
        | 'pricing_data'
        | 'strategy'
        | 'template';
      title: string;
      content: any;
      tags?: string[];
      metadata?: any;
    }
  ): Promise<any> {
    return await this.storeKnowledge({
      agentId,
      knowledgeType: entry.knowledgeType,
      domain: entry.domain,
      title: entry.title,
      content: entry.content,
      confidenceScore: entry.metadata?.confidenceScore || 0.5,
      sourceType: 'experience',
      tags: entry.tags,
    });
  }
}

export const agentMemoryService = AgentMemoryService.getInstance();
