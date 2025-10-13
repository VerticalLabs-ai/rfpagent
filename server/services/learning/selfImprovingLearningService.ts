import { storage } from '../../storage';
import { agentMemoryService } from '../agents/agentMemoryService';
import { workflowCoordinator } from '../workflows/workflowCoordinator';
import { nanoid } from 'nanoid';

/**
 * SAFLA (Self-Aware Feedback Loop Algorithm) Learning Service
 *
 * Implements a comprehensive self-improving system that learns from:
 * - Proposal submission outcomes
 * - Portal interaction patterns
 * - Document parsing accuracy
 * - User feedback and corrections
 * - Market conditions and bidding strategies
 */

export interface LearningOutcome {
  id?: string;
  type:
    | 'proposal_success'
    | 'proposal_failure'
    | 'portal_navigation'
    | 'document_parsing'
    | 'compliance_check'
    | 'market_analysis';
  rfpId?: string;
  portalId?: string;
  agentId: string;
  context: {
    action: string;
    strategy: any;
    conditions: any;
    inputs: any;
    expectedOutput?: any;
    actualOutput?: any;
  };
  outcome: {
    success: boolean;
    metrics: any;
    feedback?: string;
    errorDetails?: any;
    improvementAreas?: string[];
  };
  learnedPatterns?: string[];
  adaptations?: any[];
  confidenceScore: number;
  domain: string;
  category: string;
  timestamp: Date;
}

export interface PortalStrategy {
  portalId: string;
  portalName: string;
  strategy: {
    navigationPattern: any;
    selectors: any;
    waitTimes: any;
    errorHandling: any;
    authenticationSteps: any;
  };
  performance: {
    successRate: number;
    averageTime: number;
    errorCount: number;
    lastUpdated: Date;
  };
  adaptations: Array<{
    timestamp: Date;
    change: string;
    reason: string;
    performanceImpact: number;
  }>;
}

export interface ParsingPattern {
  documentType: string;
  domain: string;
  pattern: {
    identifiers: string[];
    extractionRules: any;
    validationRules: any;
    postProcessing: any;
  };
  accuracy: {
    successRate: number;
    commonErrors: string[];
    improvementSuggestions: string[];
  };
  versions: Array<{
    version: string;
    timestamp: Date;
    changes: string[];
    performanceChange: number;
  }>;
}

export interface ProposalStrategy {
  domain: string;
  rfpType: string;
  strategy: {
    contentApproach: any;
    pricingStrategy: any;
    complianceApproach: any;
    narrativeStyle: any;
  };
  outcomes: {
    totalSubmissions: number;
    wins: number;
    losses: number;
    winRate: number;
    averageScore: number;
    feedbackPatterns: string[];
  };
  optimizations: Array<{
    timestamp: Date;
    change: string;
    rationale: string;
    expectedImpact: number;
    actualImpact?: number;
  }>;
}

export class SelfImprovingLearningService {
  private static instance: SelfImprovingLearningService;
  private learningEnabled: boolean = true;
  private adaptationThreshold: number = 0.7;
  private memoryConsolidationInterval: number = 24 * 60 * 60 * 1000; // 24 hours

  public static getInstance(): SelfImprovingLearningService {
    if (!SelfImprovingLearningService.instance) {
      SelfImprovingLearningService.instance =
        new SelfImprovingLearningService();
    }
    return SelfImprovingLearningService.instance;
  }

  // ============ CORE LEARNING FRAMEWORK ============

  /**
   * Record and learn from any system outcome
   */
  async recordLearningOutcome(outcome: LearningOutcome): Promise<void> {
    if (!this.learningEnabled) return;

    try {
      console.log(
        `📊 Recording learning outcome: ${outcome.type} for agent ${outcome.agentId}`
      );

      // Store the outcome in agent memory
      await agentMemoryService.storeMemory({
        agentId: outcome.agentId,
        memoryType: 'episodic',
        contextKey: `outcome_${outcome.type}_${outcome.timestamp.getTime()}`,
        title: `${outcome.type}: ${outcome.outcome.success ? 'Success' : 'Failure'}`,
        content: {
          type: outcome.type,
          context: outcome.context,
          outcome: outcome.outcome,
          rfpId: outcome.rfpId,
          portalId: outcome.portalId,
          domain: outcome.domain,
          category: outcome.category,
          confidenceScore: outcome.confidenceScore,
          learnedPatterns: outcome.learnedPatterns || [],
          adaptations: outcome.adaptations || [],
        },
        importance: outcome.outcome.success ? 8 : 9, // Failures are slightly more important for learning
        tags: [
          outcome.type,
          outcome.domain,
          outcome.category,
          outcome.outcome.success ? 'success' : 'failure',
        ],
        metadata: {
          rfpId: outcome.rfpId,
          portalId: outcome.portalId,
          processingTime: Date.now(),
        },
      });

      // Learn from the outcome
      await agentMemoryService.learnFromExperience(outcome.agentId, {
        context: outcome.context,
        outcome: outcome.outcome,
        success: outcome.outcome.success,
        rfpId: outcome.rfpId,
        category: outcome.category,
        domain: outcome.domain,
      });

      // Trigger specific learning processes based on outcome type
      await this.processOutcomeSpecificLearning(outcome);

      // Update performance metrics
      await this.updatePerformanceMetrics(outcome);

      console.log(
        `✅ Learning outcome recorded and processed for ${outcome.agentId}`
      );
    } catch (error) {
      console.error('❌ Failed to record learning outcome:', error);
    }
  }

  /**
   * Process outcome-specific learning patterns
   */
  private async processOutcomeSpecificLearning(
    outcome: LearningOutcome
  ): Promise<void> {
    switch (outcome.type) {
      case 'proposal_success':
      case 'proposal_failure':
        await this.learnFromProposalOutcome(outcome);
        break;
      case 'portal_navigation':
        await this.learnFromPortalInteraction(outcome);
        break;
      case 'document_parsing':
        await this.learnFromParsingOutcome(outcome);
        break;
      case 'compliance_check':
        await this.learnFromComplianceOutcome(outcome);
        break;
      case 'market_analysis':
        await this.learnFromMarketAnalysis(outcome);
        break;
    }
  }

  // ============ PROPOSAL OUTCOME LEARNING ============

  /**
   * Learn from proposal submission outcomes
   */
  async learnFromProposalOutcome(outcome: LearningOutcome): Promise<void> {
    if (!outcome.rfpId) return;

    try {
      // Get the RFP and proposal details
      const rfp = await storage.getRFP(outcome.rfpId);
      const proposal = await storage.getProposalByRFP(outcome.rfpId);

      if (!rfp || !proposal) return;

      // Extract strategy patterns
      const strategy = this.extractProposalStrategy(rfp, proposal, outcome);

      // Store or update proposal strategy knowledge
      await this.updateProposalStrategy(strategy, outcome.outcome.success);

      // If failure, analyze what went wrong
      if (!outcome.outcome.success && outcome.outcome.feedback) {
        await this.analyzeProposalFailure(
          rfp,
          proposal,
          outcome.outcome.feedback
        );
      }

      // Learn pricing patterns
      if (outcome.context.strategy?.pricing) {
        await this.learnPricingPatterns(
          rfp,
          outcome.context.strategy.pricing,
          outcome.outcome.success
        );
      }

      console.log(`💡 Learned from proposal outcome for RFP: ${rfp.title}`);
    } catch (error) {
      console.error('❌ Failed to learn from proposal outcome:', error);
    }
  }

  /**
   * Extract proposal strategy from successful/failed submissions
   */
  private extractProposalStrategy(
    rfp: any,
    proposal: any,
    outcome: LearningOutcome
  ): ProposalStrategy {
    return {
      domain: rfp.agency || 'unknown',
      rfpType: this.categorizeRFP(rfp),
      strategy: {
        contentApproach: {
          narrativeStyle: this.analyzeNarrativeStyle(proposal.narratives),
          technicalDepth: this.analyzeTechnicalDepth(proposal.content),
          complianceApproach: this.analyzeComplianceApproach(proposal),
          structuralElements: this.analyzeStructure(proposal),
        },
        pricingStrategy: {
          approach:
            outcome.context.strategy?.pricing?.approach || 'competitive',
          margin: outcome.context.strategy?.pricing?.margin || 0.15,
          breakdown: outcome.context.strategy?.pricing?.breakdown || 'standard',
        },
        complianceApproach: {
          thoroughness: this.analyzeComplianceThoroughness(proposal),
          riskMitigation: this.analyzeRiskMitigation(proposal),
        },
        narrativeStyle: {
          tone: this.analyzeProposalTone(proposal),
          length: this.analyzeContentLength(proposal),
          focusAreas: this.identifyFocusAreas(proposal),
        },
      },
      outcomes: {
        totalSubmissions: 1,
        wins: outcome.outcome.success ? 1 : 0,
        losses: outcome.outcome.success ? 0 : 1,
        winRate: outcome.outcome.success ? 1.0 : 0.0,
        averageScore: outcome.outcome.metrics?.score || 0,
        feedbackPatterns: outcome.outcome.feedback
          ? [outcome.outcome.feedback]
          : [],
      },
      optimizations: [],
    };
  }

  /**
   * Analyze proposal failure patterns
   */
  private async analyzeProposalFailure(
    rfp: any,
    proposal: any,
    feedback: string
  ): Promise<void> {
    const failurePatterns = this.identifyFailurePatterns(feedback);

    // Store failure analysis as knowledge
    await agentMemoryService.storeKnowledge({
      agentId: 'proposal-generation-specialist',
      knowledgeType: 'strategy',
      domain: rfp.agency || 'general',
      title: `Failure Pattern: ${rfp.title}`,
      description: `Analysis of proposal failure for insights`,
      content: {
        rfpId: rfp.id,
        failurePatterns,
        feedback,
        proposalStructure: this.analyzeStructure(proposal),
        proposedFixes: this.suggestImprovements(failurePatterns),
      },
      confidenceScore: 0.8,
      sourceType: 'feedback',
      sourceId: rfp.id,
      tags: ['failure_analysis', rfp.agency, 'improvement'],
    });
  }

  // ============ PORTAL NAVIGATION LEARNING ============

  /**
   * Learn from portal interaction outcomes
   */
  async learnFromPortalInteraction(outcome: LearningOutcome): Promise<void> {
    if (!outcome.portalId) return;

    try {
      const portal = await storage.getPortal(outcome.portalId);
      if (!portal) return;

      // Extract navigation strategy
      const strategy = this.extractPortalStrategy(portal, outcome);

      // Update or create portal strategy
      await this.updatePortalStrategy(strategy, outcome.outcome.success);

      // If navigation failed, analyze the failure
      if (!outcome.outcome.success) {
        await this.analyzeNavigationFailure(portal, outcome);
      }

      // Learn from timing patterns
      if (outcome.outcome.metrics?.duration) {
        await this.learnTimingPatterns(
          portal,
          outcome.outcome.metrics.duration
        );
      }

      console.log(`🧭 Learned from portal navigation: ${portal.name}`);
    } catch (error) {
      console.error('❌ Failed to learn from portal interaction:', error);
    }
  }

  /**
   * Extract portal navigation strategy
   */
  private extractPortalStrategy(
    portal: any,
    outcome: LearningOutcome
  ): PortalStrategy {
    return {
      portalId: portal.id,
      portalName: portal.name,
      strategy: {
        navigationPattern: outcome.context.strategy?.navigationPattern || {},
        selectors:
          outcome.context.strategy?.selectors || portal.selectors || {},
        waitTimes: outcome.context.strategy?.waitTimes || { default: 3000 },
        errorHandling: outcome.context.strategy?.errorHandling || {},
        authenticationSteps:
          outcome.context.strategy?.authenticationSteps || {},
      },
      performance: {
        successRate: outcome.outcome.success ? 1.0 : 0.0,
        averageTime: outcome.outcome.metrics?.duration || 0,
        errorCount: outcome.outcome.success ? 0 : 1,
        lastUpdated: new Date(),
      },
      adaptations: [],
    };
  }

  /**
   * Analyze navigation failures to improve strategies
   */
  private async analyzeNavigationFailure(
    portal: any,
    outcome: LearningOutcome
  ): Promise<void> {
    const errorAnalysis = this.analyzeNavigationError(
      outcome.outcome.errorDetails
    );

    // Store navigation failure analysis
    await agentMemoryService.storeKnowledge({
      agentId: 'portal-navigation-specialist',
      knowledgeType: 'strategy',
      domain: 'portal_navigation',
      title: `Navigation Failure: ${portal.name}`,
      description: `Analysis of navigation failure for portal optimization`,
      content: {
        portalId: portal.id,
        portalName: portal.name,
        errorAnalysis,
        originalStrategy: outcome.context.strategy,
        suggestedFixes: this.suggestNavigationFixes(errorAnalysis),
        fallbackStrategies: this.generateFallbackStrategies(portal),
      },
      confidenceScore: 0.7,
      sourceType: 'experience',
      sourceId: portal.id,
      tags: ['navigation_failure', 'portal_optimization', portal.name],
    });
  }

  // ============ DOCUMENT PARSING LEARNING ============

  /**
   * Learn from document parsing outcomes
   */
  async learnFromParsingOutcome(outcome: LearningOutcome): Promise<void> {
    try {
      const documentType = outcome.context.inputs?.documentType || 'unknown';
      const domain = outcome.domain || 'general';

      // Extract parsing patterns
      const pattern = this.extractParsingPattern(outcome);

      // Update parsing strategy
      await this.updateParsingPattern(pattern, outcome.outcome.success);

      // Analyze parsing errors for improvement
      if (!outcome.outcome.success && outcome.outcome.errorDetails) {
        await this.analyzeParsingFailure(outcome);
      }

      console.log(
        `📄 Learned from document parsing: ${documentType} in ${domain}`
      );
    } catch (error) {
      console.error('❌ Failed to learn from parsing outcome:', error);
    }
  }

  /**
   * Extract parsing patterns from outcomes
   */
  private extractParsingPattern(outcome: LearningOutcome): ParsingPattern {
    return {
      documentType: outcome.context.inputs?.documentType || 'unknown',
      domain: outcome.domain || 'general',
      pattern: {
        identifiers: outcome.context.strategy?.identifiers || [],
        extractionRules: outcome.context.strategy?.extractionRules || {},
        validationRules: outcome.context.strategy?.validationRules || {},
        postProcessing: outcome.context.strategy?.postProcessing || {},
      },
      accuracy: {
        successRate: outcome.outcome.success ? 1.0 : 0.0,
        commonErrors: outcome.outcome.errorDetails
          ? [outcome.outcome.errorDetails.message]
          : [],
        improvementSuggestions: outcome.outcome.improvementAreas || [],
      },
      versions: [
        {
          version: '1.0',
          timestamp: new Date(),
          changes: ['Initial pattern'],
          performanceChange: 0,
        },
      ],
    };
  }

  // ============ ADAPTIVE STRATEGY MANAGEMENT ============

  /**
   * Update portal strategy based on outcomes
   */
  private async updatePortalStrategy(
    strategy: PortalStrategy,
    success: boolean
  ): Promise<void> {
    // Get existing strategy
    const existingStrategy = await this.getPortalStrategy(strategy.portalId);

    if (existingStrategy) {
      // Update performance metrics
      const updatedStrategy = this.mergePortalStrategies(
        existingStrategy,
        strategy,
        success
      );

      // Check if adaptation is needed
      if (this.shouldAdaptPortalStrategy(updatedStrategy)) {
        await this.adaptPortalStrategy(updatedStrategy);
      }

      await this.storePortalStrategy(updatedStrategy);
    } else {
      await this.storePortalStrategy(strategy);
    }
  }

  /**
   * Update proposal strategy based on outcomes
   */
  private async updateProposalStrategy(
    strategy: ProposalStrategy,
    success: boolean
  ): Promise<void> {
    const key = `${strategy.domain}_${strategy.rfpType}`;
    const existing = await this.getProposalStrategy(key);

    if (existing) {
      const updated = this.mergeProposalStrategies(existing, strategy, success);

      if (this.shouldAdaptProposalStrategy(updated)) {
        await this.adaptProposalStrategy(updated);
      }

      await this.storeProposalStrategy(key, updated);
    } else {
      await this.storeProposalStrategy(key, strategy);
    }
  }

  /**
   * Adapt portal strategy based on performance patterns
   */
  private async adaptPortalStrategy(strategy: PortalStrategy): Promise<void> {
    const adaptations = [];

    // Adapt wait times if success rate is low
    if (strategy.performance.successRate < 0.7) {
      adaptations.push({
        timestamp: new Date(),
        change: 'Increased wait times by 50%',
        reason: 'Low success rate suggests timing issues',
        performanceImpact: 0,
      });

      // Increase wait times
      Object.keys(strategy.strategy.waitTimes).forEach(key => {
        strategy.strategy.waitTimes[key] *= 1.5;
      });
    }

    // Adapt selectors if errors suggest element not found
    if (strategy.performance.errorCount > 5) {
      adaptations.push({
        timestamp: new Date(),
        change: 'Updated backup selectors',
        reason: 'High error count suggests selector instability',
        performanceImpact: 0,
      });
    }

    strategy.adaptations.push(...adaptations);

    console.log(
      `🔄 Adapted portal strategy for ${strategy.portalName}: ${adaptations.length} changes`
    );
  }

  /**
   * Adapt proposal strategy based on success patterns
   */
  private async adaptProposalStrategy(
    strategy: ProposalStrategy
  ): Promise<void> {
    const adaptations = [];

    // Adapt based on win rate
    if (
      strategy.outcomes.winRate < 0.3 &&
      strategy.outcomes.totalSubmissions > 3
    ) {
      adaptations.push({
        timestamp: new Date(),
        change: 'Adjusted narrative style to be more conservative',
        rationale: 'Low win rate suggests approach may be too aggressive',
        expectedImpact: 0.15,
      });

      // Adjust strategy
      strategy.strategy.narrativeStyle.tone = 'conservative';
    }

    // Adapt pricing if consistently losing
    if (
      strategy.outcomes.losses > strategy.outcomes.wins &&
      strategy.outcomes.totalSubmissions > 2
    ) {
      adaptations.push({
        timestamp: new Date(),
        change: 'Reduced margin by 2% to be more competitive',
        rationale: 'More losses than wins suggests pricing may be too high',
        expectedImpact: 0.1,
      });

      strategy.strategy.pricingStrategy.margin = Math.max(
        0.05,
        strategy.strategy.pricingStrategy.margin - 0.02
      );
    }

    strategy.optimizations.push(...adaptations);

    console.log(
      `💰 Adapted proposal strategy for ${strategy.domain}/${strategy.rfpType}: ${adaptations.length} changes`
    );
  }

  // ============ PERFORMANCE MONITORING & METRICS ============

  /**
   * Update performance metrics based on outcomes
   */
  private async updatePerformanceMetrics(
    outcome: LearningOutcome
  ): Promise<void> {
    await agentMemoryService.recordPerformanceMetric(
      outcome.agentId,
      `${outcome.type}_success_rate`,
      outcome.outcome.success ? 1 : 0,
      {
        entityType: outcome.type,
        entityId: outcome.rfpId || outcome.portalId,
        domain: outcome.domain,
        category: outcome.category,
      }
    );

    if (outcome.outcome.metrics?.duration) {
      await agentMemoryService.recordPerformanceMetric(
        outcome.agentId,
        `${outcome.type}_duration`,
        outcome.outcome.metrics.duration,
        {
          entityType: outcome.type,
          entityId: outcome.rfpId || outcome.portalId,
        }
      );
    }

    if (outcome.outcome.metrics?.score) {
      await agentMemoryService.recordPerformanceMetric(
        outcome.agentId,
        `${outcome.type}_quality_score`,
        outcome.outcome.metrics.score,
        {
          entityType: outcome.type,
          entityId: outcome.rfpId || outcome.portalId,
        }
      );
    }
  }

  /**
   * Generate improvement recommendations based on learning
   */
  async generateImprovementRecommendations(agentId: string): Promise<any[]> {
    const recommendations = [];

    // Get recent performance metrics
    const performance =
      await agentMemoryService.getAgentPerformanceSummary(agentId);

    // Get recent failures for pattern analysis
    const recentMemories = await agentMemoryService.getAgentMemories(
      agentId,
      'episodic',
      50
    );
    const failures = recentMemories.filter(
      m =>
        m.content.success === false &&
        Date.now() - new Date(m.createdAt).getTime() < 7 * 24 * 60 * 60 * 1000 // Last 7 days
    );

    // Analyze failure patterns
    if (failures.length > 3) {
      const patterns = this.analyzeFailurePatterns(failures);
      recommendations.push({
        type: 'failure_pattern',
        priority: 'high',
        title: 'Recurring Failure Pattern Detected',
        description: `Identified ${patterns.length} failure patterns in recent activities`,
        patterns,
        suggestedActions: this.suggestActionsForPatterns(patterns),
      });
    }

    // Performance-based recommendations
    if (performance?.success_rate < 0.7) {
      recommendations.push({
        type: 'performance',
        priority: 'medium',
        title: 'Low Success Rate',
        description: `Success rate of ${(performance.success_rate * 100).toFixed(1)}% is below optimal`,
        suggestedActions: [
          'Review recent failures',
          'Update strategies',
          'Increase validation steps',
        ],
      });
    }

    return recommendations;
  }

  // ============ CONTINUOUS LEARNING MANAGEMENT ============

  /**
   * Consolidate memories and extract long-term patterns
   */
  async consolidateMemories(): Promise<void> {
    console.log('🧠 Starting memory consolidation process...');

    // Get all agents
    const agents = await storage.getAllAgents();

    for (const agent of agents) {
      await this.consolidateAgentMemories(agent.agentId);
    }

    console.log('✅ Memory consolidation completed');
  }

  /**
   * Consolidate memories for a specific agent
   */
  private async consolidateAgentMemories(agentId: string): Promise<void> {
    // Get episodic memories older than consolidation interval
    const oldMemories = await agentMemoryService.getAgentMemories(
      agentId,
      'episodic',
      1000
    );
    const cutoff = Date.now() - this.memoryConsolidationInterval;

    const memoriesToConsolidate = oldMemories.filter(
      m => new Date(m.createdAt).getTime() < cutoff
    );

    if (memoriesToConsolidate.length < 10) return; // Not enough to consolidate

    // Extract patterns from old memories
    const patterns = this.extractPatternsFromMemories(memoriesToConsolidate);

    // Store consolidated patterns as semantic knowledge
    for (const pattern of patterns) {
      await agentMemoryService.storeKnowledge({
        agentId,
        knowledgeType: pattern.type,
        domain: pattern.domain,
        title: `Consolidated Pattern: ${pattern.title}`,
        description: pattern.description,
        content: pattern.content,
        confidenceScore: pattern.confidence,
        sourceType: 'experience',
        tags: pattern.tags,
      });
    }

    console.log(
      `📚 Consolidated ${memoriesToConsolidate.length} memories into ${patterns.length} patterns for ${agentId}`
    );
  }

  /**
   * Enable or disable learning
   */
  setLearningEnabled(enabled: boolean): void {
    this.learningEnabled = enabled;
    console.log(`📖 Learning ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Get current learning configuration
   */
  getLearningConfig(): any {
    return {
      enabled: this.learningEnabled,
      adaptationThreshold: this.adaptationThreshold,
      memoryConsolidationInterval: this.memoryConsolidationInterval,
      version: '1.0.0',
    };
  }

  // ============ PRIVATE HELPER METHODS ============

  private categorizeRFP(rfp: any): string {
    const title = (rfp.title || '').toLowerCase();
    if (
      title.includes('technology') ||
      title.includes('software') ||
      title.includes('it')
    )
      return 'technology';
    if (title.includes('construction') || title.includes('building'))
      return 'construction';
    if (title.includes('consulting') || title.includes('advisory'))
      return 'consulting';
    if (title.includes('maintenance') || title.includes('support'))
      return 'maintenance';
    return 'general';
  }

  private analyzeNarrativeStyle(narratives: any[]): string {
    if (!narratives || narratives.length === 0) return 'standard';

    const totalLength = narratives.reduce(
      (sum, n) => sum + (n?.length || 0),
      0
    );
    const avgLength = totalLength / narratives.length;

    if (avgLength > 1000) return 'detailed';
    if (avgLength > 500) return 'moderate';
    return 'concise';
  }

  private analyzeTechnicalDepth(content: any): string {
    if (!content) return 'basic';

    const contentStr = JSON.stringify(content).toLowerCase();
    const technicalTerms = [
      'architecture',
      'methodology',
      'framework',
      'protocol',
      'implementation',
    ];
    const matches = technicalTerms.filter(term => contentStr.includes(term));

    if (matches.length > 3) return 'deep';
    if (matches.length > 1) return 'moderate';
    return 'basic';
  }

  private analyzeComplianceApproach(proposal: any): string {
    if (proposal.metadata?.complianceScore > 0.9) return 'thorough';
    if (proposal.metadata?.complianceScore > 0.7) return 'adequate';
    return 'basic';
  }

  private analyzeStructure(proposal: any): any {
    return {
      sections: proposal.narratives?.length || 0,
      hasExecutiveSummary: !!proposal.content?.executive_summary,
      hasTechnicalApproach: !!proposal.content?.technical_approach,
      hasQualifications: !!proposal.content?.qualifications,
      hasPricing: !!proposal.pricingTables,
    };
  }

  private analyzeComplianceThoroughness(proposal: any): string {
    const score = proposal.metadata?.complianceScore || 0;
    if (score > 0.9) return 'exhaustive';
    if (score > 0.8) return 'thorough';
    if (score > 0.6) return 'adequate';
    return 'minimal';
  }

  private analyzeRiskMitigation(proposal: any): string {
    const hasRiskSection = !!proposal.content?.risk_mitigation;
    const hasContingency = !!proposal.content?.contingency_plans;

    if (hasRiskSection && hasContingency) return 'comprehensive';
    if (hasRiskSection || hasContingency) return 'basic';
    return 'none';
  }

  private analyzeProposalTone(proposal: any): string {
    // Simple heuristic based on content analysis
    const content = JSON.stringify(proposal.content || {}).toLowerCase();

    if (content.includes('innovative') || content.includes('cutting-edge'))
      return 'aggressive';
    if (content.includes('proven') || content.includes('established'))
      return 'conservative';
    return 'balanced';
  }

  private analyzeContentLength(proposal: any): string {
    const totalContent = JSON.stringify(proposal.content || {}).length;

    if (totalContent > 5000) return 'detailed';
    if (totalContent > 2000) return 'moderate';
    return 'concise';
  }

  private identifyFocusAreas(proposal: any): string[] {
    const areas = [];
    const content = proposal.content || {};

    if (content.technical_approach) areas.push('technical');
    if (content.team_qualifications) areas.push('team');
    if (content.past_performance) areas.push('experience');
    if (content.cost_breakdown) areas.push('pricing');

    return areas;
  }

  private identifyFailurePatterns(feedback: string): string[] {
    const patterns = [];
    const lowerFeedback = feedback.toLowerCase();

    if (lowerFeedback.includes('price') || lowerFeedback.includes('cost'))
      patterns.push('pricing_issues');
    if (
      lowerFeedback.includes('technical') ||
      lowerFeedback.includes('approach')
    )
      patterns.push('technical_deficiency');
    if (
      lowerFeedback.includes('experience') ||
      lowerFeedback.includes('qualification')
    )
      patterns.push('qualification_concerns');
    if (
      lowerFeedback.includes('compliance') ||
      lowerFeedback.includes('requirement')
    )
      patterns.push('compliance_gaps');

    return patterns;
  }

  private suggestImprovements(patterns: string[]): string[] {
    const suggestions = [];

    if (patterns.includes('pricing_issues'))
      suggestions.push('Review pricing strategy and market rates');
    if (patterns.includes('technical_deficiency'))
      suggestions.push('Enhance technical sections with more detail');
    if (patterns.includes('qualification_concerns'))
      suggestions.push('Strengthen team qualifications and past performance');
    if (patterns.includes('compliance_gaps'))
      suggestions.push('Improve compliance checking and requirement coverage');

    return suggestions;
  }

  private analyzeNavigationError(errorDetails: any): any {
    if (!errorDetails) return { type: 'unknown', severity: 'low' };

    const message = errorDetails.message || '';

    if (message.includes('timeout'))
      return { type: 'timing', severity: 'medium' };
    if (message.includes('not found') || message.includes('selector'))
      return { type: 'selector', severity: 'high' };
    if (message.includes('auth') || message.includes('login'))
      return { type: 'authentication', severity: 'high' };

    return { type: 'unknown', severity: 'medium' };
  }

  private suggestNavigationFixes(errorAnalysis: any): string[] {
    const fixes = [];

    switch (errorAnalysis.type) {
      case 'timing':
        fixes.push('Increase wait times', 'Add explicit waits for elements');
        break;
      case 'selector':
        fixes.push(
          'Update selectors',
          'Add fallback selectors',
          'Use more robust targeting'
        );
        break;
      case 'authentication':
        fixes.push(
          'Review login process',
          'Check credentials',
          'Verify 2FA handling'
        );
        break;
      default:
        fixes.push('Add error handling', 'Implement retry logic');
    }

    return fixes;
  }

  private generateFallbackStrategies(portal: any): any[] {
    return [
      {
        name: 'Increased Wait Times',
        description: 'Double all wait times for more reliable navigation',
        modifications: { waitTimes: 'double' },
      },
      {
        name: 'Alternative Selectors',
        description: 'Use backup selectors for critical elements',
        modifications: { selectors: 'backup' },
      },
    ];
  }

  private mergePortalStrategies(
    existing: PortalStrategy,
    newStrategy: PortalStrategy,
    success: boolean
  ): PortalStrategy {
    // Update performance metrics
    const totalAttempts =
      existing.performance.errorCount + existing.performance.successRate;
    const newSuccessRate =
      (existing.performance.successRate * totalAttempts + (success ? 1 : 0)) /
      (totalAttempts + 1);

    return {
      ...existing,
      performance: {
        successRate: newSuccessRate,
        averageTime:
          (existing.performance.averageTime +
            newStrategy.performance.averageTime) /
          2,
        errorCount: existing.performance.errorCount + (success ? 0 : 1),
        lastUpdated: new Date(),
      },
      strategy: {
        ...existing.strategy,
        ...newStrategy.strategy, // Merge strategies, preferring newer ones
      },
    };
  }

  private mergeProposalStrategies(
    existing: ProposalStrategy,
    newStrategy: ProposalStrategy,
    success: boolean
  ): ProposalStrategy {
    return {
      ...existing,
      outcomes: {
        totalSubmissions: existing.outcomes.totalSubmissions + 1,
        wins: existing.outcomes.wins + (success ? 1 : 0),
        losses: existing.outcomes.losses + (success ? 0 : 1),
        winRate:
          (existing.outcomes.wins + (success ? 1 : 0)) /
          (existing.outcomes.totalSubmissions + 1),
        averageScore:
          (existing.outcomes.averageScore + newStrategy.outcomes.averageScore) /
          2,
        feedbackPatterns: [
          ...existing.outcomes.feedbackPatterns,
          ...newStrategy.outcomes.feedbackPatterns,
        ],
      },
      strategy: {
        ...existing.strategy,
        ...newStrategy.strategy,
      },
    };
  }

  private shouldAdaptPortalStrategy(strategy: PortalStrategy): boolean {
    return strategy.performance.successRate < this.adaptationThreshold;
  }

  private shouldAdaptProposalStrategy(strategy: ProposalStrategy): boolean {
    return (
      strategy.outcomes.winRate < this.adaptationThreshold &&
      strategy.outcomes.totalSubmissions > 2
    );
  }

  private async getPortalStrategy(
    portalId: string
  ): Promise<PortalStrategy | null> {
    const knowledge = await agentMemoryService.getAgentKnowledge(
      'portal-navigation-specialist',
      'strategy',
      portalId
    );
    return knowledge.length > 0 ? knowledge[0].content : null;
  }

  private async storePortalStrategy(strategy: PortalStrategy): Promise<void> {
    await agentMemoryService.storeKnowledge({
      agentId: 'portal-navigation-specialist',
      knowledgeType: 'strategy',
      domain: strategy.portalId,
      title: `Portal Strategy: ${strategy.portalName}`,
      description: `Navigation strategy for ${strategy.portalName}`,
      content: strategy,
      confidenceScore: strategy.performance.successRate,
      sourceType: 'experience',
      tags: ['portal_strategy', strategy.portalName],
    });
  }

  private async getProposalStrategy(
    key: string
  ): Promise<ProposalStrategy | null> {
    const knowledge = await agentMemoryService.getAgentKnowledge(
      'proposal-generation-specialist',
      'strategy',
      key
    );
    return knowledge.length > 0 ? knowledge[0].content : null;
  }

  private async storeProposalStrategy(
    key: string,
    strategy: ProposalStrategy
  ): Promise<void> {
    await agentMemoryService.storeKnowledge({
      agentId: 'proposal-generation-specialist',
      knowledgeType: 'strategy',
      domain: key,
      title: `Proposal Strategy: ${strategy.domain}/${strategy.rfpType}`,
      description: `Proposal strategy for ${strategy.domain} ${strategy.rfpType} RFPs`,
      content: strategy,
      confidenceScore: strategy.outcomes.winRate,
      sourceType: 'experience',
      tags: ['proposal_strategy', strategy.domain, strategy.rfpType],
    });
  }

  private async learnPricingPatterns(
    rfp: any,
    pricingStrategy: any,
    success: boolean
  ): Promise<void> {
    await agentMemoryService.storeKnowledge({
      agentId: 'pricing-analysis-specialist',
      knowledgeType: 'pricing_data',
      domain: rfp.agency || 'general',
      title: `Pricing Pattern: ${rfp.title}`,
      description: `Pricing outcome for ${rfp.agency} RFP`,
      content: {
        rfpId: rfp.id,
        estimatedValue: rfp.estimatedValue,
        pricingStrategy,
        success,
        agency: rfp.agency,
        category: this.categorizeRFP(rfp),
      },
      confidenceScore: success ? 0.8 : 0.6,
      sourceType: 'experience',
      sourceId: rfp.id,
      tags: ['pricing', rfp.agency, success ? 'win' : 'loss'],
    });
  }

  private async learnFromComplianceOutcome(
    outcome: LearningOutcome
  ): Promise<void> {
    // Learn compliance patterns
    await agentMemoryService.storeKnowledge({
      agentId: outcome.agentId,
      knowledgeType: 'compliance_rule',
      domain: outcome.domain,
      title: `Compliance Pattern: ${outcome.context.action}`,
      description: `Compliance checking outcome for ${outcome.domain}`,
      content: {
        action: outcome.context.action,
        strategy: outcome.context.strategy,
        outcome: outcome.outcome,
        patterns: outcome.learnedPatterns || [],
      },
      confidenceScore: outcome.confidenceScore,
      sourceType: 'experience',
      tags: [
        'compliance',
        outcome.domain,
        outcome.outcome.success ? 'pass' : 'fail',
      ],
    });
  }

  private async learnFromMarketAnalysis(
    outcome: LearningOutcome
  ): Promise<void> {
    // Learn market patterns
    await agentMemoryService.storeKnowledge({
      agentId: outcome.agentId,
      knowledgeType: 'market_insight',
      domain: outcome.domain,
      title: `Market Analysis: ${outcome.context.action}`,
      description: `Market analysis outcome for ${outcome.domain}`,
      content: {
        analysis: outcome.context.strategy,
        outcome: outcome.outcome,
        marketConditions: outcome.context.conditions,
        insights: outcome.learnedPatterns || [],
      },
      confidenceScore: outcome.confidenceScore,
      sourceType: 'research',
      tags: ['market_analysis', outcome.domain],
    });
  }

  private async updateParsingPattern(
    pattern: ParsingPattern,
    success: boolean
  ): Promise<void> {
    const key = `${pattern.documentType}_${pattern.domain}`;
    const existing = await this.getParsingPattern(key);

    if (existing) {
      // Update accuracy metrics
      const totalAttempts =
        existing.accuracy.successRate > 0
          ? 1 / existing.accuracy.successRate
          : 1;
      const newSuccessRate =
        (existing.accuracy.successRate * totalAttempts + (success ? 1 : 0)) /
        (totalAttempts + 1);

      existing.accuracy.successRate = newSuccessRate;
      if (!success && pattern.accuracy.commonErrors.length > 0) {
        existing.accuracy.commonErrors.push(...pattern.accuracy.commonErrors);
      }

      await this.storeParsingPattern(key, existing);
    } else {
      await this.storeParsingPattern(key, pattern);
    }
  }

  private async getParsingPattern(key: string): Promise<ParsingPattern | null> {
    const knowledge = await agentMemoryService.getAgentKnowledge(
      'document-processor-specialist',
      'strategy',
      key
    );
    return knowledge.length > 0 ? knowledge[0].content : null;
  }

  private async storeParsingPattern(
    key: string,
    pattern: ParsingPattern
  ): Promise<void> {
    await agentMemoryService.storeKnowledge({
      agentId: 'document-processor-specialist',
      knowledgeType: 'strategy',
      domain: key,
      title: `Parsing Pattern: ${pattern.documentType}`,
      description: `Document parsing pattern for ${pattern.documentType} in ${pattern.domain}`,
      content: pattern,
      confidenceScore: pattern.accuracy.successRate,
      sourceType: 'experience',
      tags: ['parsing_pattern', pattern.documentType, pattern.domain],
    });
  }

  private async analyzeParsingFailure(outcome: LearningOutcome): Promise<void> {
    const errorAnalysis = {
      errorType: outcome.outcome.errorDetails?.type || 'unknown',
      errorMessage: outcome.outcome.errorDetails?.message || '',
      documentType: outcome.context.inputs?.documentType,
      suggestedFixes: outcome.outcome.improvementAreas || [],
    };

    await agentMemoryService.storeKnowledge({
      agentId: outcome.agentId,
      knowledgeType: 'strategy',
      domain: 'parsing_errors',
      title: `Parsing Error: ${errorAnalysis.errorType}`,
      description: `Analysis of parsing failure for improvement`,
      content: errorAnalysis,
      confidenceScore: 0.7,
      sourceType: 'feedback',
      tags: ['parsing_error', errorAnalysis.documentType, 'improvement'],
    });
  }

  private analyzeFailurePatterns(failures: any[]): any[] {
    const patterns = [];

    // Group failures by type and look for patterns
    const failureGroups = failures.reduce((groups, failure) => {
      const type = failure.content.type || 'unknown';
      if (!groups[type]) groups[type] = [];
      groups[type].push(failure);
      return groups;
    }, {});

    for (const [type, typeFailures] of Object.entries(failureGroups)) {
      if ((typeFailures as any[]).length > 2) {
        // Pattern if 3+ failures of same type
        patterns.push({
          type,
          frequency: (typeFailures as any[]).length,
          commonErrors: this.extractCommonErrors(typeFailures as any[]),
          timeframe: this.getTimeframe(typeFailures as any[]),
        });
      }
    }

    return patterns;
  }

  private extractCommonErrors(failures: any[]): string[] {
    const errors = failures
      .map(f => f.content.outcome?.errorDetails?.message)
      .filter(Boolean);

    // Simple frequency analysis
    const errorCounts = errors.reduce((counts, error) => {
      counts[error] = (counts[error] || 0) + 1;
      return counts;
    }, {});

    return Object.entries(errorCounts)
      .filter(([_, count]) => (count as number) > 1)
      .map(([error, _]) => error);
  }

  private getTimeframe(failures: any[]): { start: Date; end: Date } {
    const dates = failures.map(f => new Date(f.createdAt));
    return {
      start: new Date(Math.min(...dates.map(d => d.getTime()))),
      end: new Date(Math.max(...dates.map(d => d.getTime()))),
    };
  }

  private suggestActionsForPatterns(patterns: any[]): string[] {
    const actions = [];

    for (const pattern of patterns) {
      switch (pattern.type) {
        case 'proposal_failure':
          actions.push('Review proposal generation strategies');
          actions.push('Analyze market competition patterns');
          break;
        case 'portal_navigation':
          actions.push('Update portal navigation selectors');
          actions.push('Increase wait times for reliability');
          break;
        case 'document_parsing':
          actions.push('Improve document type detection');
          actions.push('Update extraction patterns');
          break;
      }
    }

    return [...new Set(actions)]; // Remove duplicates
  }

  private extractPatternsFromMemories(memories: any[]): any[] {
    const patterns = [];

    // Group memories by domain and analyze for patterns
    const domainGroups = memories.reduce((groups, memory) => {
      const domain = memory.content.domain || 'general';
      if (!groups[domain]) groups[domain] = [];
      groups[domain].push(memory);
      return groups;
    }, {});

    for (const [domain, domainMemories] of Object.entries(domainGroups)) {
      const successfulMemories = (domainMemories as any[]).filter(
        m => m.content.success
      );
      const failedMemories = (domainMemories as any[]).filter(
        m => !m.content.success
      );

      if (successfulMemories.length > 3) {
        patterns.push({
          type: 'strategy',
          domain,
          title: `Success Patterns in ${domain}`,
          description: `Consolidated successful strategies from ${successfulMemories.length} experiences`,
          content: {
            successFactors: this.extractSuccessFactors(successfulMemories),
            frequency: successfulMemories.length,
            timeframe: this.getTimeframe(successfulMemories),
          },
          confidence: 0.8,
          tags: [domain, 'success_pattern', 'consolidated'],
        });
      }

      if (failedMemories.length > 2) {
        patterns.push({
          type: 'strategy',
          domain,
          title: `Failure Patterns in ${domain}`,
          description: `Consolidated failure patterns from ${failedMemories.length} experiences`,
          content: {
            failureFactors: this.extractFailureFactors(failedMemories),
            frequency: failedMemories.length,
            timeframe: this.getTimeframe(failedMemories),
          },
          confidence: 0.7,
          tags: [domain, 'failure_pattern', 'consolidated'],
        });
      }
    }

    return patterns;
  }

  private extractSuccessFactors(memories: any[]): any[] {
    // Analyze common elements in successful experiences
    const factors = [];

    // Extract strategies used in successful cases
    const strategies = memories
      .map(m => m.content.context?.strategy)
      .filter(Boolean);

    if (strategies.length > 0) {
      factors.push({
        type: 'strategy',
        commonElements: this.findCommonElements(strategies),
        frequency: strategies.length,
      });
    }

    return factors;
  }

  private extractFailureFactors(memories: any[]): any[] {
    // Analyze common elements in failed experiences
    const factors = [];

    // Extract error patterns from failed cases
    const errors = memories
      .map(m => m.content.outcome?.errorDetails)
      .filter(Boolean);

    if (errors.length > 0) {
      factors.push({
        type: 'error_pattern',
        commonErrors: this.extractCommonErrors(errors),
        frequency: errors.length,
      });
    }

    return factors;
  }

  private findCommonElements(objects: any[]): any {
    // Simple implementation to find common properties across objects
    if (objects.length === 0) return {};

    const commonKeys = Object.keys(objects[0]).filter(key =>
      objects.every(obj => Object.hasOwn(obj, key))
    );

    const common: Record<string, any> = {};
    for (const key of commonKeys) {
      const values = objects.map(obj => obj[key]);
      const uniqueValues = [...new Set(values)];

      if (uniqueValues.length === 1) {
        common[key] = uniqueValues[0];
      } else if (uniqueValues.length <= objects.length / 2) {
        // If half or fewer unique values, it's somewhat common
        common[key] = uniqueValues;
      }
    }

    return common;
  }

  private async learnTimingPatterns(
    portal: any,
    duration: number
  ): Promise<void> {
    await agentMemoryService.storeKnowledge({
      agentId: 'portal-navigation-specialist',
      knowledgeType: 'strategy',
      domain: 'timing_patterns',
      title: `Timing Pattern: ${portal.name}`,
      description: `Navigation timing data for ${portal.name}`,
      content: {
        portalId: portal.id,
        portalName: portal.name,
        duration,
        timestamp: new Date(),
        portalUrl: portal.url,
      },
      confidenceScore: 0.6,
      sourceType: 'experience',
      sourceId: portal.id,
      tags: ['timing', 'navigation', portal.name],
    });
  }
}

export const selfImprovingLearningService =
  SelfImprovingLearningService.getInstance();
