import { agentKnowledgeBase, agentMemory } from '@shared/schema';
import { and, asc, count, lt, sql } from 'drizzle-orm';
import { db } from '../../db';
import { storage } from '../../storage';
import {
  agentMemoryService,
  type AgentMemoryEntry,
} from '../agents/agentMemoryService';

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

interface PatternAggregationState {
  totalPatterns: number;
  agentSet: Set<string>;
  patternTypeCounts: Record<string, number>;
  domainCounts: Record<string, number>;
  contextCounts: Record<string, number>;
  patternAggregates: Map<string, PatternAggregateEntry>;
  confidenceAccumulator: number;
}

interface PatternAggregateEntry {
  pattern: string;
  agents: Set<string>;
  domains: Set<string>;
  type: string;
  successSamples: number[];
  usage: number;
  confidenceSum: number;
  count: number;
}

interface GlobalPatternStatsResult {
  aggregatedStats: {
    generatedAt: string;
    consolidationId: string;
    totalPatterns: number;
    recentPatternsExtracted: number;
    agentCoverage: {
      totalAgents: number;
      agentIds: string[];
    };
    mostFrequentPatternTypes: Array<{
      type: string;
      count: number;
      ratio: number;
    }>;
    commonDomains: Array<{
      domain: string;
      count: number;
      ratio: number;
    }>;
    commonContexts: Array<{
      context: string;
      count: number;
      ratio: number;
    }>;
    patternSuccessCorrelations: Array<{
      pattern: string;
      type: string;
      domains: string[];
      agentCount: number;
      avgSuccessRate: number | null;
      usage: number;
      avgConfidence: number | null;
    }>;
    shareablePatterns: Array<{
      pattern: string;
      type: string;
      agentIds: string[];
      domains: string[];
      avgSuccessRate: number | null;
      usage: number;
    }>;
  };
  aggregatedConfidence: number;
  agentCount: number;
  totalPatterns: number;
  agentIds: string[];
}

export class PersistentMemoryEngine {
  private static instance: PersistentMemoryEngine;
  private consolidationEnabled: boolean = true;
  private memoryCompressionRatio: number = 0.6; // 60% compression target
  private crossSessionRetentionDays: number = 90;
  private memoryDecayRate: number = 0.95; // 5% decay per consolidation cycle

  // Memory merging configuration
  private memorySimilarityThreshold: number = 0.85; // Configurable similarity threshold
  private mergeMaxIterations: number = 1000; // Maximum iterations to prevent unbounded loops
  private mergeTimeoutMs: number = 60000; // 60 seconds timeout for merge operations
  private mergeProgressLogInterval: number = 50; // Log progress every N merges
  private mergeMaxCandidatesPerPrimary: number = 100; // Limit candidates to check per primary
  private patternAggregationBatchSize: number = 500;
  private patternAggregationYieldInterval: number = 5;

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
          .substring(2, 11)}`,
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
    },
    agentId?: string
  ): Promise<void> {
    try {
      const sessionContext = await this.getSessionContext(sessionId, agentId);
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
  async finalizeSession(sessionId: string, agentId?: string): Promise<void> {
    try {
      const sessionContext = await this.getSessionContext(sessionId, agentId);
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
      id: `pattern_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
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
    sessionId: string,
    agentId?: string
  ): Promise<CrossSessionContext | null> {
    // agentId must be provided to correctly retrieve session context
    if (!agentId) {
      console.error(
        `getSessionContext called without agentId for session ${sessionId}. agentId is required for correct memory retrieval.`
      );
      return null;
    }

    const memory = await agentMemoryService.getMemoryByContext(
      agentId,
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
    const [result] = await db
      .select({ count: count() })
      .from(agentMemory)
      .where(
        sql`COALESCE((${agentMemory.metadata} ->> 'archived')::boolean, false) = false`
      );

    return Number(result?.count ?? 0);
  }

  private async mergeSimilarMemories(
    targetCount: number,
    similarityThreshold: number = this.memorySimilarityThreshold
  ): Promise<number> {
    if (targetCount <= 0) return 0;

    const fetchLimit = Math.min(Math.max(targetCount * 4, 100), 500);
    const startTime = Date.now();
    let iterations = 0;

    console.log(
      `🔄 Starting memory merge: target=${targetCount}, threshold=${similarityThreshold}, maxIterations=${this.mergeMaxIterations}, timeout=${this.mergeTimeoutMs}ms`
    );

    const activeMemoriesRaw = await db
      .select()
      .from(agentMemory)
      .where(
        sql`COALESCE((${agentMemory.metadata} ->> 'archived')::boolean, false) = false`
      )
      .limit(fetchLimit);

    if (!activeMemoriesRaw.length) return 0;

    const memoryById = new Map<string, any>();
    const activeIds = new Set<string>();

    for (const rawMemory of activeMemoriesRaw) {
      const normalizedMemory = {
        ...rawMemory,
        metadata: rawMemory.metadata ?? {},
        tags: rawMemory.tags ?? [],
      };
      memoryById.set(normalizedMemory.id, normalizedMemory);
      activeIds.add(normalizedMemory.id);
    }

    let mergedCount = 0;

    while (mergedCount < targetCount && activeIds.size > 1) {
      // Operational guard: check iteration limit
      if (iterations >= this.mergeMaxIterations) {
        console.warn(
          `⚠️ Merge stopped: reached max iterations (${this.mergeMaxIterations}). Merged ${mergedCount}/${targetCount}`
        );
        break;
      }

      // Operational guard: check timeout
      const elapsed = Date.now() - startTime;
      if (elapsed >= this.mergeTimeoutMs) {
        console.warn(
          `⚠️ Merge stopped: timeout (${elapsed}ms). Merged ${mergedCount}/${targetCount}`
        );
        break;
      }

      iterations++;

      // Progress logging
      if (
        mergedCount > 0 &&
        mergedCount % this.mergeProgressLogInterval === 0
      ) {
        const elapsed = Date.now() - startTime;
        console.log(
          `📊 Merge progress: ${mergedCount}/${targetCount} merged, iteration ${iterations}, elapsed ${elapsed}ms`
        );
      }

      const ids = Array.from(activeIds);
      let bestPair: {
        primaryId: string;
        secondaryId: string;
        similarity: number;
      } | null = null;

      // Prefiltering: sample candidates if we have too many to reduce O(n²) comparisons
      const candidateIds =
        ids.length > this.mergeMaxCandidatesPerPrimary * 2
          ? this.sampleCandidates(ids, this.mergeMaxCandidatesPerPrimary * 2)
          : ids;

      for (let i = 0; i < candidateIds.length; i++) {
        const memoryA = memoryById.get(candidateIds[i]);
        if (!memoryA) continue;

        // Limit candidates per primary to prevent excessive comparisons
        const maxJ = Math.min(
          candidateIds.length,
          i + 1 + this.mergeMaxCandidatesPerPrimary
        );

        for (let j = i + 1; j < maxJ; j++) {
          const memoryB = memoryById.get(candidateIds[j]);
          if (!memoryB) continue;

          const similarity = this.calculateMemorySimilarity(memoryA, memoryB);
          if (similarity <= similarityThreshold) continue;

          const primary =
            (memoryA.importance ?? 0) >= (memoryB.importance ?? 0)
              ? memoryA
              : memoryB;
          const secondary = primary === memoryA ? memoryB : memoryA;

          if (
            !bestPair ||
            similarity > bestPair.similarity ||
            (similarity === bestPair.similarity &&
              (secondary.importance ?? 0) <
                (memoryById.get(bestPair.secondaryId)?.importance ?? 0))
          ) {
            bestPair = {
              primaryId: primary.id,
              secondaryId: secondary.id,
              similarity,
            };
          }
        }
      }

      if (!bestPair) break;

      const primaryMemory = memoryById.get(bestPair.primaryId);
      const secondaryMemory = memoryById.get(bestPair.secondaryId);

      if (!primaryMemory || !secondaryMemory) {
        activeIds.delete(bestPair.primaryId);
        activeIds.delete(bestPair.secondaryId);
        continue;
      }

      const similarCandidates: any[] = [secondaryMemory];

      for (const id of ids) {
        if (id === primaryMemory.id || id === secondaryMemory.id) continue;
        if (!activeIds.has(id)) continue;

        const candidate = memoryById.get(id);
        if (!candidate) continue;

        const similarity = this.calculateMemorySimilarity(
          primaryMemory,
          candidate
        );

        if (similarity > similarityThreshold) {
          similarCandidates.push(candidate);
        }
      }

      similarCandidates.sort(
        (a, b) => (a.importance ?? 0) - (b.importance ?? 0)
      );

      const mergeQuota = targetCount - mergedCount;
      const memoriesToMerge = similarCandidates.slice(0, mergeQuota);

      if (!memoriesToMerge.length) break;

      let combinedContent = primaryMemory.content;
      let combinedMetadata = primaryMemory.metadata ?? {};
      const combinedTags = new Set<string>(primaryMemory.tags ?? []);
      const associatedSet = new Set<string>(
        Array.isArray(combinedMetadata.associatedMemories)
          ? combinedMetadata.associatedMemories
          : []
      );
      associatedSet.add(primaryMemory.id);

      const mergedFrom = new Set<string>();

      if (Array.isArray(combinedMetadata.mergedFrom)) {
        for (const id of combinedMetadata.mergedFrom) {
          if (typeof id === 'string') mergedFrom.add(id);
        }
      } else if (typeof combinedMetadata.mergedFrom === 'string') {
        mergedFrom.add(combinedMetadata.mergedFrom);
      }

      const mergedAt = new Date();

      for (const memory of memoriesToMerge) {
        combinedContent = this.mergeFieldValues(
          combinedContent,
          memory.content
        );
        combinedMetadata = this.mergeFieldValues(
          combinedMetadata,
          memory.metadata ?? {}
        );

        for (const tag of memory.tags ?? []) {
          if (typeof tag === 'string') {
            combinedTags.add(tag);
          }
        }

        const associations = Array.isArray(memory.metadata?.associatedMemories)
          ? memory.metadata.associatedMemories
          : [];
        for (const assoc of associations) {
          if (typeof assoc === 'string') {
            associatedSet.add(assoc);
          }
        }

        associatedSet.add(memory.id);
        mergedFrom.add(memory.id);
      }

      combinedMetadata =
        this.isPlainObject(combinedMetadata) && combinedMetadata !== null
          ? combinedMetadata
          : {};

      const updatedMetadata = {
        ...combinedMetadata,
        associatedMemories: Array.from(associatedSet),
        archived: false,
        mergedFrom: Array.from(mergedFrom),
        mergedAt,
      };

      const updatedImportance = Math.max(
        primaryMemory.importance ?? 0,
        ...memoriesToMerge.map(memory => memory.importance ?? 0)
      );

      const updatedPrimary = await agentMemoryService.updateMemory(
        primaryMemory.id,
        {
          content: combinedContent,
          metadata: updatedMetadata,
          tags: Array.from(combinedTags),
          importance: updatedImportance,
        }
      );

      primaryMemory.content = updatedPrimary.content ?? combinedContent;
      primaryMemory.metadata = updatedPrimary.metadata ?? updatedMetadata;
      primaryMemory.tags = updatedPrimary.tags ?? Array.from(combinedTags);
      primaryMemory.importance = updatedPrimary.importance ?? updatedImportance;

      memoryById.set(primaryMemory.id, primaryMemory);

      for (const memory of memoriesToMerge) {
        await agentMemoryService.updateMemory(memory.id, {
          metadata: {
            ...(memory.metadata ?? {}),
            archived: true,
            archivedAt: mergedAt,
            mergedInto: primaryMemory.id,
          },
        });

        activeIds.delete(memory.id);
        memoryById.delete(memory.id);
        mergedCount += 1;
      }

      activeIds.add(primaryMemory.id);
    }

    // Final summary
    const totalElapsed = Date.now() - startTime;
    console.log(
      `✅ Memory merge complete: ${mergedCount}/${targetCount} merged in ${iterations} iterations, ${totalElapsed}ms`
    );

    return mergedCount;
  }

  /**
   * Sample candidates from a large set to reduce comparison overhead
   * Uses stratified sampling to maintain diversity
   */
  private sampleCandidates(ids: string[], sampleSize: number): string[] {
    if (ids.length <= sampleSize) return ids;

    // Stratified sampling: take every nth element to maintain diversity
    const step = ids.length / sampleSize;
    const sampled: string[] = [];

    for (let i = 0; i < sampleSize; i++) {
      const index = Math.floor(i * step);
      sampled.push(ids[index]);
    }

    return sampled;
  }

  private mergeFieldValues(existing: any, incoming: any): any {
    if (existing === undefined || existing === null) return incoming;
    if (incoming === undefined || incoming === null) return existing;

    if (Array.isArray(existing) && Array.isArray(incoming)) {
      return this.deduplicateArray([...existing, ...incoming]);
    }

    if (this.isPlainObject(existing) && this.isPlainObject(incoming)) {
      const result: Record<string, any> = { ...existing };
      for (const key of Object.keys(incoming)) {
        result[key] = this.mergeFieldValues(result[key], incoming[key]);
      }
      return result;
    }

    if (Array.isArray(existing)) {
      return this.deduplicateArray([...existing, incoming]);
    }

    if (Array.isArray(incoming)) {
      return this.deduplicateArray([existing, ...incoming]);
    }

    if (existing === incoming) {
      return existing;
    }

    return this.deduplicateArray([existing, incoming]);
  }

  private isPlainObject(value: any): value is Record<string, any> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  private deduplicateArray(values: any[]): any[] {
    const result: any[] = [];
    const primitiveTracker = new Set<string>();

    for (const value of values) {
      if (value === undefined) continue;

      if (value === null) {
        if (!primitiveTracker.has('null')) {
          primitiveTracker.add('null');
          result.push(value);
        }
        continue;
      }

      const type = typeof value;
      if (type === 'string' || type === 'number' || type === 'boolean') {
        const key = `${type}:${value}`;
        if (primitiveTracker.has(key)) continue;
        primitiveTracker.add(key);
        result.push(value);
        continue;
      }

      result.push(value);
    }

    return result;
  }

  private async applyMemoryDecay(): Promise<void> {
    const decayRate = this.memoryDecayRate;
    const archiveThreshold = 2;
    const decayWindowDays = 30;
    const thresholdDate = new Date(
      Date.now() - decayWindowDays * 24 * 60 * 60 * 1000
    );

    const staleMemories = await db
      .select({
        id: agentMemory.id,
        importance: agentMemory.importance,
        metadata: agentMemory.metadata,
        lastAccessed: agentMemory.lastAccessed,
      })
      .from(agentMemory)
      .where(
        and(
          lt(agentMemory.createdAt, thresholdDate),
          sql`COALESCE((${agentMemory.metadata} ->> 'archived')::boolean, false) = false`
        )
      );

    if (!staleMemories.length) {
      return;
    }

    let decayedCount = 0;
    let archivedCount = 0;
    const updatePromises: Promise<any>[] = [];

    for (const memory of staleMemories) {
      if (memory.lastAccessed && memory.lastAccessed > thresholdDate) {
        continue;
      }

      const decayedImportance = memory.importance * decayRate;
      const newImportance = Math.max(1, Math.floor(decayedImportance));
      const shouldArchive = decayedImportance < archiveThreshold;

      const updatePayload: Partial<AgentMemoryEntry> = {};

      if (newImportance !== memory.importance) {
        updatePayload.importance = newImportance;
      }

      if (shouldArchive) {
        updatePayload.metadata = {
          ...(memory.metadata || {}),
          archived: true,
          archivedAt: new Date(),
        };
      }

      if (!Object.keys(updatePayload).length) {
        continue;
      }

      decayedCount += 1;
      if (shouldArchive) {
        archivedCount += 1;
      }

      updatePromises.push(
        agentMemoryService.updateMemory(memory.id, updatePayload)
      );
    }

    if (updatePromises.length) {
      await Promise.all(updatePromises);
    }

    if (decayedCount) {
      console.log(
        `📉 Applied decay to ${decayedCount} memories (${archivedCount} archived)`
      );
    }
  }

  private async updateGlobalPatterns(
    consolidation: MemoryConsolidation
  ): Promise<void> {
    if (!consolidation.patternsExtracted) return;

    try {
      const aggregationState = await this.aggregateGlobalPatternData();
      if (!aggregationState.totalPatterns) {
        return;
      }

      const stats = this.buildGlobalPatternStats(
        aggregationState,
        consolidation
      );
      if (!stats) {
        return;
      }

      await this.persistGlobalPatternKnowledge(stats);
      await this.buildKnowledgeGraph('global');

      console.log(
        `🌐 Updated global patterns with ${stats.totalPatterns} insights across ${stats.agentCount} agents`
      );
    } catch (error) {
      console.error('❌ Failed to update global patterns:', error);
    }
  }

  private async aggregateGlobalPatternData(): Promise<PatternAggregationState> {
    const state = this.createPatternAggregationState();
    let offset = 0;
    let batchIndex = 0;

    while (true) {
      const rows = await this.fetchPatternBatch(
        this.patternAggregationBatchSize,
        offset
      );

      if (!rows.length) {
        break;
      }

      for (const row of rows) {
        if (!this.isPatternKnowledgeEntry(row)) {
          continue;
        }
        this.updatePatternAggregation(state, row);
      }

      offset += rows.length;
      batchIndex += 1;

      if (
        rows.length === this.patternAggregationBatchSize &&
        batchIndex % this.patternAggregationYieldInterval === 0
      ) {
        await this.yieldToEventLoop();
      }
    }

    return state;
  }

  private createPatternAggregationState(): PatternAggregationState {
    return {
      totalPatterns: 0,
      agentSet: new Set<string>(),
      patternTypeCounts: {},
      domainCounts: {},
      contextCounts: {},
      patternAggregates: new Map<string, PatternAggregateEntry>(),
      confidenceAccumulator: 0,
    };
  }

  private isPatternKnowledgeEntry(entry: any): boolean {
    if (!entry) return false;

    const tags: string[] = Array.isArray(entry.tags)
      ? entry.tags.filter((tag: any): tag is string => typeof tag === 'string')
      : [];
    const content = (entry.content ?? {}) as Record<string, unknown>;

    const hasPatternInContent = typeof content.pattern === 'string';
    const hasPatternTag = tags.some((tag: string) =>
      tag.toLowerCase().includes('pattern')
    );
    const isPatternKnowledgeType =
      typeof entry.knowledgeType === 'string' &&
      entry.knowledgeType.toLowerCase() === 'rfp_pattern';

    return hasPatternInContent || isPatternKnowledgeType || hasPatternTag;
  }

  private updatePatternAggregation(
    state: PatternAggregationState,
    entry: any
  ): void {
    state.totalPatterns += 1;
    state.agentSet.add(entry.agentId);

    const tags: string[] = Array.isArray(entry.tags)
      ? entry.tags.filter((tag: any): tag is string => typeof tag === 'string')
      : [];
    const patternType =
      tags.find((tag: string) =>
        ['episodic', 'semantic', 'procedural', 'working'].includes(tag)
      ) || 'semantic';
    state.patternTypeCounts[patternType] =
      (state.patternTypeCounts[patternType] || 0) + 1;

    if (entry.domain) {
      state.domainCounts[entry.domain] =
        (state.domainCounts[entry.domain] || 0) + 1;
    }

    const content = (entry.content ?? {}) as {
      pattern?: string;
      context?: Record<string, unknown>;
    };
    const context = (content.context ?? {}) as Record<string, unknown>;
    for (const [key, value] of Object.entries(context)) {
      if (value === undefined || value === null) continue;
      const normalizedValue = this.normalizeContextValue(value);
      const contextKey = `${key}:${normalizedValue}`;
      state.contextCounts[contextKey] =
        (state.contextCounts[contextKey] || 0) + 1;
    }

    const confidence = Number(entry.confidenceScore ?? 0);
    if (!Number.isNaN(confidence)) {
      state.confidenceAccumulator += confidence;
    }

    const patternLabel =
      typeof content.pattern === 'string' ? content.pattern : entry.title;
    const signature = patternLabel.toLowerCase();

    let aggregate = state.patternAggregates.get(signature);
    if (!aggregate) {
      aggregate = {
        pattern: patternLabel,
        agents: new Set<string>(),
        domains: new Set<string>(),
        type: patternType,
        successSamples: [],
        usage: 0,
        confidenceSum: 0,
        count: 0,
      };
      state.patternAggregates.set(signature, aggregate);
    }

    aggregate.agents.add(entry.agentId);
    if (entry.domain) {
      aggregate.domains.add(entry.domain);
    }
    aggregate.count += 1;
    aggregate.usage += Number(entry.usageCount ?? 0);

    const successValue =
      entry.successRate !== null && entry.successRate !== undefined
        ? Number(entry.successRate)
        : undefined;
    if (successValue !== undefined && !Number.isNaN(successValue)) {
      aggregate.successSamples.push(successValue);
    }

    if (!Number.isNaN(confidence)) {
      aggregate.confidenceSum += confidence;
    }
  }

  private normalizeContextValue(value: unknown): string {
    if (typeof value === 'string') {
      return value.toLowerCase();
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }

    if (Array.isArray(value)) {
      return value.map(item => this.normalizeContextValue(item)).join(',');
    }

    if (value && typeof value === 'object') {
      return JSON.stringify(value);
    }

    return '';
  }

  private buildGlobalPatternStats(
    state: PatternAggregationState,
    consolidation: MemoryConsolidation
  ): GlobalPatternStatsResult | null {
    if (!state.totalPatterns) {
      return null;
    }

    const totalPatterns = state.totalPatterns;
    const mostFrequentPatternTypes = this.formatCountMap(
      state.patternTypeCounts,
      totalPatterns,
      5,
      'type'
    );
    const commonDomains = this.formatCountMap(
      state.domainCounts,
      totalPatterns,
      10,
      'domain'
    );
    const commonContexts = this.formatCountMap(
      state.contextCounts,
      totalPatterns,
      10,
      'context'
    );

    const aggregateEntries = Array.from(state.patternAggregates.values());
    const patternSuccessCorrelations =
      this.createPatternSuccessCorrelations(aggregateEntries);
    const shareablePatterns = this.createShareablePatterns(aggregateEntries);

    const aggregatedConfidence =
      totalPatterns > 0
        ? Number((state.confidenceAccumulator / totalPatterns).toFixed(2))
        : 0.5;

    const agentIds = Array.from(state.agentSet);

    return {
      aggregatedStats: {
        generatedAt: new Date().toISOString(),
        consolidationId: consolidation.id,
        totalPatterns,
        recentPatternsExtracted: consolidation.patternsExtracted,
        agentCoverage: {
          totalAgents: state.agentSet.size,
          agentIds,
        },
        mostFrequentPatternTypes,
        commonDomains,
        commonContexts,
        patternSuccessCorrelations,
        shareablePatterns,
      },
      aggregatedConfidence,
      agentCount: state.agentSet.size,
      totalPatterns,
      agentIds,
    };
  }

  private formatCountMap(
    counts: Record<string, number>,
    total: number,
    limit: number,
    label: 'type'
  ): Array<{ type: string; count: number; ratio: number }>;
  private formatCountMap(
    counts: Record<string, number>,
    total: number,
    limit: number,
    label: 'domain'
  ): Array<{ domain: string; count: number; ratio: number }>;
  private formatCountMap(
    counts: Record<string, number>,
    total: number,
    limit: number,
    label: 'context'
  ): Array<{ context: string; count: number; ratio: number }>;
  private formatCountMap(
    counts: Record<string, number>,
    total: number,
    limit: number,
    label: 'type' | 'domain' | 'context'
  ):
    | Array<{ type: string; count: number; ratio: number }>
    | Array<{ domain: string; count: number; ratio: number }>
    | Array<{ context: string; count: number; ratio: number }> {
    const normalizedTotal = total || 1;
    const baseEntries = Object.entries(counts)
      .map(([key, count]) => ({
        key,
        count,
        ratio: Number((count / normalizedTotal).toFixed(2)),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);

    if (label === 'type') {
      return baseEntries.map(entry => ({
        type: entry.key,
        count: entry.count,
        ratio: entry.ratio,
      }));
    }

    if (label === 'domain') {
      return baseEntries.map(entry => ({
        domain: entry.key,
        count: entry.count,
        ratio: entry.ratio,
      }));
    }

    return baseEntries.map(entry => ({
      context: entry.key,
      count: entry.count,
      ratio: entry.ratio,
    }));
  }

  private createPatternSuccessCorrelations(
    aggregates: PatternAggregateEntry[]
  ): Array<{
    pattern: string;
    type: string;
    domains: string[];
    agentCount: number;
    avgSuccessRate: number | null;
    usage: number;
    avgConfidence: number | null;
  }> {
    return aggregates
      .map(entry => {
        const avgSuccess =
          entry.successSamples.length > 0
            ? Number(
                (
                  entry.successSamples.reduce((sum, value) => sum + value, 0) /
                  entry.successSamples.length
                ).toFixed(2)
              )
            : null;

        const avgConfidence =
          entry.count > 0
            ? Number((entry.confidenceSum / entry.count).toFixed(2))
            : null;

        return {
          pattern: entry.pattern,
          type: entry.type,
          domains: Array.from(entry.domains),
          agentCount: entry.agents.size,
          avgSuccessRate: avgSuccess,
          usage: entry.usage,
          avgConfidence,
        };
      })
      .sort((a, b) => {
        const successA = a.avgSuccessRate ?? 0;
        const successB = b.avgSuccessRate ?? 0;
        if (successB !== successA) return successB - successA;
        return b.usage - a.usage;
      })
      .slice(0, 15);
  }

  private createShareablePatterns(aggregates: PatternAggregateEntry[]): Array<{
    pattern: string;
    type: string;
    agentIds: string[];
    domains: string[];
    avgSuccessRate: number | null;
    usage: number;
  }> {
    return aggregates
      .filter(entry => entry.agents.size > 1)
      .map(entry => {
        const avgSuccess =
          entry.successSamples.length > 0
            ? Number(
                (
                  entry.successSamples.reduce((sum, value) => sum + value, 0) /
                  entry.successSamples.length
                ).toFixed(2)
              )
            : null;

        return {
          pattern: entry.pattern,
          type: entry.type,
          agentIds: Array.from(entry.agents),
          domains: Array.from(entry.domains),
          avgSuccessRate: avgSuccess,
          usage: entry.usage,
        };
      })
      .sort((a, b) => {
        const successA = a.avgSuccessRate ?? 0;
        const successB = b.avgSuccessRate ?? 0;
        if (successB !== successA) return successB - successA;
        return b.usage - a.usage;
      })
      .slice(0, 10);
  }

  private async persistGlobalPatternKnowledge(
    stats: GlobalPatternStatsResult
  ): Promise<void> {
    const [existingGlobalKnowledge] =
      await agentMemoryService.getAgentKnowledge(
        'memory-engine',
        'rfp_pattern',
        'global',
        1
      );

    const knowledgePayload = {
      title: 'Global Pattern Intelligence',
      description: `Aggregated from ${stats.totalPatterns} patterns across ${stats.agentCount} agents`,
      content: stats.aggregatedStats,
      confidenceScore: stats.aggregatedConfidence,
      tags: ['global_pattern_stats', 'consolidated_pattern', 'system_insight'],
    };

    if (existingGlobalKnowledge) {
      await agentMemoryService.updateKnowledge(existingGlobalKnowledge.id, {
        ...knowledgePayload,
      });
    } else {
      await agentMemoryService.storeKnowledge({
        agentId: 'memory-engine',
        knowledgeType: 'rfp_pattern',
        domain: 'global',
        title: knowledgePayload.title,
        description: knowledgePayload.description,
        content: knowledgePayload.content,
        confidenceScore: knowledgePayload.confidenceScore,
        sourceType: 'experience',
        tags: knowledgePayload.tags,
      });
    }
  }

  private async fetchPatternBatch(
    limit: number,
    offset: number
  ): Promise<any[]> {
    return await db
      .select({
        id: agentKnowledgeBase.id,
        agentId: agentKnowledgeBase.agentId,
        domain: agentKnowledgeBase.domain,
        knowledgeType: agentKnowledgeBase.knowledgeType,
        title: agentKnowledgeBase.title,
        tags: agentKnowledgeBase.tags,
        content: agentKnowledgeBase.content,
        successRate: agentKnowledgeBase.successRate,
        usageCount: agentKnowledgeBase.usageCount,
        confidenceScore: agentKnowledgeBase.confidenceScore,
      })
      .from(agentKnowledgeBase)
      .where(sql`${agentKnowledgeBase.domain} != 'global'`)
      .orderBy(asc(agentKnowledgeBase.createdAt))
      .limit(limit)
      .offset(offset);
  }

  private async yieldToEventLoop(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 0));
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
      id: `cluster_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
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

    return Object.keys(tagCounts).filter((tag: string) => {
      return tagCounts[tag] >= Math.ceil(memories.length * 0.5);
    });
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
