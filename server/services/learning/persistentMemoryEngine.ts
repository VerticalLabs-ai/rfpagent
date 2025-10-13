import { storage } from '../../storage';
import { agentMemoryService } from '../agents/agentMemoryService';

/**
 * Persistent Memory Engine Service
 *
 * Implements SAFLA (Self-Aware Feedback Loop Algorithm) memory patterns for
 * cross-session learning and long-term knowledge retention.
 *
 * Memory Architecture:
 * - Episodic Memory: Specific experiences and events
 * - Semantic Memory: General knowledge and patterns
 * - Procedural Memory: Skills and strategies
 * - Working Memory: Active context and temporary data
 */

export interface MemoryPattern {
  id: string;
  type: 'episodic' | 'semantic' | 'procedural' | 'working';
  pattern: string;
  confidence: number;
  frequency: number;
  lastAccessed: Date;
  associatedMemories: string[];
  context: any;
  metadata: any;
}

export interface CrossSessionContext {
  sessionId: string;
  userId?: string;
  agentId: string;
  taskType: string;
  domain: string;
  startTime: Date;
  endTime?: Date;
  outcomes: any[];
  learningPoints: any[];
  carryOverContext: any;
}

export interface MemoryConsolidation {
  id: string;
  type: 'nightly' | 'weekly' | 'triggered';
  timestamp: Date;
  memoriesProcessed: number;
  patternsExtracted: number;
  knowledgeUpdated: string[];
  performanceImpact: number;
  consolidationRules: any[];
}

export interface KnowledgeGraph {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  clusters: KnowledgeCluster[];
  strength: number;
  lastUpdated: Date;
}

export interface KnowledgeNode {
  id: string;
  type: 'concept' | 'strategy' | 'pattern' | 'outcome' | 'context';
  label: string;
  content: any;
  importance: number;
  connections: number;
  lastActivated: Date;
}

export interface KnowledgeEdge {
  id: string;
  from: string;
  to: string;
  relationship:
    | 'causes'
    | 'enables'
    | 'conflicts'
    | 'supports'
    | 'requires'
    | 'similar';
  strength: number;
  confidence: number;
  evidence: string[];
}

export interface KnowledgeCluster {
  id: string;
  name: string;
  nodes: string[];
  cohesion: number;
  domain: string;
  keyInsights: string[];
}

export class PersistentMemoryEngine {
  private static instance: PersistentMemoryEngine;
  private consolidationEnabled: boolean = true;
  private memoryCompressionRatio: number = 0.6; // 60% compression target
  private crossSessionRetentionDays: number = 90;
  private memoryDecayRate: number = 0.95; // 5% decay per consolidation cycle

  public static getInstance(): PersistentMemoryEngine {
    if (!PersistentMemoryEngine.instance) {
      PersistentMemoryEngine.instance = new PersistentMemoryEngine();
    }
    return PersistentMemoryEngine.instance;
  }

  // ============ CROSS-SESSION LEARNING ============

  /**
   * Initialize a new session with context from previous sessions
   */
  async initializeSessionContext(sessionRequest: {
    userId?: string;
    agentId: string;
    taskType: string;
    domain: string;
  }): Promise<CrossSessionContext> {
    try {
      console.log(
        `🧠 Initializing session context for ${sessionRequest.agentId}`
      );

      // Get relevant context from previous sessions
      const relevantContext =
        await this.retrieveRelevantContext(sessionRequest);

      // Create new session context
      const sessionContext: CrossSessionContext = {
        sessionId: `session_${Date.now()}_${Math.random()
          .toString(36)
          .substr(2, 9)}`,
        userId: sessionRequest.userId,
        agentId: sessionRequest.agentId,
        taskType: sessionRequest.taskType,
        domain: sessionRequest.domain,
        startTime: new Date(),
        outcomes: [],
        learningPoints: [],
        carryOverContext: relevantContext,
      };

      // Store session initialization
      await this.storeSessionContext(sessionContext);

      console.log(
        `✅ Session context initialized: ${sessionContext.sessionId}`
      );
      return sessionContext;
    } catch (error) {
      console.error('❌ Failed to initialize session context:', error);
      throw error;
    }
  }

  /**
   * Update session context with new learnings and outcomes
   */
  async updateSessionContext(
    sessionId: string,
    updates: {
      outcomes?: any[];
      learningPoints?: any[];
      context?: any;
    }
  ): Promise<void> {
    try {
      const sessionContext = await this.getSessionContext(sessionId);
      if (!sessionContext) {
        console.warn(`Session context not found: ${sessionId}`);
        return;
      }

      // Update session data
      if (updates.outcomes) {
        sessionContext.outcomes.push(...updates.outcomes);
      }

      if (updates.learningPoints) {
        sessionContext.learningPoints.push(...updates.learningPoints);
      }

      if (updates.context) {
        sessionContext.carryOverContext = {
          ...sessionContext.carryOverContext,
          ...updates.context,
        };
      }

      // Store updated context
      await this.storeSessionContext(sessionContext);

      console.log(`📝 Session context updated: ${sessionId}`);
    } catch (error) {
      console.error('❌ Failed to update session context:', error);
    }
  }

  /**
   * Finalize session and extract learnings for future sessions
   */
  async finalizeSession(sessionId: string): Promise<void> {
    try {
      const sessionContext = await this.getSessionContext(sessionId);
      if (!sessionContext) {
        console.warn(`Session context not found: ${sessionId}`);
        return;
      }

      sessionContext.endTime = new Date();

      // Extract session learnings
      const sessionLearnings =
        await this.extractSessionLearnings(sessionContext);

      // Store learnings for future sessions
      await this.persistSessionLearnings(sessionLearnings);

      // Update knowledge graph
      await this.updateKnowledgeGraph(sessionLearnings);

      // Consolidate session memories
      await this.consolidateSessionMemories(sessionContext);

      console.log(
        `🎯 Session finalized with ${sessionLearnings.length} learnings: ${sessionId}`
      );
    } catch (error) {
      console.error('❌ Failed to finalize session:', error);
    }
  }

  // ============ MEMORY CONSOLIDATION ============

  /**
   * Perform memory consolidation to compress and organize memories
   */
  async performMemoryConsolidation(
    type: 'nightly' | 'weekly' | 'triggered' = 'nightly'
  ): Promise<MemoryConsolidation> {
    try {
      console.log(`🔄 Starting ${type} memory consolidation...`);

      const consolidation: MemoryConsolidation = {
        id: `consolidation_${Date.now()}`,
        type,
        timestamp: new Date(),
        memoriesProcessed: 0,
        patternsExtracted: 0,
        knowledgeUpdated: [],
        performanceImpact: 0,
        consolidationRules: this.getConsolidationRules(type),
      };

      // Get all agents for consolidation
      const agents = await storage.getAllAgents();

      for (const agent of agents) {
        await this.consolidateAgentMemories(agent.agentId, consolidation);
      }

      // Compress memory if needed
      if (consolidation.memoriesProcessed > 1000) {
        await this.compressMemories(consolidation);
      }

      // Update global knowledge patterns
      await this.updateGlobalPatterns(consolidation);

      // Store consolidation record
      await this.storeConsolidationRecord(consolidation);

      console.log(
        `✅ Memory consolidation completed: ${consolidation.memoriesProcessed} memories processed`
      );
      return consolidation;
    } catch (error) {
      console.error('❌ Memory consolidation failed:', error);
      throw error;
    }
  }

  /**
   * Consolidate memories for a specific agent
   */
  private async consolidateAgentMemories(
    agentId: string,
    consolidation: MemoryConsolidation
  ): Promise<void> {
    try {
      // Get episodic memories older than 24 hours
      const oldMemories = await agentMemoryService.getAgentMemories(
        agentId,
        'episodic',
        1000
      );
      const cutoffTime = Date.now() - 24 * 60 * 60 * 1000;

      const memoriesToConsolidate = oldMemories.filter(
        memory => new Date(memory.createdAt).getTime() < cutoffTime
      );

      if (memoriesToConsolidate.length === 0) return;

      consolidation.memoriesProcessed += memoriesToConsolidate.length;

      // Extract patterns from memories
      const patterns = this.extractMemoryPatterns(memoriesToConsolidate);
      consolidation.patternsExtracted += patterns.length;

      // Convert episodic memories to semantic knowledge
      const semanticKnowledge = this.convertToSemanticKnowledge(
        patterns,
        agentId
      );

      // Store semantic knowledge
      for (const knowledge of semanticKnowledge) {
        await agentMemoryService.storeKnowledge({
          agentId,
          knowledgeType: knowledge.type,
          domain: knowledge.domain,
          title: knowledge.title,
          description: knowledge.description,
          content: knowledge.content,
          confidenceScore: knowledge.confidence,
          sourceType: 'experience',
          tags: knowledge.tags,
        });

        consolidation.knowledgeUpdated.push(knowledge.title);
      }

      // Archive old episodic memories (mark for cleanup)
      await this.archiveOldMemories(memoriesToConsolidate);
    } catch (error) {
      console.error(
        `❌ Failed to consolidate memories for agent ${agentId}:`,
        error
      );
    }
  }

  /**
   * Compress memories to meet compression ratio targets
   */
  private async compressMemories(
    consolidation: MemoryConsolidation
  ): Promise<void> {
    try {
      const currentMemoryCount = await this.getTotalMemoryCount();
      const targetMemoryCount = Math.floor(
        currentMemoryCount * this.memoryCompressionRatio
      );

      if (currentMemoryCount <= targetMemoryCount) return;

      const memoriesToCompress = currentMemoryCount - targetMemoryCount;

      // Compress by merging similar memories
      const compressedCount =
        await this.mergeSimilarMemories(memoriesToCompress);

      // Apply memory decay to reduce importance of old memories
      await this.applyMemoryDecay();

      consolidation.performanceImpact =
        (compressedCount / currentMemoryCount) * 100;

      console.log(
        `🗜️ Compressed ${compressedCount} memories (${consolidation.performanceImpact.toFixed(
          1
        )}% compression)`
      );
    } catch (error) {
      console.error('❌ Memory compression failed:', error);
    }
  }

  // ============ KNOWLEDGE GRAPH MANAGEMENT ============

  /**
   * Build and maintain knowledge graph from memories
   */
  async buildKnowledgeGraph(domain?: string): Promise<KnowledgeGraph> {
    try {
      console.log(
        `🕸️ Building knowledge graph${domain ? ` for domain: ${domain}` : ''}`
      );

      // Get all semantic knowledge
      const allKnowledge = await this.getAllSemanticKnowledge(domain);

      // Create nodes from knowledge
      const nodes = this.createKnowledgeNodes(allKnowledge);

      // Create edges from relationships
      const edges = await this.createKnowledgeEdges(nodes, allKnowledge);

      // Identify clusters
      const clusters = this.identifyKnowledgeClusters(nodes, edges);

      const knowledgeGraph: KnowledgeGraph = {
        nodes,
        edges,
        clusters,
        strength: this.calculateGraphStrength(nodes, edges),
        lastUpdated: new Date(),
      };

      // Store knowledge graph
      await this.storeKnowledgeGraph(knowledgeGraph, domain);

      console.log(
        `✅ Knowledge graph built: ${nodes.length} nodes, ${edges.length} edges, ${clusters.length} clusters`
      );
      return knowledgeGraph;
    } catch (error) {
      console.error('❌ Failed to build knowledge graph:', error);
      throw error;
    }
  }

  /**
   * Query knowledge graph for insights
   */
  async queryKnowledgeGraph(query: {
    type?: 'concept' | 'strategy' | 'pattern' | 'outcome';
    domain?: string;
    keywords?: string[];
    relationships?: string[];
    limit?: number;
  }): Promise<any[]> {
    try {
      const graph = await this.getKnowledgeGraph(query.domain);
      if (!graph) return [];

      let relevantNodes = graph.nodes;

      // Filter by type
      if (query.type) {
        relevantNodes = relevantNodes.filter(node => node.type === query.type);
      }

      // Filter by keywords
      if (query.keywords && query.keywords.length > 0) {
        relevantNodes = relevantNodes.filter(node =>
          query.keywords!.some(
            keyword =>
              node.label.toLowerCase().includes(keyword.toLowerCase()) ||
              JSON.stringify(node.content)
                .toLowerCase()
                .includes(keyword.toLowerCase())
          )
        );
      }

      // Sort by importance and connections
      relevantNodes.sort((a, b) => {
        const scoreA = a.importance * 0.7 + a.connections * 0.3;
        const scoreB = b.importance * 0.7 + b.connections * 0.3;
        return scoreB - scoreA;
      });

      // Apply limit
      if (query.limit) {
        relevantNodes = relevantNodes.slice(0, query.limit);
      }

      // Enrich with relationship information
      const enrichedResults = relevantNodes.map(node => ({
        ...node,
        relatedNodes: this.getRelatedNodes(node.id, graph),
        insights: this.generateNodeInsights(node, graph),
      }));

      return enrichedResults;
    } catch (error) {
      console.error('❌ Failed to query knowledge graph:', error);
      return [];
    }
  }

  // ============ PATTERN EXTRACTION AND LEARNING ============

  /**
   * Extract patterns from memory collections
   */
  private extractMemoryPatterns(memories: any[]): MemoryPattern[] {
    const patterns: MemoryPattern[] = [];

    // Group memories by similarity
    const memoryGroups = this.groupMemoriesBySimilarity(memories);

    for (const group of memoryGroups) {
      if (group.length >= 2) {
        // Pattern requires at least 2 similar memories
        const pattern = this.createPatternFromGroup(group);
        patterns.push(pattern);
      }
    }

    // Extract temporal patterns
    const temporalPatterns = this.extractTemporalPatterns(memories);
    patterns.push(...temporalPatterns);

    // Extract causal patterns
    const causalPatterns = this.extractCausalPatterns(memories);
    patterns.push(...causalPatterns);

    return patterns;
  }

  /**
   * Group memories by similarity using semantic analysis
   */
  private groupMemoriesBySimilarity(memories: any[]): any[][] {
    const groups: any[][] = [];
    const processed = new Set<string>();

    for (const memory of memories) {
      if (processed.has(memory.id)) continue;

      const similarMemories = [memory];
      processed.add(memory.id);

      // Find similar memories
      for (const otherMemory of memories) {
        if (processed.has(otherMemory.id)) continue;

        const similarity = this.calculateMemorySimilarity(memory, otherMemory);
        if (similarity > 0.7) {
          similarMemories.push(otherMemory);
          processed.add(otherMemory.id);
        }
      }

      if (similarMemories.length > 1) {
        groups.push(similarMemories);
      }
    }

    return groups;
  }

  /**
   * Calculate similarity between two memories
   */
  private calculateMemorySimilarity(memory1: any, memory2: any): number {
    let similarity = 0;

    // Tag similarity
    const tags1 = memory1.tags || [];
    const tags2 = memory2.tags || [];
    const commonTags = tags1.filter((tag: string) => tags2.includes(tag));
    const tagSimilarity =
      commonTags.length / Math.max(tags1.length, tags2.length, 1);
    similarity += tagSimilarity * 0.4;

    // Content similarity (simplified)
    const content1 = JSON.stringify(memory1.content).toLowerCase();
    const content2 = JSON.stringify(memory2.content).toLowerCase();
    const words1 = content1.split(/\s+/);
    const words2 = content2.split(/\s+/);
    const commonWords = words1.filter(
      word => words2.includes(word) && word.length > 3
    );
    const contentSimilarity =
      commonWords.length / Math.max(words1.length, words2.length, 1);
    similarity += contentSimilarity * 0.3;

    // Context similarity
    const context1 = memory1.metadata || {};
    const context2 = memory2.metadata || {};
    const contextKeys1 = Object.keys(context1);
    const contextKeys2 = Object.keys(context2);
    const commonContextKeys = contextKeys1.filter(
      key => contextKeys2.includes(key) && context1[key] === context2[key]
    );
    const contextSimilarity =
      commonContextKeys.length /
      Math.max(contextKeys1.length, contextKeys2.length, 1);
    similarity += contextSimilarity * 0.3;

    return Math.min(similarity, 1.0);
  }

  /**
   * Create pattern from group of similar memories
   */
  private createPatternFromGroup(memoryGroup: any[]): MemoryPattern {
    const commonTags = this.findCommonTags(memoryGroup);
    const commonContext = this.findCommonContext(memoryGroup);
    const patternContent = this.extractPatternContent(memoryGroup);

    return {
      id: `pattern_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: this.determinePatternType(memoryGroup),
      pattern: this.generatePatternDescription(patternContent),
      confidence: this.calculatePatternConfidence(memoryGroup),
      frequency: memoryGroup.length,
      lastAccessed: new Date(),
      associatedMemories: memoryGroup.map(m => m.id),
      context: commonContext,
      metadata: {
        memoryCount: memoryGroup.length,
        extractedAt: new Date(),
        commonTags,
      },
    };
  }

  /**
   * Extract temporal patterns from memories
   */
  private extractTemporalPatterns(memories: any[]): MemoryPattern[] {
    const patterns: MemoryPattern[] = [];

    // Sort memories by timestamp
    const sortedMemories = memories.sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    // Look for sequences
    for (let i = 0; i < sortedMemories.length - 2; i++) {
      const sequence = sortedMemories.slice(i, i + 3);
      const pattern = this.analyzeTemporalSequence(sequence);

      if (pattern) {
        patterns.push(pattern);
      }
    }

    return patterns;
  }

  /**
   * Extract causal patterns from memories
   */
  private extractCausalPatterns(memories: any[]): MemoryPattern[] {
    const patterns: MemoryPattern[] = [];

    // Group by success/failure outcomes
    const successMemories = memories.filter(m => m.content.success === true);
    const failureMemories = memories.filter(m => m.content.success === false);

    // Analyze success patterns
    if (successMemories.length >= 2) {
      const successPattern = this.analyzeCausalPattern(
        successMemories,
        'success'
      );
      if (successPattern) patterns.push(successPattern);
    }

    // Analyze failure patterns
    if (failureMemories.length >= 2) {
      const failurePattern = this.analyzeCausalPattern(
        failureMemories,
        'failure'
      );
      if (failurePattern) patterns.push(failurePattern);
    }

    return patterns;
  }

  // ============ CROSS-SESSION CONTEXT MANAGEMENT ============

  /**
   * Retrieve relevant context from previous sessions
   */
  private async retrieveRelevantContext(sessionRequest: {
    userId?: string;
    agentId: string;
    taskType: string;
    domain: string;
  }): Promise<any> {
    try {
      // Get recent memories for the agent
      const recentMemories = await agentMemoryService.getRelevantMemories(
        sessionRequest.agentId,
        {
          tags: [sessionRequest.taskType, sessionRequest.domain],
          keywords: [sessionRequest.taskType, sessionRequest.domain],
        },
        20
      );

      // Get relevant knowledge
      const relevantKnowledge = await agentMemoryService.getRelevantKnowledge(
        sessionRequest.agentId,
        {
          domain: sessionRequest.domain,
          knowledgeType: 'strategy',
        },
        10
      );

      // Get session patterns
      const sessionPatterns = await this.getSessionPatterns(sessionRequest);

      return {
        recentMemories: recentMemories.slice(0, 10), // Limit to prevent context overflow
        relevantKnowledge: relevantKnowledge.slice(0, 5),
        sessionPatterns,
        contextMetadata: {
          retrievedAt: new Date(),
          memoryCount: recentMemories.length,
          knowledgeCount: relevantKnowledge.length,
          patternCount: sessionPatterns.length,
        },
      };
    } catch (error) {
      console.error('❌ Failed to retrieve relevant context:', error);
      return {
        recentMemories: [],
        relevantKnowledge: [],
        sessionPatterns: [],
        contextMetadata: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  /**
   * Get session patterns for context initialization
   */
  private async getSessionPatterns(sessionRequest: any): Promise<any[]> {
    // Get previous sessions for the same agent and task type
    const sessionMemories = await agentMemoryService.getAgentMemories(
      sessionRequest.agentId,
      'episodic',
      100
    );

    const sessionPattern = sessionMemories.filter(
      memory =>
        memory.content.taskType === sessionRequest.taskType &&
        memory.content.domain === sessionRequest.domain
    );

    return sessionPattern.map(memory => ({
      sessionId: memory.content.sessionId,
      outcomes: memory.content.outcomes || [],
      learningPoints: memory.content.learningPoints || [],
      duration: memory.content.duration,
      success: memory.content.success,
    }));
  }

  /**
   * Extract learnings from completed session
   */
  private async extractSessionLearnings(
    sessionContext: CrossSessionContext
  ): Promise<any[]> {
    const learnings = [];

    // Extract outcome patterns
    if (sessionContext.outcomes.length > 0) {
      const outcomePatterns = this.analyzeOutcomePatterns(
        sessionContext.outcomes
      );
      learnings.push(...outcomePatterns);
    }

    // Extract strategy effectiveness
    const strategyLearnings = this.analyzeStrategyEffectiveness(sessionContext);
    learnings.push(...strategyLearnings);

    // Extract temporal insights
    if (sessionContext.endTime) {
      const duration =
        sessionContext.endTime.getTime() - sessionContext.startTime.getTime();
      const temporalInsights = this.analyzeTemporalInsights(
        sessionContext,
        duration
      );
      learnings.push(...temporalInsights);
    }

    return learnings;
  }

  /**
   * Store session learnings for future use
   */
  private async persistSessionLearnings(learnings: any[]): Promise<void> {
    for (const learning of learnings) {
      await agentMemoryService.storeKnowledge({
        agentId: learning.agentId,
        knowledgeType: learning.type,
        domain: learning.domain,
        title: learning.title,
        description: learning.description,
        content: learning.content,
        confidenceScore: learning.confidence,
        sourceType: 'experience',
        tags: learning.tags,
      });
    }
  }

  // ============ UTILITY METHODS ============

  private async storeSessionContext(
    sessionContext: CrossSessionContext
  ): Promise<void> {
    await agentMemoryService.storeMemory({
      agentId: sessionContext.agentId,
      memoryType: 'working',
      contextKey: `session_${sessionContext.sessionId}`,
      title: `Session Context: ${sessionContext.taskType}`,
      content: sessionContext,
      importance: 7,
      tags: ['session_context', sessionContext.taskType, sessionContext.domain],
      metadata: {
        sessionId: sessionContext.sessionId,
        taskType: sessionContext.taskType,
        domain: sessionContext.domain,
      },
    });
  }

  private async getSessionContext(
    sessionId: string
  ): Promise<CrossSessionContext | null> {
    const memory = await agentMemoryService.getMemoryByContext(
      'session_manager',
      `session_${sessionId}`
    );

    return memory ? memory.content : null;
  }

  private getConsolidationRules(type: string): any[] {
    const rules: Record<string, any[]> = {
      nightly: [
        { rule: 'merge_similar_memories', threshold: 0.8 },
        { rule: 'extract_patterns', minFrequency: 2 },
        { rule: 'decay_old_memories', decayRate: 0.95 },
      ],
      weekly: [
        { rule: 'merge_similar_memories', threshold: 0.7 },
        { rule: 'extract_patterns', minFrequency: 3 },
        { rule: 'build_knowledge_graph', update: true },
        { rule: 'archive_old_memories', ageDays: 30 },
      ],
      triggered: [
        { rule: 'emergency_consolidation', threshold: 0.9 },
        { rule: 'compress_memories', ratio: 0.6 },
      ],
    };

    return rules[type] || rules['nightly'];
  }

  private convertToSemanticKnowledge(
    patterns: MemoryPattern[],
    agentId: string
  ): any[] {
    return patterns.map(pattern => ({
      agentId,
      type: this.mapPatternToKnowledgeType(pattern.type),
      domain: pattern.context.domain || 'general',
      title: `Pattern: ${pattern.pattern}`,
      description: `Learned pattern from ${pattern.frequency} experiences`,
      content: {
        pattern: pattern.pattern,
        confidence: pattern.confidence,
        frequency: pattern.frequency,
        context: pattern.context,
        associatedMemories: pattern.associatedMemories,
      },
      confidence: pattern.confidence,
      tags: [
        'consolidated_pattern',
        pattern.type,
        ...Object.keys(pattern.context),
      ],
    }));
  }

  private async archiveOldMemories(memories: any[]): Promise<void> {
    for (const memory of memories) {
      await agentMemoryService.updateMemory(memory.id, {
        metadata: {
          ...memory.metadata,
          archived: true,
          archivedAt: new Date(),
        },
      });
    }
  }

  private async getTotalMemoryCount(): Promise<number> {
    // This would query the storage for total memory count
    return 10000; // Placeholder
  }

  private async mergeSimilarMemories(targetCount: number): Promise<number> {
    // Implementation would merge similar memories
    return Math.floor(targetCount * 0.8); // Placeholder
  }

  private async applyMemoryDecay(): Promise<void> {
    // Implementation would reduce importance of old memories
    console.log('Applying memory decay...');
  }

  private async updateGlobalPatterns(
    consolidation: MemoryConsolidation
  ): Promise<void> {
    // Implementation would update global learning patterns
    console.log('Updating global patterns...');
  }

  private async storeConsolidationRecord(
    consolidation: MemoryConsolidation
  ): Promise<void> {
    await agentMemoryService.storeMemory({
      agentId: 'memory-engine',
      memoryType: 'semantic',
      contextKey: `consolidation_${consolidation.id}`,
      title: `Memory Consolidation: ${consolidation.type}`,
      content: consolidation,
      importance: 8,
      tags: ['memory_consolidation', consolidation.type],
      metadata: {
        consolidationId: consolidation.id,
        type: consolidation.type,
        performanceImpact: consolidation.performanceImpact,
      },
    });
  }

  private async getAllSemanticKnowledge(domain?: string): Promise<any[]> {
    // Get all semantic knowledge from all agents
    const agents = await storage.getAllAgents();
    const allKnowledge = [];

    for (const agent of agents) {
      const knowledge = await agentMemoryService.getAgentKnowledge(
        agent.agentId,
        undefined,
        domain,
        1000
      );
      allKnowledge.push(...knowledge);
    }

    return allKnowledge;
  }

  private createKnowledgeNodes(knowledge: any[]): KnowledgeNode[] {
    return knowledge.map(item => ({
      id: item.id,
      type: this.mapKnowledgeToNodeType(item.knowledgeType),
      label: item.title,
      content: item.content,
      importance: item.confidenceScore * item.usageCount,
      connections: 0, // Will be calculated when creating edges
      lastActivated: new Date(item.updatedAt),
    }));
  }

  private async createKnowledgeEdges(
    nodes: KnowledgeNode[],
    knowledge: any[]
  ): Promise<KnowledgeEdge[]> {
    const edges: KnowledgeEdge[] = [];

    // Create edges based on content similarity and tag overlap
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const node1 = nodes[i];
        const node2 = nodes[j];
        const knowledge1 = knowledge[i];
        const knowledge2 = knowledge[j];

        const relationship = this.analyzeRelationship(knowledge1, knowledge2);
        if (relationship.strength > 0.3) {
          edges.push({
            id: `edge_${node1.id}_${node2.id}`,
            from: node1.id,
            to: node2.id,
            relationship: relationship.type,
            strength: relationship.strength,
            confidence: relationship.confidence,
            evidence: relationship.evidence,
          });

          // Update connection counts
          node1.connections++;
          node2.connections++;
        }
      }
    }

    return edges;
  }

  private identifyKnowledgeClusters(
    nodes: KnowledgeNode[],
    edges: KnowledgeEdge[]
  ): KnowledgeCluster[] {
    // Simple clustering based on strong connections
    const clusters: KnowledgeCluster[] = [];
    const processed = new Set<string>();

    for (const node of nodes) {
      if (processed.has(node.id)) continue;

      const cluster = this.buildClusterFromNode(node, nodes, edges, processed);
      if (cluster.nodes.length > 1) {
        clusters.push(cluster);
      }
    }

    return clusters;
  }

  private buildClusterFromNode(
    startNode: KnowledgeNode,
    allNodes: KnowledgeNode[],
    edges: KnowledgeEdge[],
    processed: Set<string>
  ): KnowledgeCluster {
    const clusterNodes = [startNode.id];
    processed.add(startNode.id);

    // Find strongly connected nodes
    const connectedEdges = edges.filter(
      edge =>
        (edge.from === startNode.id || edge.to === startNode.id) &&
        edge.strength > 0.7
    );

    for (const edge of connectedEdges) {
      const connectedNodeId = edge.from === startNode.id ? edge.to : edge.from;
      if (!processed.has(connectedNodeId)) {
        clusterNodes.push(connectedNodeId);
        processed.add(connectedNodeId);
      }
    }

    return {
      id: `cluster_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: `Cluster: ${startNode.label}`,
      nodes: clusterNodes,
      cohesion: this.calculateClusterCohesion(clusterNodes, edges),
      domain: this.determineDominantDomain(clusterNodes, allNodes),
      keyInsights: this.extractClusterInsights(clusterNodes, allNodes),
    };
  }

  private calculateGraphStrength(
    nodes: KnowledgeNode[],
    edges: KnowledgeEdge[]
  ): number {
    if (nodes.length === 0) return 0;

    const totalConnections = edges.reduce(
      (sum, edge) => sum + edge.strength,
      0
    );
    const maxPossibleConnections = (nodes.length * (nodes.length - 1)) / 2;

    return maxPossibleConnections > 0
      ? totalConnections / maxPossibleConnections
      : 0;
  }

  private async storeKnowledgeGraph(
    graph: KnowledgeGraph,
    domain?: string
  ): Promise<void> {
    const graphKey = domain
      ? `knowledge_graph_${domain}`
      : 'knowledge_graph_global';

    await agentMemoryService.storeMemory({
      agentId: 'memory-engine',
      memoryType: 'semantic',
      contextKey: graphKey,
      title: `Knowledge Graph${domain ? `: ${domain}` : ''}`,
      content: graph,
      importance: 10, // Highest importance for knowledge graphs
      tags: ['knowledge_graph', domain || 'global'],
      metadata: {
        nodeCount: graph.nodes.length,
        edgeCount: graph.edges.length,
        clusterCount: graph.clusters.length,
        strength: graph.strength,
      },
    });
  }

  private async getKnowledgeGraph(
    domain?: string
  ): Promise<KnowledgeGraph | null> {
    const graphKey = domain
      ? `knowledge_graph_${domain}`
      : 'knowledge_graph_global';

    const memory = await agentMemoryService.getMemoryByContext(
      'memory-engine',
      graphKey
    );
    return memory ? memory.content : null;
  }

  private getRelatedNodes(
    nodeId: string,
    graph: KnowledgeGraph
  ): KnowledgeNode[] {
    const relatedEdges = graph.edges.filter(
      edge => edge.from === nodeId || edge.to === nodeId
    );

    const relatedNodeIds = relatedEdges.map(edge =>
      edge.from === nodeId ? edge.to : edge.from
    );

    return graph.nodes.filter(node => relatedNodeIds.includes(node.id));
  }

  private generateNodeInsights(
    node: KnowledgeNode,
    graph: KnowledgeGraph
  ): string[] {
    const insights = [];

    if (node.connections > graph.nodes.length * 0.1) {
      insights.push('Highly connected concept');
    }

    if (node.importance > 0.8) {
      insights.push('High importance knowledge');
    }

    const recentActivity = Date.now() - node.lastActivated.getTime();
    if (recentActivity < 7 * 24 * 60 * 60 * 1000) {
      insights.push('Recently active');
    }

    return insights;
  }

  // Additional helper methods for pattern analysis and knowledge management
  private findCommonTags(memories: any[]): string[] {
    const tagCounts: Record<string, number> = {};
    for (const memory of memories) {
      for (const tag of memory.tags || []) {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      }
    }

    return Object.keys(tagCounts).filter(
      tag => tagCounts[tag] >= Math.ceil(memories.length * 0.5)
    );
  }

  private findCommonContext(memories: any[]): any {
    // Find common context elements across memories
    const contexts = memories.map(m => m.metadata || {});
    if (contexts.length === 0) return {};

    const commonContext: Record<string, any> = {};
    const firstContext = contexts[0];

    for (const key of Object.keys(firstContext)) {
      const values = contexts.map(ctx => ctx[key]).filter(v => v !== undefined);
      if (values.length === contexts.length && new Set(values).size === 1) {
        commonContext[key] = values[0];
      }
    }

    return commonContext;
  }

  private extractPatternContent(memories: any[]): any {
    // Extract common patterns from memory content
    return {
      commonElements: this.findCommonElements(memories.map(m => m.content)),
      frequency: memories.length,
      timeRange: {
        start: Math.min(...memories.map(m => new Date(m.createdAt).getTime())),
        end: Math.max(...memories.map(m => new Date(m.createdAt).getTime())),
      },
    };
  }

  private findCommonElements(contents: any[]): any {
    // Simple implementation to find common properties
    if (contents.length === 0) return {};

    const commonKeys = Object.keys(contents[0]).filter(key =>
      contents.every(content => Object.hasOwn(content, key))
    );

    const common: Record<string, any> = {};
    for (const key of commonKeys) {
      const values = contents.map(content => content[key]);
      const uniqueValues = [...new Set(values)];

      if (uniqueValues.length === 1) {
        common[key] = uniqueValues[0];
      }
    }

    return common;
  }

  private determinePatternType(
    memories: any[]
  ): 'episodic' | 'semantic' | 'procedural' | 'working' {
    // Analyze memory types and content to determine pattern type
    const memoryTypes = memories.map(m => m.memoryType);
    const dominantType = this.findMostFrequent(memoryTypes);

    const validTypes: ('episodic' | 'semantic' | 'procedural' | 'working')[] = [
      'episodic',
      'semantic',
      'procedural',
      'working',
    ];
    return validTypes.includes(dominantType as any)
      ? (dominantType as any)
      : 'semantic';
  }

  private findMostFrequent(items: string[]): string {
    const counts = items.reduce(
      (acc, item) => {
        acc[item] = (acc[item] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return Object.keys(counts).reduce((a, b) =>
      counts[a] > counts[b] ? a : b
    );
  }

  private generatePatternDescription(content: any): string {
    // Generate human-readable pattern description
    const elements = Object.keys(content.commonElements || {});
    if (elements.length > 0) {
      return `Pattern involving ${elements.join(', ')} with ${
        content.frequency
      } occurrences`;
    }
    return `Behavioral pattern with ${content.frequency} occurrences`;
  }

  private calculatePatternConfidence(memories: any[]): number {
    // Calculate confidence based on frequency and consistency
    const frequency = memories.length;
    const consistency = this.calculateConsistency(memories);

    return Math.min((frequency / 10) * 0.6 + consistency * 0.4, 1.0);
  }

  private calculateConsistency(memories: any[]): number {
    // Calculate how consistent the memories are
    if (memories.length < 2) return 1.0;

    const similarities = [];
    for (let i = 0; i < memories.length - 1; i++) {
      similarities.push(
        this.calculateMemorySimilarity(memories[i], memories[i + 1])
      );
    }

    return (
      similarities.reduce((sum, sim) => sum + sim, 0) / similarities.length
    );
  }

  private analyzeTemporalSequence(sequence: any[]): MemoryPattern | null {
    // Analyze sequence for temporal patterns
    if (sequence.length < 3) return null;

    const intervals = [];
    for (let i = 1; i < sequence.length; i++) {
      const interval =
        new Date(sequence[i].createdAt).getTime() -
        new Date(sequence[i - 1].createdAt).getTime();
      intervals.push(interval);
    }

    // Check if intervals are consistent (indicating a temporal pattern)
    const avgInterval =
      intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    const variance =
      intervals.reduce(
        (sum, interval) => sum + Math.pow(interval - avgInterval, 2),
        0
      ) / intervals.length;

    if (variance < avgInterval * 0.1) {
      // Low variance indicates pattern
      return {
        id: `temporal_pattern_${Date.now()}`,
        type: 'procedural',
        pattern: `Temporal sequence with ${avgInterval}ms intervals`,
        confidence: 0.8,
        frequency: sequence.length,
        lastAccessed: new Date(),
        associatedMemories: sequence.map(m => m.id),
        context: { type: 'temporal', avgInterval, variance },
        metadata: { extractedAt: new Date() },
      };
    }

    return null;
  }

  private analyzeCausalPattern(
    memories: any[],
    outcome: string
  ): MemoryPattern | null {
    // Analyze memories for causal patterns
    const commonFactors = this.extractCommonFactors(memories);

    if (Object.keys(commonFactors).length > 0) {
      return {
        id: `causal_pattern_${outcome}_${Date.now()}`,
        type: 'semantic',
        pattern: `${outcome} pattern involving ${Object.keys(
          commonFactors
        ).join(', ')}`,
        confidence: 0.7,
        frequency: memories.length,
        lastAccessed: new Date(),
        associatedMemories: memories.map(m => m.id),
        context: { outcome, factors: commonFactors },
        metadata: { extractedAt: new Date(), causal: true },
      };
    }

    return null;
  }

  private extractCommonFactors(memories: any[]): any {
    // Extract factors common to memories with same outcome
    const factors: Record<string, Record<string, number>> = {};

    for (const memory of memories) {
      const content = memory.content || {};
      for (const [key, value] of Object.entries(content)) {
        if (typeof value === 'string' || typeof value === 'number') {
          if (!factors[key]) factors[key] = {};
          factors[key][value] = (factors[key][value] || 0) + 1;
        }
      }
    }

    // Filter for factors present in majority of memories
    const commonFactors: Record<string, any> = {};
    for (const [factor, values] of Object.entries(factors)) {
      for (const [value, count] of Object.entries(
        values as Record<string, number>
      )) {
        if ((count as number) >= Math.ceil(memories.length * 0.6)) {
          commonFactors[factor] = value;
        }
      }
    }

    return commonFactors;
  }

  private analyzeOutcomePatterns(outcomes: any[]): any[] {
    // Analyze outcomes for learning patterns
    const patterns = [];

    const successOutcomes = outcomes.filter(o => o.success);
    const failureOutcomes = outcomes.filter(o => !o.success);

    if (successOutcomes.length > 0) {
      patterns.push({
        type: 'strategy',
        title: 'Success Pattern Analysis',
        description: `Analysis of ${successOutcomes.length} successful outcomes`,
        content: { outcomes: successOutcomes, pattern: 'success' },
        confidence: 0.8,
        tags: ['success_pattern', 'outcome_analysis'],
      });
    }

    if (failureOutcomes.length > 0) {
      patterns.push({
        type: 'strategy',
        title: 'Failure Pattern Analysis',
        description: `Analysis of ${failureOutcomes.length} failed outcomes`,
        content: { outcomes: failureOutcomes, pattern: 'failure' },
        confidence: 0.8,
        tags: ['failure_pattern', 'outcome_analysis'],
      });
    }

    return patterns;
  }

  private analyzeStrategyEffectiveness(
    sessionContext: CrossSessionContext
  ): any[] {
    // Analyze which strategies were effective
    const learnings = [];

    if (
      sessionContext.carryOverContext &&
      sessionContext.carryOverContext.relevantKnowledge
    ) {
      const appliedStrategies =
        sessionContext.carryOverContext.relevantKnowledge;
      const sessionSuccess = sessionContext.outcomes.some(o => o.success);

      learnings.push({
        agentId: sessionContext.agentId,
        type: 'strategy',
        domain: sessionContext.domain,
        title: `Strategy Effectiveness: ${sessionContext.taskType}`,
        description: `Analysis of strategy effectiveness for ${sessionContext.taskType}`,
        content: {
          strategies: appliedStrategies,
          sessionOutcome: sessionSuccess,
          taskType: sessionContext.taskType,
          domain: sessionContext.domain,
        },
        confidence: sessionSuccess ? 0.8 : 0.6,
        tags: [
          'strategy_analysis',
          sessionContext.taskType,
          sessionContext.domain,
        ],
      });
    }

    return learnings;
  }

  private analyzeTemporalInsights(
    sessionContext: CrossSessionContext,
    duration: number
  ): any[] {
    // Analyze timing and temporal patterns
    const insights = [];

    const avgDuration = this.calculateAverageDuration(sessionContext.taskType);
    const efficiency = avgDuration > 0 ? avgDuration / duration : 1;

    insights.push({
      agentId: sessionContext.agentId,
      type: 'strategy',
      domain: 'temporal_analysis',
      title: `Temporal Insights: ${sessionContext.taskType}`,
      description: `Timing analysis for ${sessionContext.taskType}`,
      content: {
        duration,
        efficiency,
        taskType: sessionContext.taskType,
        comparison: { avgDuration },
      },
      confidence: 0.7,
      tags: ['temporal_analysis', 'efficiency', sessionContext.taskType],
    });

    return insights;
  }

  private calculateAverageDuration(taskType: string): number {
    // Calculate average duration for task type (placeholder)
    const averages = {
      proposal_generation: 30 * 60 * 1000, // 30 minutes
      document_parsing: 5 * 60 * 1000, // 5 minutes
      portal_navigation: 10 * 60 * 1000, // 10 minutes
    };

    return averages[taskType as keyof typeof averages] || 15 * 60 * 1000; // 15 minutes default
  }

  private mapPatternToKnowledgeType(patternType: string): string {
    const mapping = {
      episodic: 'strategy',
      semantic: 'strategy',
      procedural: 'strategy',
      working: 'strategy',
    };

    return mapping[patternType as keyof typeof mapping] || 'strategy';
  }

  private mapKnowledgeToNodeType(
    knowledgeType: string
  ): 'concept' | 'strategy' | 'pattern' | 'outcome' | 'context' {
    const mapping: Record<
      string,
      'concept' | 'strategy' | 'pattern' | 'outcome' | 'context'
    > = {
      rfp_pattern: 'pattern',
      compliance_rule: 'concept',
      market_insight: 'concept',
      pricing_data: 'concept',
      strategy: 'strategy',
    };

    return mapping[knowledgeType] || 'concept';
  }

  private analyzeRelationship(knowledge1: any, knowledge2: any): any {
    // Analyze relationship between two knowledge items
    let strength = 0;
    let type = 'similar';
    const evidence = [];

    // Tag overlap
    const tags1 = knowledge1.tags || [];
    const tags2 = knowledge2.tags || [];
    const commonTags = tags1.filter((tag: string) => tags2.includes(tag));

    if (commonTags.length > 0) {
      strength +=
        (commonTags.length / Math.max(tags1.length, tags2.length)) * 0.4;
      evidence.push(`Common tags: ${commonTags.join(', ')}`);
    }

    // Domain similarity
    if (knowledge1.domain === knowledge2.domain) {
      strength += 0.3;
      evidence.push('Same domain');
    }

    // Content similarity (simplified)
    const content1 = JSON.stringify(knowledge1.content).toLowerCase();
    const content2 = JSON.stringify(knowledge2.content).toLowerCase();

    if (content1.includes('success') && content2.includes('failure')) {
      type = 'conflicts';
      strength += 0.2;
    } else if (content1.includes('enables') || content2.includes('enables')) {
      type = 'enables';
      strength += 0.3;
    }

    return {
      type,
      strength: Math.min(strength, 1.0),
      confidence: strength,
      evidence,
    };
  }

  private calculateClusterCohesion(
    nodeIds: string[],
    edges: KnowledgeEdge[]
  ): number {
    const internalEdges = edges.filter(
      edge => nodeIds.includes(edge.from) && nodeIds.includes(edge.to)
    );

    const maxPossibleEdges = (nodeIds.length * (nodeIds.length - 1)) / 2;
    return maxPossibleEdges > 0 ? internalEdges.length / maxPossibleEdges : 0;
  }

  private determineDominantDomain(
    nodeIds: string[],
    allNodes: KnowledgeNode[]
  ): string {
    const clusterNodes = allNodes.filter(node => nodeIds.includes(node.id));

    // Extract domains from node content (simplified)
    const domains = clusterNodes
      .map(node => node.content?.domain || 'general')
      .filter(domain => domain !== 'general');

    if (domains.length === 0) return 'general';

    const domainCounts = domains.reduce(
      (counts, domain) => {
        counts[domain as keyof typeof counts] =
          (counts[domain as keyof typeof counts] || 0) + 1;
        return counts;
      },
      {} as Record<string, number>
    );

    return Object.keys(domainCounts).reduce((a, b) =>
      domainCounts[a] > domainCounts[b] ? a : b
    );
  }

  private extractClusterInsights(
    nodeIds: string[],
    allNodes: KnowledgeNode[]
  ): string[] {
    const clusterNodes = allNodes.filter(node => nodeIds.includes(node.id));
    const insights = [];

    const avgImportance =
      clusterNodes.reduce((sum, node) => sum + node.importance, 0) /
      clusterNodes.length;
    if (avgImportance > 0.8) {
      insights.push('High importance cluster');
    }

    const recentNodes = clusterNodes.filter(
      node =>
        Date.now() - node.lastActivated.getTime() < 7 * 24 * 60 * 60 * 1000
    );

    if (recentNodes.length > clusterNodes.length * 0.5) {
      insights.push('Recently active cluster');
    }

    return insights;
  }

  private async updateKnowledgeGraph(learnings: any[]): Promise<void> {
    // Update knowledge graph with new learnings
    for (const learning of learnings) {
      const graph = await this.getKnowledgeGraph(learning.domain);
      if (graph) {
        // Add new nodes and edges based on learnings
        await this.buildKnowledgeGraph(learning.domain);
      }
    }
  }

  private async consolidateSessionMemories(
    sessionContext: CrossSessionContext
  ): Promise<void> {
    // Consolidate memories from the session
    const sessionMemories = await agentMemoryService.getAgentMemories(
      sessionContext.agentId,
      'working',
      100
    );

    const sessionSpecificMemories = sessionMemories.filter(
      memory => memory.content.sessionId === sessionContext.sessionId
    );

    if (sessionSpecificMemories.length > 0) {
      const patterns = this.extractMemoryPatterns(sessionSpecificMemories);
      const semanticKnowledge = this.convertToSemanticKnowledge(
        patterns,
        sessionContext.agentId
      );

      for (const knowledge of semanticKnowledge) {
        await agentMemoryService.storeKnowledge(knowledge);
      }
    }
  }
}

export const persistentMemoryEngine = PersistentMemoryEngine.getInstance();
