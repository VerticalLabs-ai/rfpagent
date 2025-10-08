import { BaseContentExtractor } from '../ContentExtractor';
import { RFPOpportunity } from '../../types';
import * as cheerio from 'cheerio';

/**
 * Specialized content extractor for SAM.gov portal
 * Handles federal government procurement opportunities
 */
export class SAMGovContentExtractor extends BaseContentExtractor {
  constructor() {
    super('sam.gov');
  }

  /**
   * Extract opportunities from SAM.gov content
   */
  async extract(
    content: string,
    url: string,
    portalContext: string
  ): Promise<RFPOpportunity[]> {
    try {
      console.log(`🏛️ Starting SAM.gov content extraction for ${url}`);

      if (!this.validateContent(content)) {
        console.warn(`⚠️ Invalid content provided for SAM.gov extraction`);
        return [];
      }

      const $ = cheerio.load(content);
      const opportunities: RFPOpportunity[] = [];

      // SAM.gov specific extraction strategies
      const searchResults = this.extractSearchResults($, url);
      const detailPages = this.extractDetailPages($, url);
      const listingPages = this.extractListingPages($, url);

      opportunities.push(...searchResults, ...detailPages, ...listingPages);

      // Calculate confidence scores and filter
      opportunities.forEach(opp => {
        opp.confidence = this.getConfidenceScore(opp);
      });

      const minConfidence = this.getMinimumConfidenceThreshold(portalContext);
      const filteredOpportunities = opportunities.filter(
        opp => (opp.confidence || 0) >= minConfidence
      );

      console.log(
        `🏛️ SAM.gov extraction completed: ${opportunities.length} found, ${filteredOpportunities.length} above confidence threshold`
      );

      return this.removeDuplicates(filteredOpportunities);
    } catch (error) {
      console.error(`❌ SAM.gov content extraction failed for ${url}:`, error);
      return [];
    }
  }

  /**
   * Enhanced content validation for SAM.gov
   */
  validateContent(content: string): boolean {
    if (!super.validateContent(content)) {
      return false;
    }

    // Check for SAM.gov specific indicators
    const hasSAMIndicators =
      content.includes('sam.gov') ||
      content.includes('SAM.gov') ||
      content.includes('opportunity-row') ||
      content.includes('search-result') ||
      content.includes('contract opportunities') ||
      this.hasRFPKeywords(content);

    return hasSAMIndicators;
  }

  /**
   * Extract opportunities from search result pages
   */
  private extractSearchResults(
    $: cheerio.CheerioAPI,
    baseUrl: string
  ): RFPOpportunity[] {
    const opportunities: RFPOpportunity[] = [];

    // SAM.gov search result selectors
    $(
      '.opportunity-row, .search-result, [class*="opportunity"], [data-testid*="opportunity"]'
    ).each((_, element) => {
      const $row = $(element);

      const title = this.extractTitle($row);
      const description = this.extractDescription($row);
      const agency = this.extractAgency($row);
      const deadline = this.extractDeadline($row);
      const link = this.extractLink($row, baseUrl);
      const solicitationNumber = this.extractSolicitationNumber($row);
      const setAside = this.extractSetAside($row);
      const naicsCode = this.extractNAICSCode($row);

      if (title && (link || solicitationNumber)) {
        opportunities.push({
          title: this.cleanText(title),
          description: description ? this.cleanText(description) : '',
          agency: agency ? this.cleanText(agency) : undefined,
          deadline: this.parseDate(deadline),
          url: link || '',
          link: link,
          category: this.inferCategoryFromSAM(title, solicitationNumber),
          estimatedValue: this.extractEstimatedValue($row),
          confidence: 0.8,
        } as any);
        console.log(`✅ SAM.gov search result found: ${title}`);
      }
    });

    return opportunities;
  }

  /**
   * Extract opportunities from detail pages
   */
  private extractDetailPages(
    $: cheerio.CheerioAPI,
    baseUrl: string
  ): RFPOpportunity[] {
    const opportunities: RFPOpportunity[] = [];

    // Check if this is a detail page
    const detailPageSelectors = [
      '.opportunity-detail',
      '.solicitation-detail',
      '[class*="detail-page"]',
      '[data-testid*="detail"]',
    ];

    const isDetailPage = detailPageSelectors.some(
      selector => $(selector).length > 0
    );

    if (isDetailPage) {
      const title = this.extractDetailTitle($);
      const description = this.extractDetailDescription($);
      const agency = this.extractDetailAgency($);
      const deadline = this.extractDetailDeadline($);
      const solicitationNumber = this.extractDetailSolicitationNumber($);
      const pointOfContact = this.extractPointOfContact($);

      if (title) {
        opportunities.push({
          title: this.cleanText(title),
          description: description ? this.cleanText(description) : '',
          agency: agency ? this.cleanText(agency) : undefined,
          deadline: this.parseDate(deadline),
          url: baseUrl || '',
          link: baseUrl,
          category: this.inferCategoryFromSAM(title, solicitationNumber),
          confidence: 0.9,
        } as any);
        console.log(`✅ SAM.gov detail page found: ${title}`);
      }
    }

    return opportunities;
  }

  /**
   * Extract opportunities from listing pages
   */
  private extractListingPages(
    $: cheerio.CheerioAPI,
    baseUrl: string
  ): RFPOpportunity[] {
    const opportunities: RFPOpportunity[] = [];

    // Generic opportunity listings
    $('tr, .listing-item, .opportunity-item').each((_, element) => {
      const $item = $(element);
      const text = this.cleanText($item.text());

      if (this.hasRFPKeywords(text) && text.length > 50) {
        const title = this.extractGenericTitle($item);
        const link = this.extractGenericLink($item, baseUrl);

        if (title && !opportunities.some(opp => opp.title === title)) {
          opportunities.push({
            title,
            description:
              text.length > 200 ? text.substring(0, 200) + '...' : text,
            url: link,
            link: link,
            category: this.inferCategoryFromText(text),
            confidence: 0.6,
          });
          console.log(`✅ SAM.gov listing found: ${title}`);
        }
      }
    });

    return opportunities;
  }

  /**
   * Extract title from search result row
   */
  private extractTitle($row: cheerio.Cheerio<cheerio.Element>): string {
    const selectors = [
      '.opportunity-title',
      '.title',
      'h2',
      'h3',
      'h4',
      '[class*="title"]',
      '[data-testid*="title"]',
      'a[href*="opportunity"]',
    ];

    for (const selector of selectors) {
      const title = $row.find(selector).first().text().trim();
      if (title && title.length > 5) {
        return title;
      }
    }

    return '';
  }

  /**
   * Extract description from search result row
   */
  private extractDescription($row: cheerio.Cheerio<cheerio.Element>): string {
    const selectors = [
      '.opportunity-description',
      '.description',
      '.summary',
      '[class*="description"]',
      'p',
    ];

    for (const selector of selectors) {
      const description = $row.find(selector).first().text().trim();
      if (description && description.length > 10) {
        return description;
      }
    }

    return '';
  }

  /**
   * Extract agency from search result row
   */
  private extractAgency($row: cheerio.Cheerio<cheerio.Element>): string {
    const selectors = [
      '.agency',
      '.department',
      '.office',
      '[class*="agency"]',
      '[class*="department"]',
    ];

    for (const selector of selectors) {
      const agency = $row.find(selector).first().text().trim();
      if (agency) {
        return agency;
      }
    }

    return '';
  }

  /**
   * Extract deadline from search result row
   */
  private extractDeadline($row: cheerio.Cheerio<cheerio.Element>): string {
    const selectors = [
      '.response-date',
      '.due-date',
      '.deadline',
      '.submission-date',
      '[class*="due"]',
      '[class*="deadline"]',
    ];

    for (const selector of selectors) {
      const deadline = $row.find(selector).first().text().trim();
      if (deadline) {
        return deadline;
      }
    }

    return '';
  }

  /**
   * Extract link from search result row
   */
  private extractLink(
    $row: cheerio.Cheerio<cheerio.Element>,
    baseUrl: string
  ): string | undefined {
    const link = $row.find('a').first().attr('href');
    return this.validateAndFixSourceUrl(link, baseUrl);
  }

  /**
   * Extract solicitation number
   */
  private extractSolicitationNumber(
    $row: cheerio.Cheerio<cheerio.Element>
  ): string | undefined {
    const text = $row.text();
    const patterns = [
      /Solicitation\s*[#:]?\s*([A-Z0-9\-_]+)/i,
      /Sol[#:]?\s*([A-Z0-9\-_]+)/i,
      /Number[#:]?\s*([A-Z0-9\-_]+)/i,
      /\b([A-Z]{2,}\d{2,}[\w\-]*)\b/,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return undefined;
  }

  /**
   * Extract set-aside information
   */
  private extractSetAside(
    $row: cheerio.Cheerio<cheerio.Element>
  ): string | undefined {
    const text = $row.text().toLowerCase();
    const setAsideTypes = [
      'small business',
      'woman-owned',
      'veteran-owned',
      'hubzone',
      'sdvosb',
      '8(a)',
      'unrestricted',
    ];

    for (const type of setAsideTypes) {
      if (text.includes(type)) {
        return type;
      }
    }

    return undefined;
  }

  /**
   * Extract NAICS code
   */
  private extractNAICSCode(
    $row: cheerio.Cheerio<cheerio.Element>
  ): string | undefined {
    const text = $row.text();
    const naicsMatch = text.match(/NAICS[:\s]*(\d{6})/i);
    return naicsMatch ? naicsMatch[1] : undefined;
  }

  /**
   * Extract estimated value
   */
  private extractEstimatedValue(
    $row: cheerio.Cheerio<cheerio.Element>
  ): string | undefined {
    const text = $row.text();
    return this.extractCurrencyValue(text);
  }

  /**
   * Extract title from detail page
   */
  private extractDetailTitle($: cheerio.CheerioAPI): string {
    const selectors = [
      '.opportunity-title',
      '.solicitation-title',
      'h1',
      'h2',
      '[class*="title"]',
    ];

    for (const selector of selectors) {
      const title = $(selector).first().text().trim();
      if (title && title.length > 5) {
        return title;
      }
    }

    return '';
  }

  /**
   * Extract description from detail page
   */
  private extractDetailDescription($: cheerio.CheerioAPI): string {
    const selectors = [
      '.opportunity-description',
      '.description',
      '.overview',
      '[class*="description"]',
    ];

    for (const selector of selectors) {
      const description = $(selector).first().text().trim();
      if (description && description.length > 20) {
        return description;
      }
    }

    return '';
  }

  /**
   * Extract agency from detail page
   */
  private extractDetailAgency($: cheerio.CheerioAPI): string {
    const selectors = [
      '.contracting-office',
      '.agency',
      '.department',
      '[class*="agency"]',
    ];

    for (const selector of selectors) {
      const agency = $(selector).first().text().trim();
      if (agency) {
        return agency;
      }
    }

    return '';
  }

  /**
   * Extract deadline from detail page
   */
  private extractDetailDeadline($: cheerio.CheerioAPI): string {
    const selectors = [
      '.response-date',
      '.submission-deadline',
      '.due-date',
      '[class*="deadline"]',
    ];

    for (const selector of selectors) {
      const deadline = $(selector).first().text().trim();
      if (deadline) {
        return deadline;
      }
    }

    return '';
  }

  /**
   * Extract solicitation number from detail page
   */
  private extractDetailSolicitationNumber(
    $: cheerio.CheerioAPI
  ): string | undefined {
    const text = $('body').text();
    return this.extractSolicitationNumber($({ text: () => text } as any));
  }

  /**
   * Extract point of contact
   */
  private extractPointOfContact($: cheerio.CheerioAPI): string | undefined {
    const selectors = [
      '.point-of-contact',
      '.contact',
      '.contracting-officer',
      '[class*="contact"]',
    ];

    for (const selector of selectors) {
      const contact = $(selector).first().text().trim();
      if (contact && contact.length > 5) {
        return contact;
      }
    }

    return undefined;
  }

  /**
   * Extract generic title
   */
  private extractGenericTitle($item: cheerio.Cheerio<cheerio.Element>): string {
    const title = $item
      .find('h1, h2, h3, h4, .title, [class*="title"]')
      .first()
      .text()
      .trim();
    return title || $item.text().trim().substring(0, 100);
  }

  /**
   * Extract generic link
   */
  private extractGenericLink(
    $item: cheerio.Cheerio<cheerio.Element>,
    baseUrl: string
  ): string | undefined {
    const link = $item.find('a').first().attr('href');
    return this.validateAndFixSourceUrl(link, baseUrl);
  }

  /**
   * Infer category from SAM.gov specific information
   */
  private inferCategoryFromSAM(
    title: string,
    solicitationNumber?: string
  ): string | undefined {
    const text = (title + ' ' + (solicitationNumber || '')).toLowerCase();

    if (text.includes('rfp')) return 'Request for Proposal';
    if (text.includes('ifb')) return 'Invitation for Bid';
    if (text.includes('rfq')) return 'Request for Quote';
    if (text.includes('rfi')) return 'Request for Information';
    if (text.includes('sources sought')) return 'Sources Sought';
    if (text.includes('pre-solicitation')) return 'Pre-Solicitation';

    return 'Federal Opportunity';
  }

  /**
   * Infer category from text content
   */
  private inferCategoryFromText(text: string): string | undefined {
    const lowerText = text.toLowerCase();

    if (lowerText.includes('rfp')) return 'Request for Proposal';
    if (lowerText.includes('ifb')) return 'Invitation for Bid';
    if (lowerText.includes('rfq')) return 'Request for Quote';
    if (lowerText.includes('contract')) return 'Contract';

    return 'Federal Opportunity';
  }

  /**
   * Get minimum confidence threshold for SAM.gov
   */
  private getMinimumConfidenceThreshold(portalContext: string): number {
    // SAM.gov is highly structured, so we can use higher confidence thresholds
    return 0.7;
  }

  /**
   * Enhanced confidence scoring for SAM.gov opportunities
   */
  getConfidenceScore(opportunity: RFPOpportunity): number {
    let score = super.getConfidenceScore(opportunity);

    // Boost score for federal-specific patterns
    if (opportunity.title) {
      if (opportunity.title.match(/\b(RFP|IFB|RFQ|RFI)\b/i)) {
        score += 0.2;
      }
    }

    // Boost score for solicitation numbers
    if ((opportunity as any).solicitationNumber) {
      score += 0.15;
    }

    // Boost score for proper federal agencies
    if (
      opportunity.agency &&
      (opportunity.agency.includes('Department') ||
        opportunity.agency.includes('Agency') ||
        opportunity.agency.includes('Administration'))
    ) {
      score += 0.1;
    }

    // Boost score for NAICS codes
    if ((opportunity as any).naicsCode) {
      score += 0.1;
    }

    // Boost score for detail pages
    if (opportunity.confidence === 0.9) {
      score += 0.05;
    }

    return Math.min(1.0, score);
  }
}
