import { storage } from '../storage';
import { selfImprovingLearningService } from './selfImprovingLearningService';
import { agentMemoryService } from './agentMemoryService';

/**
 * Proposal Quality Evaluator Service
 *
 * Implements self-evaluation mechanisms for proposal quality assessment.
 * Uses machine learning patterns and historical data to predict proposal success
 * and provide quality scores with actionable feedback.
 */

export interface QualityEvaluation {
  proposalId: string;
  rfpId: string;
  timestamp: Date;

  // Overall quality metrics
  overallScore: number;
  confidenceLevel: number;
  predictedSuccessRate: number;

  // Detailed component scores
  componentScores: {
    contentQuality: QualityScore;
    complianceScore: QualityScore;
    technicalScore: QualityScore;
    presentationScore: QualityScore;
    competitivenessScore: QualityScore;
    strategicScore: QualityScore;
  };

  // Feedback and recommendations
  feedback: QualityFeedback;
  recommendations: QualityRecommendation[];
  riskAssessment: RiskAssessment;

  // Comparative analysis
  benchmarkComparison: BenchmarkComparison;
  historicalComparison: HistoricalComparison;

  // Metadata
  evaluationMetadata: {
    evaluatorVersion: string;
    evaluationDuration: number;
    dataSourcesUsed: string[];
    modelConfidence: number;
  };
}

export interface QualityScore {
  score: number; // 0-100
  confidence: number; // 0-1
  factors: QualityFactor[];
  improvements: string[];
  benchmarkDelta: number;
}

export interface QualityFactor {
  name: string;
  impact: number; // -1 to 1 (negative = detrimental, positive = beneficial)
  confidence: number;
  description: string;
  evidence: string[];
}

export interface QualityFeedback {
  strengths: string[];
  weaknesses: string[];
  criticalIssues: string[];
  quickWins: string[];
  strategicRecommendations: string[];
}

export interface QualityRecommendation {
  category:
    | 'content'
    | 'compliance'
    | 'technical'
    | 'presentation'
    | 'strategy'
    | 'competitive';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  impact: number; // Expected impact on overall score
  effort: 'low' | 'medium' | 'high';
  timeToImplement: number; // minutes
  successProbability: number;
}

export interface RiskAssessment {
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  riskFactors: RiskFactor[];
  mitigationStrategies: string[];
  probabilityOfSuccess: number;
}

export interface RiskFactor {
  type: 'content' | 'compliance' | 'competitive' | 'technical' | 'strategic';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  likelihood: number;
  impact: number;
  mitigation: string;
}

export interface BenchmarkComparison {
  industryAverage: number;
  topPerformers: number;
  agencyAverage: number;
  categoryAverage: number;
  rankingPercentile: number;
}

export interface HistoricalComparison {
  personalBest: number;
  recentAverage: number;
  improvementTrend: 'improving' | 'stable' | 'declining';
  trendStrength: number;
  keyChanges: string[];
}

export interface EvaluationModel {
  modelId: string;
  version: string;
  domain: string;
  documentType: string;

  // Model parameters
  weights: ModelWeights;
  thresholds: ModelThresholds;
  features: ModelFeature[];

  // Performance metrics
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;

  // Training data
  trainingDataSize: number;
  lastTrained: Date;
  validationScore: number;
}

export interface ModelWeights {
  contentQuality: number;
  compliance: number;
  technical: number;
  presentation: number;
  competitiveness: number;
  strategic: number;
}

export interface ModelThresholds {
  excellent: number;
  good: number;
  acceptable: number;
  poor: number;
}

export interface ModelFeature {
  name: string;
  type: 'numeric' | 'categorical' | 'text' | 'boolean';
  weight: number;
  description: string;
  extractor: string; // Function to extract this feature
}

export class ProposalQualityEvaluator {
  private static instance: ProposalQualityEvaluator;
  private evaluationModels: Map<string, EvaluationModel> = new Map();
  private learningEnabled: boolean = true;
  private evaluationVersion: string = '2.0.0';

  public static getInstance(): ProposalQualityEvaluator {
    if (!ProposalQualityEvaluator.instance) {
      ProposalQualityEvaluator.instance = new ProposalQualityEvaluator();
    }
    return ProposalQualityEvaluator.instance;
  }

  // ============ MAIN EVALUATION INTERFACE ============

  /**
   * Evaluate proposal quality comprehensively
   */
  async evaluateProposalQuality(
    proposalId: string
  ): Promise<QualityEvaluation> {
    try {
      console.log(`🔍 Evaluating proposal quality: ${proposalId}`);

      const startTime = Date.now();

      // Get proposal and RFP data
      const proposal = await storage.getProposal(proposalId);
      if (!proposal) {
        throw new Error(`Proposal not found: ${proposalId}`);
      }

      const rfp = await storage.getRFP(proposal.rfpId);
      if (!rfp) {
        throw new Error(`RFP not found: ${proposal.rfpId}`);
      }

      // Get or create evaluation model for this domain/type
      const model = await this.getEvaluationModel(rfp, proposal);

      // Extract features from proposal
      const features = await this.extractProposalFeatures(proposal, rfp);

      // Perform component evaluations
      const componentScores = await this.evaluateComponents(features, model);

      // Calculate overall score
      const overallScore = this.calculateOverallScore(
        componentScores,
        model.weights
      );

      // Generate feedback and recommendations
      const feedback = this.generateFeedback(componentScores, features);
      const recommendations = await this.generateRecommendations(
        componentScores,
        features,
        model
      );

      // Assess risks
      const riskAssessment = this.assessRisks(componentScores, features);

      // Perform comparative analysis
      const benchmarkComparison = await this.performBenchmarkComparison(
        overallScore,
        rfp
      );
      const historicalComparison = await this.performHistoricalComparison(
        overallScore,
        rfp
      );

      // Predict success rate
      const predictedSuccessRate = this.predictSuccessRate(
        overallScore,
        componentScores,
        features
      );

      const evaluation: QualityEvaluation = {
        proposalId,
        rfpId: proposal.rfpId,
        timestamp: new Date(),
        overallScore,
        confidenceLevel: this.calculateConfidenceLevel(componentScores),
        predictedSuccessRate,
        componentScores,
        feedback,
        recommendations,
        riskAssessment,
        benchmarkComparison,
        historicalComparison,
        evaluationMetadata: {
          evaluatorVersion: this.evaluationVersion,
          evaluationDuration: Date.now() - startTime,
          dataSourcesUsed: [
            'proposal_content',
            'rfp_requirements',
            'historical_data',
            'market_data',
          ],
          modelConfidence: model.accuracy,
        },
      };

      // Store evaluation for learning
      await this.storeEvaluation(evaluation);

      // Record learning outcome
      if (this.learningEnabled) {
        // TODO: Implement recordEvaluationLearning method
        // await this.recordEvaluationLearning(evaluation, features);
      }

      console.log(
        `✅ Proposal evaluation completed: ${overallScore.toFixed(1)}/100 (${predictedSuccessRate.toFixed(1)}% success probability)`
      );

      return evaluation;
    } catch (error) {
      console.error('❌ Failed to evaluate proposal quality:', error);
      throw error;
    }
  }

  /**
   * Learn from actual proposal outcomes to improve evaluation accuracy
   */
  async learnFromOutcome(
    proposalId: string,
    actualOutcome: {
      won: boolean;
      score?: number;
      feedback?: string;
      competitorInfo?: any;
    }
  ): Promise<void> {
    try {
      console.log(`📚 Learning from proposal outcome: ${proposalId}`);

      // Get the evaluation
      const evaluation = await this.getStoredEvaluation(proposalId);
      if (!evaluation) {
        console.warn(`No evaluation found for proposal: ${proposalId}`);
        return;
      }

      // Calculate prediction accuracy
      const predictionAccuracy = this.calculatePredictionAccuracy(
        evaluation,
        actualOutcome
      );

      // Update model based on outcome
      await this.updateModelFromOutcome(
        evaluation,
        actualOutcome,
        predictionAccuracy
      );

      // Store learning data
      await this.storeLearningData(
        proposalId,
        evaluation,
        actualOutcome,
        predictionAccuracy
      );

      // Record learning outcome for the self-improving system
      const learningOutcome = this.createQualityLearningOutcome(
        evaluation,
        actualOutcome
      );
      await selfImprovingLearningService.recordLearningOutcome(learningOutcome);

      console.log(
        `✅ Learning completed - prediction accuracy: ${(predictionAccuracy * 100).toFixed(1)}%`
      );
    } catch (error) {
      console.error('❌ Failed to learn from outcome:', error);
    }
  }

  /**
   * Generate quality improvement roadmap
   */
  async generateImprovementRoadmap(proposalId: string): Promise<any> {
    try {
      const evaluation = await this.getStoredEvaluation(proposalId);
      if (!evaluation) {
        throw new Error(`No evaluation found for proposal: ${proposalId}`);
      }

      // Prioritize recommendations by impact and effort
      const prioritizedRecommendations = this.prioritizeRecommendations(
        evaluation.recommendations
      );

      // Create implementation phases
      const phases = this.createImplementationPhases(
        prioritizedRecommendations
      );

      // Estimate impact of improvements
      const impactEstimates = this.estimateImprovementImpact(
        evaluation,
        prioritizedRecommendations
      );

      return {
        currentScore: evaluation.overallScore,
        targetScore: evaluation.overallScore + impactEstimates.totalImpact,
        improvementPhases: phases,
        timeline: this.estimateImprovementTimeline(phases),
        priorityActions: prioritizedRecommendations.slice(0, 5),
        expectedOutcomes: impactEstimates,
      };
    } catch (error) {
      console.error('❌ Failed to generate improvement roadmap:', error);
      throw error;
    }
  }

  // ============ COMPONENT EVALUATION METHODS ============

  /**
   * Evaluate all proposal components
   */
  private async evaluateComponents(
    features: any,
    model: EvaluationModel
  ): Promise<any> {
    return {
      contentQuality: await this.evaluateContentQuality(features, model),
      complianceScore: await this.evaluateCompliance(features, model),
      technicalScore: await this.evaluateTechnicalQuality(features, model),
      presentationScore: await this.evaluatePresentation(features, model),
      competitivenessScore: await this.evaluateCompetitiveness(features, model),
      strategicScore: await this.evaluateStrategicValue(features, model),
    };
  }

  /**
   * Evaluate content quality
   */
  private async evaluateContentQuality(
    features: any,
    model: EvaluationModel
  ): Promise<QualityScore> {
    const factors: QualityFactor[] = [];
    let score = 70; // Base score

    // Narrative quality
    if (features.narrativeQuality) {
      const narrativeFactor = this.assessNarrativeQuality(
        features.narrativeQuality
      );
      factors.push(narrativeFactor);
      score += narrativeFactor.impact * 10;
    }

    // Completeness
    if (features.completeness) {
      const completenessFactor = this.assessCompleteness(features.completeness);
      factors.push(completenessFactor);
      score += completenessFactor.impact * 15;
    }

    // Clarity and readability
    if (features.readability) {
      const readabilityFactor = this.assessReadability(features.readability);
      factors.push(readabilityFactor);
      score += readabilityFactor.impact * 8;
    }

    // Relevance to requirements
    if (features.relevance) {
      const relevanceFactor = this.assessRelevance(features.relevance);
      factors.push(relevanceFactor);
      score += relevanceFactor.impact * 12;
    }

    return {
      score: Math.max(0, Math.min(100, score)),
      confidence: this.calculateComponentConfidence(factors),
      factors,
      improvements: this.generateContentImprovements(factors),
      benchmarkDelta: await this.getBenchmarkDelta('content', score),
    };
  }

  /**
   * Evaluate compliance score
   */
  private async evaluateCompliance(
    features: any,
    model: EvaluationModel
  ): Promise<QualityScore> {
    const factors: QualityFactor[] = [];
    let score = 60; // Base score (compliance is critical)

    // Requirements coverage
    if (features.requirementsCoverage) {
      const coverageFactor = this.assessRequirementsCoverage(
        features.requirementsCoverage
      );
      factors.push(coverageFactor);
      score += coverageFactor.impact * 25; // High weight for compliance
    }

    // Format compliance
    if (features.formatCompliance) {
      const formatFactor = this.assessFormatCompliance(
        features.formatCompliance
      );
      factors.push(formatFactor);
      score += formatFactor.impact * 15;
    }

    // Deadline compliance
    if (features.deadlineCompliance) {
      const deadlineFactor = this.assessDeadlineCompliance(
        features.deadlineCompliance
      );
      factors.push(deadlineFactor);
      score += deadlineFactor.impact * 10;
    }

    return {
      score: Math.max(0, Math.min(100, score)),
      confidence: this.calculateComponentConfidence(factors),
      factors,
      improvements: this.generateComplianceImprovements(factors),
      benchmarkDelta: await this.getBenchmarkDelta('compliance', score),
    };
  }

  /**
   * Evaluate technical quality
   */
  private async evaluateTechnicalQuality(
    features: any,
    model: EvaluationModel
  ): Promise<QualityScore> {
    const factors: QualityFactor[] = [];
    let score = 65; // Base score

    // Technical approach quality
    if (features.technicalApproach) {
      const approachFactor = this.assessTechnicalApproach(
        features.technicalApproach
      );
      factors.push(approachFactor);
      score += approachFactor.impact * 20;
    }

    // Innovation and differentiation
    if (features.innovation) {
      const innovationFactor = this.assessInnovation(features.innovation);
      factors.push(innovationFactor);
      score += innovationFactor.impact * 12;
    }

    // Feasibility
    if (features.feasibility) {
      const feasibilityFactor = this.assessFeasibility(features.feasibility);
      factors.push(feasibilityFactor);
      score += feasibilityFactor.impact * 15;
    }

    return {
      score: Math.max(0, Math.min(100, score)),
      confidence: this.calculateComponentConfidence(factors),
      factors,
      improvements: this.generateTechnicalImprovements(factors),
      benchmarkDelta: await this.getBenchmarkDelta('technical', score),
    };
  }

  /**
   * Evaluate presentation quality
   */
  private async evaluatePresentation(
    features: any,
    model: EvaluationModel
  ): Promise<QualityScore> {
    const factors: QualityFactor[] = [];
    let score = 75; // Base score

    // Visual organization
    if (features.visualOrganization) {
      const visualFactor = this.assessVisualOrganization(
        features.visualOrganization
      );
      factors.push(visualFactor);
      score += visualFactor.impact * 10;
    }

    // Professional appearance
    if (features.professionalism) {
      const professionalFactor = this.assessProfessionalism(
        features.professionalism
      );
      factors.push(professionalFactor);
      score += professionalFactor.impact * 8;
    }

    return {
      score: Math.max(0, Math.min(100, score)),
      confidence: this.calculateComponentConfidence(factors),
      factors,
      improvements: this.generatePresentationImprovements(factors),
      benchmarkDelta: await this.getBenchmarkDelta('presentation', score),
    };
  }

  /**
   * Evaluate competitiveness
   */
  private async evaluateCompetitiveness(
    features: any,
    model: EvaluationModel
  ): Promise<QualityScore> {
    const factors: QualityFactor[] = [];
    let score = 70; // Base score

    // Pricing competitiveness
    if (features.pricingCompetitiveness) {
      const pricingFactor = this.assessPricingCompetitiveness(
        features.pricingCompetitiveness
      );
      factors.push(pricingFactor);
      score += pricingFactor.impact * 18;
    }

    // Unique value proposition
    if (features.uniqueValue) {
      const valueFactor = this.assessUniqueValue(features.uniqueValue);
      factors.push(valueFactor);
      score += valueFactor.impact * 15;
    }

    // Market positioning
    if (features.marketPosition) {
      const positionFactor = this.assessMarketPosition(features.marketPosition);
      factors.push(positionFactor);
      score += positionFactor.impact * 12;
    }

    return {
      score: Math.max(0, Math.min(100, score)),
      confidence: this.calculateComponentConfidence(factors),
      factors,
      improvements: this.generateCompetitivenessImprovements(factors),
      benchmarkDelta: await this.getBenchmarkDelta('competitiveness', score),
    };
  }

  /**
   * Evaluate strategic value
   */
  private async evaluateStrategicValue(
    features: any,
    model: EvaluationModel
  ): Promise<QualityScore> {
    const factors: QualityFactor[] = [];
    let score = 65; // Base score

    // Strategic alignment
    if (features.strategicAlignment) {
      const alignmentFactor = this.assessStrategicAlignment(
        features.strategicAlignment
      );
      factors.push(alignmentFactor);
      score += alignmentFactor.impact * 20;
    }

    // Long-term value
    if (features.longTermValue) {
      const valueFactor = this.assessLongTermValue(features.longTermValue);
      factors.push(valueFactor);
      score += valueFactor.impact * 15;
    }

    return {
      score: Math.max(0, Math.min(100, score)),
      confidence: this.calculateComponentConfidence(factors),
      factors,
      improvements: this.generateStrategicImprovements(factors),
      benchmarkDelta: await this.getBenchmarkDelta('strategic', score),
    };
  }

  // ============ FEATURE EXTRACTION ============

  /**
   * Extract features from proposal for evaluation
   */
  private async extractProposalFeatures(proposal: any, rfp: any): Promise<any> {
    const features = {
      // Content features
      narrativeQuality: this.extractNarrativeQuality(proposal),
      completeness: this.extractCompleteness(proposal, rfp),
      readability: this.extractReadability(proposal),
      relevance: this.extractRelevance(proposal, rfp),

      // Compliance features
      requirementsCoverage: this.extractRequirementsCoverage(proposal, rfp),
      formatCompliance: this.extractFormatCompliance(proposal, rfp),
      deadlineCompliance: this.extractDeadlineCompliance(proposal, rfp),

      // Technical features
      technicalApproach: this.extractTechnicalApproach(proposal),
      innovation: this.extractInnovation(proposal),
      feasibility: this.extractFeasibility(proposal),

      // Presentation features
      visualOrganization: this.extractVisualOrganization(proposal),
      professionalism: this.extractProfessionalism(proposal),

      // Competitive features
      pricingCompetitiveness: await this.extractPricingCompetitiveness(
        proposal,
        rfp
      ),
      uniqueValue: this.extractUniqueValue(proposal),
      marketPosition: await this.extractMarketPosition(proposal, rfp),

      // Strategic features
      strategicAlignment: this.extractStrategicAlignment(proposal, rfp),
      longTermValue: this.extractLongTermValue(proposal),
    };

    return features;
  }

  // ============ PRIVATE HELPER METHODS ============

  private async getEvaluationModel(
    rfp: any,
    proposal: any
  ): Promise<EvaluationModel> {
    const domain = rfp.agency || 'general';
    const documentType = this.categorizeRFP(rfp);
    const modelKey = `${domain}_${documentType}`;

    let model = this.evaluationModels.get(modelKey);

    if (!model) {
      model = await this.createDefaultModel(domain, documentType);
      this.evaluationModels.set(modelKey, model);
    }

    return model;
  }

  private async createDefaultModel(
    domain: string,
    documentType: string
  ): Promise<EvaluationModel> {
    return {
      modelId: `eval_model_${domain}_${documentType}`,
      version: '1.0.0',
      domain,
      documentType,
      weights: {
        contentQuality: 0.25,
        compliance: 0.2,
        technical: 0.2,
        presentation: 0.1,
        competitiveness: 0.15,
        strategic: 0.1,
      },
      thresholds: {
        excellent: 85,
        good: 70,
        acceptable: 55,
        poor: 40,
      },
      features: this.getDefaultModelFeatures(),
      accuracy: 0.75, // Default accuracy
      precision: 0.7,
      recall: 0.8,
      f1Score: 0.75,
      trainingDataSize: 0,
      lastTrained: new Date(),
      validationScore: 0.75,
    };
  }

  private getDefaultModelFeatures(): ModelFeature[] {
    return [
      {
        name: 'narrative_quality',
        type: 'numeric',
        weight: 0.8,
        description: 'Quality of narrative content',
        extractor: 'extractNarrativeQuality',
      },
      {
        name: 'requirements_coverage',
        type: 'numeric',
        weight: 1.0,
        description: 'Coverage of RFP requirements',
        extractor: 'extractRequirementsCoverage',
      },
      {
        name: 'technical_depth',
        type: 'numeric',
        weight: 0.7,
        description: 'Technical approach depth',
        extractor: 'extractTechnicalApproach',
      },
    ];
  }

  private calculateOverallScore(
    componentScores: any,
    weights: ModelWeights
  ): number {
    return (
      componentScores.contentQuality.score * weights.contentQuality +
      componentScores.complianceScore.score * weights.compliance +
      componentScores.technicalScore.score * weights.technical +
      componentScores.presentationScore.score * weights.presentation +
      componentScores.competitivenessScore.score * weights.competitiveness +
      componentScores.strategicScore.score * weights.strategic
    );
  }

  private calculateConfidenceLevel(componentScores: any): number {
    const confidences = Object.values(componentScores).map(
      (score: any) => score.confidence
    );
    return (
      confidences.reduce((sum: number, conf: number) => sum + conf, 0) /
      confidences.length
    );
  }

  private predictSuccessRate(
    overallScore: number,
    componentScores: any,
    features: any
  ): number {
    // Simple prediction model based on historical data
    let baseRate = Math.max(0, Math.min(1, overallScore / 100));

    // Adjust based on critical factors
    if (componentScores.complianceScore.score < 60) {
      baseRate *= 0.3; // Poor compliance severely hurts chances
    }

    if (componentScores.competitivenessScore.score > 80) {
      baseRate *= 1.2; // High competitiveness boosts chances
    }

    return Math.max(0, Math.min(1, baseRate));
  }

  private generateFeedback(
    componentScores: any,
    features: any
  ): QualityFeedback {
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    const criticalIssues: string[] = [];
    const quickWins: string[] = [];
    const strategicRecommendations: string[] = [];

    // Analyze each component
    for (const [component, score] of Object.entries(componentScores)) {
      const componentScore = score as QualityScore;

      if (componentScore.score >= 80) {
        strengths.push(`Strong ${component.replace('Score', '')} performance`);
      } else if (componentScore.score < 60) {
        weaknesses.push(`Weak ${component.replace('Score', '')} performance`);

        if (componentScore.score < 40) {
          criticalIssues.push(
            `Critical ${component.replace('Score', '')} deficiency`
          );
        }
      }

      // Identify quick wins (high impact, low effort improvements)
      const quickWinFactors = componentScore.factors.filter(
        f => f.impact < -0.3 && f.confidence > 0.7
      );

      for (const factor of quickWinFactors) {
        quickWins.push(
          `Address ${factor.name} in ${component.replace('Score', '')}`
        );
      }
    }

    return {
      strengths,
      weaknesses,
      criticalIssues,
      quickWins,
      strategicRecommendations,
    };
  }

  private async generateRecommendations(
    componentScores: any,
    features: any,
    model: EvaluationModel
  ): Promise<QualityRecommendation[]> {
    const recommendations: QualityRecommendation[] = [];

    // Generate recommendations for each component
    for (const [component, score] of Object.entries(componentScores)) {
      const componentScore = score as QualityScore;
      const componentRecommendations =
        await this.generateComponentRecommendations(
          component,
          componentScore,
          features
        );
      recommendations.push(...componentRecommendations);
    }

    // Sort by priority and impact
    return recommendations.sort((a, b) => {
      const priorityWeight = { critical: 4, high: 3, medium: 2, low: 1 };
      const aPriority = priorityWeight[a.priority];
      const bPriority = priorityWeight[b.priority];

      if (aPriority !== bPriority) {
        return bPriority - aPriority;
      }

      return b.impact - a.impact;
    });
  }

  private async generateComponentRecommendations(
    component: string,
    componentScore: QualityScore,
    features: any
  ): Promise<QualityRecommendation[]> {
    const recommendations: QualityRecommendation[] = [];

    if (componentScore.score < 70) {
      // Generate specific recommendations based on component type
      switch (component) {
        case 'contentQuality':
          recommendations.push({
            category: 'content',
            priority: componentScore.score < 50 ? 'high' : 'medium',
            title: 'Improve Content Quality',
            description: 'Enhance narrative quality and completeness',
            impact: 15,
            effort: 'medium',
            timeToImplement: 120,
            successProbability: 0.8,
          });
          break;

        case 'complianceScore':
          recommendations.push({
            category: 'compliance',
            priority: 'critical',
            title: 'Address Compliance Issues',
            description: 'Ensure all requirements are fully addressed',
            impact: 25,
            effort: 'high',
            timeToImplement: 180,
            successProbability: 0.9,
          });
          break;

        // Add more component-specific recommendations
      }
    }

    return recommendations;
  }

  private assessRisks(componentScores: any, features: any): RiskAssessment {
    const riskFactors: RiskFactor[] = [];
    let overallRisk: 'low' | 'medium' | 'high' | 'critical' = 'low';

    // Assess compliance risk
    if (componentScores.complianceScore.score < 60) {
      riskFactors.push({
        type: 'compliance',
        severity: 'critical',
        description: 'Poor compliance may lead to disqualification',
        likelihood: 0.8,
        impact: 0.9,
        mitigation: 'Review and address all compliance requirements',
      });
      overallRisk = 'critical';
    }

    // Assess competitive risk
    if (componentScores.competitivenessScore.score < 50) {
      riskFactors.push({
        type: 'competitive',
        severity: 'high',
        description: 'Low competitiveness may result in loss to competitors',
        likelihood: 0.7,
        impact: 0.8,
        mitigation: 'Strengthen value proposition and pricing strategy',
      });

      if (overallRisk !== 'critical') {
        overallRisk = 'high';
      }
    }

    return {
      overallRisk,
      riskFactors,
      mitigationStrategies: riskFactors.map(rf => rf.mitigation),
      probabilityOfSuccess: this.calculateSuccessProbability(riskFactors),
    };
  }

  private calculateSuccessProbability(riskFactors: RiskFactor[]): number {
    if (riskFactors.length === 0) return 0.8; // Base probability

    const totalRisk = riskFactors.reduce(
      (sum, rf) => sum + rf.likelihood * rf.impact,
      0
    );
    const averageRisk = totalRisk / riskFactors.length;

    return Math.max(0.1, 1 - averageRisk);
  }

  private async performBenchmarkComparison(
    score: number,
    rfp: any
  ): Promise<BenchmarkComparison> {
    // Get benchmark data (placeholder implementation)
    return {
      industryAverage: 65,
      topPerformers: 85,
      agencyAverage: 70,
      categoryAverage: 68,
      rankingPercentile: this.calculatePercentile(score, 65), // Based on industry average
    };
  }

  private async performHistoricalComparison(
    score: number,
    rfp: any
  ): Promise<HistoricalComparison> {
    // Get historical data for this agent/domain
    const historicalScores = await this.getHistoricalScores(rfp.agency);

    return {
      personalBest: Math.max(...historicalScores, score),
      recentAverage: this.calculateRecentAverage(historicalScores),
      improvementTrend: this.calculateTrend(historicalScores),
      trendStrength: this.calculateTrendStrength(historicalScores),
      keyChanges: this.identifyKeyChanges(historicalScores),
    };
  }

  private calculatePercentile(score: number, average: number): number {
    // Simple percentile calculation
    const standardDeviation = 15; // Assumed
    const zScore = (score - average) / standardDeviation;
    return Math.max(0, Math.min(100, 50 + zScore * 20));
  }

  private async getHistoricalScores(agency: string): Promise<number[]> {
    // Get historical evaluation scores for this agency
    const evaluations = await this.getHistoricalEvaluations(agency);
    return evaluations.map(e => e.overallScore);
  }

  private calculateRecentAverage(scores: number[]): number {
    if (scores.length === 0) return 0;
    const recent = scores.slice(-5); // Last 5 scores
    return recent.reduce((sum, score) => sum + score, 0) / recent.length;
  }

  private calculateTrend(
    scores: number[]
  ): 'improving' | 'stable' | 'declining' {
    if (scores.length < 3) return 'stable';

    const recent = scores.slice(-3);
    const trend = recent[2] - recent[0];

    if (trend > 5) return 'improving';
    if (trend < -5) return 'declining';
    return 'stable';
  }

  private calculateTrendStrength(scores: number[]): number {
    if (scores.length < 3) return 0;

    const recent = scores.slice(-3);
    const changes = [];

    for (let i = 1; i < recent.length; i++) {
      changes.push(recent[i] - recent[i - 1]);
    }

    const avgChange =
      changes.reduce((sum, change) => sum + change, 0) / changes.length;
    return Math.abs(avgChange) / 10; // Normalize to 0-1 scale
  }

  private identifyKeyChanges(scores: number[]): string[] {
    const changes = [];

    if (scores.length >= 2) {
      const lastChange = scores[scores.length - 1] - scores[scores.length - 2];
      if (Math.abs(lastChange) > 10) {
        changes.push(
          `Significant ${lastChange > 0 ? 'improvement' : 'decline'} in recent evaluation`
        );
      }
    }

    return changes;
  }

  // Feature extraction methods (simplified implementations)
  private extractNarrativeQuality(proposal: any): any {
    const narratives = proposal.narratives || [];
    const totalLength = narratives.reduce(
      (sum: number, n: any) => sum + (n?.length || 0),
      0
    );

    return {
      wordCount: totalLength,
      narrativeCount: narratives.length,
      averageLength:
        narratives.length > 0 ? totalLength / narratives.length : 0,
      quality: this.assessTextQuality(narratives.join(' ')),
    };
  }

  private extractCompleteness(proposal: any, rfp: any): any {
    const requiredSections = [
      'technical_approach',
      'team_qualifications',
      'past_performance',
    ];
    const presentSections = requiredSections.filter(
      section => proposal.content?.[section]
    );

    return {
      completionRate: presentSections.length / requiredSections.length,
      missingSections: requiredSections.filter(
        section => !proposal.content?.[section]
      ),
      totalSections: requiredSections.length,
    };
  }

  private extractReadability(proposal: any): any {
    const content = JSON.stringify(proposal.content || {});

    return {
      readabilityScore: this.calculateReadabilityScore(content),
      avgSentenceLength: this.calculateAvgSentenceLength(content),
      vocabularyComplexity: this.calculateVocabularyComplexity(content),
    };
  }

  private extractRelevance(proposal: any, rfp: any): any {
    const proposalText = JSON.stringify(proposal.content || {}).toLowerCase();
    const rfpText = (rfp.description || '').toLowerCase();

    const rfpKeywords = this.extractKeywords(rfpText);
    const matchedKeywords = rfpKeywords.filter(keyword =>
      proposalText.includes(keyword)
    );

    return {
      keywordMatchRate:
        rfpKeywords.length > 0
          ? matchedKeywords.length / rfpKeywords.length
          : 0,
      matchedKeywords,
      totalKeywords: rfpKeywords.length,
    };
  }

  private extractRequirementsCoverage(proposal: any, rfp: any): any {
    // Extract requirements from RFP and check coverage in proposal
    const requirements = this.extractRequirements(rfp);
    const coverage = this.assessRequirementsCoverageRate(
      proposal,
      requirements
    );

    return {
      coverageRate: coverage.rate,
      coveredRequirements: coverage.covered,
      missedRequirements: coverage.missed,
      totalRequirements: requirements.length,
    };
  }

  private extractFormatCompliance(proposal: any, rfp: any): any {
    return {
      hasExecutiveSummary: !!proposal.content?.executive_summary,
      hasTechnicalApproach: !!proposal.content?.technical_approach,
      hasQualifications: !!proposal.content?.qualifications,
      hasPricing: !!proposal.pricingTables,
      formatScore: this.calculateFormatScore(proposal),
    };
  }

  private extractDeadlineCompliance(proposal: any, rfp: any): any {
    const submissionTime = new Date(proposal.generatedAt);
    const deadline = new Date(rfp.deadline);
    const timeToDeadline = deadline.getTime() - submissionTime.getTime();

    return {
      submittedOnTime: timeToDeadline > 0,
      timeToDeadline: timeToDeadline,
      submissionTimestamp: submissionTime,
      deadline: deadline,
    };
  }

  // Assessment methods for quality factors
  private assessNarrativeQuality(narrativeData: any): QualityFactor {
    const qualityScore = narrativeData.quality || 0.5;

    return {
      name: 'narrative_quality',
      impact: (qualityScore - 0.5) * 2, // Convert 0-1 to -1 to 1
      confidence: 0.8,
      description: `Narrative quality assessment based on content analysis`,
      evidence: [
        `Word count: ${narrativeData.wordCount}`,
        `Quality score: ${qualityScore.toFixed(2)}`,
      ],
    };
  }

  private assessCompleteness(completenessData: any): QualityFactor {
    const completionRate = completenessData.completionRate || 0;

    return {
      name: 'completeness',
      impact: (completionRate - 0.8) * 2, // Target 80% completion
      confidence: 0.9,
      description: `Proposal completeness assessment`,
      evidence: [
        `Completion rate: ${(completionRate * 100).toFixed(1)}%`,
        `Missing sections: ${completenessData.missingSections?.join(', ') || 'none'}`,
      ],
    };
  }

  private assessReadability(readabilityData: any): QualityFactor {
    const readabilityScore = readabilityData.readabilityScore || 0.5;

    return {
      name: 'readability',
      impact: (readabilityScore - 0.6) * 1.5,
      confidence: 0.7,
      description: `Content readability assessment`,
      evidence: [`Readability score: ${readabilityScore.toFixed(2)}`],
    };
  }

  private assessRelevance(relevanceData: any): QualityFactor {
    const matchRate = relevanceData.keywordMatchRate || 0;

    return {
      name: 'relevance',
      impact: (matchRate - 0.7) * 1.8, // Target 70% keyword match
      confidence: 0.8,
      description: `Relevance to RFP requirements`,
      evidence: [
        `Keyword match rate: ${(matchRate * 100).toFixed(1)}%`,
        `Matched keywords: ${relevanceData.matchedKeywords?.length || 0}`,
      ],
    };
  }

  // Additional assessment methods would be implemented similarly...

  private calculateComponentConfidence(factors: QualityFactor[]): number {
    if (factors.length === 0) return 0.5;

    const avgConfidence =
      factors.reduce((sum, factor) => sum + factor.confidence, 0) /
      factors.length;
    return avgConfidence;
  }

  private generateContentImprovements(factors: QualityFactor[]): string[] {
    const improvements = [];

    for (const factor of factors) {
      if (factor.impact < -0.2) {
        switch (factor.name) {
          case 'narrative_quality':
            improvements.push('Enhance narrative clarity and depth');
            break;
          case 'completeness':
            improvements.push('Complete missing proposal sections');
            break;
          case 'readability':
            improvements.push('Improve content readability and flow');
            break;
          case 'relevance':
            improvements.push('Better align content with RFP requirements');
            break;
        }
      }
    }

    return improvements;
  }

  // Similar improvement generation methods for other components...
  private generateComplianceImprovements(factors: QualityFactor[]): string[] {
    return factors
      .filter(f => f.impact < -0.2)
      .map(f => `Address ${f.name} compliance issues`);
  }

  private generateTechnicalImprovements(factors: QualityFactor[]): string[] {
    return factors
      .filter(f => f.impact < -0.2)
      .map(f => `Strengthen ${f.name} technical approach`);
  }

  private generatePresentationImprovements(factors: QualityFactor[]): string[] {
    return factors
      .filter(f => f.impact < -0.2)
      .map(f => `Improve ${f.name} presentation quality`);
  }

  private generateCompetitivenessImprovements(
    factors: QualityFactor[]
  ): string[] {
    return factors
      .filter(f => f.impact < -0.2)
      .map(f => `Enhance ${f.name} competitive positioning`);
  }

  private generateStrategicImprovements(factors: QualityFactor[]): string[] {
    return factors
      .filter(f => f.impact < -0.2)
      .map(f => `Strengthen ${f.name} strategic value`);
  }

  // Additional utility methods...
  private async getBenchmarkDelta(
    component: string,
    score: number
  ): Promise<number> {
    // Get benchmark score for component
    const benchmarks: Record<string, number> = {
      content: 70,
      compliance: 75,
      technical: 68,
      presentation: 72,
      competitiveness: 65,
      strategic: 66,
    };

    return score - (benchmarks[component] || 70);
  }

  private categorizeRFP(rfp: any): string {
    const title = (rfp.title || '').toLowerCase();
    if (title.includes('technology') || title.includes('software'))
      return 'technology';
    if (title.includes('construction') || title.includes('building'))
      return 'construction';
    if (title.includes('consulting') || title.includes('advisory'))
      return 'consulting';
    return 'general';
  }

  // Storage and persistence methods
  private async storeEvaluation(evaluation: QualityEvaluation): Promise<void> {
    await agentMemoryService.storeMemory({
      agentId: 'proposal-quality-evaluator',
      memoryType: 'episodic',
      contextKey: `evaluation_${evaluation.proposalId}`,
      title: `Quality Evaluation: ${evaluation.proposalId}`,
      content: evaluation,
      importance: 8,
      tags: ['quality_evaluation', 'proposal_assessment'],
      metadata: {
        proposalId: evaluation.proposalId,
        rfpId: evaluation.rfpId,
        overallScore: evaluation.overallScore,
        predictedSuccess: evaluation.predictedSuccessRate,
      },
    });
  }

  private async getStoredEvaluation(
    proposalId: string
  ): Promise<QualityEvaluation | null> {
    const memory = await agentMemoryService.getMemoryByContext(
      'proposal-quality-evaluator',
      `evaluation_${proposalId}`
    );

    return memory ? memory.content : null;
  }

  private async getHistoricalEvaluations(
    agency: string
  ): Promise<QualityEvaluation[]> {
    const memories = await agentMemoryService.getAgentMemories(
      'proposal-quality-evaluator',
      'episodic',
      100
    );

    return memories
      .map(m => m.content)
      .filter(
        evaluation => evaluation.rfpId && evaluation.overallScore !== undefined
      );
  }

  // Simplified implementations for demonstration
  private assessTextQuality(text: string): number {
    // Simple text quality assessment
    const wordCount = text.split(/\s+/).length;
    const sentenceCount = text.split(/[.!?]+/).length;
    const avgWordsPerSentence = wordCount / sentenceCount;

    // Basic quality scoring based on length and structure
    let quality = 0.5;
    if (wordCount > 100) quality += 0.2;
    if (avgWordsPerSentence > 10 && avgWordsPerSentence < 25) quality += 0.2;
    if (text.length > 500) quality += 0.1;

    return Math.min(1.0, quality);
  }

  private calculateReadabilityScore(text: string): number {
    // Simplified readability calculation
    const words = text.split(/\s+/).length;
    const sentences = text.split(/[.!?]+/).length;
    const avgWordsPerSentence = words / sentences;

    // Simple scoring: target 15-20 words per sentence
    if (avgWordsPerSentence >= 15 && avgWordsPerSentence <= 20) {
      return 0.8;
    } else if (avgWordsPerSentence >= 10 && avgWordsPerSentence <= 25) {
      return 0.6;
    } else {
      return 0.4;
    }
  }

  private calculateAvgSentenceLength(text: string): number {
    const words = text.split(/\s+/).length;
    const sentences = text.split(/[.!?]+/).length;
    return sentences > 0 ? words / sentences : 0;
  }

  private calculateVocabularyComplexity(text: string): number {
    const words = text.toLowerCase().split(/\s+/);
    const uniqueWords = new Set(words);
    return words.length > 0 ? uniqueWords.size / words.length : 0;
  }

  private extractKeywords(text: string): string[] {
    const words = text
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 4)
      .filter(
        word =>
          !/^(the|and|for|are|but|not|you|all|can|had|her|was|one|our|out|day|get|has|him|his|how|its|may|new|now|old|see|two|who|boy|did|man|way|too)$/.test(
            word
          )
      );

    return [...new Set(words)].slice(0, 20); // Top 20 unique keywords
  }

  private extractRequirements(rfp: any): string[] {
    // Extract requirements from RFP (simplified)
    const text = rfp.description || '';
    const sentences = text.split(/[.!?]+/);

    return sentences
      .filter(
        (sentence: any) =>
          sentence.toLowerCase().includes('must') ||
          sentence.toLowerCase().includes('shall') ||
          sentence.toLowerCase().includes('required')
      )
      .map((sentence: any) => sentence.trim())
      .filter((sentence: any) => sentence.length > 10);
  }

  private assessRequirementsCoverageRate(
    proposal: any,
    requirements: string[]
  ): any {
    const proposalText = JSON.stringify(proposal.content || {}).toLowerCase();

    const covered = [];
    const missed = [];

    for (const requirement of requirements) {
      const keywords = this.extractKeywords(requirement);
      const matchedKeywords = keywords.filter(keyword =>
        proposalText.includes(keyword)
      );

      if (matchedKeywords.length > keywords.length * 0.5) {
        covered.push(requirement);
      } else {
        missed.push(requirement);
      }
    }

    return {
      rate: requirements.length > 0 ? covered.length / requirements.length : 1,
      covered,
      missed,
    };
  }

  private calculateFormatScore(proposal: any): number {
    let score = 0;
    const maxScore = 5;

    if (proposal.content?.executive_summary) score++;
    if (proposal.content?.technical_approach) score++;
    if (proposal.content?.qualifications) score++;
    if (proposal.pricingTables) score++;
    if (proposal.narratives && proposal.narratives.length > 0) score++;

    return score / maxScore;
  }

  // Additional feature extraction methods would be implemented here...
  private extractTechnicalApproach(proposal: any): any {
    return {
      hasTechnicalSection: !!proposal.content?.technical_approach,
      depth: this.assessTechnicalDepth(
        proposal.content?.technical_approach || ''
      ),
      innovation: this.assessInnovationLevel(proposal.content || {}),
    };
  }

  private extractInnovation(proposal: any): any {
    const content = JSON.stringify(proposal.content || {}).toLowerCase();
    const innovationKeywords = [
      'innovative',
      'novel',
      'breakthrough',
      'cutting-edge',
      'advanced',
    ];
    const matches = innovationKeywords.filter(keyword =>
      content.includes(keyword)
    );

    return {
      innovationScore: matches.length / innovationKeywords.length,
      innovationKeywords: matches,
    };
  }

  private extractFeasibility(proposal: any): any {
    return {
      hasImplementationPlan: !!proposal.content?.implementation_plan,
      hasTimeline: !!proposal.content?.timeline,
      hasRiskMitigation: !!proposal.content?.risk_mitigation,
      feasibilityScore: this.calculateFeasibilityScore(proposal),
    };
  }

  private extractVisualOrganization(proposal: any): any {
    return {
      sectionCount: Object.keys(proposal.content || {}).length,
      hasStructuredLayout: this.assessStructuredLayout(proposal),
      organizationScore: 0.7, // Placeholder
    };
  }

  private extractProfessionalism(proposal: any): any {
    return {
      formalTone: this.assessFormalTone(proposal),
      consistency: this.assessConsistency(proposal),
      professionalismScore: 0.8, // Placeholder
    };
  }

  private async extractPricingCompetitiveness(
    proposal: any,
    rfp: any
  ): Promise<any> {
    const proposedPrice = this.extractProposedPrice(proposal);
    const marketPrice = await this.getMarketPrice(rfp);

    return {
      proposedPrice,
      marketPrice,
      competitivenessRatio: marketPrice > 0 ? proposedPrice / marketPrice : 1,
      isPriceCompetitive: proposedPrice <= marketPrice * 1.1,
    };
  }

  private extractUniqueValue(proposal: any): any {
    const content = JSON.stringify(proposal.content || {}).toLowerCase();
    const valueKeywords = [
      'unique',
      'exclusive',
      'proprietary',
      'specialized',
      'differentiated',
    ];
    const matches = valueKeywords.filter(keyword => content.includes(keyword));

    return {
      uniquenessScore: matches.length / valueKeywords.length,
      valuePropositions: this.extractValuePropositions(proposal),
    };
  }

  private async extractMarketPosition(proposal: any, rfp: any): Promise<any> {
    return {
      competitorCount: await this.estimateCompetitorCount(rfp),
      marketShare: this.estimateMarketShare(proposal, rfp),
      positioningStrength: 0.6, // Placeholder
    };
  }

  private extractStrategicAlignment(proposal: any, rfp: any): any {
    return {
      alignmentScore: this.calculateStrategicAlignment(proposal, rfp),
      strategicKeywords: this.extractStrategicKeywords(proposal),
      longTermFocus: this.assessLongTermFocus(proposal),
    };
  }

  private extractLongTermValue(proposal: any): any {
    const content = JSON.stringify(proposal.content || {}).toLowerCase();
    const longTermKeywords = [
      'sustainable',
      'scalable',
      'future',
      'long-term',
      'strategic',
    ];
    const matches = longTermKeywords.filter(keyword =>
      content.includes(keyword)
    );

    return {
      longTermScore: matches.length / longTermKeywords.length,
      sustainabilityIndicators: matches,
    };
  }

  // Assessment helper methods
  private assessTechnicalDepth(technicalContent: string): number {
    const technicalKeywords = [
      'architecture',
      'methodology',
      'framework',
      'protocol',
      'algorithm',
    ];
    const matches = technicalKeywords.filter(keyword =>
      technicalContent.toLowerCase().includes(keyword)
    );

    return matches.length / technicalKeywords.length;
  }

  private assessInnovationLevel(content: any): number {
    // Simple innovation assessment
    return 0.5; // Placeholder
  }

  private calculateFeasibilityScore(proposal: any): number {
    let score = 0;
    if (proposal.content?.implementation_plan) score += 0.3;
    if (proposal.content?.timeline) score += 0.3;
    if (proposal.content?.risk_mitigation) score += 0.2;
    if (proposal.content?.team_qualifications) score += 0.2;

    return score;
  }

  private assessStructuredLayout(proposal: any): boolean {
    const requiredSections = [
      'executive_summary',
      'technical_approach',
      'qualifications',
    ];
    return requiredSections.every(section => proposal.content?.[section]);
  }

  private assessFormalTone(proposal: any): number {
    // Simple tone assessment
    return 0.8; // Placeholder
  }

  private assessConsistency(proposal: any): number {
    // Simple consistency assessment
    return 0.7; // Placeholder
  }

  private extractProposedPrice(proposal: any): number {
    // Extract price from pricing tables or content
    const pricingTables = proposal.pricingTables || [];
    if (pricingTables.length > 0) {
      const totalPrice = pricingTables.reduce((sum: number, table: any) => {
        return sum + (table.total || 0);
      }, 0);
      return totalPrice;
    }

    return 0;
  }

  private async getMarketPrice(rfp: any): Promise<number> {
    // Get market price for similar RFPs
    return rfp.estimatedValue || 100000; // Placeholder
  }

  private extractValuePropositions(proposal: any): string[] {
    // Extract value propositions from content
    return ['competitive pricing', 'proven experience']; // Placeholder
  }

  private async estimateCompetitorCount(rfp: any): Promise<number> {
    // Estimate number of competitors for this RFP
    return 5; // Placeholder
  }

  private estimateMarketShare(proposal: any, rfp: any): number {
    // Estimate market share in this domain
    return 0.15; // 15% placeholder
  }

  private calculateStrategicAlignment(proposal: any, rfp: any): number {
    // Calculate alignment between proposal and strategic objectives
    return 0.7; // Placeholder
  }

  private extractStrategicKeywords(proposal: any): string[] {
    const content = JSON.stringify(proposal.content || {}).toLowerCase();
    const strategicKeywords = [
      'strategic',
      'vision',
      'mission',
      'objectives',
      'goals',
    ];

    return strategicKeywords.filter(keyword => content.includes(keyword));
  }

  private assessLongTermFocus(proposal: any): number {
    // Assess long-term focus of the proposal
    return 0.6; // Placeholder
  }

  // Learning and improvement methods
  private calculatePredictionAccuracy(
    evaluation: QualityEvaluation,
    outcome: any
  ): number {
    const predicted = evaluation.predictedSuccessRate;
    const actual = outcome.won ? 1 : 0;

    return 1 - Math.abs(predicted - actual);
  }

  private async updateModelFromOutcome(
    evaluation: QualityEvaluation,
    outcome: any,
    accuracy: number
  ): Promise<void> {
    // Update model parameters based on outcome
    console.log(`Updating model based on outcome - accuracy: ${accuracy}`);
  }

  private async storeLearningData(
    proposalId: string,
    evaluation: QualityEvaluation,
    outcome: any,
    accuracy: number
  ): Promise<void> {
    await agentMemoryService.storeMemory({
      agentId: 'proposal-quality-evaluator',
      memoryType: 'episodic',
      contextKey: `learning_${proposalId}`,
      title: `Learning from Outcome: ${proposalId}`,
      content: {
        evaluation,
        outcome,
        accuracy,
        timestamp: new Date(),
      },
      importance: 9,
      tags: ['outcome_learning', 'model_training'],
      metadata: {
        proposalId,
        accuracy,
        outcome: outcome.won ? 'won' : 'lost',
      },
    });
  }

  private createQualityLearningOutcome(
    evaluation: QualityEvaluation,
    outcome: any
  ): any {
    return {
      type: 'proposal_quality_evaluation',
      rfpId: evaluation.rfpId,
      agentId: 'proposal-quality-evaluator',
      context: {
        action: 'quality_evaluation',
        strategy: {
          evaluationModel: evaluation.evaluationMetadata.evaluatorVersion,
          componentWeights: 'default',
          predictionMethod: 'score_based',
        },
        conditions: {
          proposalComplexity:
            evaluation.componentScores.technicalScore.score > 70
              ? 'high'
              : 'medium',
          competitiveEnvironment:
            evaluation.componentScores.competitivenessScore.score < 60
              ? 'high'
              : 'medium',
        },
        inputs: {
          overallScore: evaluation.overallScore,
          componentScores: evaluation.componentScores,
          predictedSuccess: evaluation.predictedSuccessRate,
        },
        expectedOutput: outcome.won ? 'win' : 'loss',
        actualOutput: outcome.won ? 'win' : 'loss',
      },
      outcome: {
        success: outcome.won,
        metrics: {
          predictionAccuracy: this.calculatePredictionAccuracy(
            evaluation,
            outcome
          ),
          evaluationConfidence: evaluation.confidenceLevel,
          actualScore: outcome.score || 0,
        },
        feedback: outcome.feedback,
        errorDetails: !outcome.won
          ? {
              type: 'prediction_error',
              message: 'Predicted success but proposal was not awarded',
            }
          : undefined,
      },
      learnedPatterns: this.extractQualityPatterns(evaluation, outcome),
      adaptations: this.suggestEvaluationAdaptations(evaluation, outcome),
      confidenceScore: evaluation.confidenceLevel,
      domain: 'quality_evaluation',
      category: 'prediction_accuracy',
      timestamp: new Date(),
    };
  }

  private extractQualityPatterns(
    evaluation: QualityEvaluation,
    outcome: any
  ): string[] {
    const patterns = [];

    if (outcome.won && evaluation.overallScore > 80) {
      patterns.push('high_score_success_pattern');
    }

    if (!outcome.won && evaluation.componentScores.complianceScore.score < 60) {
      patterns.push('compliance_failure_pattern');
    }

    if (
      outcome.won &&
      evaluation.componentScores.competitivenessScore.score > 75
    ) {
      patterns.push('competitive_advantage_pattern');
    }

    return patterns;
  }

  private suggestEvaluationAdaptations(
    evaluation: QualityEvaluation,
    outcome: any
  ): any[] {
    const adaptations = [];

    const predictionError = Math.abs(
      evaluation.predictedSuccessRate - (outcome.won ? 1 : 0)
    );

    if (predictionError > 0.3) {
      adaptations.push({
        type: 'model_calibration',
        area: 'prediction_accuracy',
        suggestion: 'Recalibrate prediction model weights',
        confidence: 0.8,
      });
    }

    if (!outcome.won && evaluation.overallScore > 75) {
      adaptations.push({
        type: 'evaluation_criteria',
        area: 'scoring_model',
        suggestion: 'Review evaluation criteria - high score but lost',
        confidence: 0.9,
      });
    }

    return adaptations;
  }

  // Roadmap generation methods
  private prioritizeRecommendations(
    recommendations: QualityRecommendation[]
  ): QualityRecommendation[] {
    return recommendations.sort((a, b) => {
      // Sort by priority, then impact, then effort
      const priorityWeight = { critical: 4, high: 3, medium: 2, low: 1 };
      const effortWeight = { low: 3, medium: 2, high: 1 };

      const aScore =
        priorityWeight[a.priority] * 10 +
        a.impact * 5 +
        effortWeight[a.effort] * 2;
      const bScore =
        priorityWeight[b.priority] * 10 +
        b.impact * 5 +
        effortWeight[b.effort] * 2;

      return bScore - aScore;
    });
  }

  private createImplementationPhases(
    recommendations: QualityRecommendation[]
  ): any[] {
    const phases = [];
    const criticalItems = recommendations.filter(
      r => r.priority === 'critical'
    );
    const highItems = recommendations.filter(r => r.priority === 'high');
    const mediumItems = recommendations.filter(r => r.priority === 'medium');
    const lowItems = recommendations.filter(r => r.priority === 'low');

    if (criticalItems.length > 0) {
      phases.push({
        phase: 1,
        name: 'Critical Issues',
        description: 'Address critical issues that may cause disqualification',
        recommendations: criticalItems,
        estimatedTime: criticalItems.reduce(
          (sum, item) => sum + item.timeToImplement,
          0
        ),
        priority: 'immediate',
      });
    }

    if (highItems.length > 0) {
      phases.push({
        phase: phases.length + 1,
        name: 'High Impact Improvements',
        description: 'Implement high-impact improvements',
        recommendations: highItems,
        estimatedTime: highItems.reduce(
          (sum, item) => sum + item.timeToImplement,
          0
        ),
        priority: 'urgent',
      });
    }

    if (mediumItems.length > 0) {
      phases.push({
        phase: phases.length + 1,
        name: 'Quality Enhancements',
        description: 'Enhance overall proposal quality',
        recommendations: mediumItems,
        estimatedTime: mediumItems.reduce(
          (sum, item) => sum + item.timeToImplement,
          0
        ),
        priority: 'scheduled',
      });
    }

    return phases;
  }

  private estimateImprovementTimeline(phases: any[]): any {
    const totalTime = phases.reduce(
      (sum, phase) => sum + phase.estimatedTime,
      0
    );

    return {
      totalEstimatedTime: totalTime,
      phases: phases.map(phase => ({
        phase: phase.phase,
        name: phase.name,
        estimatedTime: phase.estimatedTime,
        priority: phase.priority,
      })),
      recommendedApproach: totalTime > 480 ? 'phased' : 'immediate', // 8 hours threshold
    };
  }

  private estimateImprovementImpact(
    evaluation: QualityEvaluation,
    recommendations: QualityRecommendation[]
  ): any {
    const totalImpact = recommendations.reduce(
      (sum, rec) => sum + rec.impact,
      0
    );
    const weightedImpact = recommendations.reduce((sum, rec) => {
      const priorityWeight = {
        critical: 1.5,
        high: 1.2,
        medium: 1.0,
        low: 0.8,
      };
      return (
        sum + rec.impact * priorityWeight[rec.priority] * rec.successProbability
      );
    }, 0);

    return {
      totalImpact,
      weightedImpact,
      expectedScoreIncrease: Math.min(25, weightedImpact), // Cap at 25 points
      confidenceLevel:
        recommendations.reduce((sum, rec) => sum + rec.successProbability, 0) /
        recommendations.length,
      riskAdjustedImpact: weightedImpact * 0.8, // 20% risk adjustment
    };
  }

  // Component-specific assessment methods (continued)
  private assessRequirementsCoverage(coverageData: any): QualityFactor {
    const coverageRate = coverageData.coverageRate || 0;

    return {
      name: 'requirements_coverage',
      impact: (coverageRate - 0.9) * 3, // High penalty for missing requirements
      confidence: 0.9,
      description: `Requirements coverage assessment`,
      evidence: [
        `Coverage rate: ${(coverageRate * 100).toFixed(1)}%`,
        `Covered requirements: ${coverageData.coveredRequirements?.length || 0}`,
        `Missed requirements: ${coverageData.missedRequirements?.length || 0}`,
      ],
    };
  }

  private assessFormatCompliance(formatData: any): QualityFactor {
    const formatScore = formatData.formatScore || 0;

    return {
      name: 'format_compliance',
      impact: (formatScore - 0.8) * 2,
      confidence: 0.95,
      description: `Format compliance assessment`,
      evidence: [
        `Format score: ${(formatScore * 100).toFixed(1)}%`,
        `Has executive summary: ${formatData.hasExecutiveSummary}`,
        `Has technical approach: ${formatData.hasTechnicalApproach}`,
        `Has pricing: ${formatData.hasPricing}`,
      ],
    };
  }

  private assessDeadlineCompliance(deadlineData: any): QualityFactor {
    const onTime = deadlineData.submittedOnTime;
    const timeBuffer = deadlineData.timeToDeadline / (24 * 60 * 60 * 1000); // Days

    return {
      name: 'deadline_compliance',
      impact: onTime ? (timeBuffer > 1 ? 0.5 : 0.2) : -1.0, // Severe penalty for late submission
      confidence: 1.0,
      description: `Deadline compliance assessment`,
      evidence: [
        `Submitted on time: ${onTime}`,
        `Time to deadline: ${timeBuffer.toFixed(1)} days`,
      ],
    };
  }

  private assessTechnicalApproach(technicalData: any): QualityFactor {
    const hasSection = technicalData.hasTechnicalSection;
    const depth = technicalData.depth || 0;

    return {
      name: 'technical_approach',
      impact: hasSection ? (depth - 0.6) * 1.5 : -0.8,
      confidence: 0.8,
      description: `Technical approach quality assessment`,
      evidence: [
        `Has technical section: ${hasSection}`,
        `Technical depth: ${(depth * 100).toFixed(1)}%`,
      ],
    };
  }

  private assessInnovation(innovationData: any): QualityFactor {
    const innovationScore = innovationData.innovationScore || 0;

    return {
      name: 'innovation',
      impact: (innovationScore - 0.3) * 1.2,
      confidence: 0.7,
      description: `Innovation level assessment`,
      evidence: [
        `Innovation score: ${(innovationScore * 100).toFixed(1)}%`,
        `Innovation keywords: ${innovationData.innovationKeywords?.join(', ') || 'none'}`,
      ],
    };
  }

  private assessFeasibility(feasibilityData: any): QualityFactor {
    const feasibilityScore = feasibilityData.feasibilityScore || 0;

    return {
      name: 'feasibility',
      impact: (feasibilityScore - 0.7) * 1.8,
      confidence: 0.8,
      description: `Implementation feasibility assessment`,
      evidence: [
        `Feasibility score: ${(feasibilityScore * 100).toFixed(1)}%`,
        `Has implementation plan: ${feasibilityData.hasImplementationPlan}`,
        `Has timeline: ${feasibilityData.hasTimeline}`,
        `Has risk mitigation: ${feasibilityData.hasRiskMitigation}`,
      ],
    };
  }

  private assessVisualOrganization(visualData: any): QualityFactor {
    const organizationScore = visualData.organizationScore || 0;

    return {
      name: 'visual_organization',
      impact: (organizationScore - 0.7) * 1.0,
      confidence: 0.7,
      description: `Visual organization assessment`,
      evidence: [
        `Organization score: ${(organizationScore * 100).toFixed(1)}%`,
        `Section count: ${visualData.sectionCount}`,
        `Structured layout: ${visualData.hasStructuredLayout}`,
      ],
    };
  }

  private assessProfessionalism(professionalData: any): QualityFactor {
    const professionalismScore = professionalData.professionalismScore || 0;

    return {
      name: 'professionalism',
      impact: (professionalismScore - 0.8) * 1.0,
      confidence: 0.8,
      description: `Professional presentation assessment`,
      evidence: [
        `Professionalism score: ${(professionalismScore * 100).toFixed(1)}%`,
      ],
    };
  }

  private assessPricingCompetitiveness(pricingData: any): QualityFactor {
    const isCompetitive = pricingData.isPriceCompetitive;
    const competitivenessRatio = pricingData.competitivenessRatio || 1;

    return {
      name: 'pricing_competitiveness',
      impact: isCompetitive ? 0.5 : competitivenessRatio > 1.2 ? -0.8 : -0.3,
      confidence: 0.8,
      description: `Pricing competitiveness assessment`,
      evidence: [
        `Is competitive: ${isCompetitive}`,
        `Competitiveness ratio: ${competitivenessRatio.toFixed(2)}`,
        `Proposed price: $${pricingData.proposedPrice?.toLocaleString() || 'N/A'}`,
      ],
    };
  }

  private assessUniqueValue(uniqueData: any): QualityFactor {
    const uniquenessScore = uniqueData.uniquenessScore || 0;

    return {
      name: 'unique_value',
      impact: (uniquenessScore - 0.4) * 1.5,
      confidence: 0.7,
      description: `Unique value proposition assessment`,
      evidence: [
        `Uniqueness score: ${(uniquenessScore * 100).toFixed(1)}%`,
        `Value propositions: ${uniqueData.valuePropositions?.join(', ') || 'none identified'}`,
      ],
    };
  }

  private assessMarketPosition(marketData: any): QualityFactor {
    const positioningStrength = marketData.positioningStrength || 0;

    return {
      name: 'market_position',
      impact: (positioningStrength - 0.6) * 1.3,
      confidence: 0.6,
      description: `Market positioning assessment`,
      evidence: [
        `Positioning strength: ${(positioningStrength * 100).toFixed(1)}%`,
        `Estimated competitors: ${marketData.competitorCount}`,
        `Market share: ${(marketData.marketShare * 100).toFixed(1)}%`,
      ],
    };
  }

  private assessStrategicAlignment(alignmentData: any): QualityFactor {
    const alignmentScore = alignmentData.alignmentScore || 0;

    return {
      name: 'strategic_alignment',
      impact: (alignmentScore - 0.7) * 1.6,
      confidence: 0.7,
      description: `Strategic alignment assessment`,
      evidence: [
        `Alignment score: ${(alignmentScore * 100).toFixed(1)}%`,
        `Strategic keywords: ${alignmentData.strategicKeywords?.join(', ') || 'none'}`,
      ],
    };
  }

  private assessLongTermValue(longTermData: any): QualityFactor {
    const longTermScore = longTermData.longTermScore || 0;

    return {
      name: 'long_term_value',
      impact: (longTermScore - 0.5) * 1.2,
      confidence: 0.6,
      description: `Long-term value assessment`,
      evidence: [
        `Long-term score: ${(longTermScore * 100).toFixed(1)}%`,
        `Sustainability indicators: ${longTermData.sustainabilityIndicators?.join(', ') || 'none'}`,
      ],
    };
  }
}

export const proposalQualityEvaluator = ProposalQualityEvaluator.getInstance();
