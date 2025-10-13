import { storage } from '../../storage';
import { selfImprovingLearningService } from '../learning/selfImprovingLearningService';
import { agentMemoryService } from '../agents/agentMemoryService';

/**
 * Adaptive Portal Navigator Service
 *
 * Learns from portal interactions and continuously adapts navigation strategies.
 * Implements self-improving algorithms for handling portal quirks and changes.
 */

export interface PortalNavigationStrategy {
  portalId: string;
  portalName: string;
  baseUrl: string;

  // Navigation patterns
  navigationFlow: {
    loginSequence: NavigationStep[];
    searchSequence: NavigationStep[];
    detailPageSequence: NavigationStep[];
    documentDownloadSequence: NavigationStep[];
  };

  // Adaptive selectors with fallbacks
  selectors: {
    [key: string]: {
      primary: string;
      fallbacks: string[];
      adaptiveScore: number;
      lastValidated: Date;
    };
  };

  // Timing patterns learned from experience
  timingPatterns: {
    pageLoadWait: number;
    elementWait: number;
    downloadWait: number;
    retryDelay: number;
    adaptiveMultiplier: number;
  };

  // Error handling strategies
  errorHandling: {
    commonErrors: ErrorPattern[];
    recoveryStrategies: RecoveryStrategy[];
    escalationThresholds: {
      maxRetries: number;
      timeoutThreshold: number;
      errorRateThreshold: number;
    };
  };

  // Performance metrics
  performance: {
    successRate: number;
    averageLatency: number;
    errorFrequency: number;
    lastSuccess: Date;
    totalAttempts: number;
    adaptationCount: number;
  };

  // Learning metadata
  learningData: {
    createdAt: Date;
    lastAdaptation: Date;
    adaptationTriggers: string[];
    validationStatus: 'valid' | 'outdated' | 'needs_validation';
    confidenceScore: number;
  };
}

export interface NavigationStep {
  action:
    | 'navigate'
    | 'click'
    | 'type'
    | 'wait'
    | 'select'
    | 'upload'
    | 'download'
    | 'validate';
  selector?: string;
  value?: string;
  waitCondition?: string;
  timeout?: number;
  optional?: boolean;
  validationRules?: any[];
  fallbackActions?: NavigationStep[];
}

export interface ErrorPattern {
  errorType: string;
  frequency: number;
  symptoms: string[];
  commonCauses: string[];
  detectionRules: any[];
  resolution: 'retry' | 'adapt' | 'escalate' | 'skip';
}

export interface RecoveryStrategy {
  name: string;
  description: string;
  applicableErrors: string[];
  steps: NavigationStep[];
  successRate: number;
  averageRecoveryTime: number;
}

export interface NavigationAttempt {
  portalId: string;
  timestamp: Date;
  strategy: string;
  steps: Array<{
    stepIndex: number;
    action: string;
    selector?: string;
    success: boolean;
    duration: number;
    errorDetails?: any;
  }>;
  overallResult: {
    success: boolean;
    duration: number;
    dataExtracted?: any;
    errorDetails?: any;
    adaptationsApplied?: string[];
  };
}

export class AdaptivePortalNavigator {
  private static instance: AdaptivePortalNavigator;
  private adaptationThreshold: number = 0.8; // Adapt when success rate drops below 80%
  private validationInterval: number = 24 * 60 * 60 * 1000; // 24 hours
  private learningEnabled: boolean = true;

  public static getInstance(): AdaptivePortalNavigator {
    if (!AdaptivePortalNavigator.instance) {
      AdaptivePortalNavigator.instance = new AdaptivePortalNavigator();
    }
    return AdaptivePortalNavigator.instance;
  }

  // ============ STRATEGY MANAGEMENT ============

  /**
   * Get adaptive navigation strategy for a portal
   */
  async getNavigationStrategy(
    portalId: string
  ): Promise<PortalNavigationStrategy | null> {
    try {
      // First try to get existing strategy
      let strategy = await this.loadStrategy(portalId);

      if (!strategy) {
        // Create initial strategy for new portal
        strategy = await this.createInitialStrategy(portalId);
      } else {
        // Check if strategy needs validation/refresh
        if (await this.needsValidation(strategy)) {
          await this.validateAndUpdateStrategy(strategy);
        }
      }

      return strategy;
    } catch (error) {
      console.error(
        `❌ Failed to get navigation strategy for portal ${portalId}:`,
        error
      );
      return null;
    }
  }

  /**
   * Record navigation attempt and learn from outcome
   */
  async recordNavigationAttempt(attempt: NavigationAttempt): Promise<void> {
    if (!this.learningEnabled) return;

    try {
      console.log(
        `📊 Recording navigation attempt for portal: ${attempt.portalId}`
      );

      // Store attempt in memory for analysis
      await agentMemoryService.storeMemory({
        agentId: 'portal-navigator',
        memoryType: 'episodic',
        contextKey: `nav_attempt_${attempt.portalId}_${attempt.timestamp.getTime()}`,
        title: `Navigation Attempt: ${attempt.portalId}`,
        content: attempt,
        importance: attempt.overallResult.success ? 6 : 8, // Failures are more important
        tags: [
          'portal_navigation',
          attempt.portalId,
          attempt.overallResult.success ? 'success' : 'failure',
        ],
        metadata: {
          portalId: attempt.portalId,
          duration: attempt.overallResult.duration,
          success: attempt.overallResult.success,
        },
      });

      // Create learning outcome for the self-improving system
      const learningOutcome = this.createNavigationLearningOutcome(attempt);
      await selfImprovingLearningService.recordLearningOutcome(learningOutcome);

      // Update strategy based on attempt
      await this.updateStrategyFromAttempt(attempt);

      // Check if adaptation is needed
      if (!attempt.overallResult.success) {
        await this.analyzeFailureAndAdapt(attempt);
      }

      console.log(`✅ Navigation attempt recorded and analyzed`);
    } catch (error) {
      console.error('❌ Failed to record navigation attempt:', error);
    }
  }

  /**
   * Adapt navigation strategy based on performance
   */
  async adaptNavigationStrategy(
    portalId: string,
    adaptationReason: string
  ): Promise<void> {
    try {
      const strategy = await this.loadStrategy(portalId);
      if (!strategy) return;

      console.log(
        `🔄 Adapting navigation strategy for ${strategy.portalName}: ${adaptationReason}`
      );

      const adaptations = await this.generateAdaptations(
        strategy,
        adaptationReason
      );

      // Apply adaptations
      for (const adaptation of adaptations) {
        await this.applyAdaptation(strategy, adaptation);
      }

      // Update metadata
      strategy.learningData.lastAdaptation = new Date();
      strategy.learningData.adaptationTriggers.push(adaptationReason);
      strategy.performance.adaptationCount++;

      // Save updated strategy
      await this.saveStrategy(strategy);

      // Record adaptation in learning system
      await this.recordAdaptationLearning(
        strategy,
        adaptations,
        adaptationReason
      );

      console.log(
        `✅ Applied ${adaptations.length} adaptations to ${strategy.portalName}`
      );
    } catch (error) {
      console.error(`❌ Failed to adapt navigation strategy:`, error);
    }
  }

  /**
   * Validate portal strategy against current portal state
   */
  async validatePortalStrategy(portalId: string): Promise<boolean> {
    try {
      const strategy = await this.loadStrategy(portalId);
      if (!strategy) return false;

      console.log(`🔍 Validating portal strategy for ${strategy.portalName}`);

      // Test key selectors
      const validationResults = await this.testSelectors(strategy);

      // Update validation status
      const overallValid =
        validationResults.validCount / validationResults.totalCount > 0.7;
      strategy.learningData.validationStatus = overallValid
        ? 'valid'
        : 'needs_validation';
      strategy.learningData.confidenceScore =
        validationResults.validCount / validationResults.totalCount;

      // Update individual selector scores
      for (const result of validationResults.results) {
        if (strategy.selectors[result.selectorKey]) {
          strategy.selectors[result.selectorKey].adaptiveScore = result.valid
            ? 1.0
            : 0.0;
          strategy.selectors[result.selectorKey].lastValidated = new Date();
        }
      }

      await this.saveStrategy(strategy);

      // If validation failed, trigger adaptation
      if (!overallValid) {
        await this.adaptNavigationStrategy(portalId, 'validation_failure');
      }

      console.log(
        `📊 Strategy validation completed: ${overallValid ? 'VALID' : 'NEEDS ADAPTATION'}`
      );
      return overallValid;
    } catch (error) {
      console.error('❌ Failed to validate portal strategy:', error);
      return false;
    }
  }

  // ============ LEARNING AND ADAPTATION ALGORITHMS ============

  /**
   * Analyze failure patterns and generate adaptive responses
   */
  private async analyzeFailureAndAdapt(
    attempt: NavigationAttempt
  ): Promise<void> {
    const strategy = await this.loadStrategy(attempt.portalId);
    if (!strategy) return;

    // Analyze failure patterns
    const failureAnalysis = this.analyzeFailurePatterns(attempt);

    // Generate adaptive responses
    const adaptiveResponses = this.generateAdaptiveResponses(failureAnalysis);

    // Apply immediate adaptations if confident
    for (const response of adaptiveResponses) {
      if (response.confidence > 0.8) {
        await this.applyAdaptation(strategy, response);
      }
    }

    // Check if strategy needs broader adaptation
    const recentFailures = await this.getRecentFailures(attempt.portalId, 5);
    if (recentFailures.length >= 3) {
      const patterns = this.identifyFailurePatterns(recentFailures);
      if (patterns.length > 0) {
        await this.adaptNavigationStrategy(
          attempt.portalId,
          `pattern_detected_${patterns[0].type}`
        );
      }
    }
  }

  /**
   * Generate adaptations based on performance and feedback
   */
  private async generateAdaptations(
    strategy: PortalNavigationStrategy,
    reason: string
  ): Promise<any[]> {
    const adaptations = [];

    switch (reason) {
      case 'low_success_rate':
        adaptations.push(
          ...(await this.generateSuccessRateAdaptations(strategy))
        );
        break;
      case 'timeout_errors':
        adaptations.push(...this.generateTimingAdaptations(strategy));
        break;
      case 'selector_failures':
        adaptations.push(...(await this.generateSelectorAdaptations(strategy)));
        break;
      case 'validation_failure':
        adaptations.push(
          ...(await this.generateValidationAdaptations(strategy))
        );
        break;
      default:
        adaptations.push(...(await this.generateGenericAdaptations(strategy)));
    }

    return adaptations;
  }

  /**
   * Apply specific adaptation to strategy
   */
  private async applyAdaptation(
    strategy: PortalNavigationStrategy,
    adaptation: any
  ): Promise<void> {
    switch (adaptation.type) {
      case 'timing_adjustment':
        this.applyTimingAdaptation(strategy, adaptation);
        break;
      case 'selector_update':
        await this.applySelectorAdaptation(strategy, adaptation);
        break;
      case 'flow_modification':
        this.applyFlowAdaptation(strategy, adaptation);
        break;
      case 'error_handling_update':
        this.applyErrorHandlingAdaptation(strategy, adaptation);
        break;
    }
  }

  /**
   * Learn optimal timing patterns from successful attempts
   */
  private async learnTimingPatterns(portalId: string): Promise<void> {
    const recentAttempts = await this.getRecentAttempts(portalId, 20);
    const successfulAttempts = recentAttempts.filter(
      a => a.overallResult.success
    );

    if (successfulAttempts.length < 5) return;

    const timingData = this.extractTimingData(successfulAttempts);
    const optimizedTimings = this.calculateOptimalTimings(timingData);

    const strategy = await this.loadStrategy(portalId);
    if (strategy) {
      strategy.timingPatterns = {
        ...strategy.timingPatterns,
        ...optimizedTimings,
      };
      await this.saveStrategy(strategy);
    }
  }

  /**
   * Discover and learn new selectors through exploration
   */
  private async discoverNewSelectors(portalId: string): Promise<void> {
    const strategy = await this.loadStrategy(portalId);
    if (!strategy) return;

    // This would use web scraping to discover current selectors
    const discoveredSelectors = await this.explorePortalSelectors(strategy);

    // Update strategy with new selectors
    for (const [key, selectorData] of Object.entries(discoveredSelectors)) {
      const selector = selectorData as {
        primary: string;
        fallbacks?: string[];
      };
      if (!strategy.selectors[key]) {
        strategy.selectors[key] = {
          primary: selector.primary,
          fallbacks: selector.fallbacks || [],
          adaptiveScore: 0.5, // Start with neutral score
          lastValidated: new Date(),
        };
      } else {
        // Add as fallback if different from current primary
        if (selector.primary !== strategy.selectors[key].primary) {
          if (!strategy.selectors[key].fallbacks.includes(selector.primary)) {
            strategy.selectors[key].fallbacks.unshift(selector.primary);
            // Keep only top 3 fallbacks
            strategy.selectors[key].fallbacks = strategy.selectors[
              key
            ].fallbacks.slice(0, 3);
          }
        }
      }
    }

    await this.saveStrategy(strategy);
  }

  // ============ STRATEGY PERSISTENCE ============

  /**
   * Load navigation strategy from persistent storage
   */
  private async loadStrategy(
    portalId: string
  ): Promise<PortalNavigationStrategy | null> {
    const memory = await agentMemoryService.getMemoryByContext(
      'portal-navigator',
      `strategy_${portalId}`
    );

    return memory ? memory.content : null;
  }

  /**
   * Save navigation strategy to persistent storage
   */
  private async saveStrategy(
    strategy: PortalNavigationStrategy
  ): Promise<void> {
    await agentMemoryService.storeMemory({
      agentId: 'portal-navigator',
      memoryType: 'procedural',
      contextKey: `strategy_${strategy.portalId}`,
      title: `Navigation Strategy: ${strategy.portalName}`,
      content: strategy,
      importance: 9, // High importance for navigation strategies
      tags: ['navigation_strategy', strategy.portalName, strategy.portalId],
      metadata: {
        portalId: strategy.portalId,
        successRate: strategy.performance.successRate,
        lastAdaptation: strategy.learningData.lastAdaptation,
      },
    });

    // Also store as knowledge
    await agentMemoryService.storeKnowledge({
      agentId: 'portal-navigator',
      knowledgeType: 'strategy',
      domain: strategy.portalId,
      title: `Portal Strategy: ${strategy.portalName}`,
      description: `Adaptive navigation strategy for ${strategy.portalName}`,
      content: strategy,
      confidenceScore: strategy.learningData.confidenceScore,
      sourceType: 'experience',
      tags: ['portal_strategy', 'navigation', strategy.portalName],
    });
  }

  /**
   * Create initial strategy for new portal
   */
  private async createInitialStrategy(
    portalId: string
  ): Promise<PortalNavigationStrategy> {
    const portal = await storage.getPortal(portalId);
    if (!portal) throw new Error(`Portal not found: ${portalId}`);

    const strategy: PortalNavigationStrategy = {
      portalId: portal.id,
      portalName: portal.name,
      baseUrl: portal.url,

      navigationFlow: {
        loginSequence: this.createDefaultLoginSequence(),
        searchSequence: this.createDefaultSearchSequence(),
        detailPageSequence: this.createDefaultDetailSequence(),
        documentDownloadSequence: this.createDefaultDownloadSequence(),
      },

      selectors: this.createDefaultSelectors(portal),

      timingPatterns: {
        pageLoadWait: 3000,
        elementWait: 2000,
        downloadWait: 5000,
        retryDelay: 1000,
        adaptiveMultiplier: 1.0,
      },

      errorHandling: {
        commonErrors: [],
        recoveryStrategies: this.createDefaultRecoveryStrategies(),
        escalationThresholds: {
          maxRetries: 3,
          timeoutThreshold: 30000,
          errorRateThreshold: 0.5,
        },
      },

      performance: {
        successRate: 1.0,
        averageLatency: 0,
        errorFrequency: 0,
        lastSuccess: new Date(),
        totalAttempts: 0,
        adaptationCount: 0,
      },

      learningData: {
        createdAt: new Date(),
        lastAdaptation: new Date(),
        adaptationTriggers: [],
        validationStatus: 'needs_validation',
        confidenceScore: 0.5,
      },
    };

    await this.saveStrategy(strategy);
    return strategy;
  }

  // ============ HELPER METHODS ============

  private createNavigationLearningOutcome(attempt: NavigationAttempt): any {
    return {
      type: 'portal_navigation',
      portalId: attempt.portalId,
      agentId: 'portal-navigator',
      context: {
        action: 'portal_navigation',
        strategy: attempt.strategy,
        conditions: {
          portalState: 'active',
          networkConditions: 'normal',
          timestamp: attempt.timestamp,
        },
        inputs: {
          portalId: attempt.portalId,
          navigationSteps: attempt.steps.length,
        },
        expectedOutput: 'successful_navigation',
        actualOutput: attempt.overallResult.success ? 'success' : 'failure',
      },
      outcome: {
        success: attempt.overallResult.success,
        metrics: {
          duration: attempt.overallResult.duration,
          stepsCompleted: attempt.steps.filter(s => s.success).length,
          totalSteps: attempt.steps.length,
        },
        feedback: attempt.overallResult.errorDetails?.message,
        errorDetails: attempt.overallResult.errorDetails,
        improvementAreas: this.identifyNavigationImprovements(attempt),
      },
      learnedPatterns: this.extractNavigationPatterns(attempt),
      adaptations: attempt.overallResult.adaptationsApplied || [],
      confidenceScore: attempt.overallResult.success ? 0.8 : 0.6,
      domain: 'portal_navigation',
      category: 'navigation_automation',
      timestamp: attempt.timestamp,
    };
  }

  private async updateStrategyFromAttempt(
    attempt: NavigationAttempt
  ): Promise<void> {
    const strategy = await this.loadStrategy(attempt.portalId);
    if (!strategy) return;

    // Update performance metrics
    strategy.performance.totalAttempts++;

    const successCount =
      strategy.performance.successRate *
        (strategy.performance.totalAttempts - 1) +
      (attempt.overallResult.success ? 1 : 0);
    strategy.performance.successRate =
      successCount / strategy.performance.totalAttempts;

    if (attempt.overallResult.success) {
      strategy.performance.lastSuccess = attempt.timestamp;
      strategy.performance.averageLatency =
        (strategy.performance.averageLatency + attempt.overallResult.duration) /
        2;
    } else {
      strategy.performance.errorFrequency =
        (strategy.performance.errorFrequency + 1) /
        strategy.performance.totalAttempts;
    }

    // Check if adaptation is needed
    if (strategy.performance.successRate < this.adaptationThreshold) {
      await this.adaptNavigationStrategy(attempt.portalId, 'low_success_rate');
    }

    await this.saveStrategy(strategy);
  }

  private analyzeFailurePatterns(attempt: NavigationAttempt): any {
    const failedSteps = attempt.steps.filter(step => !step.success);

    return {
      failureType: this.categorizeFailure(failedSteps),
      failedSelectors: failedSteps.map(step => step.selector).filter(Boolean),
      commonErrors: failedSteps
        .map(step => step.errorDetails?.message)
        .filter(Boolean),
      failureStage: this.identifyFailureStage(attempt.steps),
      recoverability: this.assessRecoverability(failedSteps),
    };
  }

  private generateAdaptiveResponses(failureAnalysis: any): any[] {
    const responses = [];

    if (failureAnalysis.failureType === 'selector_not_found') {
      responses.push({
        type: 'selector_update',
        confidence: 0.9,
        selectors: failureAnalysis.failedSelectors,
        action: 'discover_alternatives',
      });
    }

    if (failureAnalysis.failureType === 'timeout') {
      responses.push({
        type: 'timing_adjustment',
        confidence: 0.8,
        adjustment: 'increase_wait_times',
        multiplier: 1.5,
      });
    }

    return responses;
  }

  private async getRecentFailures(
    portalId: string,
    count: number
  ): Promise<NavigationAttempt[]> {
    const memories = await agentMemoryService.getAgentMemories(
      'portal-navigator',
      'episodic',
      count * 2
    );

    return memories
      .filter(
        m =>
          m.content.portalId === portalId &&
          !m.content.overallResult.success &&
          Date.now() - new Date(m.createdAt).getTime() < 24 * 60 * 60 * 1000 // Last 24 hours
      )
      .map(m => m.content)
      .slice(0, count);
  }

  private identifyFailurePatterns(failures: NavigationAttempt[]): any[] {
    const patterns = [];

    // Pattern 1: Repeated selector failures
    const selectorFailures = failures
      .flatMap(f => f.steps.filter(s => !s.success && s.selector))
      .reduce((acc: Record<string, number>, step) => {
        acc[step.selector!] = (acc[step.selector!] || 0) + 1;
        return acc;
      }, {});

    for (const [selector, count] of Object.entries(selectorFailures)) {
      if ((count as number) >= 2) {
        patterns.push({
          type: 'repeated_selector_failure',
          selector,
          frequency: count,
          confidence: 0.8,
        });
      }
    }

    // Pattern 2: Timeout patterns
    const timeoutFailures = failures.filter(f =>
      f.steps.some(s => s.errorDetails?.message?.includes('timeout'))
    );

    if (timeoutFailures.length >= 2) {
      patterns.push({
        type: 'timeout_pattern',
        frequency: timeoutFailures.length,
        confidence: 0.7,
      });
    }

    return patterns;
  }

  private async generateSuccessRateAdaptations(
    strategy: PortalNavigationStrategy
  ): Promise<any[]> {
    const adaptations = [];

    // Analyze recent performance
    const recentAttempts = await this.getRecentAttempts(strategy.portalId, 10);
    const failureReasons = this.analyzeFailureReasons(recentAttempts);

    if (failureReasons.selectorFailures > failureReasons.total * 0.5) {
      adaptations.push({
        type: 'selector_update',
        priority: 'high',
        action: 'refresh_selectors',
        confidence: 0.8,
      });
    }

    if (failureReasons.timeoutFailures > failureReasons.total * 0.3) {
      adaptations.push({
        type: 'timing_adjustment',
        priority: 'medium',
        action: 'increase_wait_times',
        multiplier: 1.3,
        confidence: 0.7,
      });
    }

    return adaptations;
  }

  private generateTimingAdaptations(strategy: PortalNavigationStrategy): any[] {
    return [
      {
        type: 'timing_adjustment',
        adjustments: {
          pageLoadWait: strategy.timingPatterns.pageLoadWait * 1.5,
          elementWait: strategy.timingPatterns.elementWait * 1.3,
          retryDelay: strategy.timingPatterns.retryDelay * 1.2,
        },
        confidence: 0.8,
      },
    ];
  }

  private async generateSelectorAdaptations(
    strategy: PortalNavigationStrategy
  ): Promise<any[]> {
    const adaptations = [];

    // Find selectors with low adaptive scores
    const lowScoreSelectors = Object.entries(strategy.selectors)
      .filter(([_, selector]) => selector.adaptiveScore < 0.5)
      .map(([key, _]) => key);

    if (lowScoreSelectors.length > 0) {
      adaptations.push({
        type: 'selector_update',
        selectors: lowScoreSelectors,
        action: 'discover_new_selectors',
        confidence: 0.9,
      });
    }

    return adaptations;
  }

  private async generateValidationAdaptations(
    _strategy: PortalNavigationStrategy
  ): Promise<any[]> {
    return [
      {
        type: 'full_strategy_refresh',
        action: 'revalidate_and_update',
        confidence: 0.7,
      },
    ];
  }

  private async generateGenericAdaptations(
    _strategy: PortalNavigationStrategy
  ): Promise<any[]> {
    return [
      {
        type: 'conservative_adjustment',
        adjustments: {
          increaseWaitTimes: true,
          addRetryLogic: true,
          updateErrorHandling: true,
        },
        confidence: 0.6,
      },
    ];
  }

  private applyTimingAdaptation(
    strategy: PortalNavigationStrategy,
    adaptation: any
  ): void {
    if (adaptation.adjustments) {
      Object.assign(strategy.timingPatterns, adaptation.adjustments);
    }
    if (adaptation.multiplier) {
      strategy.timingPatterns.adaptiveMultiplier *= adaptation.multiplier;
    }
  }

  private async applySelectorAdaptation(
    strategy: PortalNavigationStrategy,
    adaptation: any
  ): Promise<void> {
    if (adaptation.action === 'discover_new_selectors') {
      await this.discoverNewSelectors(strategy.portalId);
    }
    if (adaptation.selectors) {
      // Reset adaptive scores for problematic selectors
      for (const selectorKey of adaptation.selectors) {
        if (strategy.selectors[selectorKey]) {
          strategy.selectors[selectorKey].adaptiveScore = 0.3;
        }
      }
    }
  }

  private applyFlowAdaptation(
    _strategy: PortalNavigationStrategy,
    _adaptation: any
  ): void {
    // Implementation would modify navigation flows based on adaptation
  }

  private applyErrorHandlingAdaptation(
    _strategy: PortalNavigationStrategy,
    _adaptation: any
  ): void {
    // Implementation would update error handling strategies
  }

  private async recordAdaptationLearning(
    strategy: PortalNavigationStrategy,
    adaptations: any[],
    reason: string
  ): Promise<void> {
    await agentMemoryService.storeMemory({
      agentId: 'portal-navigator',
      memoryType: 'episodic',
      contextKey: `adaptation_${strategy.portalId}_${Date.now()}`,
      title: `Strategy Adaptation: ${strategy.portalName}`,
      content: {
        portalId: strategy.portalId,
        reason,
        adaptations,
        performanceBefore: { ...strategy.performance },
        timestamp: new Date(),
      },
      importance: 8,
      tags: ['adaptation', 'strategy_update', strategy.portalName],
      metadata: {
        portalId: strategy.portalId,
        adaptationCount: adaptations.length,
        reason,
      },
    });
  }

  private async needsValidation(
    strategy: PortalNavigationStrategy
  ): Promise<boolean> {
    const timeSinceValidation =
      Date.now() - strategy.learningData.lastAdaptation.getTime();
    return (
      timeSinceValidation > this.validationInterval ||
      strategy.learningData.validationStatus === 'needs_validation'
    );
  }

  private async validateAndUpdateStrategy(
    strategy: PortalNavigationStrategy
  ): Promise<void> {
    await this.validatePortalStrategy(strategy.portalId);
  }

  private async testSelectors(
    strategy: PortalNavigationStrategy
  ): Promise<any> {
    // Mock implementation - would actually test selectors against live portal
    const results = [];
    let validCount = 0;

    for (const [key, selector] of Object.entries(strategy.selectors)) {
      const valid = Math.random() > 0.3; // Mock test result
      results.push({
        selectorKey: key,
        selector: selector.primary,
        valid,
      });
      if (valid) validCount++;
    }

    return {
      results,
      validCount,
      totalCount: results.length,
    };
  }

  private async explorePortalSelectors(
    _strategy: PortalNavigationStrategy
  ): Promise<any> {
    // Mock implementation - would use web scraping to discover current selectors
    return {
      search_input: {
        primary: '#search-input',
        fallbacks: ['input[name="search"]', '.search-box input'],
      },
      login_button: {
        primary: '#login-btn',
        fallbacks: ['button[type="submit"]', '.login-button'],
      },
    };
  }

  private createDefaultLoginSequence(): NavigationStep[] {
    return [
      { action: 'navigate', selector: 'login_page', timeout: 5000 },
      { action: 'type', selector: 'username_input', value: '{username}' },
      { action: 'type', selector: 'password_input', value: '{password}' },
      { action: 'click', selector: 'login_button' },
      { action: 'wait', waitCondition: 'page_load', timeout: 10000 },
    ];
  }

  private createDefaultSearchSequence(): NavigationStep[] {
    return [
      { action: 'click', selector: 'search_input' },
      { action: 'type', selector: 'search_input', value: '{search_term}' },
      { action: 'click', selector: 'search_button' },
      { action: 'wait', waitCondition: 'results_load', timeout: 8000 },
    ];
  }

  private createDefaultDetailSequence(): NavigationStep[] {
    return [
      { action: 'click', selector: 'rfp_link' },
      { action: 'wait', waitCondition: 'detail_page_load', timeout: 8000 },
      {
        action: 'validate',
        validationRules: ['title_present', 'deadline_present'],
      },
    ];
  }

  private createDefaultDownloadSequence(): NavigationStep[] {
    return [
      { action: 'click', selector: 'download_link' },
      { action: 'wait', waitCondition: 'download_start', timeout: 5000 },
    ];
  }

  private createDefaultSelectors(portal: any): any {
    // Create default selectors based on portal configuration
    const baseSelectors = {
      search_input: {
        primary: '#search',
        fallbacks: ['input[name="search"]', '.search-input'],
        adaptiveScore: 0.5,
        lastValidated: new Date(),
      },
      search_button: {
        primary: '#search-btn',
        fallbacks: ['button[type="submit"]', '.search-button'],
        adaptiveScore: 0.5,
        lastValidated: new Date(),
      },
    };

    // Merge with portal-specific selectors if available
    if (portal.selectors) {
      Object.assign(baseSelectors, portal.selectors);
    }

    return baseSelectors;
  }

  private createDefaultRecoveryStrategies(): RecoveryStrategy[] {
    return [
      {
        name: 'page_refresh',
        description: 'Refresh the page and retry',
        applicableErrors: ['timeout', 'element_not_found'],
        steps: [
          { action: 'navigate', selector: 'current_page' },
          { action: 'wait', waitCondition: 'page_load', timeout: 10000 },
        ],
        successRate: 0.7,
        averageRecoveryTime: 5000,
      },
    ];
  }

  private identifyNavigationImprovements(attempt: NavigationAttempt): string[] {
    const improvements = [];

    const failedSteps = attempt.steps.filter(s => !s.success);
    if (failedSteps.length > 0) {
      improvements.push('selector_reliability');
      improvements.push('error_handling');
    }

    if (attempt.overallResult.duration > 30000) {
      improvements.push('timing_optimization');
    }

    return improvements;
  }

  private extractNavigationPatterns(attempt: NavigationAttempt): string[] {
    const patterns = [];

    if (attempt.overallResult.success) {
      patterns.push(`successful_navigation_${attempt.portalId}`);
    }

    const fastExecution = attempt.overallResult.duration < 15000;
    if (fastExecution && attempt.overallResult.success) {
      patterns.push('efficient_navigation');
    }

    return patterns;
  }

  private categorizeFailure(failedSteps: any[]): string {
    if (failedSteps.some(s => s.errorDetails?.message?.includes('timeout'))) {
      return 'timeout';
    }
    if (failedSteps.some(s => s.errorDetails?.message?.includes('not found'))) {
      return 'selector_not_found';
    }
    return 'unknown';
  }

  private identifyFailureStage(steps: any[]): string {
    const failedIndex = steps.findIndex(s => !s.success);
    if (failedIndex < steps.length * 0.3) return 'early';
    if (failedIndex < steps.length * 0.7) return 'middle';
    return 'late';
  }

  private assessRecoverability(failedSteps: any[]): 'high' | 'medium' | 'low' {
    if (failedSteps.length <= 1) return 'high';
    if (failedSteps.length <= 3) return 'medium';
    return 'low';
  }

  private async getRecentAttempts(
    portalId: string,
    count: number
  ): Promise<NavigationAttempt[]> {
    const memories = await agentMemoryService.getAgentMemories(
      'portal-navigator',
      'episodic',
      count * 2
    );

    return memories
      .filter(m => m.content.portalId === portalId)
      .map(m => m.content)
      .slice(0, count);
  }

  private analyzeFailureReasons(attempts: NavigationAttempt[]): any {
    let selectorFailures = 0;
    let timeoutFailures = 0;
    let total = 0;

    for (const attempt of attempts) {
      if (!attempt.overallResult.success) {
        total++;
        const errorMessage = attempt.overallResult.errorDetails?.message || '';
        if (
          errorMessage.includes('not found') ||
          errorMessage.includes('selector')
        ) {
          selectorFailures++;
        }
        if (errorMessage.includes('timeout')) {
          timeoutFailures++;
        }
      }
    }

    return { selectorFailures, timeoutFailures, total };
  }

  private extractTimingData(attempts: NavigationAttempt[]): any {
    return {
      averageDuration:
        attempts.reduce((sum, a) => sum + a.overallResult.duration, 0) /
        attempts.length,
      stepTimings: attempts.flatMap(a =>
        a.steps.map(s => ({ action: s.action, duration: s.duration }))
      ),
    };
  }

  private calculateOptimalTimings(timingData: any): any {
    return {
      pageLoadWait: Math.max(3000, timingData.averageDuration * 0.2),
      elementWait: Math.max(2000, timingData.averageDuration * 0.1),
      downloadWait: Math.max(5000, timingData.averageDuration * 0.3),
    };
  }
}

export const adaptivePortalNavigator = AdaptivePortalNavigator.getInstance();
