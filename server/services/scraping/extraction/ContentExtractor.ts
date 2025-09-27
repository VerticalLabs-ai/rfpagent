import { RFPOpportunity } from '../types';

/**
 * Base interface for content extractors
 */
export interface ContentExtractor {
  extract(content: string, url: string, portalContext: string): Promise<RFPOpportunity[]>;
  getPortalType(): string;
  validateContent(content: string): boolean;
  getConfidenceScore(opportunity: RFPOpportunity): number;
}

/**
 * Abstract base class for content extractors
 */
export abstract class BaseContentExtractor implements ContentExtractor {
  protected portalType: string;

  constructor(portalType: string) {
    this.portalType = portalType;
  }

  abstract extract(content: string, url: string, portalContext: string): Promise<RFPOpportunity[]>;

  /**
   * Get supported portal type
   */
  getPortalType(): string {
    return this.portalType;
  }

  /**
   * Basic content validation
   */
  validateContent(content: string): boolean {
    return !!(content && content.trim().length > 0);
  }

  /**
   * Calculate confidence score for an opportunity
   */
  getConfidenceScore(opportunity: RFPOpportunity): number {
    let score = 0.5; // Base score

    // Title presence and quality
    if (opportunity.title) {
      score += 0.2;
      if (opportunity.title.length > 10) score += 0.1;
      if (this.hasRFPKeywords(opportunity.title)) score += 0.1;
    }

    // Description presence
    if (opportunity.description && opportunity.description.length > 20) {
      score += 0.2;
    }

    // Agency presence
    if (opportunity.agency) {
      score += 0.1;
    }

    // Deadline presence
    if (opportunity.deadline) {
      score += 0.1;
      if (this.isValidDate(opportunity.deadline)) score += 0.1;
    }

    // URL presence and validity
    if (opportunity.url || opportunity.link) {
      score += 0.1;
      const url = opportunity.url || opportunity.link;
      if (url && this.isValidUrl(url)) score += 0.1;
    }

    // Estimated value presence
    if (opportunity.estimatedValue) {
      score += 0.1;
    }

    return Math.min(1.0, score);
  }

  /**
   * Check if text contains RFP-related keywords
   */
  protected hasRFPKeywords(text: string): boolean {
    const keywords = [
      'rfp', 'request for proposal', 'procurement', 'solicitation',
      'bid', 'tender', 'contract', 'opportunity', 'ifb', 'invitation for bid',
      'rfq', 'request for quote', 'proposal', 'quotes'
    ];

    const lowerText = text.toLowerCase();
    return keywords.some(keyword => lowerText.includes(keyword));
  }

  /**
   * Validate if string is a valid date
   */
  protected isValidDate(dateString: string): boolean {
    const date = new Date(dateString);
    return !isNaN(date.getTime()) && date > new Date();
  }

  /**
   * Validate if string is a valid URL
   */
  protected isValidUrl(urlString: string): boolean {
    try {
      new URL(urlString);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Clean and normalize text
   */
  protected cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, ' ')
      .trim();
  }

  /**
   * Extract URLs from text
   */
  protected extractUrls(text: string, baseUrl: string): string[] {
    const urlRegex = /https?:\/\/[^\s<>"]+/g;
    const relativeUrlRegex = /\/[^\s<>"]*\?[^\s<>"]*/g;

    const urls: string[] = [];

    // Extract absolute URLs
    const absoluteUrls = text.match(urlRegex) || [];
    urls.push(...absoluteUrls);

    // Extract relative URLs and convert to absolute
    const relativeUrls = text.match(relativeUrlRegex) || [];
    relativeUrls.forEach(relativeUrl => {
      try {
        const absoluteUrl = new URL(relativeUrl, baseUrl).toString();
        urls.push(absoluteUrl);
      } catch {
        // Ignore invalid URLs
      }
    });

    return [...new Set(urls)]; // Remove duplicates
  }

  /**
   * Parse date from various formats
   */
  protected parseDate(dateString: string): string | undefined {
    if (!dateString) return undefined;

    // Common date patterns
    const patterns = [
      /(\d{1,2})\/(\d{1,2})\/(\d{2,4})/,  // MM/DD/YYYY or DD/MM/YYYY
      /(\d{4})-(\d{1,2})-(\d{1,2})/,      // YYYY-MM-DD
      /(\w+)\s+(\d{1,2}),?\s+(\d{4})/,    // Month DD, YYYY
      /(\d{1,2})\s+(\w+)\s+(\d{4})/       // DD Month YYYY
    ];

    for (const pattern of patterns) {
      const match = dateString.match(pattern);
      if (match) {
        try {
          const date = new Date(dateString);
          if (!isNaN(date.getTime())) {
            return date.toISOString();
          }
        } catch {
          continue;
        }
      }
    }

    return undefined;
  }

  /**
   * Extract currency values
   */
  protected extractCurrencyValue(text: string): string | undefined {
    const currencyPatterns = [
      /\$[\d,]+(?:\.\d{2})?/g,
      /USD?\s*[\d,]+(?:\.\d{2})?/gi,
      /[\d,]+(?:\.\d{2})?\s*dollars?/gi
    ];

    for (const pattern of currencyPatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[0];
      }
    }

    return undefined;
  }

  /**
   * Validate and fix source URL
   */
  protected validateAndFixSourceUrl(url: string | undefined, baseUrl: string): string | undefined {
    if (!url) return undefined;

    try {
      // If it's already a complete URL, validate it
      if (url.startsWith('http')) {
        new URL(url); // Validate
        return url;
      }

      // If it's a relative URL, make it absolute
      if (url.startsWith('/')) {
        return new URL(url, baseUrl).toString();
      }

      // If it's a query or fragment, append to base
      if (url.startsWith('?') || url.startsWith('#')) {
        return new URL(url, baseUrl).toString();
      }

      // Try to construct relative URL
      return new URL(url, baseUrl).toString();
    } catch {
      return undefined;
    }
  }

  /**
   * Remove duplicate opportunities
   */
  protected removeDuplicates(opportunities: RFPOpportunity[]): RFPOpportunity[] {
    const seen = new Set<string>();
    const unique: RFPOpportunity[] = [];

    for (const opp of opportunities) {
      // Create a key based on title and URL/link
      const key = `${opp.title?.toLowerCase() || ''}|${opp.url || opp.link || ''}`;

      if (!seen.has(key)) {
        seen.add(key);
        unique.push(opp);
      }
    }

    return unique;
  }

  /**
   * Filter opportunities by search criteria
   */
  protected filterBySearch(opportunities: RFPOpportunity[], searchFilter?: string): RFPOpportunity[] {
    if (!searchFilter) return opportunities;

    const searchTerms = searchFilter.toLowerCase().split(/\s+/);

    return opportunities.filter(opp => {
      const searchableText = [
        opp.title,
        opp.description,
        opp.agency,
        opp.category
      ].join(' ').toLowerCase();

      return searchTerms.some(term => searchableText.includes(term));
    });
  }
}