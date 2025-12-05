import * as cheerio from 'cheerio';
import type { RFPOpportunity } from '../../types';
import { BaseContentExtractor } from '../ContentExtractor';

/**
 * Specialized content extractor for Bonfire Hub portals
 * Handles complex Bonfire-specific HTML structures and authentication requirements
 */
export class BonfireContentExtractor extends BaseContentExtractor {
  constructor() {
    super('bonfire');
  }

  /**
   * Extract opportunities from Bonfire Hub content
   */
  async extract(
    content: string,
    url: string,
    portalContext: string
  ): Promise<RFPOpportunity[]> {
    try {
      console.log(`🔥 Starting Bonfire content extraction for ${url}`);

      if (!this.validateContent(content)) {
        console.warn(`⚠️ Invalid content provided for Bonfire extraction`);
        return [];
      }

      const $ = cheerio.load(content);
      const opportunities: RFPOpportunity[] = [];

      // Log page structure for debugging
      this.logPageStructure($, url);

      // Try multiple extraction strategies
      const tableOpportunities = this.extractFromTables($, url);
      const listOpportunities = this.extractFromLists($, url);
      const divOpportunities = this.extractFromDivs($, url);

      opportunities.push(
        ...tableOpportunities,
        ...listOpportunities,
        ...divOpportunities
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
        `🔥 Bonfire extraction completed: ${opportunities.length} found, ${filteredOpportunities.length} above confidence threshold`
      );

      return this.removeDuplicates(filteredOpportunities);
    } catch (error) {
      console.error(`❌ Bonfire content extraction failed for ${url}:`, error);
      return [];
    }
  }

  /**
   * Enhanced content validation for Bonfire pages
   */
  validateContent(content: string): boolean {
    if (!super.validateContent(content)) {
      return false;
    }

    // Check for Bonfire-specific indicators
    const hasBonfireIndicators =
      content.includes('BonfireHub') ||
      content.includes('bonfirehub') ||
      content.includes('bonfire-') ||
      content.includes('solicitation_details.cfm') ||
      this.hasRFPKeywords(content);

    return hasBonfireIndicators && content.length >= 200;
  }

  /**
   * Log page structure for debugging
   */
  private logPageStructure($: cheerio.CheerioAPI, url?: string): void {
    const pageTitle = $('title').text();
    const tables = $('table').length;
    const rows = $('tr').length;
    const lists = $('ul, ol').length;
    const listItems = $('li').length;
    const divs = $('div').length;

    console.log(
      `📄 Bonfire page "${pageTitle}"${url ? ` (${url})` : ''} structure: ${tables} tables, ${rows} rows, ${lists} lists, ${listItems} list items, ${divs} divs`
    );
  }

  /**
   * Extract opportunities from table structures
   */
  private extractFromTables(
    $: cheerio.CheerioAPI,
    baseUrl: string
  ): RFPOpportunity[] {
    const opportunities: RFPOpportunity[] = [];

    $('table tr').each((index, element) => {
      if (index === 0) return; // Skip header row

      const $row = $(element);
      const cells = $row.find('td');

      if (cells.length >= 2) {
        const title = this.cleanText(cells.eq(0).text());
        const description = this.cleanText(cells.eq(1).text());
        const deadline =
          cells.length > 2 ? this.cleanText(cells.eq(2).text()) : undefined;
        const agency =
          cells.length > 3 ? this.cleanText(cells.eq(3).text()) : undefined;

        // Look for links in any cell
        const link = $row.find('a').first().attr('href');

        if (this.isValidOpportunity(title, link)) {
          opportunities.push({
            title,
            description,
            deadline: this.parseDate(deadline || ''),
            agency,
            url: this.validateAndFixSourceUrl(link, baseUrl) || '',
            link: this.validateAndFixSourceUrl(link, baseUrl),
            category: this.inferCategory(title),
            confidence: 0.7,
          });
          console.log(`✅ Bonfire table opportunity found: ${title}`);
        }
      }
    });

    return opportunities;
  }

  /**
   * Extract opportunities from list structures
   */
  private extractFromLists(
    $: cheerio.CheerioAPI,
    baseUrl: string
  ): RFPOpportunity[] {
    const opportunities: RFPOpportunity[] = [];

    $('li').each((_, element) => {
      const $item = $(element);
      const text = this.cleanText($item.text());
      const link =
        $item.find('a').first().attr('href') || $item.closest('a').attr('href');

      if (this.hasRFPKeywords(text) && text.length > 10) {
        const title =
          $item.find('h1, h2, h3, h4, h5, h6').first().text().trim() ||
          text.substring(0, 100);

        if (title && !opportunities.some(opp => opp.title === title)) {
          opportunities.push({
            title: this.cleanText(title),
            description: text,
            url: this.validateAndFixSourceUrl(link, baseUrl),
            link: this.validateAndFixSourceUrl(link, baseUrl),
            category: this.inferCategory(title),
            confidence: 0.6,
          });
          console.log(`✅ Bonfire list opportunity found: ${title}`);
        }
      }
    });

    return opportunities;
  }

  /**
   * Extract opportunities from div structures
   */
  private extractFromDivs(
    $: cheerio.CheerioAPI,
    baseUrl: string
  ): RFPOpportunity[] {
    const opportunities: RFPOpportunity[] = [];

    $('div').each((_, element) => {
      const $div = $(element);
      const text = this.cleanText($div.text());
      const link = $div.find('a').first().attr('href');

      if (this.isValidDivOpportunity(text)) {
        const title =
          $div.find('h1, h2, h3, h4, h5, h6').first().text().trim() ||
          text.substring(0, 100);

        if (title && !opportunities.some(opp => opp.title === title)) {
          opportunities.push({
            title: this.cleanText(title),
            description: text,
            url: this.validateAndFixSourceUrl(link, baseUrl),
            link: this.validateAndFixSourceUrl(link, baseUrl),
            category: this.inferCategory(title),
            confidence: 0.5,
          });
          console.log(`✅ Bonfire div opportunity found: ${title}`);
        }
      }
    });

    return opportunities;
  }

  /**
   * Check if title and link represent a valid opportunity
   */
  private isValidOpportunity(title: string, link?: string): boolean {
    return !!(
      title &&
      title.length > 5 &&
      (link || this.hasRFPKeywords(title))
    );
  }

  /**
   * Check if div text represents a valid opportunity
   */
  private isValidDivOpportunity(text: string): boolean {
    return !!(
      text.length > 20 &&
      text.length < 500 &&
      this.hasRFPKeywords(text) &&
      !text.toLowerCase().includes('footer') &&
      !text.toLowerCase().includes('header')
    );
  }

  /**
   * Infer category from title text
   */
  private inferCategory(title: string): string | undefined {
    const lowerTitle = title.toLowerCase();

    if (lowerTitle.includes('rfp')) return 'Request for Proposal';
    if (lowerTitle.includes('ifb')) return 'Invitation for Bid';
    if (lowerTitle.includes('rfq')) return 'Request for Quote';
    if (lowerTitle.includes('solicitation')) return 'Solicitation';
    if (lowerTitle.includes('procurement')) return 'Procurement';

    return undefined;
  }

  /**
   * Get minimum confidence threshold based on portal context
   * Different portals warrant different thresholds based on:
   * - Portal reliability and structure consistency
   * - Authentication complexity
   * - Known extraction success rates
   *
   * @param portalContext - Portal type identifier (e.g., 'bonfire', 'sam_gov', 'generic')
   * @returns Minimum confidence threshold (0.0-1.0)
   */
  private getMinimumConfidenceThreshold(portalContext?: string): number {
    if (!portalContext) {
      // Default threshold when context is unknown
      return 0.6;
    }

    const normalizedContext = portalContext.toLowerCase().trim();

    // Well-known, reliable portals with consistent structure
    // These portals have proven extraction patterns, so we can be more lenient
    const reliablePortals = ['bonfire', 'bonfirehub', 'sam_gov', 'sam.gov'];
    if (reliablePortals.some(portal => normalizedContext.includes(portal))) {
      // Bonfire has complex authentication but consistent HTML structure
      // SAM.gov has structured API responses
      return 0.5;
    }

    // Government portals with standardized formats
    // These tend to have consistent structure but may vary by agency
    const governmentPortals = [
      'gov',
      'government',
      'federal',
      'state',
      'municipal',
    ];
    if (governmentPortals.some(portal => normalizedContext.includes(portal))) {
      return 0.55;
    }

    // Generic or unknown portals
    // Require higher confidence to avoid false positives
    const genericIndicators = ['generic', 'unknown', 'other', 'custom'];
    if (
      genericIndicators.some(indicator => normalizedContext.includes(indicator))
    ) {
      return 0.65;
    }

    // Default threshold for unclassified portals
    // Slightly higher than reliable portals but lower than generic
    return 0.6;
  }

  /**
   * Enhanced confidence scoring for Bonfire opportunities
   */
  getConfidenceScore(opportunity: RFPOpportunity): number {
    let score = super.getConfidenceScore(opportunity);

    // Boost score for Bonfire-specific patterns
    if (opportunity.title) {
      if (
        opportunity.title.includes('IFB') ||
        opportunity.title.includes('RFP') ||
        opportunity.title.includes('RFQ')
      ) {
        score += 0.15;
      }
      if (opportunity.title.match(/\b\d{3,5}\b/)) {
        // Contains ID numbers
        score += 0.1;
      }
    }

    // Boost score for URLs with solicitation details
    if (
      opportunity.url &&
      opportunity.url.includes('solicitation_details.cfm')
    ) {
      score += 0.2;
    }

    // Boost score for opportunities with proper agency
    if (
      opportunity.agency &&
      (opportunity.agency.includes('City') ||
        opportunity.agency.includes('County') ||
        opportunity.agency.includes('State'))
    ) {
      score += 0.1;
    }

    return Math.min(1.0, score);
  }
}
