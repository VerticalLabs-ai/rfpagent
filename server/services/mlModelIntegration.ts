import OpenAI from 'openai';
import { storage } from '../storage';

/**
 * ML Model Integration for RFP Agent Intelligence
 *
 * This module integrates advanced machine learning capabilities:
 *
 * 1. EMBEDDINGS & SEMANTIC SEARCH
 *    - Document embeddings for intelligent retrieval
 *    - Requirement similarity matching
 *    - Context-aware search
 *
 * 2. CLASSIFICATION MODELS
 *    - RFP category classification
 *    - Requirement type detection
 *    - Risk level classification
 *
 * 3. REGRESSION MODELS
 *    - Cost estimation
 *    - Timeline prediction
 *    - Resource allocation optimization
 *
 * 4. CLUSTERING & PATTERN DETECTION
 *    - RFP grouping by similarity
 *    - Agency pattern recognition
 *    - Seasonal trend detection
 *
 * 5. ANOMALY DETECTION
 *    - Unusual RFP requirements
 *    - Pricing outliers
 *    - Suspicious patterns
 */

// ============================================================================
// STARTUP VALIDATION
// ============================================================================

/**
 * Validate required environment variables at startup
 */
function validateEnvironment(): void {
  if (!process.env.OPENAI_API_KEY) {
    const errorMessage =
      'FATAL: OPENAI_API_KEY environment variable is not set. ML Model Integration cannot initialize.';
    console.error(errorMessage);
    throw new Error(errorMessage);
  }
}

// Run validation before instantiating OpenAI client
validateEnvironment();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface EmbeddingVector {
  text: string;
  embedding: number[];
  metadata?: Record<string, any>;
}

export interface SemanticSearchResult {
  id: string;
  text: string;
  similarity: number;
  metadata?: Record<string, any>;
}

export interface ClassificationResult {
  category: string;
  confidence: number;
  alternatives: Array<{ category: string; confidence: number }>;
}

export interface RegressionPrediction {
  value: number;
  confidence: number;
  range: { min: number; max: number };
  factors: Array<{ factor: string; contribution: number }>;
}

export interface ClusterAnalysis {
  clusters: Array<{
    id: number;
    centroid: number[];
    members: string[];
    characteristics: string[];
  }>;
  optimalClusters: number;
  silhouetteScore: number;
}

export interface AnomalyDetectionResult {
  isAnomaly: boolean;
  anomalyScore: number;
  anomalyType?: string;
  explanation: string;
  severity: 'low' | 'medium' | 'high';
}

// ============================================================================
// ML MODEL INTEGRATION SERVICE
// ============================================================================

/**
 * LRU Cache implementation for embeddings with configurable size limit
 */
class LRUCache<K, V> {
  private cache: Map<K, V>;
  private readonly maxSize: number;

  constructor(maxSize: number) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    if (!this.cache.has(key)) return undefined;

    // Move to end (most recently used)
    const value = this.cache.get(key)!;
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  set(key: K, value: V): void {
    // Remove existing key if present
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // Evict oldest entry if at capacity
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    // Add new entry (most recently used)
    this.cache.set(key, value);
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  get size(): number {
    return this.cache.size;
  }

  clear(): void {
    this.cache.clear();
  }
}

export class MLModelIntegration {
  private static instance: MLModelIntegration;

  // Configurable cache size limit (default: 1000 embeddings)
  private readonly MAX_CACHE_SIZE =
    Number(process.env.EMBEDDING_CACHE_SIZE) || 1000;

  // LRU cache for embeddings with automatic eviction
  private embeddingCache: LRUCache<string, number[]>;

  // Model versions
  private readonly embeddingModel = 'text-embedding-3-large';
  private readonly embeddingDimensions = 3072;

  private constructor() {
    this.embeddingCache = new LRUCache(this.MAX_CACHE_SIZE);
  }
}

  public static getInstance(): MLModelIntegration {
    if (!MLModelIntegration.instance) {
      MLModelIntegration.instance = new MLModelIntegration();
    }
    return MLModelIntegration.instance;
  }

  // ========================================================================
  // 1. EMBEDDINGS & SEMANTIC SEARCH
  // ========================================================================

  /**
   * Generate embedding vector for text
   */
  async generateEmbedding(
    text: string,
    options?: {
      model?: string;
      dimensions?: number;
    }
  ): Promise<number[]> {
    try {
      // Check cache
      const dimensions = options?.dimensions || this.embeddingDimensions;
      const cacheKey = `${text}_${options?.model || this.embeddingModel}_${dimensions}`;
      if (this.embeddingCache.has(cacheKey)) {
        return this.embeddingCache.get(cacheKey)!;
      }

      // Generate embedding
      const response = await openai.embeddings.create({
        model: options?.model || this.embeddingModel,
        input: text,
        dimensions: options?.dimensions,
      });

      const embedding = response.data[0].embedding;

      // Cache result
      this.embeddingCache.set(cacheKey, embedding);

      console.log(`🔢 Generated embedding: ${embedding.length} dimensions`);

      return embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw error;
    }
  }

  /**
   * Batch generate embeddings for multiple texts
   */
  async generateEmbeddingBatch(
    texts: string[],
    options?: {
      model?: string;
      dimensions?: number;
      batchSize?: number;
    }
  ): Promise<number[][]> {
    const batchSize = options?.batchSize || 100;
    const embeddings: number[][] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchIndex = Math.floor(i / batchSize);

      try {
        const response = await openai.embeddings.create({
          model: options?.model || this.embeddingModel,
          input: batch,
          dimensions: options?.dimensions,
        });

        embeddings.push(...response.data.map(d => d.embedding));

        console.log(
          `🔢 Generated ${embeddings.length}/${texts.length} embeddings`
        );
      } catch (error) {
        console.error(
          `❌ Error generating embeddings for batch ${batchIndex} (texts ${i}-${i + batch.length - 1}):`,
          error instanceof Error ? error.message : error
        );
        // Skip this batch and continue with remaining batches
        continue;
      }
    }

    // Ensure we have at least some embeddings
    if (embeddings.length === 0) {
      throw new Error(
        `Failed to generate any embeddings for ${texts.length} texts. All batches failed.`
      );
    }

    return embeddings;
  }

  /**
   * Semantic search using embeddings
   */
  async semanticSearch(
    query: string,
    documents: Array<{ id: string; text: string; metadata?: any }>,
    options?: {
      topK?: number;
      threshold?: number;
    }
  ): Promise<SemanticSearchResult[]> {
    try {
      const topK = options?.topK || 10;
      const threshold = options?.threshold || 0.5;

      // Generate query embedding
      const queryEmbedding = await this.generateEmbedding(query);

      // Generate document embeddings
      const docTexts = documents.map(d => d.text);
      const docEmbeddings = await this.generateEmbeddingBatch(docTexts);

      // Calculate similarities
      const results: SemanticSearchResult[] = [];

      for (let i = 0; i < documents.length; i++) {
        const similarity = this.cosineSimilarity(
          queryEmbedding,
          docEmbeddings[i]
        );

        if (similarity >= threshold) {
          results.push({
            id: documents[i].id,
            text: documents[i].text,
            similarity,
            metadata: documents[i].metadata,
          });
        }
      }

      // Sort by similarity and return top K
      results.sort((a, b) => b.similarity - a.similarity);

      console.log(
        `🔍 Semantic Search: Found ${results.length} results above threshold ${threshold}`
      );

      return results.slice(0, topK);
    } catch (error) {
      console.error('Error in semantic search:', error);
      return [];
    }
  }

  /**
   * Find similar RFPs using embeddings
   */
  async findSimilarRFPs(
    rfpId: string,
    options?: {
      topK?: number;
      minSimilarity?: number;
    }
  ): Promise<
    Array<{ rfpId: string; similarity: number; matchingFeatures: string[] }>
  > {
    try {
      // Get RFP details from database
      const rfp = await storage.getRFP(rfpId);
      if (!rfp) return [];

      // Create RFP text representation
      const rfpText = `${rfp.title}\n${rfp.description}\nAgency: ${rfp.agency}\nCategory: ${rfp.category}`;

      // Get all other RFPs
      const allRfps = await storage.getAllRFPs();
      const otherRfps = allRfps.filter(r => r.id !== rfpId);

      // Perform semantic search
      const documents = otherRfps.map(r => ({
        id: r.id,
        text: `${r.title}\n${r.description}\nAgency: ${r.agency}\nCategory: ${r.category}`,
        metadata: { agency: r.agency, category: r.category },
      }));

      const results = await this.semanticSearch(rfpText, documents, {
        topK: options?.topK || 10,
        threshold: options?.minSimilarity || 0.7,
      });

      // Identify matching features
      return results.map(r => ({
        rfpId: r.id,
        similarity: r.similarity,
        matchingFeatures: this.identifyMatchingFeatures(rfp, r.metadata),
      }));
    } catch (error) {
      console.error('Error finding similar RFPs:', error);
      return [];
    }
  }

  // ========================================================================
  // 2. CLASSIFICATION MODELS
  // ========================================================================

  /**
   * Classify RFP category using GPT-5
   */
  async classifyRFPCategory(
    rfpText: string,
    options?: {
      categories?: string[];
    }
  ): Promise<ClassificationResult> {
    try {
      const categories = options?.categories || [
        'IT Services',
        'Construction',
        'Professional Services',
        'Equipment & Supplies',
        'Healthcare',
        'Transportation',
        'Education',
        'Security',
        'Other',
      ];

      const prompt = `Classify the following RFP into one of these categories: ${categories.join(', ')}

RFP:
${rfpText}

Respond with JSON:
{
  "category": "selected category",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation",
  "alternatives": [
    { "category": "alternative", "confidence": 0.0-1.0 }
  ]
}`;

      const response = await openai.chat.completions.create({
        model: 'gpt-5',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');

      console.log(
        `🏷️ Classification: ${result.category} (${(result.confidence * 100).toFixed(1)}% confidence)`
      );

      return {
        category: result.category,
        confidence: result.confidence,
        alternatives: result.alternatives || [],
      };
    } catch (error) {
      console.error('Error classifying RFP:', error);
      return {
        category: 'Unknown',
        confidence: 0,
        alternatives: [],
      };
    }
  }

  /**
   * Classify requirement type
   */
  async classifyRequirementType(requirement: string): Promise<{
    type: 'technical' | 'functional' | 'compliance' | 'business' | 'other';
    confidence: number;
    keywords: string[];
  }> {
    try {
      const prompt = `Classify this requirement type:

Requirement: ${requirement}

Types:
- technical: Technical specifications, architecture, technologies
- functional: Business functionality, features, capabilities
- compliance: Legal, regulatory, certification requirements
- business: Business terms, pricing, timeline, deliverables
- other: Doesn't fit above categories

Respond with JSON:
{
  "type": "selected type",
  "confidence": 0.0-1.0,
  "keywords": ["key", "words"],
  "reasoning": "brief explanation"
}`;

      const response = await openai.chat.completions.create({
        model: 'gpt-5',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.2,
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');

      return {
        type: result.type,
        confidence: result.confidence,
        keywords: result.keywords || [],
      };
    } catch (error) {
      console.error('Error classifying requirement:', error);
      return { type: 'other', confidence: 0, keywords: [] };
    }
  }

  // ========================================================================
  // 3. REGRESSION MODELS
  // ========================================================================

  /**
   * Estimate RFP cost using ML regression
   */
  async estimateCost(rfpFeatures: {
    category: string;
    requirements: string[];
    estimatedDuration: number;
    complexity: number;
    teamSize?: number;
  }): Promise<RegressionPrediction> {
    try {
      // Get historical cost data
      const historicalData = await this.getHistoricalCostData(
        rfpFeatures.category
      );

      if (historicalData.length < 5) {
        // Not enough data - use rule-based estimation
        return this.ruleBasedCostEstimation(rfpFeatures);
      }

      // Simple linear regression on historical data
      const X = historicalData.map(d => [
        d.requirementCount,
        d.duration,
        d.complexity,
        d.teamSize,
      ]);
      const y = historicalData.map(d => d.actualCost);

      // Calculate regression coefficients
      const coefficients = this.multipleLinearRegression(X, y);

      // If regression fails, fall back to rule-based estimation
      if (!coefficients) {
        console.warn('Regression failed, using rule-based estimation');
        return this.ruleBasedCostEstimation(rfpFeatures);
      }

      // Predict cost
      const featureVector = [
        rfpFeatures.requirements.length,
        rfpFeatures.estimatedDuration,
        rfpFeatures.complexity,
        rfpFeatures.teamSize || 5,
      ];

      const predictedCost = this.predictValue(featureVector, coefficients);

      // Calculate confidence interval
      const residuals = X.map(
        (x, i) => y[i] - this.predictValue(x, coefficients)
      );
      const rmse = Math.sqrt(
        residuals.reduce((sum, r) => sum + r * r, 0) / residuals.length
      );

      const confidence = Math.max(0.5, 1 - rmse / predictedCost);
      const range = {
        min: predictedCost - rmse * 1.96, // 95% confidence interval
        max: predictedCost + rmse * 1.96,
      };

      // Identify key cost factors
      const factors = [
        {
          factor: 'Requirements',
          contribution: coefficients[0] * rfpFeatures.requirements.length,
        },
        {
          factor: 'Duration',
          contribution: coefficients[1] * rfpFeatures.estimatedDuration,
        },
        {
          factor: 'Complexity',
          contribution: coefficients[2] * rfpFeatures.complexity,
        },
        {
          factor: 'Team Size',
          contribution: coefficients[3] * (rfpFeatures.teamSize || 5),
        },
      ].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));

      console.log(
        `💰 Cost Estimation: $${predictedCost.toLocaleString()} (confidence: ${(confidence * 100).toFixed(1)}%)`
      );

      return {
        value: predictedCost,
        confidence,
        range,
        factors,
      };
    } catch (error) {
      console.error('Error estimating cost:', error);
      return this.ruleBasedCostEstimation(rfpFeatures);
    }
  }

  /**
   * Predict project timeline
   */
  async predictTimeline(rfpFeatures: {
    requirements: string[];
    complexity: number;
    teamSize: number;
    dependencies: number;
  }): Promise<RegressionPrediction> {
    try {
      // Simple heuristic-based prediction
      const baselineWeeks = rfpFeatures.requirements.length * 0.5; // 0.5 weeks per requirement

      // Complexity adjustment
      const complexityMultiplier = 1 + rfpFeatures.complexity * 0.5;

      // Team size adjustment (more people = faster, but diminishing returns)
      const teamMultiplier = 1 / Math.sqrt(rfpFeatures.teamSize);

      // Dependency adjustment
      const dependencyWeeks = rfpFeatures.dependencies * 0.3;

      const predictedWeeks =
        baselineWeeks * complexityMultiplier * teamMultiplier + dependencyWeeks;

      // Confidence based on data quality
      const confidence = 0.7;

      // 20% buffer range
      const range = {
        min: predictedWeeks * 0.8,
        max: predictedWeeks * 1.2,
      };

      const factors = [
        { factor: 'Requirements', contribution: baselineWeeks },
        {
          factor: 'Complexity',
          contribution: baselineWeeks * (complexityMultiplier - 1),
        },
        {
          factor: 'Team Size',
          contribution: -baselineWeeks * (1 - teamMultiplier),
        },
        { factor: 'Dependencies', contribution: dependencyWeeks },
      ];

      console.log(`⏱️ Timeline Prediction: ${predictedWeeks.toFixed(1)} weeks`);

      return { value: predictedWeeks, confidence, range, factors };
    } catch (error) {
      console.error('Error predicting timeline:', error);
      return {
        value: 12,
        confidence: 0.5,
        range: { min: 8, max: 16 },
        factors: [],
      };
    }
  }

  // ========================================================================
  // 4. CLUSTERING & PATTERN DETECTION
  // ========================================================================

  /**
   * Cluster RFPs by similarity
   */
  async clusterRFPs(
    rfps: Array<{ id: string; text: string }>,
    options?: {
      numClusters?: number;
      minClusterSize?: number;
    }
  ): Promise<ClusterAnalysis> {
    try {
      // Generate embeddings for all RFPs
      const embeddings = await this.generateEmbeddingBatch(
        rfps.map(r => r.text)
      );

      // Determine optimal number of clusters (if not specified)
      const k =
        options?.numClusters ||
        Math.min(10, Math.ceil(Math.sqrt(rfps.length / 2)));

      // K-means clustering
      const clusters = this.kMeansClustering(embeddings, k);

      // Calculate cluster characteristics
      const clusterAnalysis = clusters.map((cluster, i) => ({
        id: i,
        centroid: cluster.centroid,
        members: cluster.memberIndices.map(idx => rfps[idx].id),
        characteristics: this.identifyClusterCharacteristics(
          cluster.memberIndices.map(idx => rfps[idx].text)
        ),
      }));

      // Calculate silhouette score (cluster quality metric)
      const silhouetteScore = this.calculateSilhouetteScore(
        embeddings,
        clusters
      );

      console.log(
        `🎯 Clustering: ${k} clusters, silhouette score: ${silhouetteScore.toFixed(3)}`
      );

      return {
        clusters: clusterAnalysis,
        optimalClusters: k,
        silhouetteScore,
      };
    } catch (error) {
      console.error('Error clustering RFPs:', error);
      return {
        clusters: [],
        optimalClusters: 0,
        silhouetteScore: 0,
      };
    }
  }

  // ========================================================================
  // 5. ANOMALY DETECTION
  // ========================================================================

  /**
   * Detect anomalies in RFP data
   */
  async detectAnomalies(rfpData: {
    estimatedValue: number;
    deadline: Date;
    requirements: string[];
    category: string;
  }): Promise<AnomalyDetectionResult> {
    try {
      let isAnomaly = false;
      let anomalyScore = 0;
      let anomalyType: string | undefined;
      let explanation = 'No anomalies detected';
      let severity: 'low' | 'medium' | 'high' = 'low';

      // Get statistical baseline for category
      const baseline = await this.getCategoryBaseline(rfpData.category);

      // Check 1: Unusual value
      if (
        rfpData.estimatedValue > baseline.valueP95 ||
        rfpData.estimatedValue < baseline.valueP5
      ) {
        isAnomaly = true;
        anomalyScore = Math.max(anomalyScore, 0.7);
        anomalyType = 'unusual_value';
        explanation = `Estimated value $${rfpData.estimatedValue.toLocaleString()} is outside normal range`;
        severity =
          rfpData.estimatedValue > baseline.valueP95 ? 'high' : 'medium';
      }

      // Check 2: Unusually short deadline
      const now = new Date();
      const daysUntilDeadline =
        (rfpData.deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

      if (daysUntilDeadline < baseline.avgDeadlineDays * 0.3) {
        isAnomaly = true;
        anomalyScore = Math.max(anomalyScore, 0.8);
        anomalyType = 'urgent_deadline';
        explanation = `Deadline in ${daysUntilDeadline.toFixed(0)} days is unusually short`;
        severity = 'high';
      }

      // Check 3: Requirement count anomaly
      if (
        rfpData.requirements.length > baseline.avgRequirements * 2 ||
        rfpData.requirements.length < baseline.avgRequirements * 0.3
      ) {
        isAnomaly = true;
        anomalyScore = Math.max(anomalyScore, 0.6);
        anomalyType = 'unusual_requirements';
        explanation = `${rfpData.requirements.length} requirements is unusual for ${rfpData.category}`;
        severity = severity === 'high' ? 'high' : 'medium';
      }

      console.log(
        `🚨 Anomaly Detection: ${isAnomaly ? 'ANOMALY DETECTED' : 'Normal'} (score: ${anomalyScore.toFixed(2)})`
      );

      return {
        isAnomaly,
        anomalyScore,
        anomalyType,
        explanation,
        severity,
      };
    } catch (error) {
      console.error('Error detecting anomalies:', error);
      return {
        isAnomaly: false,
        anomalyScore: 0,
        explanation: 'Error during anomaly detection',
        severity: 'low',
      };
    }
  }

  // ========================================================================
  // HELPER METHODS
  // ========================================================================

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private identifyMatchingFeatures(rfp1: any, rfp2Metadata: any): string[] {
    const features: string[] = [];

    if (rfp1.agency === rfp2Metadata.agency) features.push('Same Agency');
    if (rfp1.category === rfp2Metadata.category) features.push('Same Category');

    return features;
  }

  private async getHistoricalCostData(category: string): Promise<any[]> {
    // Mock implementation - would query database
    return [];
  }

  private ruleBasedCostEstimation(features: any): RegressionPrediction {
    const baseRate = 150; // $150/hour
    const hoursPerRequirement = 40;
    const estimatedHours =
      features.requirements.length *
      hoursPerRequirement *
      (1 + features.complexity);

    const value = estimatedHours * baseRate;

    return {
      value,
      confidence: 0.6,
      range: { min: value * 0.7, max: value * 1.3 },
      factors: [
        {
          factor: 'Requirements',
          contribution:
            features.requirements.length * hoursPerRequirement * baseRate,
        },
        { factor: 'Complexity', contribution: value * features.complexity },
      ],
    };
  }

  /**
   * Multiple Linear Regression using Normal Equation: β = (X^T X)^(-1) X^T y
   * Returns null if insufficient data or singular matrix
   */
  private multipleLinearRegression(
    X: number[][],
    y: number[]
  ): number[] | null {
    const n = X.length;

    // Validate input
    if (n === 0 || y.length === 0 || n !== y.length) {
      console.warn('multipleLinearRegression: Invalid input dimensions');
      return null;
    }

    const m = X[0].length;

    // Need at least m+1 samples for m features (plus intercept)
    if (n < m + 1) {
      console.warn(
        `multipleLinearRegression: Insufficient data (${n} samples for ${m} features)`
      );
      return null;
    }

    // Add intercept column (bias term) at the beginning
    const X_with_bias = X.map(row => [1, ...row]);

    try {
      // Compute X^T X
      const XtX = this.matrixMultiply(this.transpose(X_with_bias), X_with_bias);

      // Check for singularity by computing determinant approximation
      // For simplicity, check if any diagonal element is near zero
      for (let i = 0; i < XtX.length; i++) {
        if (Math.abs(XtX[i][i]) < 1e-10) {
          console.warn(
            'multipleLinearRegression: Near-singular matrix detected'
          );
          return null;
        }
      }

      // Compute (X^T X)^(-1)
      const XtX_inv = this.matrixInverse(XtX);
      if (!XtX_inv) {
        console.warn('multipleLinearRegression: Matrix inversion failed');
        return null;
      }

      // Compute X^T y
      const Xt = this.transpose(X_with_bias);
      const Xty = Xt.map(row =>
        row.reduce((sum, val, i) => sum + val * y[i], 0)
      );

      // Compute β = (X^T X)^(-1) X^T y
      const coefficients = XtX_inv.map(row =>
        row.reduce((sum, val, i) => sum + val * Xty[i], 0)
      );

      return coefficients;
    } catch (error) {
      console.error('multipleLinearRegression: Computation error', error);
      return null;
    }
  }

  /**
   * Matrix transpose
   */
  private transpose(matrix: number[][]): number[][] {
    if (matrix.length === 0) return [];
    return matrix[0].map((_, colIndex) => matrix.map(row => row[colIndex]));
  }

  /**
   * Matrix multiplication: A × B
   */
  private matrixMultiply(A: number[][], B: number[][]): number[][] {
    const rowsA = A.length;
    const colsA = A[0].length;
    const colsB = B[0].length;

    const result: number[][] = Array(rowsA)
      .fill(null)
      .map(() => Array(colsB).fill(0));

    for (let i = 0; i < rowsA; i++) {
      for (let j = 0; j < colsB; j++) {
        for (let k = 0; k < colsA; k++) {
          result[i][j] += A[i][k] * B[k][j];
        }
      }
    }

    return result;
  }

  /**
   * Matrix inversion using Gauss-Jordan elimination
   * Returns null if matrix is singular
   */
  private matrixInverse(matrix: number[][]): number[][] | null {
    const n = matrix.length;

    // Create augmented matrix [A | I]
    const augmented = matrix.map((row, i) => [
      ...row,
      ...Array(n)
        .fill(0)
        .map((_, j) => (i === j ? 1 : 0)),
    ]);

    // Forward elimination
    for (let i = 0; i < n; i++) {
      // Find pivot
      let maxRow = i;
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(augmented[k][i]) > Math.abs(augmented[maxRow][i])) {
          maxRow = k;
        }
      }

      // Swap rows
      [augmented[i], augmented[maxRow]] = [augmented[maxRow], augmented[i]];

      // Check for singular matrix
      if (Math.abs(augmented[i][i]) < 1e-10) {
        return null;
      }

      // Scale pivot row
      const pivot = augmented[i][i];
      for (let j = 0; j < 2 * n; j++) {
        augmented[i][j] /= pivot;
      }

      // Eliminate column
      for (let k = 0; k < n; k++) {
        if (k !== i) {
          const factor = augmented[k][i];
          for (let j = 0; j < 2 * n; j++) {
            augmented[k][j] -= factor * augmented[i][j];
          }
        }
      }
    }

    // Extract inverse from right side of augmented matrix
    return augmented.map(row => row.slice(n));
  }

  private predictValue(features: number[], coefficients: number[]): number {
    return [1, ...features].reduce(
      (sum, val, i) => sum + val * coefficients[i],
      0
    );
  }

  private kMeansClustering(
    embeddings: number[][],
    k: number,
    options?: { maxIterations?: number; seed?: number }
  ): Array<{
    centroid: number[];
    memberIndices: number[];
  }> {
    const maxIterations = options?.maxIterations || 100;
    const n = embeddings.length;

    // Input validation
    if (k <= 0) {
      throw new Error('k must be greater than 0');
    }
    if (n === 0) {
      throw new Error('embeddings cannot be empty');
    }

    // Adjust k if it exceeds number of points
    const effectiveK = Math.min(k, n);

    // Helper: Euclidean distance
    const euclideanDistance = (a: number[], b: number[]): number => {
      return Math.sqrt(
        a.reduce((sum, val, i) => sum + Math.pow(val - b[i], 2), 0)
      );
    };

    // Helper: Calculate mean of vectors
    const calculateMean = (vectors: number[][]): number[] => {
      if (vectors.length === 0) return [];
      const dim = vectors[0].length;
      const mean = new Array(dim).fill(0);
      vectors.forEach(vec => {
        vec.forEach((val, i) => {
          mean[i] += val / vectors.length;
        });
      });
      return mean;
    };

    // K-means++ initialization for better centroid selection
    const initializeCentroids = (): number[][] => {
      const centroids: number[][] = [];
      const rng =
        options?.seed !== undefined
          ? this.seededRandom(options.seed)
          : Math.random;

      // First centroid: random point
      const firstIdx = Math.floor(rng() * n);
      centroids.push([...embeddings[firstIdx]]);

      // Select remaining centroids using k-means++
      for (let i = 1; i < effectiveK; i++) {
        const distances = embeddings.map(point => {
          const minDist = Math.min(
            ...centroids.map(c => Math.pow(euclideanDistance(point, c), 2))
          );
          return minDist;
        });

        const totalDist = distances.reduce((sum, d) => sum + d, 0);
        let threshold = rng() * totalDist;

        let selectedIdx = 0;
        for (let j = 0; j < distances.length; j++) {
          threshold -= distances[j];
          if (threshold <= 0) {
            selectedIdx = j;
            break;
          }
        }

        centroids.push([...embeddings[selectedIdx]]);
      }

      return centroids;
    };

    // Initialize centroids
    const centroids = initializeCentroids();
    const assignments = new Array(n).fill(-1);
    let previousAssignments: number[] = [];
    let iteration = 0;

    // Main K-means loop
    while (iteration < maxIterations) {
      previousAssignments = [...assignments];

      // Assignment step: assign each point to nearest centroid
      for (let i = 0; i < n; i++) {
        let minDist = Infinity;
        let assignedCluster = 0;

        for (let j = 0; j < effectiveK; j++) {
          const dist = euclideanDistance(embeddings[i], centroids[j]);
          if (dist < minDist) {
            minDist = dist;
            assignedCluster = j;
          }
        }

        assignments[i] = assignedCluster;
      }

      // Check convergence
      if (
        iteration > 0 &&
        assignments.every((val, i) => val === previousAssignments[i])
      ) {
        break;
      }

      // Update step: recompute centroids
      for (let j = 0; j < effectiveK; j++) {
        const clusterPoints = embeddings.filter((_, i) => assignments[i] === j);

        if (clusterPoints.length > 0) {
          centroids[j] = calculateMean(clusterPoints);
        } else {
          // Handle empty cluster by reinitializing centroid
          // Select the point furthest from any existing centroid
          let maxMinDist = -1;
          let furthestIdx = 0;

          for (let i = 0; i < n; i++) {
            const minDist = Math.min(
              ...centroids.map(c => euclideanDistance(embeddings[i], c))
            );
            if (minDist > maxMinDist) {
              maxMinDist = minDist;
              furthestIdx = i;
            }
          }

          centroids[j] = [...embeddings[furthestIdx]];
        }
      }

      iteration++;
    }

    // Build result in required format
    const clusters: Array<{
      centroid: number[];
      memberIndices: number[];
    }> = [];

    for (let j = 0; j < effectiveK; j++) {
      const memberIndices = assignments
        .map((cluster, idx) => (cluster === j ? idx : -1))
        .filter(idx => idx !== -1);

      clusters.push({
        centroid: centroids[j],
        memberIndices,
      });
    }

    return clusters;
  }

  private seededRandom(seed: number): () => number {
    let state = seed;
    return () => {
      state = (state * 1664525 + 1013904223) % 4294967296;
      return state / 4294967296;
    };
  }

  private identifyClusterCharacteristics(texts: string[]): string[] {
    // Extract common keywords from cluster
    const wordCounts = new Map<string, number>();

    for (const text of texts) {
      const words = text.toLowerCase().split(/\W+/);
      for (const word of words) {
        if (word.length > 3) {
          wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
        }
      }
    }

    return Array.from(wordCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word);
  }

  private calculateSilhouetteScore(
    embeddings: number[][],
    clusters: any[]
  ): number {
    // Validate inputs
    if (
      !embeddings ||
      embeddings.length === 0 ||
      !clusters ||
      clusters.length < 2
    ) {
      return 0;
    }

    // Build cluster assignments map
    const clusterMap = new Map<number, number>(); // index -> clusterId
    for (let i = 0; i < clusters.length; i++) {
      const cluster = clusters[i];
      if (cluster.memberIndices && Array.isArray(cluster.memberIndices)) {
        cluster.memberIndices.forEach((idx: number) => {
          if (idx >= 0 && idx < embeddings.length) {
            clusterMap.set(idx, i);
          }
        });
      }
    }

    // Ensure all points are assigned
    if (clusterMap.size !== embeddings.length) {
      return 0;
    }

    // Helper: Euclidean distance
    const euclideanDistance = (a: number[], b: number[]): number => {
      if (a.length !== b.length) return Infinity;
      let sum = 0;
      for (let i = 0; i < a.length; i++) {
        const diff = a[i] - b[i];
        sum += diff * diff;
      }
      return Math.sqrt(sum);
    };

    // Precompute pairwise distances for performance
    const distances: number[][] = [];
    for (let i = 0; i < embeddings.length; i++) {
      distances[i] = [];
      for (let j = 0; j < embeddings.length; j++) {
        if (i === j) {
          distances[i][j] = 0;
        } else if (j < i) {
          distances[i][j] = distances[j][i]; // Symmetric
        } else {
          distances[i][j] = euclideanDistance(embeddings[i], embeddings[j]);
        }
      }
    }

    // Calculate silhouette for each point
    const silhouetteScores: number[] = [];

    for (let i = 0; i < embeddings.length; i++) {
      const ownClusterId = clusterMap.get(i)!;
      const ownClusterMembers = clusters[ownClusterId].memberIndices.filter(
        (idx: number) => idx !== i
      );

      // a(i): mean distance to other points in same cluster
      let a = 0;
      if (ownClusterMembers.length === 0) {
        // Single member cluster - silhouette is 0
        silhouetteScores.push(0);
        continue;
      }

      for (const idx of ownClusterMembers) {
        a += distances[i][idx];
      }
      a /= ownClusterMembers.length;

      // b(i): minimum mean distance to points in any other cluster
      let b = Infinity;
      for (let c = 0; c < clusters.length; c++) {
        if (c === ownClusterId) continue;

        const otherClusterMembers = clusters[c].memberIndices;
        if (!otherClusterMembers || otherClusterMembers.length === 0) continue;

        let meanDist = 0;
        for (const idx of otherClusterMembers) {
          meanDist += distances[i][idx];
        }
        meanDist /= otherClusterMembers.length;

        b = Math.min(b, meanDist);
      }

      // Silhouette coefficient: (b - a) / max(a, b)
      const maxAB = Math.max(a, b);
      const silhouette = maxAB === 0 ? 0 : (b - a) / maxAB;
      silhouetteScores.push(silhouette);
    }

    // Return mean silhouette score
    if (silhouetteScores.length === 0) return 0;
    return (
      silhouetteScores.reduce((sum, s) => sum + s, 0) / silhouetteScores.length
    );
  }

  private async getCategoryBaseline(category: string): Promise<{
    valueP5: number;
    valueP95: number;
    avgDeadlineDays: number;
    avgRequirements: number;
  }> {
    try {
      // Fetch all RFPs from the database
      const { rfps: allRfps } = await storage.getAllRFPs({});

      // Filter RFPs by category
      const categoryRfps = allRfps.filter(
        rfp => rfp.category?.toLowerCase() === category.toLowerCase()
      );

      // Check if we have enough samples for statistical analysis
      const MIN_SAMPLES = 10;
      if (categoryRfps.length < MIN_SAMPLES) {
        console.warn(
          `Insufficient samples for category "${category}": ${categoryRfps.length} RFPs found. Using conservative fallback defaults.`
        );
        return {
          valueP5: 5000, // Conservative minimum
          valueP95: 5000000, // Conservative maximum
          avgDeadlineDays: 60, // Conservative deadline
          avgRequirements: 10, // Conservative requirement count
        };
      }

      // Extract values for statistical computation
      const values: number[] = [];
      const deadlineDays: number[] = [];
      const requirementCounts: number[] = [];

      for (const rfp of categoryRfps) {
        // Extract estimated value
        if (rfp.estimatedValue && !isNaN(Number(rfp.estimatedValue))) {
          values.push(Number(rfp.estimatedValue));
        }

        // Calculate deadline days
        if (rfp.deadline) {
          const deadlineDate = new Date(rfp.deadline);
          const discoveredDate = rfp.discoveredAt
            ? new Date(rfp.discoveredAt)
            : new Date();
          const daysDiff = Math.max(
            0,
            Math.ceil(
              (deadlineDate.getTime() - discoveredDate.getTime()) /
                (1000 * 60 * 60 * 24)
            )
          );
          deadlineDays.push(daysDiff);
        }

        // Extract requirement count
        if (rfp.requirements && Array.isArray(rfp.requirements)) {
          requirementCounts.push(rfp.requirements.length);
        }
      }

      // Compute percentiles for value (5th and 95th)
      const valueP5 = this.calculatePercentile(values, 5);
      const valueP95 = this.calculatePercentile(values, 95);

      // Compute averages
      const avgDeadlineDays =
        deadlineDays.length > 0
          ? deadlineDays.reduce((a, b) => a + b, 0) / deadlineDays.length
          : 45; // fallback

      const avgRequirements =
        requirementCounts.length > 0
          ? requirementCounts.reduce((a, b) => a + b, 0) /
            requirementCounts.length
          : 15; // fallback

      console.log(
        `Category baseline for "${category}": ${categoryRfps.length} RFPs analyzed`,
        {
          valueP5,
          valueP95,
          avgDeadlineDays,
          avgRequirements,
        }
      );

      return {
        valueP5,
        valueP95,
        avgDeadlineDays: Math.round(avgDeadlineDays),
        avgRequirements: Math.round(avgRequirements),
      };
    } catch (error) {
      console.error(
        `Error computing category baseline for "${category}":`,
        error
      );
      // Return conservative fallback defaults on error
      return {
        valueP5: 5000,
        valueP95: 5000000,
        avgDeadlineDays: 60,
        avgRequirements: 10,
      };
    }
  }

  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) {
      return percentile < 50 ? 5000 : 5000000; // fallback
    }

    const sorted = [...values].sort((a, b) => a - b);
    const index = (percentile / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;

    if (lower === upper) {
      return sorted[lower];
    }

    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  }
}

export const mlModelIntegration = MLModelIntegration.getInstance();
