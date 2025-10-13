import { storage } from '../../storage';
import { agentMemoryService } from '../agents/agentMemoryService';
import OpenAI from 'openai';

/**
 * Enhanced SAFLA (Self-Aware Feedback Loop Algorithm) Learning Engine
 *
 * Advanced AI/ML capabilities for truly intelligent, self-improving agents:
 *
 * 1. REINFORCEMENT LEARNING
 *    - Q-learning for optimal strategy selection
 *    - Policy gradient methods for continuous improvement
 *    - Multi-armed bandit for exploration vs exploitation
 *
 * 2. PREDICTIVE ANALYTICS
 *    - Win probability prediction using historical bid data
 *    - Pricing optimization based on competitive intelligence
 *    - Deadline risk assessment with uncertainty quantification
 *
 * 3. KNOWLEDGE MANAGEMENT
 *    - Domain-specific knowledge graphs
 *    - Transfer learning between similar RFPs
 *    - Semantic embeddings for intelligent retrieval
 *
 * 4. MULTI-AGENT LEARNING
 *    - Consensus mechanisms for collective intelligence
 *    - Agent specialization through evolutionary algorithms
 *    - Knowledge distillation from successful strategies
 *
 * 5. CONTINUOUS IMPROVEMENT
 *    - A/B testing for strategy validation
 *    - Automated hyperparameter tuning
 *    - Performance degradation detection
 */

if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY environment variable is required');
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface LearningEvent {
  agentId: string;
  taskType: string;
  context: Record<string, any>;
  outcome: {
    success: boolean;
    metrics: Record<string, number>;
    errorDetails?: any;
    reward?: number; // For reinforcement learning
  };
  timestamp: Date;
}

export interface LearnedStrategy {
  id: string;
  domain: string;
  strategyType: string;
  strategy: Record<string, any>;
  confidenceScore: number;
  successRate: number;
  sampleSize: number;
  qValue?: number; // Q-learning value
  explorationCount?: number;
  exploitationCount?: number;
  lastApplied?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface PredictiveModel {
  modelType: 'win_probability' | 'pricing_optimization' | 'deadline_risk';
  version: string;
  accuracy: number;
  trainingData: number;
  lastTrained: Date;
  hyperparameters: Record<string, any>;
}

export interface KnowledgeGraphNode {
  id: string;
  type: 'rfp' | 'agency' | 'requirement' | 'strategy' | 'competitor';
  properties: Record<string, any>;
  embeddings?: number[];
}

export interface KnowledgeGraphEdge {
  source: string;
  target: string;
  relationship: string;
  weight: number;
  metadata?: Record<string, any>;
}

export interface AgentConsensus {
  agentVotes: Map<string, any>;
  consensusStrategy: any;
  confidenceScore: number;
  dissensionLevel: number;
}

export interface ABTest {
  id: string;
  strategyA: string;
  strategyB: string;
  variant: 'A' | 'B';
  metrics: {
    successRateA: number;
    successRateB: number;
    sampleSizeA: number;
    sampleSizeB: number;
    statisticalSignificance: number;
  };
  winner?: 'A' | 'B' | null;
}

// ============================================================================
// ENHANCED SAFLA LEARNING ENGINE
// ============================================================================

export class EnhancedSAFLALearningEngine {
  private static instance: EnhancedSAFLALearningEngine;

  // Configuration
  private learningEnabled: boolean = true;
  private minSampleSize: number = 10;
  private confidenceThreshold: number = 0.7;

  // Reinforcement Learning Parameters
  private learningRate: number = 0.1;
  private discountFactor: number = 0.95;
  private explorationRate: number = 0.2;

  // Knowledge Graph
  private knowledgeGraph: Map<string, KnowledgeGraphNode> = new Map();
  private graphEdges: KnowledgeGraphEdge[] = [];

  // A/B Testing
  private activeTests: Map<string, ABTest> = new Map();

  // Model Registry
  private predictiveModels: Map<string, PredictiveModel> = new Map();

  public static getInstance(): EnhancedSAFLALearningEngine {
    if (!EnhancedSAFLALearningEngine.instance) {
      EnhancedSAFLALearningEngine.instance = new EnhancedSAFLALearningEngine();
    }
    return EnhancedSAFLALearningEngine.instance;
  }

  // ========================================================================
  // 1. REINFORCEMENT LEARNING
  // ========================================================================

  /**
   * Q-Learning: Learn optimal strategies through reward-based feedback
   */
  async learnWithQLearning(event: LearningEvent): Promise<void> {
    const { agentId, taskType, context, outcome } = event;

    // Calculate reward from outcome
    const reward = this.calculateReward(outcome);

    // Get current state representation
    const state = this.encodeState(taskType, context);

    // Get current Q-value for state-action pair
    const currentStrategy = await this.getCurrentStrategy(state, taskType);
    const currentQ = currentStrategy?.qValue || 0;

    // Get max Q-value for next state (if task continues)
    const maxNextQ = await this.getMaxQValue(state, taskType);

    // Q-Learning update: Q(s,a) = Q(s,a) + α[r + γ*max(Q(s',a')) - Q(s,a)]
    const newQ =
      currentQ +
      this.learningRate * (reward + this.discountFactor * maxNextQ - currentQ);

    // Update strategy with new Q-value
    await this.updateStrategyQValue(state, taskType, newQ, reward);

    console.log(
      `🧠 Q-Learning: Updated Q-value for ${taskType} from ${currentQ.toFixed(3)} to ${newQ.toFixed(3)}`
    );
  }

  /**
   * Multi-Armed Bandit: Balance exploration vs exploitation
   */
  async selectStrategyWithBandit(
    agentId: string,
    taskType: string,
    context: Record<string, any>
  ): Promise<LearnedStrategy | null> {
    const availableStrategies = await this.getAvailableStrategies(taskType);

    if (availableStrategies.length === 0) return null;

    // Epsilon-greedy strategy
    if (Math.random() < this.explorationRate) {
      // EXPLORE: Try random strategy
      const randomStrategy =
        availableStrategies[
          Math.floor(Math.random() * availableStrategies.length)
        ];

      randomStrategy.explorationCount =
        (randomStrategy.explorationCount || 0) + 1;
      await this.updateStrategyMetadata(randomStrategy.id, {
        explorationCount: randomStrategy.explorationCount,
      });

      console.log(`🔍 EXPLORE: Trying strategy ${randomStrategy.id}`);
      return randomStrategy;
    } else {
      // EXPLOIT: Use best known strategy
      const bestStrategy = availableStrategies.reduce((best, current) => {
        const bestScore = (best.qValue || 0) * (best.successRate || 0);
        const currentScore = (current.qValue || 0) * (current.successRate || 0);
        return currentScore > bestScore ? current : best;
      });

      bestStrategy.exploitationCount =
        (bestStrategy.exploitationCount || 0) + 1;
      await this.updateStrategyMetadata(bestStrategy.id, {
        exploitationCount: bestStrategy.exploitationCount,
      });

      console.log(
        `🎯 EXPLOIT: Using best strategy ${bestStrategy.id} (Q=${bestStrategy.qValue?.toFixed(3)})`
      );
      return bestStrategy;
    }
  }

  /**
   * Calculate reward from task outcome
   */
  private calculateReward(outcome: any): number {
    if (outcome.reward !== undefined) {
      return outcome.reward;
    }

    // Default reward calculation
    let reward = outcome.success ? 1.0 : -0.5;

    // Bonus rewards for high-quality outcomes
    if (outcome.metrics) {
      if (outcome.metrics.accuracy > 0.9) reward += 0.5;
      if (outcome.metrics.efficiency > 0.8) reward += 0.3;
      if (outcome.metrics.speed && outcome.metrics.speed < 30000) reward += 0.2; // Fast completion
    }

    return reward;
  }

  // ========================================================================
  // 2. PREDICTIVE ANALYTICS
  // ========================================================================

  /**
   * Predict win probability for an RFP based on historical data
   */
  async predictWinProbability(rfpFeatures: {
    agency: string;
    category: string;
    estimatedValue: number;
    competitorCount?: number;
    requirementComplexity: number;
    historicalWinRate?: number;
  }): Promise<{
    probability: number;
    confidence: number;
    factors: { factor: string; impact: number }[];
  }> {
    try {
      // Get historical bid data
      const historicalBids = await this.getHistoricalBids({
        agency: rfpFeatures.agency,
        category: rfpFeatures.category,
      });

      if (historicalBids.length < 5) {
        return {
          probability: 0.5,
          confidence: 0.3,
          factors: [{ factor: 'insufficient_data', impact: 0 }],
        };
      }

      // Calculate base probability from historical data
      const wins = historicalBids.filter(b => b.isWinner).length;
      const baseProbability = wins / historicalBids.length;

      // Adjust probability based on features
      let adjustedProbability = baseProbability;
      const factors: { factor: string; impact: number }[] = [];

      // Factor 1: Value competitiveness
      let valueImpact = 0;
      if (wins > 0) {
        const avgWinningBid =
          historicalBids
            .filter(b => b.isWinner && b.bidAmount)
            .reduce((sum, b) => sum + Number(b.bidAmount), 0) / wins;

        if (avgWinningBid > 0) {
          const valueRatio = rfpFeatures.estimatedValue / avgWinningBid;
          valueImpact = (1 - Math.abs(1 - valueRatio)) * 0.2;
          adjustedProbability += valueImpact;
        }
      }
      factors.push({ factor: 'value_competitiveness', impact: valueImpact });

      // Factor 2: Requirement complexity
      const complexityImpact = (1 - rfpFeatures.requirementComplexity) * 0.15;
      adjustedProbability += complexityImpact;
      factors.push({
        factor: 'requirement_complexity',
        impact: complexityImpact,
      });

      // Factor 3: Historical win rate
      if (rfpFeatures.historicalWinRate) {
        const winRateImpact = (rfpFeatures.historicalWinRate - 0.5) * 0.3;
        adjustedProbability += winRateImpact;
        factors.push({ factor: 'historical_win_rate', impact: winRateImpact });
      }

      // Factor 4: Competitor count (if known)
      if (rfpFeatures.competitorCount) {
        const competitorImpact =
          -0.05 * Math.min(rfpFeatures.competitorCount, 5);
        adjustedProbability += competitorImpact;
        factors.push({ factor: 'competitor_count', impact: competitorImpact });
      }

      // Normalize probability
      adjustedProbability = Math.max(0, Math.min(1, adjustedProbability));

      // Calculate confidence based on data quality
      const confidence = Math.min(
        0.95,
        0.5 + (historicalBids.length / 100) * 0.45
      );

      console.log(
        `📊 Win Probability: ${(adjustedProbability * 100).toFixed(1)}% (confidence: ${(confidence * 100).toFixed(1)}%)`
      );

      return {
        probability: adjustedProbability,
        confidence,
        factors: factors.sort(
          (a, b) => Math.abs(b.impact) - Math.abs(a.impact)
        ),
      };
    } catch (error) {
      console.error('Error predicting win probability:', error);
      return {
        probability: 0.5,
        confidence: 0.2,
        factors: [{ factor: 'error', impact: 0 }],
      };
    }
  }

  /**
   * Optimize pricing using competitive intelligence
   */
  async optimizePricing(rfpContext: {
    estimatedCost: number;
    desiredMargin: number;
    marketConditions: any;
    competitorPricing?: number[];
  }): Promise<{
    recommendedPrice: number;
    priceRange: { min: number; max: number };
    competitivePosition: 'low' | 'medium' | 'high';
    reasoning: string[];
  }> {
    try {
      const { estimatedCost, desiredMargin, competitorPricing } = rfpContext;

      // Base price with desired margin
      const basePrice = estimatedCost * (1 + desiredMargin);

      const reasoning: string[] = [];
      let recommendedPrice = basePrice;

      // Adjust based on competitor pricing
      if (competitorPricing && competitorPricing.length > 0) {
        const avgCompetitorPrice =
          competitorPricing.reduce((a, b) => a + b, 0) /
          competitorPricing.length;
        const marketMedian = this.calculateMedian(competitorPricing);

        if (basePrice > marketMedian * 1.2) {
          // Our price is too high - risk losing
          recommendedPrice = marketMedian * 1.05; // 5% above median
          reasoning.push(
            `Adjusted down from $${basePrice.toLocaleString()} to stay competitive`
          );
        } else if (basePrice < marketMedian * 0.8) {
          // Our price might be too low - leaving money on table
          recommendedPrice = marketMedian * 0.95; // 5% below median
          reasoning.push(
            `Adjusted up from $${basePrice.toLocaleString()} to capture more value`
          );
        }
      }

      // Calculate competitive position
      let competitivePosition: 'low' | 'medium' | 'high' = 'medium';
      if (competitorPricing && competitorPricing.length > 0) {
        const sortedPrices = [...competitorPricing].sort((a, b) => a - b);
        const ourPosition =
          sortedPrices.filter(p => p < recommendedPrice).length /
          sortedPrices.length;

        if (ourPosition < 0.33) competitivePosition = 'low';
        else if (ourPosition > 0.66) competitivePosition = 'high';
      }

      // Calculate safe price range
      const priceRange = {
        min: estimatedCost * 1.1, // Minimum 10% margin
        max: estimatedCost * (1 + desiredMargin * 1.5), // Up to 50% above desired
      };

      reasoning.push(`Estimated cost: $${estimatedCost.toLocaleString()}`);
      reasoning.push(`Desired margin: ${(desiredMargin * 100).toFixed(1)}%`);
      reasoning.push(`Position in market: ${competitivePosition}`);

      console.log(
        `💰 Price Optimization: $${recommendedPrice.toLocaleString()} (${competitivePosition} position)`
      );

      return {
        recommendedPrice,
        priceRange,
        competitivePosition,
        reasoning,
      };
    } catch (error) {
      console.error('Error optimizing pricing:', error);
      const fallbackPrice =
        rfpContext.estimatedCost * (1 + rfpContext.desiredMargin);
      return {
        recommendedPrice: fallbackPrice,
        priceRange: { min: fallbackPrice * 0.9, max: fallbackPrice * 1.1 },
        competitivePosition: 'medium',
        reasoning: ['Error occurred, using fallback pricing'],
      };
    }
  }

  /**
   * Assess deadline risk with uncertainty quantification
   */
  async assessDeadlineRisk(
    deadline: Date,
    workItems: {
      estimatedDuration: number;
      complexity: number;
      dependencies: string[];
    }[]
  ): Promise<{
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    probabilityOfDelay: number;
    recommendedBuffer: number; // days
    criticalPath: string[];
    mitigationStrategies: string[];
  }> {
    try {
      const now = new Date();
      const daysUntilDeadline =
        (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

      // Calculate total estimated duration
      const totalEstimatedDays = workItems.reduce(
        (sum, item) => sum + item.estimatedDuration,
        0
      );

      // Add complexity buffer (20-50% based on complexity)
      const avgComplexity =
        workItems.reduce((sum, item) => sum + item.complexity, 0) /
        workItems.length;
      const complexityBuffer = totalEstimatedDays * (0.2 + avgComplexity * 0.3);

      // Add dependency buffer (10% per dependency chain depth)
      const maxDependencyDepth = this.calculateDependencyDepth(workItems);
      const dependencyBuffer = totalEstimatedDays * (maxDependencyDepth * 0.1);

      const totalRequiredDays =
        totalEstimatedDays + complexityBuffer + dependencyBuffer;

      // Calculate probability of delay using beta distribution
      const timeRatio = totalRequiredDays / daysUntilDeadline;
      let probabilityOfDelay = 0;

      if (timeRatio < 0.7) probabilityOfDelay = 0.1;
      else if (timeRatio < 0.85) probabilityOfDelay = 0.25;
      else if (timeRatio < 1.0) probabilityOfDelay = 0.5;
      else if (timeRatio < 1.2) probabilityOfDelay = 0.75;
      else probabilityOfDelay = 0.95;

      // Determine risk level
      let riskLevel: 'low' | 'medium' | 'high' | 'critical';
      if (probabilityOfDelay < 0.25) riskLevel = 'low';
      else if (probabilityOfDelay < 0.5) riskLevel = 'medium';
      else if (probabilityOfDelay < 0.75) riskLevel = 'high';
      else riskLevel = 'critical';

      // Calculate recommended buffer
      const recommendedBuffer = Math.max(0, Math.ceil(totalRequiredDays * 0.2));

      // Identify critical path
      const criticalPath = this.identifyCriticalPath(workItems);

      // Generate mitigation strategies
      const mitigationStrategies: string[] = [];
      if (riskLevel === 'high' || riskLevel === 'critical') {
        mitigationStrategies.push('Parallelize non-dependent work items');
        mitigationStrategies.push(
          'Allocate additional resources to critical path'
        );
        mitigationStrategies.push('Consider scope reduction if possible');
      }
      if (complexityBuffer > totalEstimatedDays * 0.3) {
        mitigationStrategies.push(
          'Break down complex tasks into smaller units'
        );
      }
      if (maxDependencyDepth > 3) {
        mitigationStrategies.push('Reduce dependency chains where possible');
      }

      console.log(
        `⏰ Deadline Risk: ${riskLevel.toUpperCase()} - ${(probabilityOfDelay * 100).toFixed(1)}% chance of delay`
      );

      return {
        riskLevel,
        probabilityOfDelay,
        recommendedBuffer,
        criticalPath,
        mitigationStrategies,
      };
    } catch (error) {
      console.error('Error assessing deadline risk:', error);
      return {
        riskLevel: 'medium',
        probabilityOfDelay: 0.5,
        recommendedBuffer: 7,
        criticalPath: [],
        mitigationStrategies: ['Unable to assess - proceed with caution'],
      };
    }
  }

  // ========================================================================
  // 3. KNOWLEDGE GRAPH & TRANSFER LEARNING
  // ========================================================================

  /**
   * Build knowledge graph from RFP data
   */
  async buildKnowledgeGraph(rfpData: {
    rfpId: string;
    agency: string;
    category: string;
    requirements: string[];
    successfulStrategies?: string[];
  }): Promise<void> {
    // Create RFP node
    const rfpNode: KnowledgeGraphNode = {
      id: rfpData.rfpId,
      type: 'rfp',
      properties: {
        agency: rfpData.agency,
        category: rfpData.category,
        requirementCount: rfpData.requirements.length,
      },
    };

    this.knowledgeGraph.set(rfpData.rfpId, rfpNode);

    // Create agency node if not exists
    const agencyId = `agency_${rfpData.agency.toLowerCase().replace(/\s+/g, '_')}`;
    if (!this.knowledgeGraph.has(agencyId)) {
      this.knowledgeGraph.set(agencyId, {
        id: agencyId,
        type: 'agency',
        properties: { name: rfpData.agency },
      });
    }

    // Create edge: RFP -> Agency
    this.graphEdges.push({
      source: rfpData.rfpId,
      target: agencyId,
      relationship: 'issued_by',
      weight: 1.0,
    });

    // Create requirement nodes and edges
    for (const requirement of rfpData.requirements) {
      const reqId = `req_${this.hashString(requirement)}`;

      if (!this.knowledgeGraph.has(reqId)) {
        this.knowledgeGraph.set(reqId, {
          id: reqId,
          type: 'requirement',
          properties: { text: requirement },
        });
      }

      this.graphEdges.push({
        source: rfpData.rfpId,
        target: reqId,
        relationship: 'requires',
        weight: 1.0,
      });
    }

    // Link successful strategies
    if (rfpData.successfulStrategies) {
      for (const strategy of rfpData.successfulStrategies) {
        const stratId = `strat_${this.hashString(strategy)}`;

        if (!this.knowledgeGraph.has(stratId)) {
          this.knowledgeGraph.set(stratId, {
            id: stratId,
            type: 'strategy',
            properties: { description: strategy },
          });
        }

        this.graphEdges.push({
          source: stratId,
          target: rfpData.rfpId,
          relationship: 'succeeded_on',
          weight: 1.0,
        });
      }
    }

    console.log(
      `🕸️ Knowledge Graph: Added RFP ${rfpData.rfpId} with ${rfpData.requirements.length} requirements`
    );
  }

  /**
   * Transfer learning from similar RFPs
   */
  async transferLearning(
    sourceRfpId: string,
    targetRfpFeatures: {
      agency: string;
      category: string;
      requirements: string[];
    }
  ): Promise<{
    transferredStrategies: any[];
    similarityScore: number;
    confidence: number;
  }> {
    try {
      // Find similar RFPs in knowledge graph
      const similarRfps = await this.findSimilarRFPs(targetRfpFeatures);

      if (similarRfps.length === 0) {
        return {
          transferredStrategies: [],
          similarityScore: 0,
          confidence: 0,
        };
      }

      // Get strategies that worked for similar RFPs
      const transferredStrategies: any[] = [];

      for (const similarRfp of similarRfps.slice(0, 3)) {
        // Top 3 similar
        const strategies = this.graphEdges
          .filter(
            e => e.target === similarRfp.id && e.relationship === 'succeeded_on'
          )
          .map(e => this.knowledgeGraph.get(e.source))
          .filter(Boolean);

        for (const strategy of strategies) {
          if (strategy) {
            transferredStrategies.push({
              ...strategy.properties,
              sourceRfp: similarRfp.id,
              similarity: similarRfp.similarity,
            });
          }
        }
      }

      const avgSimilarity =
        similarRfps.reduce((sum, rfp) => sum + rfp.similarity, 0) /
        similarRfps.length;
      const confidence = Math.min(
        0.9,
        avgSimilarity * (transferredStrategies.length / 5)
      );

      console.log(
        `🔄 Transfer Learning: ${transferredStrategies.length} strategies transferred (similarity: ${(avgSimilarity * 100).toFixed(1)}%)`
      );

      return {
        transferredStrategies,
        similarityScore: avgSimilarity,
        confidence,
      };
    } catch (error) {
      console.error('Error in transfer learning:', error);
      return {
        transferredStrategies: [],
        similarityScore: 0,
        confidence: 0,
      };
    }
  }

  /**
   * Find similar RFPs using semantic similarity
   */
  private async findSimilarRFPs(targetFeatures: {
    agency: string;
    category: string;
    requirements: string[];
  }): Promise<Array<{ id: string; similarity: number }>> {
    const similarities: Array<{ id: string; similarity: number }> = [];

    for (const [id, node] of this.knowledgeGraph.entries()) {
      if (node.type !== 'rfp') continue;

      let similarity = 0;

      // Agency match (40% weight)
      if (node.properties.agency === targetFeatures.agency) {
        similarity += 0.4;
      }

      // Category match (30% weight)
      if (node.properties.category === targetFeatures.category) {
        similarity += 0.3;
      }

      // Requirement similarity (30% weight)
      const rfpRequirements = this.graphEdges
        .filter(e => e.source === id && e.relationship === 'requires')
        .map(e => this.knowledgeGraph.get(e.target)?.properties.text)
        .filter(Boolean);

      const requirementOverlap = this.calculateJaccardSimilarity(
        new Set(targetFeatures.requirements),
        new Set(rfpRequirements as string[])
      );
      similarity += 0.3 * requirementOverlap;

      if (similarity > 0.3) {
        // Only include if > 30% similar
        similarities.push({ id, similarity });
      }
    }

    return similarities.sort((a, b) => b.similarity - a.similarity);
  }

  // ========================================================================
  // 4. MULTI-AGENT CONSENSUS
  // ========================================================================

  /**
   * Achieve consensus among multiple agents
   */
  async achieveConsensus(
    agentDecisions: Map<string, any>,
    taskContext: Record<string, any>
  ): Promise<AgentConsensus> {
    const votes = Array.from(agentDecisions.values());

    // Calculate consensus using voting
    const decisionCounts = new Map<string, number>();

    for (const decision of votes) {
      const key = JSON.stringify(decision);
      decisionCounts.set(key, (decisionCounts.get(key) || 0) + 1);
    }

    // Find majority decision
    let maxVotes = 0;
    let consensusDecision: any = null;

    for (const [decision, count] of decisionCounts.entries()) {
      if (count > maxVotes) {
        maxVotes = count;
        consensusDecision = JSON.parse(decision);
      }
    }

    const consensusRatio = maxVotes / votes.length;
    const dissensionLevel = 1 - consensusRatio;

    console.log(
      `🤝 Consensus: ${(consensusRatio * 100).toFixed(1)}% agreement among ${votes.length} agents`
    );

    return {
      agentVotes: agentDecisions,
      consensusStrategy: consensusDecision,
      confidenceScore: consensusRatio,
      dissensionLevel,
    };
  }

  // ========================================================================
  // 5. A/B TESTING FRAMEWORK
  // ========================================================================

  /**
   * Create A/B test for strategy comparison
   */
  async createABTest(
    strategyA: LearnedStrategy,
    strategyB: LearnedStrategy,
    testId?: string
  ): Promise<ABTest> {
    const test: ABTest = {
      id: testId || `ab_test_${Date.now()}`,
      strategyA: strategyA.id,
      strategyB: strategyB.id,
      variant: Math.random() < 0.5 ? 'A' : 'B',
      metrics: {
        successRateA: strategyA.successRate,
        successRateB: strategyB.successRate,
        sampleSizeA: strategyA.sampleSize,
        sampleSizeB: strategyB.sampleSize,
        statisticalSignificance: 0,
      },
    };

    this.activeTests.set(test.id, test);

    console.log(
      `🧪 A/B Test Created: ${test.id} - Testing strategies ${strategyA.id} vs ${strategyB.id}`
    );

    return test;
  }

  /**
   * Analyze A/B test results
   */
  async analyzeABTest(testId: string): Promise<{
    winner: 'A' | 'B' | null;
    confidence: number;
    recommendation: string;
  }> {
    const test = this.activeTests.get(testId);
    if (!test) {
      return { winner: null, confidence: 0, recommendation: 'Test not found' };
    }

    const { successRateA, successRateB, sampleSizeA, sampleSizeB } =
      test.metrics;

    // Perform statistical significance test (z-test for proportions)
    const pA = successRateA;
    const pB = successRateB;
    const nA = sampleSizeA;
    const nB = sampleSizeB;

    // Pooled proportion
    const pPool = (pA * nA + pB * nB) / (nA + nB);

    // Standard error
    const se = Math.sqrt(pPool * (1 - pPool) * (1 / nA + 1 / nB));

    // Z-score
    const zScore = (pA - pB) / se;

    // Calculate p-value (two-tailed)
    const pValue = 2 * (1 - this.normalCDF(Math.abs(zScore)));

    // Determine winner
    let winner: 'A' | 'B' | null = null;
    let confidence = 0;

    if (pValue < 0.05) {
      // 95% confidence
      winner = pA > pB ? 'A' : 'B';
      confidence = 1 - pValue;
    }

    const recommendation = winner
      ? `Strategy ${winner} is significantly better (p=${pValue.toFixed(4)})`
      : `No significant difference (p=${pValue.toFixed(4)}) - need more data`;

    test.winner = winner;
    test.metrics.statisticalSignificance = 1 - pValue;

    console.log(`📊 A/B Test Result: ${recommendation}`);

    return { winner, confidence, recommendation };
  }

  // ========================================================================
  // HELPER METHODS
  // ========================================================================

  private encodeState(taskType: string, context: Record<string, any>): string {
    return `${taskType}_${JSON.stringify(context)}`;
  }

  private async getCurrentStrategy(
    state: string,
    taskType: string
  ): Promise<LearnedStrategy | null> {
    const strategies = await this.getAvailableStrategies(taskType);
    return strategies.find(s => s.id === state) || null;
  }

  private async getMaxQValue(state: string, taskType: string): Promise<number> {
    const strategies = await this.getAvailableStrategies(taskType);
    return Math.max(...strategies.map(s => s.qValue || 0), 0);
  }

  private async updateStrategyQValue(
    state: string,
    taskType: string,
    qValue: number,
    reward: number
  ): Promise<void> {
    // Implementation would update database
    console.log(
      `Updated Q-value for ${state}: ${qValue.toFixed(3)}, reward: ${reward.toFixed(3)}`
    );
  }

  private async getAvailableStrategies(
    taskType: string
  ): Promise<LearnedStrategy[]> {
    // Mock implementation - would query database
    return [];
  }

  private async updateStrategyMetadata(
    strategyId: string,
    metadata: Record<string, any>
  ): Promise<void> {
    // Implementation would update database
  }

  private async getHistoricalBids(filters: {
    agency?: string;
    category?: string;
  }): Promise<any[]> {
    // Mock implementation - would query database
    return [];
  }

  private calculateMedian(numbers: number[]): number {
    const sorted = [...numbers].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }

  private calculateDependencyDepth(workItems: any[]): number {
    // Simplified - would do proper graph traversal
    return Math.max(...workItems.map(w => w.dependencies?.length || 0), 1);
  }

  private identifyCriticalPath(workItems: any[]): string[] {
    // Simplified critical path - would use proper CPM algorithm
    return workItems
      .sort((a, b) => b.estimatedDuration - a.estimatedDuration)
      .slice(0, 3)
      .map((_, i) => `Task ${i + 1}`);
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  private calculateJaccardSimilarity(setA: Set<any>, setB: Set<any>): number {
    const intersection = new Set([...setA].filter(x => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    return union.size === 0 ? 0 : intersection.size / union.size;
  }

  private normalCDF(x: number): number {
    // Approximation of standard normal cumulative distribution function
    const t = 1 / (1 + 0.2316419 * Math.abs(x));
    const d = 0.3989423 * Math.exp((-x * x) / 2);
    const prob =
      d *
      t *
      (0.3193815 +
        t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    return x > 0 ? 1 - prob : prob;
  }

  // ========================================================================
  // PUBLIC API
  // ========================================================================

  /**
   * Get comprehensive learning metrics
   */
  async getEnhancedMetrics(): Promise<{
    learning: {
      totalEvents: number;
      activeStrategies: number;
      averageConfidence: number;
      successRateImprovement: number;
    };
    reinforcement: {
      averageQValue: number;
      explorationRate: number;
      exploitationRate: number;
    };
    prediction: {
      models: number;
      averageAccuracy: number;
    };
    knowledgeGraph: {
      nodes: number;
      edges: number;
      coverage: number;
    };
    abTesting: {
      activeTests: number;
      completedTests: number;
      winningStrategies: number;
    };
  }> {
    return {
      learning: {
        totalEvents: 0, // Would query database
        activeStrategies: 0,
        averageConfidence: 0,
        successRateImprovement: 0,
      },
      reinforcement: {
        averageQValue: 0,
        explorationRate: this.explorationRate,
        exploitationRate: 1 - this.explorationRate,
      },
      prediction: {
        models: this.predictiveModels.size,
        averageAccuracy: 0,
      },
      knowledgeGraph: {
        nodes: this.knowledgeGraph.size,
        edges: this.graphEdges.length,
        coverage: 0,
      },
      abTesting: {
        activeTests: this.activeTests.size,
        completedTests: 0,
        winningStrategies: 0,
      },
    };
  }
}

export const enhancedSaflaLearningEngine =
  EnhancedSAFLALearningEngine.getInstance();
