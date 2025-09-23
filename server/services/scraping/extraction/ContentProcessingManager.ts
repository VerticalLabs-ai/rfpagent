import { ContentExtractor } from './ContentExtractor';
import { AIContentExtractor } from './extractors/AIContentExtractor';
import { BonfireContentExtractor } from './extractors/BonfireContentExtractor';
import { SAMGovContentExtractor } from './extractors/SAMGovContentExtractor';
import { AustinFinanceContentExtractor } from './extractors/AustinFinanceContentExtractor';
import { HTMLContentExtractor } from './extractors/HTMLContentExtractor';
import { JSONContentExtractor } from './extractors/JSONContentExtractor';
import { RFPOpportunity, ContentProcessingResult, ContentAnalysis } from '../types';

/**
 * Content processing manager that orchestrates multiple content extractors
 * Implements intelligent extractor selection and fallback strategies
 */
export class ContentProcessingManager {
  private extractors: Map<string, ContentExtractor>;
  private fallbackExtractors: ContentExtractor[];

  constructor() {
    this.extractors = new Map();
    this.fallbackExtractors = [];
    this.initializeExtractors();
  }

  /**
   * Initialize all content extractors
   */
  private initializeExtractors(): void {
    // Portal-specific extractors
    this.extractors.set('bonfire', new BonfireContentExtractor());
    this.extractors.set('sam.gov', new SAMGovContentExtractor());
    this.extractors.set('austin_finance', new AustinFinanceContentExtractor());

    // Content-type specific extractors
    this.extractors.set('json', new JSONContentExtractor());
    this.extractors.set('html', new HTMLContentExtractor());
    this.extractors.set('ai', new AIContentExtractor());

    // Fallback extractors (in order of preference)
    this.fallbackExtractors = [
      new AIContentExtractor(),
      new HTMLContentExtractor(),
      new JSONContentExtractor()
    ];

    console.log(`📊 Content Processing Manager initialized with ${this.extractors.size} specialized extractors and ${this.fallbackExtractors.length} fallback extractors`);
  }

  /**
   * Process content using the most appropriate extractor(s)
   */
  async processContent(
    content: string,
    url: string,
    portalType: string,
    options: ContentProcessingOptions = {}
  ): Promise<ContentProcessingResult> {
    try {
      console.log(`🔄 Processing content for ${portalType} from ${url}`);

      // Analyze content to determine best extraction strategy
      const analysis = this.analyzeContent(content, portalType);

      // Get extraction strategy based on analysis
      const strategy = this.determineExtractionStrategy(analysis, portalType, options);

      // Execute extraction strategy
      const result = await this.executeExtractionStrategy(strategy, content, url, portalType);

      console.log(`✅ Content processing completed: ${result.opportunities.length} opportunities found using ${result.extractorsUsed.join(', ')}`);

      return result;

    } catch (error) {
      console.error(`❌ Content processing failed for ${url}:`, error);

      return {
        success: false,
        opportunities: [],
        extractorsUsed: [],
        analysis: this.analyzeContent(content, portalType),
        error: error instanceof Error ? error.message : 'Unknown processing error',
        processingTime: 0
      };
    }
  }

  /**
   * Analyze content to determine its characteristics
   */
  private analyzeContent(content: string, portalType: string): ContentAnalysis {
    const analysis: ContentAnalysis = {
      contentType: 'unknown',
      size: content.length,
      hasHTML: /<[^>]+>/.test(content),
      hasJSON: this.detectJSONContent(content),
      hasRFPKeywords: this.hasRFPKeywords(content),
      portalSpecificIndicators: this.detectPortalIndicators(content, portalType),
      confidence: 0,
      recommendedExtractors: []
    };

    // Determine content type
    if (analysis.hasJSON && !analysis.hasHTML) {
      analysis.contentType = 'json';
    } else if (analysis.hasHTML) {
      analysis.contentType = 'html';
    } else {
      analysis.contentType = 'text';
    }

    // Calculate confidence based on indicators
    analysis.confidence = this.calculateContentConfidence(analysis);

    // Recommend extractors based on analysis
    analysis.recommendedExtractors = this.recommendExtractors(analysis, portalType);

    return analysis;
  }

  /**
   * Determine the best extraction strategy
   */
  private determineExtractionStrategy(
    analysis: ContentAnalysis,
    portalType: string,
    options: ContentProcessingOptions
  ): ExtractionStrategy {
    const strategy: ExtractionStrategy = {
      primary: [],
      fallback: [],
      parallel: options.useParallelExtraction || false,
      maxExtractors: options.maxExtractors || 3
    };

    // Add portal-specific extractor if available and recommended
    const portalExtractor = this.extractors.get(portalType);
    if (portalExtractor && analysis.portalSpecificIndicators.score > 0.3) {
      strategy.primary.push(portalExtractor);
    }

    // Add content-type specific extractors
    if (analysis.contentType === 'json') {
      const jsonExtractor = this.extractors.get('json');
      if (jsonExtractor) strategy.primary.push(jsonExtractor);
    }

    // Add AI extractor for high-confidence RFP content
    if (analysis.hasRFPKeywords && analysis.confidence > 0.6) {
      const aiExtractor = this.extractors.get('ai');
      if (aiExtractor) strategy.primary.push(aiExtractor);
    }

    // Add HTML extractor for HTML content
    if (analysis.hasHTML) {
      const htmlExtractor = this.extractors.get('html');
      if (htmlExtractor) strategy.primary.push(htmlExtractor);
    }

    // If no primary extractors, use recommended ones
    if (strategy.primary.length === 0) {
      strategy.primary = analysis.recommendedExtractors
        .map(name => this.extractors.get(name))
        .filter(Boolean) as ContentExtractor[];
    }

    // Set fallback extractors
    strategy.fallback = this.fallbackExtractors.filter(
      extractor => !strategy.primary.includes(extractor)
    );

    // Limit number of extractors
    strategy.primary = strategy.primary.slice(0, strategy.maxExtractors);

    return strategy;
  }

  /**
   * Execute the extraction strategy
   */
  private async executeExtractionStrategy(
    strategy: ExtractionStrategy,
    content: string,
    url: string,
    portalType: string
  ): Promise<ContentProcessingResult> {
    const startTime = Date.now();
    const allOpportunities: RFPOpportunity[] = [];
    const extractorsUsed: string[] = [];
    const errors: string[] = [];

    // Execute primary extractors
    if (strategy.parallel && strategy.primary.length > 1) {
      // Parallel execution
      const results = await Promise.allSettled(
        strategy.primary.map(extractor =>
          this.executeExtractor(extractor, content, url, portalType)
        )
      );

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          allOpportunities.push(...result.value.opportunities);
          extractorsUsed.push(result.value.extractorType);
        } else {
          errors.push(`${strategy.primary[index].getPortalType()}: ${result.reason}`);
        }
      });
    } else {
      // Sequential execution
      for (const extractor of strategy.primary) {
        try {
          const result = await this.executeExtractor(extractor, content, url, portalType);
          allOpportunities.push(...result.opportunities);
          extractorsUsed.push(result.extractorType);

          // If we got good results, we might not need to continue
          if (result.opportunities.length > 0 && result.avgConfidence > 0.7) {
            break;
          }
        } catch (error) {
          errors.push(`${extractor.getPortalType()}: ${error}`);
        }
      }
    }

    // Try fallback extractors if primary extractors didn't yield good results
    if (allOpportunities.length === 0 || this.calculateAverageConfidence(allOpportunities) < 0.5) {
      console.log(`🔄 Primary extractors yielded poor results, trying fallback extractors...`);

      for (const fallbackExtractor of strategy.fallback) {
        if (extractorsUsed.includes(fallbackExtractor.getPortalType())) {
          continue; // Skip if already used
        }

        try {
          const result = await this.executeExtractor(fallbackExtractor, content, url, portalType);
          if (result.opportunities.length > 0) {
            allOpportunities.push(...result.opportunities);
            extractorsUsed.push(result.extractorType);
            break; // Stop after first successful fallback
          }
        } catch (error) {
          errors.push(`${fallbackExtractor.getPortalType()} (fallback): ${error}`);
        }
      }
    }

    // Remove duplicates and calculate final results
    const uniqueOpportunities = this.removeDuplicates(allOpportunities);
    const processingTime = Date.now() - startTime;

    return {
      success: uniqueOpportunities.length > 0,
      opportunities: uniqueOpportunities,
      extractorsUsed,
      analysis: this.analyzeContent(content, portalType),
      processingTime,
      avgConfidence: this.calculateAverageConfidence(uniqueOpportunities),
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * Execute a single extractor
   */
  private async executeExtractor(
    extractor: ContentExtractor,
    content: string,
    url: string,
    portalType: string
  ): Promise<{ opportunities: RFPOpportunity[]; extractorType: string; avgConfidence: number }> {
    const extractorType = extractor.getPortalType();
    console.log(`🔧 Executing ${extractorType} extractor...`);

    const opportunities = await extractor.extract(content, url, portalType);
    const avgConfidence = this.calculateAverageConfidence(opportunities);

    console.log(`📊 ${extractorType} extractor: ${opportunities.length} opportunities, avg confidence: ${(avgConfidence * 100).toFixed(1)}%`);

    return { opportunities, extractorType, avgConfidence };
  }

  /**
   * Detect JSON content in various forms
   */
  private detectJSONContent(content: string): boolean {
    const trimmed = content.trim();

    // Direct JSON
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
        (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        JSON.parse(trimmed);
        return true;
      } catch {
        // Not valid JSON
      }
    }

    // Embedded JSON indicators
    const jsonIndicators = [
      'application/json',
      'application/ld+json',
      'data-json=',
      /window\.\w+\s*=\s*\{/,
      /var\s+\w+\s*=\s*\{/
    ];

    return jsonIndicators.some(indicator =>
      typeof indicator === 'string' ? content.includes(indicator) : indicator.test(content)
    );
  }

  /**
   * Check for RFP-related keywords
   */
  private hasRFPKeywords(content: string): boolean {
    const keywords = [
      'rfp', 'request for proposal', 'procurement', 'solicitation',
      'bid', 'tender', 'contract', 'opportunity', 'ifb', 'invitation for bid',
      'rfq', 'request for quote', 'proposal', 'quotes'
    ];

    const lowerContent = content.toLowerCase();
    return keywords.some(keyword => lowerContent.includes(keyword));
  }

  /**
   * Detect portal-specific indicators
   */
  private detectPortalIndicators(content: string, portalType: string): { indicators: string[]; score: number } {
    const portalPatterns: Record<string, string[]> = {
      bonfire: ['bonfirehub', 'bonfire-', 'solicitation_details.cfm'],
      'sam.gov': ['sam.gov', 'opportunity-row', 'search-result', 'contract opportunities'],
      austin_finance: ['austintexas.gov', 'City of Austin', 'IFQ', 'IFB'],
      findrfp: ['findrfp', 'rfpdb.com'],
      generic: []
    };

    const patterns = portalPatterns[portalType] || [];
    const indicators = patterns.filter(pattern => content.toLowerCase().includes(pattern.toLowerCase()));
    const score = patterns.length > 0 ? indicators.length / patterns.length : 0;

    return { indicators, score };
  }

  /**
   * Calculate content confidence based on analysis
   */
  private calculateContentConfidence(analysis: ContentAnalysis): number {
    let confidence = 0.1; // Base confidence

    // Boost for RFP keywords
    if (analysis.hasRFPKeywords) confidence += 0.3;

    // Boost for portal-specific indicators
    confidence += analysis.portalSpecificIndicators.score * 0.3;

    // Boost for structured content
    if (analysis.hasJSON) confidence += 0.2;
    if (analysis.hasHTML) confidence += 0.1;

    // Boost for reasonable content size
    if (analysis.size > 500 && analysis.size < 50000) confidence += 0.1;

    return Math.min(1.0, confidence);
  }

  /**
   * Recommend extractors based on content analysis
   */
  private recommendExtractors(analysis: ContentAnalysis, portalType: string): string[] {
    const recommendations: string[] = [];

    // Portal-specific extractor
    if (analysis.portalSpecificIndicators.score > 0.3 && this.extractors.has(portalType)) {
      recommendations.push(portalType);
    }

    // Content-type specific extractors
    if (analysis.hasJSON) {
      recommendations.push('json');
    }

    if (analysis.hasRFPKeywords && analysis.confidence > 0.5) {
      recommendations.push('ai');
    }

    if (analysis.hasHTML) {
      recommendations.push('html');
    }

    // Always include AI as a potential option for RFP content
    if (analysis.hasRFPKeywords && !recommendations.includes('ai')) {
      recommendations.push('ai');
    }

    return recommendations;
  }

  /**
   * Remove duplicate opportunities
   */
  private removeDuplicates(opportunities: RFPOpportunity[]): RFPOpportunity[] {
    const seen = new Set<string>();
    const unique: RFPOpportunity[] = [];

    for (const opp of opportunities) {
      // Create a key based on title and URL
      const key = `${opp.title?.toLowerCase() || ''}|${opp.url || opp.link || ''}`;

      if (!seen.has(key) && key !== '|') {
        seen.add(key);
        unique.push(opp);
      }
    }

    return unique;
  }

  /**
   * Calculate average confidence of opportunities
   */
  private calculateAverageConfidence(opportunities: RFPOpportunity[]): number {
    if (opportunities.length === 0) return 0;

    const total = opportunities.reduce((sum, opp) => sum + (opp.confidence || 0.5), 0);
    return total / opportunities.length;
  }

  /**
   * Get available extractors information
   */
  getAvailableExtractors(): { name: string; type: string }[] {
    return Array.from(this.extractors.entries()).map(([name, extractor]) => ({
      name,
      type: extractor.getPortalType()
    }));
  }

  /**
   * Register a new content extractor
   */
  registerExtractor(name: string, extractor: ContentExtractor): void {
    this.extractors.set(name, extractor);
    console.log(`📝 Registered new content extractor: ${name}`);
  }

  /**
   * Unregister a content extractor
   */
  unregisterExtractor(name: string): boolean {
    const success = this.extractors.delete(name);
    if (success) {
      console.log(`🗑️ Unregistered content extractor: ${name}`);
    }
    return success;
  }
}

/**
 * Content processing options
 */
export interface ContentProcessingOptions {
  useParallelExtraction?: boolean;
  maxExtractors?: number;
  preferredExtractors?: string[];
  fallbackStrategy?: 'aggressive' | 'conservative';
  minConfidenceThreshold?: number;
}

/**
 * Extraction strategy configuration
 */
interface ExtractionStrategy {
  primary: ContentExtractor[];
  fallback: ContentExtractor[];
  parallel: boolean;
  maxExtractors: number;
}

/**
 * Default content processing manager instance
 */
export const contentProcessingManager = new ContentProcessingManager();