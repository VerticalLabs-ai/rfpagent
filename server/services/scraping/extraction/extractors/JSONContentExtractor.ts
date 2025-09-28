import { BaseContentExtractor } from '../ContentExtractor';
import { RFPOpportunity } from '../../types';

/**
 * Specialized content extractor for JSON and structured data formats
 * Handles API responses, embedded JSON-LD, and structured data
 */
export class JSONContentExtractor extends BaseContentExtractor {
  constructor() {
    super('json');
  }

  /**
   * Extract opportunities from JSON content
   */
  async extract(
    content: string,
    url: string,
    portalContext: string
  ): Promise<RFPOpportunity[]> {
    try {
      console.log(`📊 Starting JSON content extraction for ${url}`);

      if (!this.validateContent(content)) {
        console.warn(`⚠️ Invalid content provided for JSON extraction`);
        return [];
      }

      const opportunities: RFPOpportunity[] = [];

      // Try different JSON extraction strategies
      const directJsonOpportunities = await this.extractDirectJSON(
        content,
        url
      );
      const embeddedJsonOpportunities = await this.extractEmbeddedJSON(
        content,
        url
      );
      const jsonLdOpportunities = await this.extractJSONLD(content, url);
      const apiResponseOpportunities = await this.extractAPIResponse(
        content,
        url
      );

      opportunities.push(
        ...directJsonOpportunities,
        ...embeddedJsonOpportunities,
        ...jsonLdOpportunities,
        ...apiResponseOpportunities
      );

      // Calculate confidence scores and filter
      opportunities.forEach(opp => {
        opp.confidence = this.getConfidenceScore(opp);
      });

      const minConfidence = this.getMinimumConfidenceThreshold(portalContext);
      const filteredOpportunities = opportunities.filter(
        opp => (opp.confidence || 0) >= minConfidence
      );

      console.log(
        `📊 JSON extraction completed: ${opportunities.length} found, ${filteredOpportunities.length} above confidence threshold`
      );

      return this.removeDuplicates(filteredOpportunities);
    } catch (error) {
      console.error(`❌ JSON content extraction failed for ${url}:`, error);
      return [];
    }
  }

  /**
   * Enhanced content validation for JSON
   */
  validateContent(content: string): boolean {
    if (!super.validateContent(content)) {
      return false;
    }

    // Check for JSON indicators
    const hasJsonStructure =
      content.trim().startsWith('{') ||
      content.trim().startsWith('[') ||
      content.includes('application/json') ||
      content.includes('application/ld+json') ||
      this.hasEmbeddedJSON(content);

    return hasJsonStructure;
  }

  /**
   * Extract from direct JSON content
   */
  private async extractDirectJSON(
    content: string,
    url: string
  ): Promise<RFPOpportunity[]> {
    const opportunities: RFPOpportunity[] = [];

    try {
      const trimmedContent = content.trim();

      // Check if content starts with JSON
      if (!trimmedContent.startsWith('{') && !trimmedContent.startsWith('[')) {
        return opportunities;
      }

      const jsonData = JSON.parse(trimmedContent);
      const extracted = this.parseJSONData(jsonData, url, 'direct');

      opportunities.push(...extracted);
      console.log(`📊 Direct JSON: Found ${extracted.length} opportunities`);
    } catch (error) {
      console.log(`⚠️ Failed to parse direct JSON:`, error);
    }

    return opportunities;
  }

  /**
   * Extract from embedded JSON in HTML
   */
  private async extractEmbeddedJSON(
    content: string,
    url: string
  ): Promise<RFPOpportunity[]> {
    const opportunities: RFPOpportunity[] = [];

    try {
      // Find JSON embedded in script tags or data attributes
      const jsonPatterns = [
        /<script[^>]*type=["']application\/json["'][^>]*>(.*?)<\/script>/gis,
        /<script[^>]*>(.*?var\s+\w+\s*=\s*(\{.*?\});.*?)<\/script>/gis,
        /data-json=["']({.*?})["']/gi,
        /data-opportunities=["']({.*?})["']/gi,
        /window\.\w+\s*=\s*(\{.*?\});/gi,
      ];

      for (const pattern of jsonPatterns) {
        let match;
        while ((match = pattern.exec(content)) !== null) {
          try {
            const jsonStr = match[1] || match[2];
            if (jsonStr && jsonStr.trim().startsWith('{')) {
              const jsonData = JSON.parse(jsonStr);
              const extracted = this.parseJSONData(jsonData, url, 'embedded');
              opportunities.push(...extracted);
            }
          } catch (error) {
            console.log(`⚠️ Failed to parse embedded JSON:`, error);
          }
        }
      }

      console.log(
        `📊 Embedded JSON: Found ${opportunities.length} opportunities`
      );
    } catch (error) {
      console.log(`⚠️ Failed to extract embedded JSON:`, error);
    }

    return opportunities;
  }

  /**
   * Extract from JSON-LD structured data
   */
  private async extractJSONLD(
    content: string,
    url: string
  ): Promise<RFPOpportunity[]> {
    const opportunities: RFPOpportunity[] = [];

    try {
      // Find JSON-LD script tags
      const jsonLdPattern =
        /<script[^>]*type=["']application\/ld\+json["'][^>]*>(.*?)<\/script>/gis;
      let match;

      while ((match = jsonLdPattern.exec(content)) !== null) {
        try {
          const jsonLdData = JSON.parse(match[1]);
          const extracted = this.parseJSONLDData(jsonLdData, url);
          opportunities.push(...extracted);
        } catch (error) {
          console.log(`⚠️ Failed to parse JSON-LD:`, error);
        }
      }

      console.log(`📊 JSON-LD: Found ${opportunities.length} opportunities`);
    } catch (error) {
      console.log(`⚠️ Failed to extract JSON-LD:`, error);
    }

    return opportunities;
  }

  /**
   * Extract from API response patterns
   */
  private async extractAPIResponse(
    content: string,
    url: string
  ): Promise<RFPOpportunity[]> {
    const opportunities: RFPOpportunity[] = [];

    try {
      const trimmedContent = content.trim();

      if (!trimmedContent.startsWith('{') && !trimmedContent.startsWith('[')) {
        return opportunities;
      }

      const apiData = JSON.parse(trimmedContent);

      // Handle common API response structures
      const extracted = this.parseAPIResponse(apiData, url);
      opportunities.push(...extracted);

      console.log(`📊 API Response: Found ${extracted.length} opportunities`);
    } catch (error) {
      console.log(`⚠️ Failed to parse API response:`, error);
    }

    return opportunities;
  }

  /**
   * Parse generic JSON data for opportunities
   */
  private parseJSONData(
    data: any,
    url: string,
    source: string
  ): RFPOpportunity[] {
    const opportunities: RFPOpportunity[] = [];

    if (!data) return opportunities;

    // Handle different data structures
    if (Array.isArray(data)) {
      // Direct array of opportunities
      data.forEach(item => {
        const opportunity = this.createOpportunityFromObject(item, url, source);
        if (opportunity) {
          opportunities.push(opportunity);
        }
      });
    } else if (typeof data === 'object') {
      // Check for common property names that might contain opportunities
      const possibleArrays = [
        'opportunities',
        'results',
        'data',
        'items',
        'records',
        'rfps',
        'bids',
        'solicitations',
        'contracts',
        'tenders',
        'listings',
        'entries',
        'documents',
      ];

      for (const prop of possibleArrays) {
        if (data[prop] && Array.isArray(data[prop])) {
          data[prop].forEach((item: any) => {
            const opportunity = this.createOpportunityFromObject(
              item,
              url,
              source
            );
            if (opportunity) {
              opportunities.push(opportunity);
            }
          });
        }
      }

      // If no arrays found, try to parse the object itself
      if (opportunities.length === 0) {
        const opportunity = this.createOpportunityFromObject(data, url, source);
        if (opportunity) {
          opportunities.push(opportunity);
        }
      }
    }

    return opportunities;
  }

  /**
   * Parse JSON-LD structured data
   */
  private parseJSONLDData(data: any, url: string): RFPOpportunity[] {
    const opportunities: RFPOpportunity[] = [];

    if (!data) return opportunities;

    // Handle arrays of JSON-LD objects
    const items = Array.isArray(data) ? data : [data];

    items.forEach(item => {
      if (item['@type']) {
        // Look for relevant schema.org types
        const type = item['@type'];
        if (this.isRelevantSchemaType(type)) {
          const opportunity = this.createOpportunityFromJSONLD(item, url);
          if (opportunity) {
            opportunities.push(opportunity);
          }
        }
      }
    });

    return opportunities;
  }

  /**
   * Parse API response structures
   */
  private parseAPIResponse(data: any, url: string): RFPOpportunity[] {
    const opportunities: RFPOpportunity[] = [];

    if (!data) return opportunities;

    // Common API response patterns
    const patterns = [
      // Standard paginated response
      { path: ['data', 'items'], meta: ['total', 'count', 'pagination'] },
      { path: ['results'], meta: ['total', 'count'] },
      { path: ['response', 'data'], meta: ['status', 'code'] },
      { path: ['payload', 'opportunities'], meta: ['success'] },
      { path: ['content'], meta: ['status'] },

      // Direct arrays
      { path: ['opportunities'], meta: [] },
      { path: ['rfps'], meta: [] },
      { path: ['solicitations'], meta: [] },
    ];

    for (const pattern of patterns) {
      const items = this.getNestedProperty(data, pattern.path);
      if (Array.isArray(items)) {
        items.forEach(item => {
          const opportunity = this.createOpportunityFromObject(
            item,
            url,
            'api'
          );
          if (opportunity) {
            opportunities.push(opportunity);
          }
        });
        break; // Use first matching pattern
      }
    }

    return opportunities;
  }

  /**
   * Create opportunity from JSON object
   */
  private createOpportunityFromObject(
    obj: any,
    url: string,
    source: string
  ): RFPOpportunity | null {
    if (!obj || typeof obj !== 'object') return null;

    // Extract title using various possible field names
    const title = this.extractFieldValue(obj, [
      'title',
      'name',
      'subject',
      'opportunity_title',
      'opportunityTitle',
      'solicitation_title',
      'solicitationTitle',
      'description',
      'summary',
    ]);

    if (!title || title.length < 5) return null;

    // Extract other fields
    const description = this.extractFieldValue(obj, [
      'description',
      'summary',
      'details',
      'overview',
      'abstract',
      'opportunity_description',
      'opportunityDescription',
    ]);

    const agency = this.extractFieldValue(obj, [
      'agency',
      'organization',
      'department',
      'office',
      'entity',
      'contracting_office',
      'contractingOffice',
      'issuer',
    ]);

    const deadline = this.extractFieldValue(obj, [
      'deadline',
      'due_date',
      'dueDate',
      'closing_date',
      'closingDate',
      'response_date',
      'responseDate',
      'submission_deadline',
      'submissionDeadline',
      'expires',
      'expiration_date',
      'expirationDate',
    ]);

    const opportunityUrl = this.extractFieldValue(obj, [
      'url',
      'link',
      'href',
      'opportunity_url',
      'opportunityUrl',
      'details_url',
      'detailsUrl',
      'view_url',
      'viewUrl',
    ]);

    const estimatedValue = this.extractFieldValue(obj, [
      'value',
      'amount',
      'estimated_value',
      'estimatedValue',
      'contract_value',
      'contractValue',
      'budget',
      'cost',
    ]);

    const category = this.extractFieldValue(obj, [
      'category',
      'type',
      'classification',
      'opportunity_type',
      'opportunityType',
      'solicitation_type',
      'solicitationType',
    ]);

    const solicitationNumber = this.extractFieldValue(obj, [
      'solicitation_number',
      'solicitationNumber',
      'number',
      'id',
      'opportunity_id',
      'opportunityId',
      'reference',
      'reference_number',
    ]);

    return {
      title: this.cleanText(title),
      description: description ? this.cleanText(description) : undefined,
      agency: agency ? this.cleanText(agency) : undefined,
      deadline: this.parseDate(deadline),
      url: this.validateAndFixSourceUrl(opportunityUrl, url),
      link: this.validateAndFixSourceUrl(opportunityUrl, url),
      category: category
        ? this.cleanText(category)
        : this.inferCategoryFromTitle(title),
      estimatedValue: estimatedValue
        ? this.cleanText(estimatedValue)
        : undefined,
      confidence: this.calculateJSONConfidence(obj, source),
      // Additional fields that might be present
      ...(solicitationNumber && {
        solicitationNumber: this.cleanText(solicitationNumber),
      }),
    };
  }

  /**
   * Create opportunity from JSON-LD object
   */
  private createOpportunityFromJSONLD(
    obj: any,
    url: string
  ): RFPOpportunity | null {
    if (!obj) return null;

    const title = obj.name || obj.headline || obj.title;
    if (!title) return null;

    return {
      title: this.cleanText(title),
      description: obj.description
        ? this.cleanText(obj.description)
        : undefined,
      agency: obj.organization
        ? this.cleanText(obj.organization.name || obj.organization)
        : undefined,
      deadline: this.parseDate(obj.endDate || obj.deadline),
      url: this.validateAndFixSourceUrl(obj.url, url),
      link: this.validateAndFixSourceUrl(obj.url, url),
      category: obj.category ? this.cleanText(obj.category) : undefined,
      confidence: 0.8, // JSON-LD is highly structured
    };
  }

  /**
   * Extract field value using multiple possible field names
   */
  private extractFieldValue(
    obj: any,
    fieldNames: string[]
  ): string | undefined {
    for (const fieldName of fieldNames) {
      const value = this.getNestedProperty(obj, [fieldName]);
      if (value && typeof value === 'string' && value.trim().length > 0) {
        return value.trim();
      }
    }
    return undefined;
  }

  /**
   * Get nested property from object using path array
   */
  private getNestedProperty(obj: any, path: string[]): any {
    return path.reduce((current, key) => current && current[key], obj);
  }

  /**
   * Check if schema.org type is relevant for opportunities
   */
  private isRelevantSchemaType(type: string | string[]): boolean {
    const relevantTypes = [
      'JobPosting',
      'Event',
      'Offer',
      'Product',
      'Service',
      'GovernmentService',
      'PublicService',
      'BroadcastEvent',
    ];

    const types = Array.isArray(type) ? type : [type];
    return types.some(t => relevantTypes.some(rt => t.includes(rt)));
  }

  /**
   * Check if content has embedded JSON
   */
  private hasEmbeddedJSON(content: string): boolean {
    const jsonIndicators = [
      'application/json',
      'application/ld+json',
      'data-json=',
      'window.',
      'var ',
      'const ',
      'let ',
    ];

    return jsonIndicators.some(indicator => content.includes(indicator));
  }

  /**
   * Calculate confidence score for JSON opportunities
   */
  private calculateJSONConfidence(obj: any, source: string): number {
    let score = 0.6; // Base score for JSON

    // Boost for source type
    if (source === 'api') score += 0.2;
    if (source === 'direct') score += 0.15;
    if (source === 'embedded') score += 0.1;

    // Boost for structured fields
    const structuredFields = [
      'deadline',
      'agency',
      'url',
      'category',
      'estimatedValue',
    ];
    const presentFields = structuredFields.filter(
      field => obj[field] || obj[this.camelCase(field)]
    );
    score += presentFields.length * 0.05;

    // Boost for RFP-specific fields
    if (obj.solicitation_number || obj.solicitationNumber) score += 0.1;
    if (obj.opportunity_id || obj.opportunityId) score += 0.05;

    return Math.min(1.0, score);
  }

  /**
   * Convert snake_case to camelCase
   */
  private camelCase(str: string): string {
    return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  }

  /**
   * Infer category from title
   */
  private inferCategoryFromTitle(title: string): string | undefined {
    const lowerTitle = title.toLowerCase();

    if (lowerTitle.includes('rfp')) return 'Request for Proposal';
    if (lowerTitle.includes('ifb')) return 'Invitation for Bid';
    if (lowerTitle.includes('rfq')) return 'Request for Quote';
    if (lowerTitle.includes('rfi')) return 'Request for Information';
    if (lowerTitle.includes('solicitation')) return 'Solicitation';
    if (lowerTitle.includes('procurement')) return 'Procurement';

    return undefined;
  }

  /**
   * Get minimum confidence threshold for JSON extraction
   */
  private getMinimumConfidenceThreshold(portalContext: string): number {
    // JSON is structured data, so we can use higher confidence thresholds
    return 0.5;
  }

  /**
   * Enhanced confidence scoring for JSON opportunities
   */
  getConfidenceScore(opportunity: RFPOpportunity): number {
    let score = super.getConfidenceScore(opportunity);

    // Boost score for JSON-specific indicators
    if (opportunity.confidence && opportunity.confidence >= 0.8) {
      score += 0.1; // JSON-LD bonus
    }

    // Boost score for structured data completeness
    const structuredFields = [
      opportunity.agency,
      opportunity.deadline,
      opportunity.category,
      opportunity.estimatedValue,
    ];
    const completeness =
      structuredFields.filter(Boolean).length / structuredFields.length;
    score += completeness * 0.2;

    // Boost score for proper URLs
    if (opportunity.url && opportunity.url.startsWith('http')) {
      score += 0.1;
    }

    return Math.min(1.0, score);
  }
}
