import { BaseContentExtractor } from '../ContentExtractor';
import { RFPOpportunity } from '../../types';
import { AIService } from '../../../aiService';

/**
 * AI-powered content extractor using the AIService
 */
export class AIContentExtractor extends BaseContentExtractor {
  private aiService: AIService;

  constructor(portalType: string = 'ai') {
    super(portalType);
    this.aiService = new AIService();
  }

  /**
   * Extract opportunities using AI analysis
   */
  async extract(content: string, url: string, portalContext: string): Promise<RFPOpportunity[]> {
    try {
      console.log(`🤖 Starting AI content extraction for ${url}`);

      if (!this.validateContent(content)) {
        console.warn(`⚠️ Invalid content provided for AI extraction`);
        return [];
      }

      // Use AIService to extract RFP details
      const extractedData = await this.aiService.extractRFPDetails(content, url);

      if (!extractedData) {
        console.log(`🚫 AI service returned no data for ${url}`);
        return [];
      }

      // Convert AI service response to RFPOpportunity format
      const opportunities = this.convertAIDataToOpportunities(extractedData, url);

      // Calculate confidence scores
      opportunities.forEach(opp => {
        opp.confidence = this.getConfidenceScore(opp);
      });

      // Filter by minimum confidence threshold
      const minConfidence = this.getMinimumConfidenceThreshold(portalContext);
      const filteredOpportunities = opportunities.filter(opp =>
        (opp.confidence || 0) >= minConfidence
      );

      console.log(`🤖 AI extraction completed: ${opportunities.length} found, ${filteredOpportunities.length} above confidence threshold`);

      return this.removeDuplicates(filteredOpportunities);

    } catch (error) {
      console.error(`❌ AI content extraction failed for ${url}:`, error);
      return [];
    }
  }

  /**
   * Convert AI service response to RFPOpportunity array
   */
  private convertAIDataToOpportunities(aiData: any, sourceUrl: string): RFPOpportunity[] {
    // Handle single opportunity
    if (aiData.title && typeof aiData.title === 'string') {
      return [{
        title: aiData.title,
        description: aiData.description || '',
        agency: aiData.agency,
        deadline: this.parseDate(aiData.deadline),
        estimatedValue: aiData.estimatedValue,
        url: sourceUrl,
        link: sourceUrl,
        category: aiData.category,
        confidence: aiData.confidence || 0.5
      }];
    }

    // Handle array of opportunities
    if (Array.isArray(aiData)) {
      return aiData.map(item => ({
        title: item.title || '',
        description: item.description || '',
        agency: item.agency,
        deadline: this.parseDate(item.deadline),
        estimatedValue: item.estimatedValue,
        url: item.url || sourceUrl,
        link: item.link || item.url || sourceUrl,
        category: item.category,
        confidence: item.confidence || 0.5
      }));
    }

    // Handle object with opportunities array
    if (aiData.opportunities && Array.isArray(aiData.opportunities)) {
      return aiData.opportunities.map((item: any) => ({
        title: item.title || '',
        description: item.description || '',
        agency: item.agency,
        deadline: this.parseDate(item.deadline),
        estimatedValue: item.estimatedValue,
        url: item.url || sourceUrl,
        link: item.link || item.url || sourceUrl,
        category: item.category,
        confidence: item.confidence || 0.5
      }));
    }

    // Handle object with results array
    if (aiData.results && Array.isArray(aiData.results)) {
      return aiData.results.map((item: any) => ({
        title: item.title || '',
        description: item.description || '',
        agency: item.agency,
        deadline: this.parseDate(item.deadline),
        estimatedValue: item.estimatedValue,
        url: item.url || sourceUrl,
        link: item.link || item.url || sourceUrl,
        category: item.category,
        confidence: item.confidence || 0.5
      }));
    }

    console.warn(`⚠️ Unexpected AI data format:`, typeof aiData);
    return [];
  }

  /**
   * Get minimum confidence threshold based on portal context
   */
  private getMinimumConfidenceThreshold(portalContext: string): number {
    const context = portalContext.toLowerCase();

    // Lower threshold for specific portal types that have been pre-validated
    if (context.includes('austin')) return 0.4;
    if (context.includes('findrfp')) return 0.3; // Already validated by Stagehand
    if (context.includes('bonfire')) return 0.6;
    if (context.includes('sam.gov')) return 0.7;

    // Default threshold
    return 0.7;
  }

  /**
   * Enhanced content validation for AI processing
   */
  validateContent(content: string): boolean {
    if (!content || content.trim().length === 0) {
      return false;
    }

    // Check for minimum content length
    if (content.length < 100) {
      return false;
    }

    // Check for HTML content vs plain text
    const hasHtml = /<[^>]+>/.test(content);
    const hasRfpKeywords = this.hasRFPKeywords(content);

    // If it's HTML, ensure it has substantial content
    if (hasHtml) {
      const textContent = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      return textContent.length >= 50;
    }

    // For plain text, check for RFP keywords or substantial content
    return hasRfpKeywords || content.length >= 200;
  }

  /**
   * Enhanced confidence scoring for AI-extracted opportunities
   */
  getConfidenceScore(opportunity: RFPOpportunity): number {
    let score = super.getConfidenceScore(opportunity);

    // Additional AI-specific scoring
    if (opportunity.confidence && typeof opportunity.confidence === 'number') {
      // Weight the AI's own confidence with our structural analysis
      score = (score * 0.6) + (opportunity.confidence * 0.4);
    }

    // Boost score for well-structured opportunities
    if (opportunity.title && opportunity.description && opportunity.agency) {
      score += 0.1;
    }

    // Boost score for opportunities with specific URLs
    if (opportunity.url && opportunity.url !== opportunity.link) {
      score += 0.05;
    }

    return Math.min(1.0, score);
  }

  /**
   * Process content in chunks for large documents
   */
  async extractFromLargeContent(content: string, url: string, portalContext: string): Promise<RFPOpportunity[]> {
    const maxChunkSize = 8000; // Characters

    if (content.length <= maxChunkSize) {
      return this.extract(content, url, portalContext);
    }

    console.log(`📄 Processing large content (${content.length} chars) in chunks`);

    const chunks = this.splitContentIntoChunks(content, maxChunkSize);
    const allOpportunities: RFPOpportunity[] = [];

    for (let i = 0; i < chunks.length; i++) {
      console.log(`🧩 Processing chunk ${i + 1}/${chunks.length}`);

      try {
        const chunkOpportunities = await this.extract(chunks[i], url, `${portalContext} (chunk ${i + 1})`);
        allOpportunities.push(...chunkOpportunities);
      } catch (error) {
        console.warn(`⚠️ Failed to process chunk ${i + 1}:`, error);
        continue;
      }

      // Add delay between chunks to avoid rate limiting
      if (i < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return this.removeDuplicates(allOpportunities);
  }

  /**
   * Split content into manageable chunks
   */
  private splitContentIntoChunks(content: string, maxChunkSize: number): string[] {
    const chunks: string[] = [];
    let currentChunk = '';

    // Split by sentences or paragraphs to maintain context
    const sentences = content.split(/[.!?]\s+/);

    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length > maxChunkSize) {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
          currentChunk = '';
        }
      }
      currentChunk += sentence + '. ';
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }
}