import { selfImprovingLearningService } from '../learning/selfImprovingLearningService';
import { agentMemoryService } from '../agents/agentMemoryService';

/**
 * Intelligent Document Processor Service
 *
 * Learns from document parsing successes and failures to continuously improve
 * extraction accuracy. Implements adaptive algorithms for different document types.
 */

export interface DocumentParsingStrategy {
  documentType: string;
  domain: string;
  version: string;

  // Identification patterns
  identification: {
    filePatterns: string[];
    contentPatterns: string[];
    structuralMarkers: string[];
    confidenceThreshold: number;
  };

  // Extraction rules with confidence scores
  extractionRules: {
    [fieldName: string]: {
      patterns: ExtractionPattern[];
      validationRules: ValidationRule[];
      postProcessing: PostProcessingRule[];
      reliability: number;
      lastSuccessful: Date;
    };
  };

  // Learning metadata
  learningData: {
    createdAt: Date;
    lastUpdated: Date;
    successCount: number;
    failureCount: number;
    accuracyScore: number;
    adaptationHistory: StrategyAdaptation[];
  };

  // Performance tracking
  performance: {
    overallAccuracy: number;
    fieldAccuracies: { [fieldName: string]: number };
    processingSpeed: number;
    errorPatterns: ErrorPattern[];
    improvementAreas: string[];
  };
}

export interface ExtractionPattern {
  type: 'regex' | 'xpath' | 'semantic' | 'contextual' | 'ml_model';
  pattern: string;
  weight: number;
  confidence: number;
  contextRequirements?: string[];
  fallbackPatterns?: string[];
  adaptiveModifications?: string[];
}

export interface ValidationRule {
  type: 'format' | 'range' | 'lookup' | 'semantic' | 'contextual';
  rule: string;
  severity: 'error' | 'warning' | 'info';
  autoCorrect?: boolean;
  confidence: number;
}

export interface PostProcessingRule {
  type: 'format' | 'normalize' | 'enrich' | 'validate' | 'correct';
  operation: string;
  parameters: any;
  confidence: number;
}

export interface StrategyAdaptation {
  timestamp: Date;
  trigger: string;
  changes: any[];
  impactScore: number;
  success: boolean;
}

export interface ErrorPattern {
  type: string;
  frequency: number;
  description: string;
  commonCauses: string[];
  resolutionStrategies: string[];
}

export interface ParsingAttempt {
  documentId: string;
  documentType: string;
  domain: string;
  timestamp: Date;
  strategy: string;

  input: {
    fileName: string;
    fileSize: number;
    mimeType: string;
    content: string;
    metadata: DocumentMetadata;
  };

  processing: {
    identificationResults: DocumentIdentificationResult;
    extractionResults: { [fieldName: string]: any };
    validationResults: { [fieldName: string]: any };
    postProcessingResults: any;
    duration: number;
  };

  outcome: {
    success: boolean;
    extractedFields: { [fieldName: string]: any };
    confidence: number;
    errors: any[];
    warnings: any[];
    qualityScore: number;
  };

  feedback?: {
    userCorrections: { [fieldName: string]: any };
    qualityRating: number;
    comments: string;
    timestamp: Date;
  };
}

interface ValidationIssue {
  type: string;
  severity: ValidationRule['severity'];
  message?: string;
  rule?: string;
}

interface ValidationOutcome {
  isValid: boolean;
  confidence: number;
  issues: ValidationIssue[];
  correctedValue: unknown;
}

interface ValidationRuleResult {
  valid: boolean;
  issueType?: string;
  message?: string;
  correctedValue?: unknown;
}

interface ExtractedFieldResult {
  value: unknown;
  confidence: number;
  method?: string;
  validationIssues?: ValidationIssue[];
  alternativeValues?: unknown[];
  error?: string;
  [key: string]: unknown;
}

type ExtractedFieldMap = Record<string, ExtractedFieldResult>;
type ValidationResultMap = Record<string, ValidationOutcome>;

type DocumentMetadata = {
  fileName?: string;
  mimeType?: string;
  [key: string]: unknown;
};

interface DocumentIdentificationResult {
  type: string;
  domain: string;
  confidence: number;
  indicators: string[];
}

interface DocumentPattern {
  type: string;
  domain: string;
  identification: {
    filePatterns?: string[];
    contentPatterns?: string[];
    structuralMarkers?: string[];
    confidenceThreshold?: number;
  };
  matchedIndicators?: string[];
}

interface AdaptationSuggestion {
  type: string;
  area: string;
  suggestion: string;
  confidence: number;
  priority?: string;
  timeframe?: string;
  resources?: string[];
}

interface FeedbackPattern {
  field: string;
  issue: string;
  correctedValue: unknown;
}

interface PerformanceSummary {
  totalDocuments: number;
  accuracy: number;
  successRate: number;
}

interface ErrorPatternSummary {
  type: string;
  frequency: number;
  percentage: number;
}

export class IntelligentDocumentProcessor {
  private static instance: IntelligentDocumentProcessor;
  private adaptationThreshold: number = 0.85; // Adapt when accuracy drops below 85%
  private learningEnabled: boolean = true;
  private strategyUpdateInterval: number = 7 * 24 * 60 * 60 * 1000; // 7 days

  public static getInstance(): IntelligentDocumentProcessor {
    if (!IntelligentDocumentProcessor.instance) {
      IntelligentDocumentProcessor.instance =
        new IntelligentDocumentProcessor();
    }
    return IntelligentDocumentProcessor.instance;
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    try {
      return JSON.stringify(error);
    } catch {
      return 'Unknown error';
    }
  }

  private normalizeMetadata(metadata: unknown): DocumentMetadata {
    if (!metadata || typeof metadata !== 'object') {
      return {};
    }

    const record = metadata as Record<string, unknown>;
    const normalized: DocumentMetadata = { ...record };

    const rawFileName = record['fileName'];
    if (typeof rawFileName === 'string') {
      normalized.fileName = rawFileName;
    } else if ('fileName' in normalized) {
      delete normalized.fileName;
    }

    const rawMime = record['mimeType'];
    if (typeof rawMime === 'string') {
      normalized.mimeType = rawMime;
    } else if ('mimeType' in normalized) {
      delete normalized.mimeType;
    }

    return normalized;
  }

  // ============ INTELLIGENT PARSING ============

  /**
   * Process document with adaptive intelligence
   */
  async processDocumentIntelligently(
    documentId: string,
    content: string,
    metadata: unknown
  ): Promise<any> {
    try {
      console.log(`🧠 Processing document intelligently: ${documentId}`);

      const normalizedMetadata = this.normalizeMetadata(metadata);

      // Identify document type and domain
      const identification = await this.identifyDocument(
        content,
        normalizedMetadata
      );

      // Get or create parsing strategy
      const strategy = await this.getParsingStrategy(
        identification.type,
        identification.domain
      );

      // Create parsing attempt record
      const attempt: ParsingAttempt = {
        documentId,
        documentType: identification.type,
        domain: identification.domain,
        timestamp: new Date(),
        strategy: strategy.version,
        input: {
          fileName: normalizedMetadata.fileName || 'unknown',
          fileSize: content.length,
          mimeType: normalizedMetadata.mimeType || 'text/plain',
          content,
          metadata: normalizedMetadata,
        },
        processing: {
          identificationResults: identification,
          extractionResults: {},
          validationResults: {},
          postProcessingResults: {},
          duration: 0,
        },
        outcome: {
          success: false,
          extractedFields: {},
          confidence: 0,
          errors: [],
          warnings: [],
          qualityScore: 0,
        },
      };

      const startTime = Date.now();

      try {
        // Extract fields using strategy
        attempt.processing.extractionResults = await this.extractFields(
          content,
          strategy
        );

        // Validate extracted data
        attempt.processing.validationResults = await this.validateExtractedData(
          attempt.processing.extractionResults,
          strategy
        );

        // Post-process results
        attempt.processing.postProcessingResults =
          await this.postProcessResults(
            attempt.processing.extractionResults,
            strategy
          );

        // Calculate outcome
        attempt.outcome = this.calculateOutcome(attempt.processing);
        attempt.processing.duration = Date.now() - startTime;

        console.log(
          `✅ Document processed with ${(attempt.outcome.confidence * 100).toFixed(1)}% confidence`
        );
      } catch (error) {
        attempt.outcome.success = false;
        const message = this.getErrorMessage(error);
        attempt.outcome.errors.push({
          type: 'processing_error',
          message,
          timestamp: new Date(),
        });
        attempt.processing.duration = Date.now() - startTime;

        console.error(`❌ Document processing failed:`, error);
      }

      // Record attempt for learning
      await this.recordParsingAttempt(attempt);

      return {
        success: attempt.outcome.success,
        extractedData: attempt.outcome.extractedFields,
        confidence: attempt.outcome.confidence,
        qualityScore: attempt.outcome.qualityScore,
        processingTime: attempt.processing.duration,
        metadata: {
          documentType: attempt.documentType,
          domain: attempt.domain,
          strategy: attempt.strategy,
        },
      };
    } catch (error) {
      const message = this.getErrorMessage(error);
      console.error('❌ Failed to process document intelligently:', error);
      return {
        success: false,
        error: message,
        extractedData: {},
        confidence: 0,
      };
    }
  }

  /**
   * Learn from user feedback and corrections
   */
  async learnFromFeedback(documentId: string, feedback: any): Promise<void> {
    if (!this.learningEnabled) return;

    try {
      console.log(`📚 Learning from feedback for document: ${documentId}`);

      // Get the original parsing attempt
      const attempt = await this.getParsingAttempt(documentId);
      if (!attempt) {
        console.warn(`No parsing attempt found for document: ${documentId}`);
        return;
      }

      // Add feedback to attempt
      attempt.feedback = {
        userCorrections: feedback.corrections || {},
        qualityRating: feedback.rating || 0,
        comments: feedback.comments || '',
        timestamp: new Date(),
      };

      // Analyze feedback for learning opportunities
      const learningInsights = this.analyzeFeedback(attempt);

      // Update parsing strategy based on feedback
      if (learningInsights.significant) {
        await this.updateStrategyFromFeedback(attempt, learningInsights);
      }

      // Create learning outcome for the self-improving system
      const learningOutcome = this.createParsingLearningOutcome(attempt, true);
      await selfImprovingLearningService.recordLearningOutcome(learningOutcome);

      // Store updated attempt
      await this.storeParsingAttempt(attempt);

      console.log(`✅ Feedback learning completed for document: ${documentId}`);
    } catch (error) {
      console.error('❌ Failed to learn from feedback:', error);
    }
  }

  /**
   * Analyze parsing performance and suggest improvements
   */
  async analyzeParsingPerformance(
    timeframe: 'day' | 'week' | 'month' = 'week'
  ): Promise<any> {
    try {
      const endDate = new Date();
      const startDate = new Date();

      switch (timeframe) {
        case 'day':
          startDate.setDate(endDate.getDate() - 1);
          break;
        case 'week':
          startDate.setDate(endDate.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(endDate.getMonth() - 1);
          break;
      }

      const attempts = await this.getParsingAttemptsByDateRange(
        startDate,
        endDate
      );

      const analysis = {
        totalDocuments: attempts.length,
        overallAccuracy: this.calculateOverallAccuracy(attempts),
        performanceByType: this.analyzePerformanceByType(attempts),
        performanceByDomain: this.analyzePerformanceByDomain(attempts),
        errorAnalysis: this.analyzeErrors(attempts),
        improvementOpportunities:
          this.identifyImprovementOpportunities(attempts),
        strategyRecommendations:
          await this.generateStrategyRecommendations(attempts),
      };

      return analysis;
    } catch (error) {
      console.error('❌ Failed to analyze parsing performance:', error);
      return { error: this.getErrorMessage(error) };
    }
  }

  // ============ DOCUMENT IDENTIFICATION ============

  /**
   * Intelligently identify document type and domain
   */
  private async identifyDocument(
    content: string,
    metadata: DocumentMetadata
  ): Promise<DocumentIdentificationResult> {
    const identification: DocumentIdentificationResult = {
      type: 'unknown',
      domain: 'general',
      confidence: 0,
      indicators: [],
    };

    // Get known document patterns
    const knownPatterns = await this.getDocumentPatterns();

    // Test against each pattern
    for (const pattern of knownPatterns) {
      const score = this.testDocumentPattern(content, metadata, pattern);
      if (score > identification.confidence) {
        identification.type = pattern.type;
        identification.domain = pattern.domain;
        identification.confidence = score;
        identification.indicators = pattern.matchedIndicators || [];
      }
    }

    // Use heuristics if no strong pattern match
    if (identification.confidence < 0.7) {
      const heuristicResult = this.applyIdentificationHeuristics(content);
      if (heuristicResult.confidence > identification.confidence) {
        Object.assign(identification, heuristicResult);
      }
    }

    return identification;
  }

  /**
   * Test content against known document patterns
   */
  private testDocumentPattern(
    content: string,
    metadata: DocumentMetadata,
    pattern: DocumentPattern
  ): number {
    let score = 0;
    let totalTests = 0;

    // Test file patterns
    if (pattern.identification.filePatterns) {
      for (const filePattern of pattern.identification.filePatterns) {
        totalTests++;
        if (this.testFilePattern(metadata.fileName ?? '', filePattern)) {
          score += 0.3;
        }
      }
    }

    // Test content patterns
    if (pattern.identification.contentPatterns) {
      for (const contentPattern of pattern.identification.contentPatterns) {
        totalTests++;
        if (this.testContentPattern(content, contentPattern)) {
          score += 0.4;
        }
      }
    }

    // Test structural markers
    if (pattern.identification.structuralMarkers) {
      for (const marker of pattern.identification.structuralMarkers) {
        totalTests++;
        if (this.testStructuralMarker(content, marker)) {
          score += 0.3;
        }
      }
    }

    return totalTests > 0 ? score / totalTests : 0;
  }

  /**
   * Apply heuristic rules for document identification
   */
  private applyIdentificationHeuristics(
    content: string
  ): DocumentIdentificationResult {
    const heuristics: DocumentIdentificationResult = {
      type: 'unknown',
      domain: 'general',
      confidence: 0,
      indicators: [],
    };

    const lowerContent = content.toLowerCase();

    // RFP/Solicitation heuristics
    if (
      lowerContent.includes('request for proposal') ||
      lowerContent.includes('rfp') ||
      lowerContent.includes('solicitation')
    ) {
      heuristics.type = 'rfp_document';
      heuristics.confidence = 0.8;
      heuristics.indicators.push('rfp_keywords');
    }

    // Contract heuristics
    if (
      lowerContent.includes('contract') ||
      lowerContent.includes('agreement') ||
      lowerContent.includes('terms and conditions')
    ) {
      heuristics.type = 'contract';
      heuristics.confidence = 0.7;
      heuristics.indicators.push('contract_keywords');
    }

    // Technical document heuristics
    if (
      lowerContent.includes('technical specification') ||
      lowerContent.includes('requirements') ||
      lowerContent.includes('architecture')
    ) {
      heuristics.type = 'technical_document';
      heuristics.confidence = 0.6;
      heuristics.indicators.push('technical_keywords');
    }

    // Domain identification
    if (
      lowerContent.includes('software') ||
      lowerContent.includes('technology')
    ) {
      heuristics.domain = 'technology';
    } else if (
      lowerContent.includes('construction') ||
      lowerContent.includes('building')
    ) {
      heuristics.domain = 'construction';
    } else if (
      lowerContent.includes('healthcare') ||
      lowerContent.includes('medical')
    ) {
      heuristics.domain = 'healthcare';
    }

    return heuristics;
  }

  // ============ FIELD EXTRACTION ============

  /**
   * Extract fields using adaptive strategy
   */
  private async extractFields(
    content: string,
    strategy: DocumentParsingStrategy
  ): Promise<ExtractedFieldMap> {
    const extractedFields: ExtractedFieldMap = {};

    for (const [fieldName, fieldRules] of Object.entries(
      strategy.extractionRules
    )) {
      try {
        const fieldValue = await this.extractField(
          content,
          fieldName,
          fieldRules
        );
        extractedFields[fieldName] = fieldValue;
      } catch (error) {
        const message = this.getErrorMessage(error);
        console.warn(`Failed to extract field ${fieldName}:`, message);
        extractedFields[fieldName] = {
          value: null,
          confidence: 0,
          error: message,
        };
      }
    }

    return extractedFields;
  }

  /**
   * Extract individual field using multiple patterns
   */
  private async extractField(
    content: string,
    fieldName: string,
    fieldRules: any
  ): Promise<ExtractedFieldResult> {
    const results: Array<
      ExtractedFieldResult & { patternWeight: number; totalConfidence: number }
    > = [];

    // Try each extraction pattern
    for (const pattern of fieldRules.patterns) {
      try {
        const result = await this.applyExtractionPattern(content, pattern);
        if (result && result.confidence > 0.3) {
          results.push({
            ...result,
            patternWeight: pattern.weight,
            totalConfidence: result.confidence * pattern.weight,
          });
        }
      } catch (error) {
        console.warn(
          `Pattern failed for ${fieldName}:`,
          this.getErrorMessage(error)
        );
      }
    }

    // Select best result or combine results
    if (results.length === 0) {
      return { value: null, confidence: 0, method: 'none' };
    }

    // Sort by total confidence
    results.sort((a, b) => b.totalConfidence - a.totalConfidence);

    const bestResult = results[0];

    // Apply validation
    const validationResult = await this.validateFieldValue(
      bestResult.value,
      fieldName,
      fieldRules.validationRules
    );

    return {
      value: validationResult.correctedValue || bestResult.value,
      confidence: bestResult.confidence * validationResult.confidence,
      method: bestResult.method,
      validationIssues: validationResult.issues || [],
      alternativeValues: results.slice(1, 3).map(r => r.value),
    };
  }

  /**
   * Apply specific extraction pattern
   */
  private async applyExtractionPattern(
    content: string,
    pattern: ExtractionPattern
  ): Promise<ExtractedFieldResult> {
    switch (pattern.type) {
      case 'regex':
        return this.applyRegexPattern(content, pattern);
      case 'xpath':
        return this.applyXPathPattern();
      case 'semantic':
        return this.applySemanticPattern(content, pattern);
      case 'contextual':
        return this.applyContextualPattern(content, pattern);
      case 'ml_model':
        return this.applyMLModelPattern();
      default:
        throw new Error(`Unknown pattern type: ${pattern.type}`);
    }
  }

  /**
   * Apply regex extraction pattern
   */
  private applyRegexPattern(
    content: string,
    pattern: ExtractionPattern
  ): ExtractedFieldResult {
    try {
      const regex = new RegExp(pattern.pattern, 'gi');
      const matches = content.match(regex);

      if (matches && matches.length > 0) {
        return {
          value: matches[0].trim(),
          confidence: pattern.confidence,
          method: 'regex',
          allMatches: matches,
        };
      }

      return { value: null, confidence: 0, method: 'regex' };
    } catch (error) {
      throw new Error(`Regex pattern failed: ${this.getErrorMessage(error)}`);
    }
  }

  /**
   * Apply semantic pattern (keyword-based with context)
   */
  private applySemanticPattern(
    content: string,
    pattern: ExtractionPattern
  ): ExtractedFieldResult {
    try {
      const keywords = pattern.pattern.split('|');
      const contextWindow = 100; // Characters around keyword

      for (const keyword of keywords) {
        const regex = new RegExp(
          `(.{0,${contextWindow}})${keyword}(.{0,${contextWindow}})`,
          'gi'
        );
        const match = regex.exec(content);

        if (match) {
          // Extract value from context
          const context = match[0];
          const extractedValue = this.extractValueFromContext(context, keyword);

          if (extractedValue) {
            return {
              value: extractedValue,
              confidence: pattern.confidence * 0.8, // Slightly lower confidence for semantic
              method: 'semantic',
              context: context,
            };
          }
        }
      }

      return { value: null, confidence: 0, method: 'semantic' };
    } catch (error) {
      throw new Error(
        `Semantic pattern failed: ${this.getErrorMessage(error)}`
      );
    }
  }

  /**
   * Apply contextual pattern (multi-line analysis)
   */
  private applyContextualPattern(
    content: string,
    pattern: ExtractionPattern
  ): ExtractedFieldResult {
    try {
      const lines = content.split('\n');
      const contextRequirements = pattern.contextRequirements || [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Check if line matches pattern
        if (line.toLowerCase().includes(pattern.pattern.toLowerCase())) {
          // Check context requirements
          const contextValid = this.validateContext(
            lines,
            i,
            contextRequirements
          );

          if (contextValid) {
            const extractedValue = this.extractValueFromLine(line);
            return {
              value: extractedValue,
              confidence: pattern.confidence,
              method: 'contextual',
              lineNumber: i + 1,
            };
          }
        }
      }

      return { value: null, confidence: 0, method: 'contextual' };
    } catch (error) {
      throw new Error(
        `Contextual pattern failed: ${this.getErrorMessage(error)}`
      );
    }
  }

  /**
   * Apply ML model pattern (placeholder for future ML integration)
   * TODO: Implement ML model-based field extraction
   */
  private applyMLModelPattern(): ExtractedFieldResult {
    // Placeholder for ML model integration
    // This would use trained models for field extraction
    throw new Error('applyMLModelPattern not implemented');
  }

  /**
   * Apply XPath pattern (for structured documents)
   * TODO: Implement XPath-based field extraction for XML/HTML documents
   */
  private applyXPathPattern(): ExtractedFieldResult {
    // Placeholder for XPath implementation
    // This would parse XML/HTML and apply XPath queries
    throw new Error('applyXPathPattern not implemented');
  }

  // ============ VALIDATION AND POST-PROCESSING ============

  /**
   * Validate extracted data using rules
   */
  private async validateExtractedData(
    extractedData: ExtractedFieldMap,
    strategy: DocumentParsingStrategy
  ): Promise<ValidationResultMap> {
    const validationResults: ValidationResultMap = {};

    for (const [fieldName, fieldData] of Object.entries(extractedData)) {
      const fieldRules = strategy.extractionRules[fieldName];
      if (fieldRules && fieldRules.validationRules) {
        validationResults[fieldName] = await this.validateFieldValue(
          fieldData.value,
          fieldName,
          fieldRules.validationRules
        );
      }
    }

    return validationResults;
  }

  /**
   * Validate individual field value
   */
  private async validateFieldValue(
    value: unknown,
    fieldName: string,
    validationRules: ValidationRule[]
  ): Promise<ValidationOutcome> {
    const result: ValidationOutcome = {
      isValid: true,
      confidence: 1.0,
      issues: [],
      correctedValue: null,
    };

    if (!value) {
      result.isValid = false;
      result.confidence = 0;
      result.issues.push({ type: 'missing_value', severity: 'error' });
      return result;
    }

    for (const rule of validationRules) {
      const validationResult = this.applyValidationRule(value, rule);

      if (!validationResult.valid) {
        result.isValid = false;
        result.confidence *= 0.8; // Reduce confidence for each validation failure
        result.issues.push({
          type: validationResult.issueType ?? 'validation_error',
          severity: rule.severity,
          message: validationResult.message,
          rule: rule.rule,
        });

        // Apply auto-correction if available
        if (rule.autoCorrect && validationResult.correctedValue) {
          result.correctedValue = validationResult.correctedValue;
        }
      }
    }

    return result;
  }

  /**
   * Apply individual validation rule
   */
  private applyValidationRule(
    value: unknown,
    rule: ValidationRule
  ): ValidationRuleResult {
    try {
      switch (rule.type) {
        case 'format':
          return this.validateFormat(value, rule);
        case 'range':
          return this.validateRange(value, rule);
        case 'lookup':
          return this.validateLookup(value, rule);
        case 'semantic':
          return this.validateSemantic(value, rule);
        case 'contextual':
          return this.validateContextual(value, rule);
        default:
          return { valid: true };
      }
    } catch (error) {
      return {
        valid: false,
        issueType: 'validation_error',
        message: `Validation failed: ${this.getErrorMessage(error)}`,
      };
    }
  }

  /**
   * Post-process extraction results
   */
  private async postProcessResults(
    extractionResults: ExtractedFieldMap,
    strategy: DocumentParsingStrategy
  ): Promise<ExtractedFieldMap> {
    const processedResults: ExtractedFieldMap = { ...extractionResults };

    for (const [fieldName, fieldData] of Object.entries(extractionResults)) {
      const fieldRules = strategy.extractionRules[fieldName];
      if (fieldRules && fieldRules.postProcessing) {
        try {
          processedResults[fieldName] = await this.applyPostProcessing(
            fieldData,
            fieldRules.postProcessing
          );
        } catch (error) {
          console.warn(
            `Post-processing failed for ${fieldName}:`,
            this.getErrorMessage(error)
          );
        }
      }
    }

    return processedResults;
  }

  /**
   * Apply post-processing rules to field
   */
  private async applyPostProcessing(
    fieldData: ExtractedFieldResult,
    postProcessingRules: PostProcessingRule[]
  ): Promise<ExtractedFieldResult> {
    let processedData: ExtractedFieldResult = { ...fieldData };

    for (const rule of postProcessingRules) {
      switch (rule.type) {
        case 'format':
          processedData = this.formatFieldValue(processedData);
          break;
        case 'normalize':
          processedData = this.normalizeFieldValue(processedData);
          break;
        case 'enrich':
          processedData = await this.enrichFieldValue(processedData);
          break;
        case 'validate':
          processedData =
            this.validateFieldValueInPostProcessing(processedData);
          break;
        case 'correct':
          processedData = this.correctFieldValue(processedData);
          break;
      }
    }

    return processedData;
  }

  // ============ STRATEGY MANAGEMENT ============

  /**
   * Get parsing strategy for document type and domain
   */
  private async getParsingStrategy(
    documentType: string,
    domain: string
  ): Promise<DocumentParsingStrategy> {
    const strategyKey = `${documentType}_${domain}`;
    let strategy = await this.loadParsingStrategy(strategyKey);

    if (!strategy) {
      strategy = await this.createDefaultStrategy(documentType, domain);
    } else if (this.needsStrategyUpdate(strategy)) {
      await this.updateStrategy(strategy);
    }

    return strategy;
  }

  /**
   * Create learning outcome from parsing attempt
   */
  private createParsingLearningOutcome(
    attempt: ParsingAttempt,
    hasFeedback: boolean = false
  ): any {
    return {
      type: 'document_parsing',
      rfpId: attempt.documentId,
      agentId: 'document-processor-specialist',
      context: {
        action: 'document_parsing',
        strategy: {
          documentType: attempt.documentType,
          domain: attempt.domain,
          version: attempt.strategy,
        },
        conditions: {
          fileSize: attempt.input.fileSize,
          mimeType: attempt.input.mimeType,
          hasStructure: this.hasStructuralContent(attempt.input.content),
        },
        inputs: {
          documentType: attempt.documentType,
          domain: attempt.domain,
          content: attempt.input.content.substring(0, 1000), // Sample for analysis
        },
        expectedOutput: 'extracted_fields',
        actualOutput: attempt.outcome.extractedFields,
      },
      outcome: {
        success: attempt.outcome.success,
        metrics: {
          confidence: attempt.outcome.confidence,
          qualityScore: attempt.outcome.qualityScore,
          duration: attempt.processing.duration,
          fieldsExtracted: Object.keys(attempt.outcome.extractedFields).length,
        },
        feedback: hasFeedback ? attempt.feedback?.comments : undefined,
        errorDetails:
          attempt.outcome.errors.length > 0
            ? attempt.outcome.errors[0]
            : undefined,
        improvementAreas: this.identifyParsingImprovements(attempt),
      },
      learnedPatterns: this.extractParsingPatterns(attempt),
      adaptations: this.suggestParsingAdaptations(attempt),
      confidenceScore: attempt.outcome.confidence,
      domain: attempt.domain,
      category: attempt.documentType,
      timestamp: attempt.timestamp,
    };
  }

  /**
   * Record parsing attempt for learning
   */
  private async recordParsingAttempt(attempt: ParsingAttempt): Promise<void> {
    if (!this.learningEnabled) return;

    // Store attempt in memory
    await agentMemoryService.storeMemory({
      agentId: 'document-processor-specialist',
      memoryType: 'episodic',
      contextKey: `parsing_attempt_${attempt.documentId}`,
      title: `Parsing Attempt: ${attempt.documentType}`,
      content: attempt,
      importance: attempt.outcome.success ? 6 : 8,
      tags: [
        'document_parsing',
        attempt.documentType,
        attempt.domain,
        attempt.outcome.success ? 'success' : 'failure',
      ],
      metadata: {
        documentId: attempt.documentId,
        confidence: attempt.outcome.confidence,
        qualityScore: attempt.outcome.qualityScore,
      },
    });

    // Create learning outcome
    const learningOutcome = this.createParsingLearningOutcome(attempt);
    await selfImprovingLearningService.recordLearningOutcome(learningOutcome);

    // Check if strategy needs adaptation
    if (
      !attempt.outcome.success ||
      attempt.outcome.confidence < this.adaptationThreshold
    ) {
      await this.adaptParsingStrategy(
        attempt.documentType,
        attempt.domain,
        'low_performance'
      );
    }
  }

  // ============ PRIVATE HELPER METHODS ============

  private async getDocumentPatterns(): Promise<DocumentPattern[]> {
    const knowledge = await agentMemoryService.getAgentKnowledge(
      'document-processor-specialist',
      'strategy',
      undefined,
      100
    );

    return knowledge
      .map(entry => entry?.content)
      .filter((content): content is DocumentPattern =>
        this.isDocumentPattern(content)
      );
  }

  private isDocumentPattern(value: unknown): value is DocumentPattern {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const candidate = value as Record<string, unknown>;
    const identification = candidate['identification'];

    return (
      typeof candidate['type'] === 'string' &&
      typeof candidate['domain'] === 'string' &&
      identification !== undefined &&
      typeof identification === 'object'
    );
  }

  private testFilePattern(fileName: string, pattern: string): boolean {
    const regex = new RegExp(pattern, 'i');
    return regex.test(fileName);
  }

  private testContentPattern(content: string, pattern: string): boolean {
    const regex = new RegExp(pattern, 'gi');
    return regex.test(content);
  }

  private testStructuralMarker(content: string, marker: string): boolean {
    return content.toLowerCase().includes(marker.toLowerCase());
  }

  private extractValueFromContext(
    context: string,
    keyword: string
  ): string | null {
    // Extract value near keyword using heuristics
    const lines = context.split('\n');
    for (const line of lines) {
      if (line.toLowerCase().includes(keyword.toLowerCase())) {
        // Look for patterns like "keyword: value" or "keyword value"
        const match = line.match(
          new RegExp(keyword + '\\s*[:-]?\\s*([^\\n\\r,;]+)', 'i')
        );
        if (match && match[1]) {
          return match[1].trim();
        }
      }
    }
    return null;
  }

  private validateContext(
    lines: string[],
    lineIndex: number,
    requirements: string[]
  ): boolean {
    const contextWindow = 3; // Check 3 lines before and after
    const startIndex = Math.max(0, lineIndex - contextWindow);
    const endIndex = Math.min(lines.length - 1, lineIndex + contextWindow);

    const contextContent = lines
      .slice(startIndex, endIndex + 1)
      .join(' ')
      .toLowerCase();

    return requirements.every(req =>
      contextContent.includes(req.toLowerCase())
    );
  }

  private extractValueFromLine(line: string): string | null {
    // Extract value from line containing pattern
    const parts = line.split(/[:\-\t]/);
    if (parts.length > 1) {
      return parts[parts.length - 1].trim();
    }
    return line.trim();
  }

  private validateFormat(
    value: unknown,
    rule: ValidationRule
  ): ValidationRuleResult {
    try {
      const regex = new RegExp(rule.rule);
      const valid = regex.test(String(value));

      return {
        valid,
        issueType: valid ? undefined : 'format_mismatch',
        message: valid
          ? undefined
          : `Value does not match expected format: ${rule.rule}`,
      };
    } catch (error) {
      return {
        valid: false,
        issueType: 'validation_error',
        message: `Format validation failed: ${this.getErrorMessage(error)}`,
      };
    }
  }

  private validateRange(
    value: unknown,
    rule: ValidationRule
  ): ValidationRuleResult {
    try {
      const numValue = parseFloat(String(value));
      if (isNaN(numValue)) {
        return {
          valid: false,
          issueType: 'not_numeric',
          message: 'Value is not numeric',
        };
      }

      const [min, max] = rule.rule.split(',').map(v => parseFloat(v.trim()));
      const valid = numValue >= min && numValue <= max;

      return {
        valid,
        issueType: valid ? undefined : 'out_of_range',
        message: valid
          ? undefined
          : `Value ${numValue} is outside range [${min}, ${max}]`,
      };
    } catch (error) {
      return {
        valid: false,
        issueType: 'validation_error',
        message: `Range validation failed: ${this.getErrorMessage(error)}`,
      };
    }
  }

  private validateLookup(
    value: unknown,
    rule: ValidationRule
  ): ValidationRuleResult {
    // Validate against lookup table
    const lookupValues = rule.rule.split('|').map(v => v.trim().toLowerCase());
    const valid = lookupValues.includes(String(value).toLowerCase());

    return {
      valid,
      issueType: valid ? undefined : 'invalid_value',
      message: valid ? undefined : `Value not in allowed list: ${rule.rule}`,
    };
  }

  private validateSemantic(
    value: unknown,
    rule: ValidationRule
  ): ValidationRuleResult {
    // Semantic validation (placeholder for more sophisticated logic)
    // TODO: Implement semantic validation using rule.rule pattern
    if (!value) {
      return { valid: false, issueType: 'missing_value' };
    }
    // Future implementation will use rule.rule for semantic pattern matching
    console.debug('Semantic validation rule:', rule.rule);
    return { valid: true };
  }

  private validateContextual(
    value: unknown,
    rule: ValidationRule
  ): ValidationRuleResult {
    // Contextual validation (placeholder)
    // TODO: Implement contextual validation using rule.rule pattern
    if (!value) {
      return { valid: false, issueType: 'missing_value' };
    }
    // Future implementation will use rule.rule for contextual pattern matching
    console.debug('Contextual validation rule:', rule.rule);
    return { valid: true };
  }

  private formatFieldValue(
    fieldData: ExtractedFieldResult
  ): ExtractedFieldResult {
    // Apply formatting rules
    return fieldData;
  }

  private normalizeFieldValue(
    fieldData: ExtractedFieldResult
  ): ExtractedFieldResult {
    // Apply normalization rules
    return fieldData;
  }

  private async enrichFieldValue(
    fieldData: ExtractedFieldResult
  ): Promise<ExtractedFieldResult> {
    // Apply enrichment rules
    return fieldData;
  }

  private validateFieldValueInPostProcessing(
    fieldData: ExtractedFieldResult
  ): ExtractedFieldResult {
    // Apply validation in post-processing
    return fieldData;
  }

  private correctFieldValue(
    fieldData: ExtractedFieldResult
  ): ExtractedFieldResult {
    // Apply correction rules
    return fieldData;
  }

  private calculateOutcome(processing: any): {
    success: boolean;
    extractedFields: ExtractedFieldMap;
    confidence: number;
    errors: unknown[];
    warnings: unknown[];
    qualityScore: number;
  } {
    const extractedFields =
      (processing.extractionResults as ExtractedFieldMap) || {};
    const validationResults =
      (processing.validationResults as ValidationResultMap) || {};

    let totalFields = 0;
    let successfulFields = 0;
    let totalConfidence = 0;
    let qualityScore = 0;

    for (const [fieldName, fieldData] of Object.entries(extractedFields)) {
      totalFields++;
      if (fieldData.value !== null && fieldData.confidence > 0.3) {
        successfulFields++;
        totalConfidence += fieldData.confidence;
      }

      const validation = validationResults[fieldName];
      if (validation && validation.isValid) {
        qualityScore += validation.confidence;
      }
    }

    const success =
      successfulFields > 0 && successfulFields / totalFields > 0.5;
    const confidence = totalFields > 0 ? totalConfidence / totalFields : 0;
    const quality = totalFields > 0 ? qualityScore / totalFields : 0;

    return {
      success,
      extractedFields: Object.fromEntries(
        Object.entries(extractedFields).filter(
          ([_, data]) => data.value !== null
        )
      ) as ExtractedFieldMap,
      confidence,
      errors: [],
      warnings: [],
      qualityScore: quality,
    };
  }

  private async loadParsingStrategy(
    strategyKey: string
  ): Promise<DocumentParsingStrategy | null> {
    const memory = await agentMemoryService.getMemoryByContext(
      'document-processor-specialist',
      `strategy_${strategyKey}`
    );

    return memory ? memory.content : null;
  }

  private needsStrategyUpdate(strategy: DocumentParsingStrategy): boolean {
    const timeSinceUpdate =
      Date.now() - strategy.learningData.lastUpdated.getTime();
    return (
      timeSinceUpdate > this.strategyUpdateInterval ||
      strategy.learningData.accuracyScore < this.adaptationThreshold
    );
  }

  private async updateStrategy(
    strategy: DocumentParsingStrategy
  ): Promise<void> {
    // Update strategy based on recent performance
    strategy.learningData.lastUpdated = new Date();
    await this.saveParsingStrategy(strategy);
  }

  private async createDefaultStrategy(
    documentType: string,
    domain: string
  ): Promise<DocumentParsingStrategy> {
    const strategy: DocumentParsingStrategy = {
      documentType,
      domain,
      version: '1.0.0',
      identification: {
        filePatterns: this.getDefaultFilePatterns(documentType),
        contentPatterns: this.getDefaultContentPatterns(documentType),
        structuralMarkers: this.getDefaultStructuralMarkers(documentType),
        confidenceThreshold: 0.7,
      },
      extractionRules: this.getDefaultExtractionRules(documentType),
      learningData: {
        createdAt: new Date(),
        lastUpdated: new Date(),
        successCount: 0,
        failureCount: 0,
        accuracyScore: 0.5,
        adaptationHistory: [],
      },
      performance: {
        overallAccuracy: 0.5,
        fieldAccuracies: {},
        processingSpeed: 0,
        errorPatterns: [],
        improvementAreas: [],
      },
    };

    await this.saveParsingStrategy(strategy);
    return strategy;
  }

  private async saveParsingStrategy(
    strategy: DocumentParsingStrategy
  ): Promise<void> {
    const strategyKey = `${strategy.documentType}_${strategy.domain}`;

    await agentMemoryService.storeMemory({
      agentId: 'document-processor-specialist',
      memoryType: 'procedural',
      contextKey: `strategy_${strategyKey}`,
      title: `Parsing Strategy: ${strategy.documentType}/${strategy.domain}`,
      content: strategy,
      importance: 9,
      tags: ['parsing_strategy', strategy.documentType, strategy.domain],
      metadata: {
        documentType: strategy.documentType,
        domain: strategy.domain,
        version: strategy.version,
        accuracy: strategy.performance.overallAccuracy,
      },
    });
  }

  private getDefaultFilePatterns(documentType: string): string[] {
    const patterns: Record<string, string[]> = {
      rfp_document: ['.*rfp.*', '.*solicitation.*', '.*proposal.*'],
      contract: ['.*contract.*', '.*agreement.*'],
      technical_document: ['.*spec.*', '.*technical.*', '.*requirements.*'],
    };

    return patterns[documentType] || ['.*'];
  }

  private getDefaultContentPatterns(documentType: string): string[] {
    const patterns: Record<string, string[]> = {
      rfp_document: [
        'request for proposal',
        'rfp number',
        'submission deadline',
      ],
      contract: ['contract number', 'effective date', 'termination'],
      technical_document: ['specification', 'requirements', 'architecture'],
    };

    return patterns[documentType] || [];
  }

  private getDefaultStructuralMarkers(documentType: string): string[] {
    const markers: Record<string, string[]> = {
      rfp_document: [
        'scope of work',
        'evaluation criteria',
        'submission requirements',
      ],
      contract: ['terms and conditions', 'payment terms', 'deliverables'],
      technical_document: [
        'functional requirements',
        'non-functional requirements',
        'constraints',
      ],
    };

    return markers[documentType] || [];
  }

  private getDefaultExtractionRules(documentType: string): any {
    // Return default extraction rules based on document type and domain
    const rules: Record<string, Record<string, unknown>> = {
      rfp_document: {
        rfp_number: {
          patterns: [
            {
              type: 'regex',
              pattern: 'rfp\\s*[#:]?\\s*([\\w\\-\\/]+)',
              weight: 1.0,
              confidence: 0.8,
            },
          ],
          validationRules: [
            {
              type: 'format',
              rule: '^[\\w\\-\\/]+$',
              severity: 'warning',
              confidence: 0.7,
            },
          ],
          postProcessing: [
            {
              type: 'normalize',
              operation: 'uppercase',
              parameters: {},
              confidence: 0.9,
            },
          ],
          reliability: 0.8,
          lastSuccessful: new Date(),
        },
        deadline: {
          patterns: [
            {
              type: 'semantic',
              pattern: 'deadline|due date|submission date',
              weight: 1.0,
              confidence: 0.7,
            },
          ],
          validationRules: [
            {
              type: 'format',
              rule: '\\d{1,2}[/\\-]\\d{1,2}[/\\-]\\d{4}',
              severity: 'error',
              confidence: 0.8,
            },
          ],
          postProcessing: [
            {
              type: 'format',
              operation: 'date_normalize',
              parameters: { format: 'MM/DD/YYYY' },
              confidence: 0.9,
            },
          ],
          reliability: 0.7,
          lastSuccessful: new Date(),
        },
      },
    };

    return rules[documentType] || {};
  }

  private hasStructuralContent(content: string): boolean {
    // Check if content has structural elements
    return (
      content.includes('<') || // HTML/XML
      content.includes('{') || // JSON
      content.includes('|') || // Tables
      content.split('\n').length > 10
    ); // Multi-line document
  }

  private identifyParsingImprovements(attempt: ParsingAttempt): string[] {
    const improvements: string[] = [];

    if (attempt.outcome.confidence < 0.7) {
      improvements.push('extraction_patterns');
    }

    if (attempt.outcome.errors.length > 0) {
      improvements.push('error_handling');
    }

    if (Object.keys(attempt.outcome.extractedFields).length === 0) {
      improvements.push('field_detection');
    }

    if (attempt.processing.duration > 10000) {
      improvements.push('processing_speed');
    }

    return improvements;
  }

  private extractParsingPatterns(attempt: ParsingAttempt): string[] {
    const patterns: string[] = [];

    if (attempt.outcome.success) {
      patterns.push(`successful_parsing_${attempt.documentType}`);
      patterns.push(`domain_pattern_${attempt.domain}`);
    }

    if (attempt.outcome.confidence > 0.9) {
      patterns.push('high_confidence_extraction');
    }

    return patterns;
  }

  private suggestParsingAdaptations(
    attempt: ParsingAttempt
  ): AdaptationSuggestion[] {
    const adaptations: AdaptationSuggestion[] = [];

    if (!attempt.outcome.success) {
      adaptations.push({
        type: 'pattern_adjustment',
        area: 'extraction_rules',
        suggestion: 'Review and update extraction patterns',
        confidence: 0.7,
      });
    }

    if (attempt.outcome.confidence < 0.5) {
      adaptations.push({
        type: 'strategy_overhaul',
        area: 'overall_approach',
        suggestion: 'Consider alternative extraction strategies',
        confidence: 0.8,
      });
    }

    return adaptations;
  }

  private async getParsingAttempt(
    documentId: string
  ): Promise<ParsingAttempt | null> {
    const memory = await agentMemoryService.getMemoryByContext(
      'document-processor-specialist',
      `parsing_attempt_${documentId}`
    );

    return memory ? memory.content : null;
  }

  private async storeParsingAttempt(attempt: ParsingAttempt): Promise<void> {
    await agentMemoryService.storeMemory({
      agentId: 'document-processor-specialist',
      memoryType: 'episodic',
      contextKey: `parsing_attempt_${attempt.documentId}`,
      title: `Parsing Attempt: ${attempt.documentType}`,
      content: attempt,
      importance: attempt.outcome.success ? 6 : 8,
      tags: ['document_parsing', attempt.documentType, attempt.domain],
      metadata: {
        documentId: attempt.documentId,
        hasFeedback: !!attempt.feedback,
      },
    });
  }

  private analyzeFeedback(attempt: ParsingAttempt): any {
    if (!attempt.feedback) return { significant: false };

    const corrections = attempt.feedback.userCorrections || {};
    const correctionCount = Object.keys(corrections).length;
    const qualityRating = attempt.feedback.qualityRating || 0;

    return {
      significant: correctionCount > 0 || qualityRating < 3,
      correctionCount,
      qualityRating,
      patterns: this.identifyFeedbackPatterns(corrections),
    };
  }

  private identifyFeedbackPatterns(
    corrections: Record<string, unknown>
  ): FeedbackPattern[] {
    const patterns: FeedbackPattern[] = [];

    for (const [fieldName, correction] of Object.entries(corrections)) {
      patterns.push({
        field: fieldName,
        issue: 'incorrect_extraction',
        correctedValue: correction,
      });
    }

    return patterns;
  }

  private async updateStrategyFromFeedback(
    attempt: ParsingAttempt,
    insights: {
      patterns: FeedbackPattern[];
      qualityRating: number;
      correctionCount: number;
    }
  ): Promise<void> {
    const strategyKey = `${attempt.documentType}_${attempt.domain}`;
    const strategy = await this.loadParsingStrategy(strategyKey);

    if (!strategy) return;

    // Update extraction rules based on feedback
    for (const pattern of insights.patterns) {
      if (strategy.extractionRules[pattern.field]) {
        // Reduce confidence of failed patterns
        strategy.extractionRules[pattern.field].patterns.forEach(p => {
          p.confidence *= 0.9;
        });

        // Add new pattern based on correction
        const newPattern = this.createPatternFromCorrection(pattern);
        if (newPattern) {
          strategy.extractionRules[pattern.field].patterns.unshift(newPattern);
        }
      }
    }

    // Update performance metrics
    strategy.performance.overallAccuracy = this.calculateUpdatedAccuracy(
      strategy.performance.overallAccuracy,
      insights.qualityRating / 5
    );

    strategy.learningData.lastUpdated = new Date();
    strategy.learningData.adaptationHistory.push({
      timestamp: new Date(),
      trigger: 'user_feedback',
      changes: insights.patterns,
      impactScore: insights.correctionCount / 10,
      success: true,
    });

    await this.saveParsingStrategy(strategy);
  }

  private createPatternFromCorrection(
    pattern: FeedbackPattern
  ): ExtractionPattern | null {
    // Create new extraction pattern based on user correction
    // This is a simplified implementation
    return {
      type: 'regex',
      pattern: String(pattern.correctedValue).replace(
        /[.*+?^${}()|[\]\\]/g,
        '\\$&'
      ),
      weight: 1.0,
      confidence: 0.8,
      adaptiveModifications: [`corrected_from_feedback_${Date.now()}`],
    };
  }

  private calculateUpdatedAccuracy(
    currentAccuracy: number,
    feedbackScore: number
  ): number {
    // Weighted average with more recent feedback having higher impact
    return currentAccuracy * 0.8 + feedbackScore * 0.2;
  }

  private async getParsingAttemptsByDateRange(
    startDate: Date,
    endDate: Date
  ): Promise<ParsingAttempt[]> {
    const memories = await agentMemoryService.getAgentMemories(
      'document-processor-specialist',
      'episodic',
      1000
    );

    return memories
      .filter(m => {
        const timestamp = new Date(m.content.timestamp);
        return timestamp >= startDate && timestamp <= endDate;
      })
      .map(m => m.content);
  }

  private calculateOverallAccuracy(attempts: ParsingAttempt[]): number {
    if (attempts.length === 0) return 0;

    const totalAccuracy = attempts.reduce(
      (sum, attempt) => sum + (attempt.outcome.confidence || 0),
      0
    );
    return totalAccuracy / attempts.length;
  }

  private analyzePerformanceByType(
    attempts: ParsingAttempt[]
  ): Record<string, PerformanceSummary> {
    const typeGroups = attempts.reduce<Record<string, ParsingAttempt[]>>(
      (groups, attempt) => {
        if (!groups[attempt.documentType]) {
          groups[attempt.documentType] = [];
        }
        groups[attempt.documentType].push(attempt);
        return groups;
      },
      {}
    );

    const analysis: Record<string, PerformanceSummary> = {};
    for (const [type, typeAttempts] of Object.entries(typeGroups)) {
      analysis[type] = {
        totalDocuments: typeAttempts.length,
        accuracy: this.calculateOverallAccuracy(typeAttempts),
        successRate:
          typeAttempts.filter(a => a.outcome.success).length /
          (typeAttempts.length || 1),
      };
    }

    return analysis;
  }

  private analyzePerformanceByDomain(
    attempts: ParsingAttempt[]
  ): Record<string, PerformanceSummary> {
    const domainGroups = attempts.reduce<Record<string, ParsingAttempt[]>>(
      (groups, attempt) => {
        if (!groups[attempt.domain]) {
          groups[attempt.domain] = [];
        }
        groups[attempt.domain].push(attempt);
        return groups;
      },
      {}
    );

    const analysis: Record<string, PerformanceSummary> = {};
    for (const [domain, domainAttempts] of Object.entries(domainGroups)) {
      analysis[domain] = {
        totalDocuments: domainAttempts.length,
        accuracy: this.calculateOverallAccuracy(domainAttempts),
        successRate:
          domainAttempts.filter(a => a.outcome.success).length /
          (domainAttempts.length || 1),
      };
    }

    return analysis;
  }

  private analyzeErrors(attempts: ParsingAttempt[]): {
    totalErrors: number;
    errorTypes: number;
    patterns: ErrorPatternSummary[];
  } {
    const errorCounts: Record<string, number> = {};
    const errorPatterns: ErrorPatternSummary[] = [];

    for (const attempt of attempts) {
      for (const error of attempt.outcome.errors) {
        errorCounts[error.type] = (errorCounts[error.type] || 0) + 1;
      }
    }

    for (const [errorType, count] of Object.entries(errorCounts)) {
      errorPatterns.push({
        type: errorType,
        frequency: count,
        percentage: (count / (attempts.length || 1)) * 100,
      });
    }

    return {
      totalErrors: Object.values(errorCounts).reduce(
        (sum, count) => sum + count,
        0
      ),
      errorTypes: Object.keys(errorCounts).length,
      patterns: errorPatterns.sort((a, b) => b.frequency - a.frequency),
    };
  }

  private identifyImprovementOpportunities(
    attempts: ParsingAttempt[]
  ): string[] {
    const opportunities: string[] = [];

    const overallAccuracy = this.calculateOverallAccuracy(attempts);
    if (overallAccuracy < 0.8) {
      opportunities.push('Improve overall extraction accuracy');
    }

    const failedAttempts = attempts.filter(a => !a.outcome.success);
    if (failedAttempts.length > attempts.length * 0.2) {
      opportunities.push('Reduce failure rate through better error handling');
    }

    const slowAttempts = attempts.filter(a => a.processing.duration > 10000);
    if (slowAttempts.length > attempts.length * 0.3) {
      opportunities.push('Optimize processing speed');
    }

    return opportunities;
  }

  private async generateStrategyRecommendations(
    attempts: ParsingAttempt[]
  ): Promise<string[]> {
    const recommendations: string[] = [];

    // Analyze patterns in failed attempts
    const failedAttempts = attempts.filter(a => !a.outcome.success);
    if (failedAttempts.length > 0) {
      const commonFailureTypes =
        this.identifyCommonFailureTypes(failedAttempts);
      for (const failureType of commonFailureTypes) {
        recommendations.push(
          `Address ${failureType} failure pattern through strategy updates`
        );
      }
    }

    // Analyze document types with low accuracy
    const typePerformance = this.analyzePerformanceByType(attempts);
    for (const [type, performance] of Object.entries(typePerformance)) {
      if ((performance as any).accuracy < 0.7) {
        recommendations.push(
          `Improve extraction strategy for ${type} documents`
        );
      }
    }

    return recommendations;
  }

  private identifyCommonFailureTypes(
    failedAttempts: ParsingAttempt[]
  ): string[] {
    const failureTypes = failedAttempts
      .flatMap(attempt => attempt.outcome.errors.map(error => error.type))
      .reduce<Record<string, number>>((counts, type) => {
        counts[type] = (counts[type] || 0) + 1;
        return counts;
      }, {});

    return Object.entries(failureTypes)
      .filter(([_, count]) => count > 1)
      .sort(([, a], [, b]) => b - a)
      .map(([type, _]) => type);
  }

  private async adaptParsingStrategy(
    documentType: string,
    domain: string,
    reason: string
  ): Promise<void> {
    console.log(
      `🔄 Adapting parsing strategy for ${documentType}/${domain}: ${reason}`
    );

    const strategy = await this.getParsingStrategy(documentType, domain);

    // Generate and apply adaptations based on reason
    const adaptations = await this.generateParsingAdaptations(strategy, reason);

    for (const adaptation of adaptations) {
      await this.applyParsingAdaptation(strategy, adaptation);
    }

    // Update strategy metadata
    strategy.learningData.lastUpdated = new Date();
    strategy.learningData.adaptationHistory.push({
      timestamp: new Date(),
      trigger: reason,
      changes: adaptations,
      impactScore: 0.5,
      success: true,
    });

    await this.saveParsingStrategy(strategy);

    console.log(
      `✅ Applied ${adaptations.length} adaptations to parsing strategy`
    );
  }

  private async generateParsingAdaptations(
    strategy: DocumentParsingStrategy,
    reason: string
  ): Promise<Record<string, unknown>[]> {
    const adaptations: Array<Record<string, unknown>> = [];

    switch (reason) {
      case 'low_performance':
        // Reduce confidence of low-performing patterns
        adaptations.push({
          type: 'confidence_adjustment',
          action: 'reduce_low_performers',
          threshold: 0.5,
        });
        break;

      case 'validation_failure':
        // Update validation rules
        adaptations.push({
          type: 'validation_update',
          action: 'relax_rules',
          severity: 'warning',
        });
        break;

      case 'user_feedback':
        // Add user-suggested patterns
        adaptations.push({
          type: 'pattern_addition',
          action: 'add_feedback_patterns',
        });
        break;
    }

    return adaptations;
  }

  private async applyParsingAdaptation(
    strategy: DocumentParsingStrategy,
    adaptation: Record<string, unknown>
  ): Promise<void> {
    switch (adaptation.type) {
      case 'confidence_adjustment':
        this.adjustPatternConfidences(strategy, adaptation);
        break;
      case 'validation_update':
        this.updateValidationRules(strategy, adaptation);
        break;
      case 'pattern_addition':
        this.addNewPatterns();
        break;
    }
  }

  private adjustPatternConfidences(
    strategy: DocumentParsingStrategy,
    adaptation: any
  ): void {
    for (const fieldRules of Object.values(strategy.extractionRules)) {
      fieldRules.patterns.forEach(pattern => {
        if (pattern.confidence < adaptation.threshold) {
          pattern.confidence *= 0.9; // Reduce confidence of low performers
        }
      });
    }
  }

  private updateValidationRules(
    strategy: DocumentParsingStrategy,
    adaptation: any
  ): void {
    for (const fieldRules of Object.values(strategy.extractionRules)) {
      fieldRules.validationRules.forEach(rule => {
        if (rule.severity === 'error' && adaptation.action === 'relax_rules') {
          rule.severity = 'warning';
        }
      });
    }
  }

  private addNewPatterns(): void {
    // Placeholder for adding new patterns based on adaptations
    console.log('Adding new patterns based on adaptation');
  }
}

export const intelligentDocumentProcessor =
  IntelligentDocumentProcessor.getInstance();
