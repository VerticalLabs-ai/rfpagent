import { storage } from '../../storage';
import { enhancedSaflaLearningEngine } from '../learning/saflaLearningEngine.enhanced';

/**
 * Prediction Log for tracking AI predictions and outcomes
 *
 * To fully enable prediction tracking, add this table to your schema:
 *
 * CREATE TABLE prediction_logs (
 *   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
 *   prediction_type VARCHAR(50) NOT NULL, -- 'winProbability', 'cost', 'timeline', 'risk'
 *   rfp_id UUID REFERENCES rfps(id),
 *   predicted_value DECIMAL NOT NULL,
 *   actual_value DECIMAL, -- NULL until outcome is known
 *   metadata JSONB,
 *   created_at TIMESTAMP DEFAULT NOW(),
 *   updated_at TIMESTAMP DEFAULT NOW()
 * );
 *
 * And add storage.getPredictionLogs() method to fetch recent/completed logs.
 */
export interface PredictionLog {
  id: string;
  timestamp: Date;
  predictionType: 'winProbability' | 'cost' | 'timeline' | 'risk';
  rfpId?: string;
  predictedValue: number;
  actualValue?: number | null;
  metadata?: Record<string, any>;
}

/**
 * Prediction bucket containing actual and predicted values for a specific metric
 */
export interface PredictionBucket {
  actual: number[];
  predicted: number[];
}

/**
 * Recent predictions grouped by prediction type
 */
export interface RecentPredictions {
  winProbability: PredictionBucket;
  cost: PredictionBucket;
  timeline: PredictionBucket;
  risk: PredictionBucket;
}

/**
 * Prediction log entry from storage matching getPredictionLogs structure
 */
export interface PredictionLogEntry {
  predictionType: 'winProbability' | 'cost' | 'timeline' | 'risk';
  predictedValue: number;
  actualValue: number | null | undefined;
  [key: string]: any; // Allow additional fields
}

/**
 * Intelligence Benchmarking System
 *
 * Comprehensive benchmarks to measure agent intelligence and learning effectiveness:
 *
 * 1. LEARNING EFFECTIVENESS
 *    - Success rate improvement over time
 *    - Strategy adaptation speed
 *    - Error reduction rate
 *    - Knowledge retention
 *
 * 2. PREDICTION ACCURACY
 *    - Win probability accuracy
 *    - Cost estimation error
 *    - Timeline prediction accuracy
 *    - Risk assessment precision
 *
 * 3. DECISION QUALITY
 *    - Optimal strategy selection rate
 *    - Context-awareness score
 *    - Multi-agent consensus quality
 *    - Transfer learning success
 *
 * 4. OPERATIONAL EFFICIENCY
 *    - Task completion time
 *    - Resource utilization
 *    - Parallel execution efficiency
 *    - Error recovery rate
 *
 * 5. BUSINESS IMPACT
 *    - Win rate improvement
 *    - Cost savings
 *    - Time savings
 *    - Quality improvements
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface BenchmarkMetrics {
  timestamp: Date;
  period: 'daily' | 'weekly' | 'monthly';

  learning: LearningMetrics;
  prediction: PredictionMetrics;
  decision: DecisionMetrics;
  operational: OperationalMetrics;
  business: BusinessMetrics;
}

export interface LearningMetrics {
  successRateImprovement: number; // % improvement
  strategyAdaptationSpeed: number; // iterations to converge
  errorReductionRate: number; // % reduction per week
  knowledgeRetention: number; // % retained after 30 days
  averageConfidence: number; // 0-1
  activeStrategies: number;
  learningEventsProcessed: number;
}

export interface PredictionMetrics {
  winProbabilityMAE: number; // Mean Absolute Error
  costEstimationMAPE: number; // Mean Absolute Percentage Error
  timelinePredictionAccuracy: number; // % within 10%
  riskAssessmentF1Score: number; // F1 score
  calibrationScore: number; // How well calibrated are probabilities
}

export interface DecisionMetrics {
  optimalStrategyRate: number; // % of optimal decisions
  contextAwarenessScore: number; // 0-1
  consensusQuality: number; // Agreement level in multi-agent
  transferLearningSuccess: number; // % successful transfers
  explorationBalance: number; // Balance of explore vs exploit
}

export interface OperationalMetrics {
  averageTaskCompletionTime: number; // milliseconds
  resourceUtilization: number; // %
  parallelExecutionEfficiency: number; // %
  errorRecoveryRate: number; // %
  throughput: number; // tasks/hour
  uptime: number; // %
}

export interface BusinessMetrics {
  winRateImprovement: number; // % improvement
  costSavings: number; // $
  timeSavings: number; // hours
  qualityScore: number; // 0-100
  customerSatisfaction: number; // 0-100
  ROI: number; // %
}

export interface BenchmarkReport {
  summary: string;
  overallScore: number; // 0-100
  metrics: BenchmarkMetrics;
  trends: {
    metric: string;
    direction: 'improving' | 'stable' | 'declining';
    change: number;
  }[];
  recommendations: string[];
  alerts: Array<{
    severity: 'info' | 'warning' | 'critical';
    message: string;
  }>;
}

// ============================================================================
// INTELLIGENCE BENCHMARKING SERVICE
// ============================================================================

export class IntelligenceBenchmarks {
  private static instance: IntelligenceBenchmarks;

  // Benchmark history
  private benchmarkHistory: BenchmarkMetrics[] = [];

  // Baseline metrics for comparison
  private baseline: BenchmarkMetrics | null = null;

  public static getInstance(): IntelligenceBenchmarks {
    if (!IntelligenceBenchmarks.instance) {
      IntelligenceBenchmarks.instance = new IntelligenceBenchmarks();
    }
    return IntelligenceBenchmarks.instance;
  }

  // ========================================================================
  // MAIN BENCHMARKING METHODS
  // ========================================================================

  /**
   * Run complete benchmark suite
   */
  async runCompleteBenchmark(
    period: 'daily' | 'weekly' | 'monthly' = 'daily'
  ): Promise<BenchmarkReport> {
    // Validate period parameter
    const validPeriods = ['daily', 'weekly', 'monthly'] as const;
    const validatedPeriod = validPeriods.includes(period as any)
      ? period
      : 'daily';

    if (!validPeriods.includes(period as any)) {
      console.warn(
        `⚠️ Invalid period "${period}" provided. Defaulting to "daily".`
      );
    }

    console.log(`🔬 Running ${validatedPeriod} benchmark suite...`);

    const metrics: BenchmarkMetrics = {
      timestamp: new Date(),
      period: validatedPeriod,
      learning: await this.measureLearningMetrics(),
      prediction: await this.measurePredictionMetrics(),
      decision: await this.measureDecisionMetrics(),
      operational: await this.measureOperationalMetrics(),
      business: await this.measureBusinessMetrics(),
    };

    // Store in history
    this.benchmarkHistory.push(metrics);

    // Generate report
    const report = this.generateBenchmarkReport(metrics);

    console.log(
      `✅ Benchmark complete. Overall score: ${report.overallScore}/100`
    );

    return report;
  }

  /**
   * Measure learning effectiveness
   */
  private async measureLearningMetrics(): Promise<LearningMetrics> {
    try {
      const enhancedMetrics =
        await enhancedSaflaLearningEngine.getEnhancedMetrics();

      // Calculate success rate improvement
      const successRateImprovement =
        await this.calculateSuccessRateImprovement();

      // Calculate strategy adaptation speed
      const adaptationSpeed = await this.calculateAdaptationSpeed();

      // Calculate error reduction rate
      const errorReductionRate = await this.calculateErrorReductionRate();

      // Calculate knowledge retention
      const knowledgeRetention = await this.calculateKnowledgeRetention();

      return {
        successRateImprovement,
        strategyAdaptationSpeed: adaptationSpeed,
        errorReductionRate,
        knowledgeRetention,
        averageConfidence: enhancedMetrics.learning.averageConfidence,
        activeStrategies: enhancedMetrics.learning.activeStrategies,
        learningEventsProcessed: enhancedMetrics.learning.totalEvents,
      };
    } catch (error) {
      console.error('Error measuring learning metrics:', error);
      return this.getDefaultLearningMetrics();
    }
  }

  /**
   * Measure prediction accuracy
   */
  private async measurePredictionMetrics(): Promise<PredictionMetrics> {
    try {
      // Get prediction results from last period
      const predictions = await this.getRecentPredictions();

      // Calculate Mean Absolute Error for win probability
      const winProbabilityMAE = this.calculateMAE(
        predictions.winProbability.actual,
        predictions.winProbability.predicted
      );

      // Calculate MAPE for cost estimation
      const costEstimationMAPE = this.calculateMAPE(
        predictions.cost.actual,
        predictions.cost.predicted
      );

      // Calculate timeline accuracy
      const timelinePredictionAccuracy = this.calculateAccuracyWithinThreshold(
        predictions.timeline.actual,
        predictions.timeline.predicted,
        0.1 // 10% threshold
      );

      // Calculate F1 score for risk assessment
      const riskAssessmentF1Score = this.calculateF1Score(
        predictions.risk.actual,
        predictions.risk.predicted
      );

      // Calculate calibration score
      const calibrationScore = this.calculateCalibration(
        predictions.winProbability.actual,
        predictions.winProbability.predicted
      );

      return {
        winProbabilityMAE,
        costEstimationMAPE,
        timelinePredictionAccuracy,
        riskAssessmentF1Score,
        calibrationScore,
      };
    } catch (error) {
      console.error('Error measuring prediction metrics:', error);
      return this.getDefaultPredictionMetrics();
    }
  }

  /**
   * Measure decision quality
   */
  private async measureDecisionMetrics(): Promise<DecisionMetrics> {
    try {
      // Get decision logs
      const decisions = await this.getRecentDecisions();

      // Calculate optimal strategy rate
      const optimalStrategyRate = decisions.optimal / decisions.total;

      // Calculate context awareness score
      const contextAwarenessScore = await this.calculateContextAwareness();

      // Calculate consensus quality
      const consensusQuality = await this.calculateConsensusQuality();

      // Calculate transfer learning success
      const transferLearningSuccess =
        await this.calculateTransferLearningSuccess();

      // Calculate exploration balance
      const enhancedMetrics =
        await enhancedSaflaLearningEngine.getEnhancedMetrics();
      const explorationBalance =
        1 -
        Math.abs(
          enhancedMetrics.reinforcement.explorationRate -
            enhancedMetrics.reinforcement.exploitationRate
        );

      return {
        optimalStrategyRate,
        contextAwarenessScore,
        consensusQuality,
        transferLearningSuccess,
        explorationBalance,
      };
    } catch (error) {
      console.error('Error measuring decision metrics:', error);
      return this.getDefaultDecisionMetrics();
    }
  }

  /**
   * Measure operational efficiency
   */
  private async measureOperationalMetrics(): Promise<OperationalMetrics> {
    try {
      const workItems = await storage.getWorkItems({ limit: 100 });

      // Calculate average task completion time
      const completedItems = workItems.filter(
        w => w.completedAt && w.startedAt
      );
      const avgCompletionTime =
        completedItems.length > 0
          ? completedItems.reduce((sum, w) => {
              const duration =
                new Date(w.completedAt!).getTime() -
                new Date(w.startedAt!).getTime();
              return sum + duration;
            }, 0) / completedItems.length
          : 0;

      // Calculate resource utilization
      const resourceUtilization = await this.calculateResourceUtilization();

      // Calculate parallel execution efficiency
      const parallelEfficiency = await this.calculateParallelEfficiency();

      // Calculate error recovery rate
      const failedItems = workItems.filter(w => w.status === 'failed');
      const recoveredItems = failedItems.filter(
        w => w.retries && w.retries > 0
      );
      const errorRecoveryRate =
        failedItems.length > 0
          ? recoveredItems.length / failedItems.length
          : 1.0;

      // Calculate throughput
      const hoursSinceFirstItem =
        (Date.now() -
          new Date(workItems[0]?.createdAt || Date.now()).getTime()) /
        (1000 * 60 * 60);
      const throughput =
        hoursSinceFirstItem > 0
          ? completedItems.length / hoursSinceFirstItem
          : 0;

      // Assume 99% uptime
      const uptime = 0.99;

      return {
        averageTaskCompletionTime: avgCompletionTime,
        resourceUtilization,
        parallelExecutionEfficiency: parallelEfficiency,
        errorRecoveryRate,
        throughput,
        uptime,
      };
    } catch (error) {
      console.error('Error measuring operational metrics:', error);
      return this.getDefaultOperationalMetrics();
    }
  }

  /**
   * Measure business impact
   */
  private async measureBusinessMetrics(): Promise<BusinessMetrics> {
    try {
      // Calculate win rate improvement
      const winRateImprovement = await this.calculateWinRateImprovement();

      // Calculate cost savings from automation
      const costSavings = await this.calculateCostSavings();

      // Calculate time savings
      const timeSavings = await this.calculateTimeSavings();

      // Quality score (composite of multiple factors)
      const qualityScore = await this.calculateQualityScore();

      // Customer satisfaction (from feedback)
      const customerSatisfaction = await this.calculateCustomerSatisfaction();

      // Calculate ROI
      const ROI = costSavings > 0 ? (costSavings / 100000) * 100 : 0; // Assume $100k investment

      return {
        winRateImprovement,
        costSavings,
        timeSavings,
        qualityScore,
        customerSatisfaction,
        ROI,
      };
    } catch (error) {
      console.error('Error measuring business metrics:', error);
      return this.getDefaultBusinessMetrics();
    }
  }

  // ========================================================================
  // REPORT GENERATION
  // ========================================================================

  /**
   * Generate comprehensive benchmark report
   */
  private generateBenchmarkReport(metrics: BenchmarkMetrics): BenchmarkReport {
    // Calculate overall score (weighted average)
    const overallScore = this.calculateOverallScore(metrics);

    // Analyze trends
    const trends = this.analyzeTrends(metrics);

    // Generate recommendations
    const recommendations = this.generateRecommendations(metrics, trends);

    // Generate alerts
    const alerts = this.generateAlerts(metrics, trends);

    // Generate summary
    const summary = this.generateSummary(metrics, overallScore, trends);

    return {
      summary,
      overallScore,
      metrics,
      trends,
      recommendations,
      alerts,
    };
  }

  /**
   * Calculate overall intelligence score
   */
  private calculateOverallScore(metrics: BenchmarkMetrics): number {
    const weights = {
      learning: 0.25,
      prediction: 0.25,
      decision: 0.2,
      operational: 0.15,
      business: 0.15,
    };

    // Normalize each category to 0-100 scale
    const learningScore =
      metrics.learning.successRateImprovement * 100 * 0.3 +
      metrics.learning.averageConfidence * 100 * 0.3 +
      metrics.learning.knowledgeRetention * 100 * 0.2 +
      (1 - metrics.learning.errorReductionRate) * 100 * 0.2;

    const predictionScore =
      (1 - Math.min(metrics.prediction.winProbabilityMAE, 0.5) / 0.5) *
        100 *
        0.25 +
      (1 - Math.min(metrics.prediction.costEstimationMAPE, 0.3) / 0.3) *
        100 *
        0.25 +
      metrics.prediction.timelinePredictionAccuracy * 100 * 0.25 +
      metrics.prediction.calibrationScore * 100 * 0.25;

    const decisionScore =
      metrics.decision.optimalStrategyRate * 100 * 0.3 +
      metrics.decision.contextAwarenessScore * 100 * 0.25 +
      metrics.decision.consensusQuality * 100 * 0.25 +
      metrics.decision.explorationBalance * 100 * 0.2;

    const operationalScore =
      metrics.operational.resourceUtilization * 100 * 0.25 +
      metrics.operational.parallelExecutionEfficiency * 100 * 0.25 +
      metrics.operational.errorRecoveryRate * 100 * 0.25 +
      metrics.operational.uptime * 100 * 0.25;

    const businessScore =
      (Math.min(metrics.business.winRateImprovement, 0.5) / 0.5) * 100 * 0.25 +
      metrics.business.qualityScore * 0.25 +
      metrics.business.customerSatisfaction * 0.25 +
      (Math.min(metrics.business.ROI, 200) / 200) * 100 * 0.25;

    const overallScore =
      learningScore * weights.learning +
      predictionScore * weights.prediction +
      decisionScore * weights.decision +
      operationalScore * weights.operational +
      businessScore * weights.business;

    return Math.round(overallScore);
  }

  /**
   * Analyze trends from historical data
   */
  private analyzeTrends(currentMetrics: BenchmarkMetrics): Array<{
    metric: string;
    direction: 'improving' | 'stable' | 'declining';
    change: number;
  }> {
    if (this.benchmarkHistory.length < 2) {
      return [];
    }

    const previousMetrics =
      this.benchmarkHistory[this.benchmarkHistory.length - 2];
    const trends: Array<{
      metric: string;
      direction: 'improving' | 'stable' | 'declining';
      change: number;
    }> = [];

    // Learning trends
    const successRateChange =
      currentMetrics.learning.successRateImprovement -
      previousMetrics.learning.successRateImprovement;
    trends.push({
      metric: 'Success Rate',
      direction:
        successRateChange > 0.02
          ? 'improving'
          : successRateChange < -0.02
            ? 'declining'
            : 'stable',
      change: successRateChange,
    });

    // Prediction trends
    const predictionChange =
      previousMetrics.prediction.winProbabilityMAE -
      currentMetrics.prediction.winProbabilityMAE;
    trends.push({
      metric: 'Win Probability Accuracy',
      direction:
        predictionChange > 0.01
          ? 'improving'
          : predictionChange < -0.01
            ? 'declining'
            : 'stable',
      change: predictionChange,
    });

    // Business trends
    const winRateChange =
      currentMetrics.business.winRateImprovement -
      previousMetrics.business.winRateImprovement;
    trends.push({
      metric: 'Win Rate',
      direction:
        winRateChange > 0.01
          ? 'improving'
          : winRateChange < -0.01
            ? 'declining'
            : 'stable',
      change: winRateChange,
    });

    return trends;
  }

  /**
   * Generate actionable recommendations
   */
  private generateRecommendations(
    metrics: BenchmarkMetrics,
    trends: any[]
  ): string[] {
    const recommendations: string[] = [];

    // Learning recommendations
    if (metrics.learning.averageConfidence < 0.7) {
      recommendations.push(
        'Increase sample size for learning - confidence is below optimal threshold'
      );
    }

    if (metrics.learning.strategyAdaptationSpeed > 100) {
      recommendations.push(
        'Consider adjusting learning rate - strategies are slow to converge'
      );
    }

    // Prediction recommendations
    if (metrics.prediction.winProbabilityMAE > 0.15) {
      recommendations.push(
        'Improve win probability model - prediction error is above acceptable threshold'
      );
    }

    if (metrics.prediction.calibrationScore < 0.7) {
      recommendations.push(
        'Recalibrate probability predictions - confidence scores are poorly calibrated'
      );
    }

    // Decision recommendations
    if (metrics.decision.optimalStrategyRate < 0.75) {
      recommendations.push(
        'Increase exploration rate - too many suboptimal decisions'
      );
    }

    if (metrics.decision.consensusQuality < 0.7) {
      recommendations.push(
        'Review multi-agent consensus mechanism - agreement levels are low'
      );
    }

    // Operational recommendations
    if (metrics.operational.resourceUtilization < 0.6) {
      recommendations.push(
        'Optimize resource allocation - system is underutilized'
      );
    }

    if (metrics.operational.errorRecoveryRate < 0.8) {
      recommendations.push('Improve error handling and retry logic');
    }

    // Business recommendations
    if (metrics.business.ROI < 50) {
      recommendations.push('Focus on high-value RFPs to improve ROI');
    }

    return recommendations;
  }

  /**
   * Generate alerts for critical issues
   */
  private generateAlerts(
    metrics: BenchmarkMetrics,
    trends: any[]
  ): Array<{
    severity: 'info' | 'warning' | 'critical';
    message: string;
  }> {
    const alerts: Array<{
      severity: 'info' | 'warning' | 'critical';
      message: string;
    }> = [];

    // Critical alerts
    if (metrics.operational.uptime < 0.95) {
      alerts.push({
        severity: 'critical',
        message: `System uptime at ${(metrics.operational.uptime * 100).toFixed(1)}% - below SLA`,
      });
    }

    if (metrics.learning.averageConfidence < 0.5) {
      alerts.push({
        severity: 'critical',
        message: 'Learning confidence critically low - manual review required',
      });
    }

    // Warning alerts
    if (metrics.prediction.winProbabilityMAE > 0.2) {
      alerts.push({
        severity: 'warning',
        message: 'Win probability predictions showing high error rate',
      });
    }

    if (metrics.operational.errorRecoveryRate < 0.7) {
      alerts.push({
        severity: 'warning',
        message:
          'Error recovery rate below threshold - investigate failure patterns',
      });
    }

    // Info alerts
    const decliningTrends = trends.filter(t => t.direction === 'declining');
    if (decliningTrends.length > 0) {
      alerts.push({
        severity: 'info',
        message: `${decliningTrends.length} metrics showing declining trend`,
      });
    }

    return alerts;
  }

  /**
   * Generate executive summary
   */
  private generateSummary(
    metrics: BenchmarkMetrics,
    overallScore: number,
    trends: any[]
  ): string {
    const grade =
      overallScore >= 90
        ? 'Excellent'
        : overallScore >= 80
          ? 'Good'
          : overallScore >= 70
            ? 'Satisfactory'
            : overallScore >= 60
              ? 'Needs Improvement'
              : 'Critical';

    const improvingCount = trends.filter(
      t => t.direction === 'improving'
    ).length;
    const decliningCount = trends.filter(
      t => t.direction === 'declining'
    ).length;

    return `
Intelligence Score: ${overallScore}/100 (${grade})

Performance Summary:
- Learning: ${metrics.learning.activeStrategies} active strategies, ${(metrics.learning.averageConfidence * 100).toFixed(1)}% confidence
- Prediction: ${(metrics.prediction.timelinePredictionAccuracy * 100).toFixed(1)}% timeline accuracy, ${(metrics.prediction.winProbabilityMAE * 100).toFixed(1)}% win prediction error
- Decisions: ${(metrics.decision.optimalStrategyRate * 100).toFixed(1)}% optimal, ${(metrics.decision.contextAwarenessScore * 100).toFixed(1)}% context-aware
- Operations: ${metrics.operational.throughput.toFixed(1)} tasks/hour, ${(metrics.operational.uptime * 100).toFixed(1)}% uptime
- Business: ${(metrics.business.winRateImprovement * 100).toFixed(1)}% win rate improvement, $${metrics.business.costSavings.toLocaleString()} saved

Trends: ${improvingCount} improving, ${decliningCount} declining
    `.trim();
  }

  // ========================================================================
  // HELPER CALCULATION METHODS
  // ========================================================================

  private async calculateSuccessRateImprovement(): Promise<number> {
    // TODO: Track success rates over time with historical data
    // For now, compare recent vs older work item success rates
    try {
      const workItems = await storage.getWorkItems({ limit: 100 });
      if (workItems.length < 20) return 0;

      const older = workItems.slice(50);
      const recent = workItems.slice(0, 50);

      const olderSuccessRate =
        older.filter(w => w.status === 'completed').length / older.length;
      const recentSuccessRate =
        recent.filter(w => w.status === 'completed').length / recent.length;

      return recentSuccessRate - olderSuccessRate;
    } catch (error) {
      console.error('Error calculating success rate improvement:', error);
      return 0;
    }
  }

  private async calculateAdaptationSpeed(): Promise<number> {
    // TODO: Track number of iterations for strategies to converge
    // For now, analyze from learning events
    try {
      const enhancedMetrics =
        await enhancedSaflaLearningEngine.getEnhancedMetrics();
      // Use inverse of learning rate as proxy for adaptation speed
      // Lower is better (fewer iterations to converge)
      return Math.round(
        1 / Math.max(enhancedMetrics.learning.averageConfidence, 0.01)
      );
    } catch (error) {
      console.error('Error calculating adaptation speed:', error);
      return 50;
    }
  }

  private async calculateErrorReductionRate(): Promise<number> {
    // TODO: Track error rates over time
    // For now, analyze failed vs successful work items
    try {
      const workItems = await storage.getWorkItems({ limit: 100 });
      if (workItems.length === 0) return 0;

      const older = workItems.slice(50);
      const recent = workItems.slice(0, 50);

      const olderErrorRate =
        older.filter(w => w.status === 'failed').length / older.length;
      const recentErrorRate =
        recent.filter(w => w.status === 'failed').length / recent.length;

      return olderErrorRate - recentErrorRate;
    } catch (error) {
      console.error('Error calculating error reduction rate:', error);
      return 0;
    }
  }

  private async calculateKnowledgeRetention(): Promise<number> {
    // TODO: Implement knowledge retention tracking over time
    // For now, use learning metrics as proxy
    try {
      const enhancedMetrics =
        await enhancedSaflaLearningEngine.getEnhancedMetrics();
      return enhancedMetrics.learning.averageConfidence;
    } catch (error) {
      console.error('Error calculating knowledge retention:', error);
      return 0.5;
    }
  }

  private async getRecentPredictions(): Promise<RecentPredictions> {
    try {
      // Attempt to fetch prediction logs from persistent storage
      const predictionLogs: PredictionLogEntry[] | undefined =
        await (storage as any).getPredictionLogs?.();

      if (!predictionLogs || predictionLogs.length === 0) {
        // No prediction logs available
        return {
          winProbability: { actual: [], predicted: [] },
          cost: { actual: [], predicted: [] },
          timeline: { actual: [], predicted: [] },
          risk: { actual: [], predicted: [] },
        };
      }

      // Group logs by prediction type
      const result: RecentPredictions = {
        winProbability: { actual: [], predicted: [] },
        cost: { actual: [], predicted: [] },
        timeline: { actual: [], predicted: [] },
        risk: { actual: [], predicted: [] },
      };

      for (const log of predictionLogs) {
        // Only include logs that have both predicted and actual values
        if (
          log.predictedValue != null &&
          log.actualValue != null &&
          log.predictionType
        ) {
          const type = log.predictionType;

          if (type === 'winProbability' && result.winProbability) {
            result.winProbability.predicted.push(log.predictedValue);
            result.winProbability.actual.push(log.actualValue);
          } else if (type === 'cost' && result.cost) {
            result.cost.predicted.push(log.predictedValue);
            result.cost.actual.push(log.actualValue);
          } else if (type === 'timeline' && result.timeline) {
            result.timeline.predicted.push(log.predictedValue);
            result.timeline.actual.push(log.actualValue);
          } else if (type === 'risk' && result.risk) {
            result.risk.predicted.push(log.predictedValue);
            result.risk.actual.push(log.actualValue);
          }
        }
      }

      return result;
    } catch (error) {
      // Log error but don't throw - fall back to empty structure
      console.error('Error fetching prediction logs:', error);

      return {
        winProbability: { actual: [], predicted: [] },
        cost: { actual: [], predicted: [] },
        timeline: { actual: [], predicted: [] },
        risk: { actual: [], predicted: [] },
      };
    }
  }

  private calculateMAE(actual: number[], predicted: number[]): number {
    if (actual.length !== predicted.length || actual.length === 0) return 0;
    return (
      actual.reduce((sum, val, i) => sum + Math.abs(val - predicted[i]), 0) /
      actual.length
    );
  }

  private calculateMAPE(actual: number[], predicted: number[]): number {
    if (actual.length !== predicted.length || actual.length === 0) return 0;

    let sumAbsolutePercentageErrors = 0;
    let nonZeroCount = 0;

    for (let i = 0; i < actual.length; i++) {
      if (actual[i] !== 0) {
        sumAbsolutePercentageErrors += Math.abs(
          (actual[i] - predicted[i]) / actual[i]
        );
        nonZeroCount++;
      }
    }

    return nonZeroCount === 0 ? 0 : sumAbsolutePercentageErrors / nonZeroCount;
  }

  private calculateAccuracyWithinThreshold(
    actual: number[],
    predicted: number[],
    threshold: number
  ): number {
    if (actual.length !== predicted.length || actual.length === 0) return 0;
    const withinThreshold = actual.filter((val, i) => {
      const error = Math.abs(val - predicted[i]) / val;
      return error <= threshold;
    }).length;
    return withinThreshold / actual.length;
  }

  private calculateF1Score(actual: number[], predicted: number[]): number {
    if (actual.length !== predicted.length || actual.length === 0) return 0;

    let tp = 0,
      fp = 0,
      fn = 0;
    for (let i = 0; i < actual.length; i++) {
      if (actual[i] === 1 && predicted[i] === 1) tp++;
      else if (actual[i] === 0 && predicted[i] === 1) fp++;
      else if (actual[i] === 1 && predicted[i] === 0) fn++;
    }

    const precision = tp / (tp + fp) || 0;
    const recall = tp / (tp + fn) || 0;

    return precision + recall > 0
      ? (2 * (precision * recall)) / (precision + recall)
      : 0;
  }

  private calculateCalibration(actual: number[], predicted: number[]): number {
    // Validate inputs
    if (
      actual.length !== predicted.length ||
      actual.length === 0 ||
      predicted.length === 0
    ) {
      return 0.5; // Return neutral score for invalid input
    }

    // Expected Calibration Error (ECE) calculation with binning
    const numBins = 10;
    const binSize = 1.0 / numBins;

    // Initialize bins
    const bins: Array<{
      predictedSum: number;
      actualSum: number;
      count: number;
    }> = Array.from({ length: numBins }, () => ({
      predictedSum: 0,
      actualSum: 0,
      count: 0,
    }));

    // Assign predictions to bins
    for (let i = 0; i < predicted.length; i++) {
      const pred = Math.max(0, Math.min(1, predicted[i])); // Clamp to [0, 1]
      const act = actual[i];

      // Determine which bin this prediction falls into
      const binIndex = Math.min(Math.floor(pred / binSize), numBins - 1);

      bins[binIndex].predictedSum += pred;
      bins[binIndex].actualSum += act;
      bins[binIndex].count += 1;
    }

    // Calculate weighted ECE
    let totalError = 0;
    let totalCount = 0;

    for (const bin of bins) {
      if (bin.count > 0) {
        const avgPredicted = bin.predictedSum / bin.count;
        const avgActual = bin.actualSum / bin.count;

        // Weighted by the number of samples in this bin
        const binError = Math.abs(avgPredicted - avgActual) * bin.count;

        totalError += binError;
        totalCount += bin.count;
      }
    }

    // Compute ECE
    const ece = totalCount > 0 ? totalError / totalCount : 0.5;

    // Convert ECE to calibration score (lower ECE = higher score)
    // ECE ranges from 0 (perfect) to 1 (worst)
    const calibrationScore = Math.max(0, 1 - ece);

    return calibrationScore;
  }

  private async getRecentDecisions(): Promise<{
    total: number;
    optimal: number;
  }> {
    // TODO: Implement decision tracking to log agent decisions and their outcomes
    // For now, analyze from agent coordination logs
    try {
      const logs = await storage.getCoordinationLogs(100);
      const total = logs.length;
      // Count successful actions as "optimal" decisions
      const optimal = logs.filter(
        log => log.status === 'success' || log.status === 'completed'
      ).length;
      return { total: total || 1, optimal: optimal || 0 };
    } catch (error) {
      console.error('Error getting recent decisions:', error);
      return { total: 1, optimal: 0 };
    }
  }

  private async calculateContextAwareness(): Promise<number> {
    // TODO: Implement context-awareness scoring based on agent behavior analysis
    // For now, calculate from work item success rates
    try {
      const workItems = await storage.getWorkItems({ limit: 50 });
      if (workItems.length === 0) return 0.5;

      // Calculate success rate as proxy for context awareness
      const successRate =
        workItems.filter(w => w.status === 'completed').length /
        workItems.length;

      return Math.min(successRate, 1.0);
    } catch (error) {
      console.error('Error calculating context awareness:', error);
      return 0.5;
    }
  }

  private async calculateConsensusQuality(): Promise<number> {
    // TODO: Implement multi-agent consensus tracking
    // For now, analyze coordination logs for agreement patterns
    try {
      const logs = await storage.getCoordinationLogs(50);
      if (logs.length === 0) return 0.5;

      // Count coordinated actions as good consensus
      const coordinatedActions = logs.filter(
        log => log.action === 'coordinate' || log.action === 'consensus'
      ).length;

      return coordinatedActions / Math.max(logs.length, 1);
    } catch (error) {
      console.error('Error calculating consensus quality:', error);
      return 0.5;
    }
  }

  private async calculateTransferLearningSuccess(): Promise<number> {
    // TODO: Implement transfer learning tracking across domains
    // For now, return conservative estimate
    return 0.5;
  }

  private async calculateResourceUtilization(): Promise<number> {
    // Calculate from work item metrics
    try {
      const workItems = await storage.getWorkItems({ limit: 100 });
      if (workItems.length === 0) return 0.5;

      const activeItems = workItems.filter(
        w => w.status === 'in_progress' || w.status === 'pending'
      ).length;

      // Resource utilization = active work / total capacity (assuming 100 max concurrent)
      return Math.min(activeItems / 100, 1.0);
    } catch (error) {
      console.error('Error calculating resource utilization:', error);
      return 0.5;
    }
  }

  private async calculateParallelEfficiency(): Promise<number> {
    // TODO: Track parallel execution metrics
    // For now, analyze completion times for concurrent work items
    try {
      const workItems = await storage.getWorkItems({ limit: 100 });
      const completedItems = workItems.filter(
        w => w.completedAt && w.startedAt
      );

      if (completedItems.length === 0) return 0.5;

      // Simple heuristic: if average completion time is low, parallel efficiency is high
      const avgDuration =
        completedItems.reduce((sum, w) => {
          const duration =
            new Date(w.completedAt!).getTime() -
            new Date(w.startedAt!).getTime();
          return sum + duration;
        }, 0) / completedItems.length;

      // Normalize: < 5 min is excellent (0.9), > 1 hour is poor (0.5)
      const fiveMinutes = 5 * 60 * 1000;
      const oneHour = 60 * 60 * 1000;

      if (avgDuration < fiveMinutes) return 0.9;
      if (avgDuration > oneHour) return 0.5;

      return (
        0.9 - ((avgDuration - fiveMinutes) / (oneHour - fiveMinutes)) * 0.4
      );
    } catch (error) {
      console.error('Error calculating parallel efficiency:', error);
      return 0.5;
    }
  }

  private async calculateWinRateImprovement(): Promise<number> {
    // TODO: Track RFP win/loss outcomes over time to measure improvement
    // For now, analyze submission success rates
    try {
      const submissions = await storage.getSubmissions({ limit: 50 });
      const older = submissions.slice(25);
      const recent = submissions.slice(0, 25);

      if (older.length === 0 || recent.length === 0) return 0;

      const olderWinRate =
        older.filter(s => s.status === 'confirmed').length / older.length;
      const recentWinRate =
        recent.filter(s => s.status === 'confirmed').length / recent.length;

      return recentWinRate - olderWinRate;
    } catch (error) {
      console.error('Error calculating win rate improvement:', error);
      return 0;
    }
  }

  private async calculateCostSavings(): Promise<number> {
    // TODO: Track actual costs vs baseline costs to measure savings
    // For now, estimate from automation metrics
    try {
      const workItems = await storage.getWorkItems({ limit: 100 });
      const completedItems = workItems.filter(w => w.status === 'completed');

      // Estimate $500 saved per automated task
      const estimatedSavingsPerTask = 500;
      return completedItems.length * estimatedSavingsPerTask;
    } catch (error) {
      console.error('Error calculating cost savings:', error);
      return 0;
    }
  }

  private async calculateTimeSavings(): Promise<number> {
    // TODO: Track time saved from automation
    // For now, estimate from completed work items
    try {
      const workItems = await storage.getWorkItems({ limit: 100 });
      const completedItems = workItems.filter(w => w.status === 'completed');

      // Estimate 2 hours saved per automated task
      const estimatedHoursSavedPerTask = 2;
      return completedItems.length * estimatedHoursSavedPerTask;
    } catch (error) {
      console.error('Error calculating time savings:', error);
      return 0;
    }
  }

  private async calculateQualityScore(): Promise<number> {
    // TODO: Implement comprehensive quality scoring system
    // For now, calculate from work item success rates
    try {
      const workItems = await storage.getWorkItems({ limit: 100 });
      if (workItems.length === 0) return 50;

      const successRate =
        workItems.filter(w => w.status === 'completed').length /
        workItems.length;
      const qualityScore = successRate * 100;

      return Math.min(Math.round(qualityScore), 100);
    } catch (error) {
      console.error('Error calculating quality score:', error);
      return 50;
    }
  }

  /**
   * Calculate customer satisfaction from real feedback data
   * Uses agent performance metrics as a proxy for customer satisfaction
   */
  private async calculateCustomerSatisfaction(): Promise<number> {
    try {
      const feedback = await storage.getRecentFeedback(100);

      // Return 0 if no feedback available
      if (feedback.length === 0) {
        return 0;
      }

      // Calculate average rating (ratings are on 0-5 scale)
      const totalRating = feedback.reduce((sum, item) => sum + item.rating, 0);
      const avgRating = totalRating / feedback.length;

      // Normalize to 0-100 scale
      const normalizedScore = (avgRating / 5) * 100;

      return Math.round(normalizedScore);
    } catch (error) {
      console.error('Error calculating customer satisfaction:', error);
      return 0;
    }
  }

  // Default metrics for error cases
  private getDefaultLearningMetrics(): LearningMetrics {
    return {
      successRateImprovement: 0,
      strategyAdaptationSpeed: 0,
      errorReductionRate: 0,
      knowledgeRetention: 0,
      averageConfidence: 0,
      activeStrategies: 0,
      learningEventsProcessed: 0,
    };
  }

  private getDefaultPredictionMetrics(): PredictionMetrics {
    return {
      winProbabilityMAE: 0.5,
      costEstimationMAPE: 0.3,
      timelinePredictionAccuracy: 0.5,
      riskAssessmentF1Score: 0.5,
      calibrationScore: 0.5,
    };
  }

  private getDefaultDecisionMetrics(): DecisionMetrics {
    return {
      optimalStrategyRate: 0.5,
      contextAwarenessScore: 0.5,
      consensusQuality: 0.5,
      transferLearningSuccess: 0.5,
      explorationBalance: 0.5,
    };
  }

  private getDefaultOperationalMetrics(): OperationalMetrics {
    return {
      averageTaskCompletionTime: 0,
      resourceUtilization: 0,
      parallelExecutionEfficiency: 0,
      errorRecoveryRate: 0,
      throughput: 0,
      uptime: 0,
    };
  }

  private getDefaultBusinessMetrics(): BusinessMetrics {
    return {
      winRateImprovement: 0,
      costSavings: 0,
      timeSavings: 0,
      qualityScore: 0,
      customerSatisfaction: 0,
      ROI: 0,
    };
  }
}

export const intelligenceBenchmarks = IntelligenceBenchmarks.getInstance();
