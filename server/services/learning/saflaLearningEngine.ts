import OpenAI from 'openai';
import { agentMemoryService } from '../agents/agentMemoryService';

/**
 * SAFLA (Self-Aware Feedback Loop Algorithm) Learning Engine
 *
 * This is the actual implementation of the learning system that:
 * 1. Collects outcome data from agent operations
 * 2. Analyzes patterns and correlations
 * 3. Generates learned strategies
 * 4. Applies learning to improve future operations
 * 5. Tracks improvement metrics over time
 */

if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY environment variable is required');
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface LearningEvent {
  agentId: string;
  taskType: string;
  context: Record<string, any>;
  outcome: {
    success: boolean;
    metrics: Record<string, number>;
    errorDetails?: any;
  };
  timestamp: Date;
}

export interface LearnedStrategy {
  id: string;
  domain: string; // portal_navigation, document_processing, proposal_generation
  strategyType: string;
  strategy: Record<string, any>;
  confidenceScore: number;
  successRate: number;
  sampleSize: number;
  lastApplied?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface LearningInsight {
  pattern: string;
  correlation: number;
  recommendation: string;
  impactEstimate: number; // 0-1
  evidence: string[];
}

export class SAFLALearningEngine {
  private static instance: SAFLALearningEngine;
  private learningEnabled: boolean = true;
  private minSampleSize: number = 10; // Minimum samples before applying learning
  private confidenceThreshold: number = 0.7; // Minimum confidence to apply strategy

  public static getInstance(): SAFLALearningEngine {
    if (!SAFLALearningEngine.instance) {
      SAFLALearningEngine.instance = new SAFLALearningEngine();
    }
    return SAFLALearningEngine.instance;
  }

  /**
   * Core learning method - analyzes outcome and updates strategies
   */
  async learn(event: LearningEvent): Promise<void> {
    if (!this.learningEnabled) return;

    try {
      console.log(
        `🧠 SAFLA Learning from ${event.agentId} - ${event.taskType}`
      );

      // 1. Store the learning event
      await this.storeLearningEvent(event);

      // 2. Analyze patterns in recent similar events
      const patterns = await this.analyzePatterns(event);

      // 3. Update or create learned strategies
      for (const pattern of patterns) {
        await this.updateStrategy(pattern);
      }

      // 4. Trigger strategy consolidation periodically
      if (Math.random() < 0.1) {
        // 10% chance
        await this.consolidateStrategies(event.taskType);
      }

      console.log(
        `✅ SAFLA Learning complete - ${patterns.length} patterns identified`
      );
    } catch (error) {
      console.error('❌ SAFLA Learning error:', error);
    }
  }

  /**
   * Apply learned strategies to a new task
   */
  async applyLearning(
    agentId: string,
    taskType: string,
    context: Record<string, any>
  ): Promise<LearnedStrategy | null> {
    try {
      // Get the best strategy for this task type
      const strategy = await this.getBestStrategy(taskType, context);

      if (!strategy) {
        console.log(`📚 No learned strategy available for ${taskType}`);
        return null;
      }

      if (strategy.confidenceScore < this.confidenceThreshold) {
        console.log(
          `⚠️ Strategy confidence too low (${strategy.confidenceScore}) - not applying`
        );
        return null;
      }

      console.log(
        `🎯 Applying learned strategy for ${taskType} (confidence: ${strategy.confidenceScore})`
      );

      // Update last applied timestamp
      await this.markStrategyApplied(strategy.id);

      return strategy;
    } catch (error) {
      console.error('Error applying learning:', error);
      return null;
    }
  }

  /**
   * Analyze patterns in recent learning events using AI
   */
  private async analyzePatterns(
    event: LearningEvent
  ): Promise<LearningInsight[]> {
    try {
      // Get similar recent events (same task type, last 50 events)
      const memories = await agentMemoryService.getAgentMemories(
        event.agentId,
        'episodic',
        50
      );

      const similarEvents = memories.filter(
        m =>
          m.content.taskType === event.taskType &&
          m.content.timestamp &&
          new Date(m.content.timestamp) >
            new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
      );

      if (similarEvents.length < this.minSampleSize) {
        return []; // Not enough data to learn from
      }

      // Use GPT-5 to identify patterns
      const analysisPrompt = `
You are analyzing agent performance data to identify patterns and strategies for improvement.

Task Type: ${event.taskType}
Agent: ${event.agentId}

Recent Event:
- Success: ${event.outcome.success}
- Metrics: ${JSON.stringify(event.outcome.metrics)}
- Context: ${JSON.stringify(event.context)}

Historical Similar Events: ${similarEvents.length}
Success Rate: ${((similarEvents.filter(e => e.content.outcome?.success).length / similarEvents.length) * 100).toFixed(1)}%

Historical Data Sample:
${similarEvents
  .slice(0, 10)
  .map(
    e => `
- Success: ${e.content.outcome?.success || 'unknown'}
- Context: ${JSON.stringify(e.content.context || {})}
- Metrics: ${JSON.stringify(e.content.outcome?.metrics || {})}
`
  )
  .join('\n')}

Analyze this data and identify:
1. Patterns that correlate with success
2. Context factors that predict outcomes
3. Strategies that could improve performance
4. Specific recommendations

Return your analysis as JSON:
{
  "patterns": [
    {
      "pattern": "Description of pattern",
      "correlation": 0.0-1.0,
      "recommendation": "Specific action to take",
      "impactEstimate": 0.0-1.0,
      "evidence": ["Supporting evidence points"]
    }
  ]
}
`;

      const response = await openai.chat.completions.create({
        model: 'gpt-5',
        messages: [{ role: 'user', content: analysisPrompt }],
        response_format: { type: 'json_object' },
        temperature: 0.3, // Low temperature for consistent analysis
      });

      const analysis = JSON.parse(
        response.choices[0]?.message?.content || '{"patterns":[]}'
      );
      return analysis.patterns || [];
    } catch (error) {
      console.error('Error analyzing patterns:', error);
      return [];
    }
  }

  /**
   * Update or create a learned strategy based on patterns
   */
  private async updateStrategy(insight: LearningInsight): Promise<void> {
    try {
      // Determine domain from pattern
      const domain = this.inferDomain(insight.pattern);

      // Create or update strategy in knowledge base
      await agentMemoryService.createKnowledgeEntry(
        'system', // System-wide learning
        {
          domain,
          knowledgeType: 'strategy',
          title: insight.pattern,
          content: {
            pattern: insight.pattern,
            correlation: insight.correlation,
            recommendation: insight.recommendation,
            impactEstimate: insight.impactEstimate,
            evidence: insight.evidence,
          },
          tags: [domain, 'learned_strategy', 'safla'],
          metadata: {
            confidenceScore: insight.correlation,
            lastUpdated: new Date().toISOString(),
          },
        }
      );

      console.log(`📝 Updated strategy: ${insight.pattern}`);
    } catch (error) {
      console.error('Error updating strategy:', error);
    }
  }

  /**
   * Get the best learned strategy for a task
   */
  private async getBestStrategy(
    taskType: string,
    context: Record<string, any>
  ): Promise<LearnedStrategy | null> {
    try {
      const domain = this.inferDomainFromTaskType(taskType);

      const strategies = await agentMemoryService.getRelevantKnowledge(
        'system',
        {
          domain,
          knowledgeType: 'strategy',
        },
        10
      );

      if (strategies.length === 0) return null;

      // Score strategies based on relevance to current context
      const scoredStrategies = strategies.map(s => ({
        strategy: s,
        score: this.scoreStrategyRelevance(s, context),
      }));

      // Sort by score and return best
      scoredStrategies.sort((a, b) => b.score - a.score);
      const best = scoredStrategies[0];

      if (!best || best.score < 0.5) return null;

      return {
        id: best.strategy.id,
        domain,
        strategyType: taskType,
        strategy: best.strategy.content,
        confidenceScore: best.strategy.metadata?.confidenceScore || 0,
        successRate: best.strategy.metadata?.successRate || 0,
        sampleSize: best.strategy.metadata?.sampleSize || 0,
        createdAt: best.strategy.createdAt,
        updatedAt: best.strategy.updatedAt,
      };
    } catch (error) {
      console.error('Error getting best strategy:', error);
      return null;
    }
  }

  /**
   * Score how relevant a strategy is to current context
   */
  private scoreStrategyRelevance(
    strategy: any,
    context: Record<string, any>
  ): number {
    let score = 0.5; // Base score

    // Higher confidence = higher relevance
    if (strategy.metadata?.confidenceScore) {
      score += strategy.metadata.confidenceScore * 0.3;
    }

    // Recent strategies are more relevant
    const daysSinceUpdate =
      (Date.now() - new Date(strategy.updatedAt).getTime()) /
      (1000 * 60 * 60 * 24);
    const recencyBonus = Math.max(0, 1 - daysSinceUpdate / 30) * 0.2;
    score += recencyBonus;

    return Math.min(1, score);
  }

  /**
   * Store learning event in memory
   */
  private async storeLearningEvent(event: LearningEvent): Promise<void> {
    await agentMemoryService.createMemory(
      event.agentId,
      'episodic',
      {
        taskType: event.taskType,
        context: event.context,
        outcome: event.outcome,
        timestamp: event.timestamp.toISOString(),
      },
      {
        tags: [
          event.taskType,
          'learning_event',
          event.outcome.success ? 'success' : 'failure',
        ],
        importance: event.outcome.success ? 6 : 8, // Failures are more important to learn from (scale 1-10)
      }
    );
  }

  /**
   * Periodically consolidate strategies (merge similar ones, prune low-confidence)
   */
  private async consolidateStrategies(taskType: string): Promise<void> {
    console.log(`🔄 Consolidating strategies for ${taskType}...`);

    const domain = this.inferDomainFromTaskType(taskType);
    const strategies = await agentMemoryService.getRelevantKnowledge(
      'system',
      { domain, knowledgeType: 'strategy' },
      100
    );

    // Prune low-confidence strategies with small sample sizes
    for (const strategy of strategies) {
      const confidence = strategy.metadata?.confidenceScore || 0;
      const sampleSize = strategy.metadata?.sampleSize || 0;

      if (confidence < 0.4 && sampleSize < 20) {
        // Delete low-confidence, low-sample strategies
        await agentMemoryService.deleteMemory(strategy.id);
        console.log(`🗑️ Pruned low-confidence strategy: ${strategy.title}`);
      }
    }
  }

  /**
   * Mark strategy as applied (for tracking usage)
   */
  private async markStrategyApplied(strategyId: string): Promise<void> {
    // Update metadata to track when strategy was last applied
    // This helps identify which strategies are actually useful
    const memory = await agentMemoryService.getMemoryById(strategyId);
    if (memory) {
      const metadata = memory.metadata || {};
      metadata.lastApplied = new Date().toISOString();
      metadata.timesApplied = (metadata.timesApplied || 0) + 1;

      // Update memory with new metadata
      await agentMemoryService.updateMemoryMetadata(strategyId, metadata);
    }
  }

  /**
   * Infer domain from pattern text
   */
  private inferDomain(pattern: string): string {
    const lowerPattern = pattern.toLowerCase();

    if (
      lowerPattern.includes('portal') ||
      lowerPattern.includes('scan') ||
      lowerPattern.includes('scrape')
    ) {
      return 'portal_navigation';
    }
    if (
      lowerPattern.includes('document') ||
      lowerPattern.includes('parse') ||
      lowerPattern.includes('extract')
    ) {
      return 'document_processing';
    }
    if (
      lowerPattern.includes('proposal') ||
      lowerPattern.includes('generation') ||
      lowerPattern.includes('compliance')
    ) {
      return 'proposal_generation';
    }

    return 'general';
  }

  /**
   * Infer domain from task type
   */
  private inferDomainFromTaskType(taskType: string): string {
    if (taskType.includes('portal') || taskType.includes('scan')) {
      return 'portal_navigation';
    }
    if (taskType.includes('document') || taskType.includes('parse')) {
      return 'document_processing';
    }
    if (taskType.includes('proposal') || taskType.includes('generation')) {
      return 'proposal_generation';
    }

    return 'general';
  }

  /**
   * Get learning events for a specific agent and task type
   */
  async getEvents(
    agentId: string,
    taskType?: string,
    limit: number = 100
  ): Promise<any[]> {
    try {
      const memories = await agentMemoryService.getAgentMemories(
        agentId,
        'episodic',
        limit
      );

      const events = memories.filter(m => m.tags?.includes('learning_event'));

      if (taskType) {
        return events.filter(e => e.content.taskType === taskType);
      }

      return events;
    } catch (error) {
      console.error('Error getting learning events:', error);
      return [];
    }
  }

  /**
   * Get learning metrics for monitoring
   */
  async getLearningMetrics(): Promise<{
    totalEvents: number;
    activeStrategies: number;
    averageConfidence: number;
    successRateImprovement: number;
  }> {
    try {
      // Count total learning events
      const allMemories = await agentMemoryService.getAgentMemories(
        'system',
        'episodic',
        1000
      );
      const learningEvents = allMemories.filter(m =>
        m.tags?.includes('learning_event')
      );

      // Count active strategies
      const strategies = await agentMemoryService.getRelevantKnowledge(
        'system',
        { knowledgeType: 'strategy' },
        1000
      );

      // Calculate average confidence
      const confidenceScores = strategies
        .map(s => s.metadata?.confidenceScore || 0)
        .filter(c => c > 0);
      const averageConfidence =
        confidenceScores.length > 0
          ? confidenceScores.reduce((a, b) => a + b, 0) /
            confidenceScores.length
          : 0;

      // Calculate success rate improvement (compare recent vs historical)
      const recentEvents = learningEvents.filter(
        e =>
          e.createdAt &&
          new Date(e.createdAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
      );
      const historicalEvents = learningEvents.filter(
        e =>
          e.createdAt &&
          new Date(e.createdAt) <=
            new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      );

      const recentSuccess =
        recentEvents.length > 0
          ? recentEvents.filter(e => e.content.outcome?.success).length /
            recentEvents.length
          : 0;
      const historicalSuccess =
        historicalEvents.length > 0
          ? historicalEvents.filter(e => e.content.outcome?.success).length /
            historicalEvents.length
          : 0;

      const successRateImprovement =
        historicalSuccess > 0
          ? (recentSuccess - historicalSuccess) / historicalSuccess
          : 0;

      return {
        totalEvents: learningEvents.length,
        activeStrategies: strategies.length,
        averageConfidence,
        successRateImprovement,
      };
    } catch (error) {
      console.error('Error getting learning metrics:', error);
      return {
        totalEvents: 0,
        activeStrategies: 0,
        averageConfidence: 0,
        successRateImprovement: 0,
      };
    }
  }
}

export const saflaLearningEngine = SAFLALearningEngine.getInstance();
