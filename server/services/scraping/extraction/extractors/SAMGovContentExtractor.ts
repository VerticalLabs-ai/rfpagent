import axios from 'axios';
import * as cheerio from 'cheerio';
import { logger } from '../../../../utils/logger';
import type { RFPOpportunity } from '../../types';
import { BaseContentExtractor } from '../ContentExtractor';

/**
 * Specialized content extractor for SAM.gov portal
 * Handles federal government procurement opportunities
 *
 * Supports two extraction modes:
 * 1. API-based extraction (primary, preferred)
 * 2. HTML scraping (fallback when API is unavailable)
 *
 * @see https://open.gsa.gov/api/opportunities-api/
 */
export class SAMGovContentExtractor extends BaseContentExtractor {
  private readonly SAM_BASE_URL = 'https://api.sam.gov/opportunities/v2';

  constructor() {
    super('sam.gov');
  }

  /**
   * Extract opportunities from SAM.gov content
   *
   * Intelligently chooses between API extraction and HTML scraping
   * based on content type and availability
   */
  async extract(content: string, url: string): Promise<RFPOpportunity[]> {
    try {
      logger.info('Starting SAM.gov content extraction', {
        url,
      });

      // Strategy 1: Try API-based extraction first if we have API key
      if (this.hasApiKey()) {
        const apiOpportunities = await this.extractFromAPI(url);
        if (apiOpportunities.length > 0) {
          logger.info('SAM.gov API extraction successful', {
            url,
            count: apiOpportunities.length,
          });
          return apiOpportunities;
        }
        logger.warn(
          'SAM.gov API extraction returned no results, falling back to HTML'
        );
      }

      // Strategy 2: Fall back to HTML scraping
      if (!this.validateContent(content)) {
        logger.warn('Invalid content provided for SAM.gov extraction', { url });
        return [];
      }

      const htmlOpportunities = await this.extractFromHTML(content, url);

      logger.info('SAM.gov extraction completed', {
        url,
        count: htmlOpportunities.length,
        method: 'HTML',
      });

      return htmlOpportunities;
    } catch (error) {
      logger.error(
        'SAM.gov content extraction failed',
        error instanceof Error ? error : new Error(String(error)),
        { url }
      );
      return [];
    }
  }

  /**
   * Check if SAM.gov API key is available
   */
  private hasApiKey(): boolean {
    return !!(
      process.env.SAM_GOV_API_KEY &&
      process.env.SAM_GOV_API_KEY.trim().length > 0
    );
  }

  /**
   * Extract opportunities using SAM.gov API
   * Primary extraction method - more reliable and structured
   */
  private async extractFromAPI(url: string): Promise<RFPOpportunity[]> {
    try {
      const apiKey = process.env.SAM_GOV_API_KEY;
      if (!apiKey) {
        return [];
      }

      // Extract search parameters from URL or use defaults
      const searchParams = this.extractSearchParamsFromURL(url);

      logger.info('Fetching opportunities from SAM.gov API', { searchParams });

      const response = await axios.get(`${this.SAM_BASE_URL}/search`, {
        params: {
          limit: searchParams.limit || 50,
          offset: searchParams.offset || 0,
          postedFrom: searchParams.postedFrom,
          postedTo: searchParams.postedTo,
          ...searchParams.filters,
        },
        headers: {
          'X-Api-Key': apiKey,
          'User-Agent': 'RFP-Agent/1.0',
          Accept: 'application/json',
        },
        timeout: 30000,
      });

      if (response.status !== 200) {
        logger.warn('SAM.gov API returned non-200 status', {
          status: response.status,
          statusText: response.statusText,
        });
        return [];
      }

      const data = response.data;
      const opportunitiesData = data?.opportunitiesData || [];

      logger.info('SAM.gov API response received', {
        total: opportunitiesData.length,
      });

      // Convert API response to RFPOpportunity format
      const opportunities = opportunitiesData.map((opp: any) =>
        this.convertAPIOpportunityToRFP(opp)
      );

      // Calculate confidence scores
      opportunities.forEach((opp: RFPOpportunity) => {
        opp.confidence = this.getConfidenceScore(opp);
      });

      const minConfidence = this.getMinimumConfidenceThreshold();
      const filtered = opportunities.filter(
        (opp: RFPOpportunity) => (opp.confidence || 0) >= minConfidence
      );

      return this.removeDuplicates(filtered);
    } catch (error) {
      logger.error(
        'SAM.gov API extraction failed',
        error instanceof Error ? error : new Error(String(error)),
        {
          endpoint: `${this.SAM_BASE_URL}/search`,
        }
      );
      return [];
    }
  }

  /**
   * Convert SAM.gov API opportunity to RFPOpportunity format
   */
  private convertAPIOpportunityToRFP(apiOpp: any): RFPOpportunity {
    return {
      title: apiOpp.title || 'Untitled Opportunity',
      description: apiOpp.description || apiOpp.synopsis || '',
      agency:
        apiOpp.organizationName || apiOpp.department || apiOpp.subtierName,
      deadline: apiOpp.responseDeadLine || apiOpp.archiveDate,
      estimatedValue: apiOpp.awardCeiling
        ? `$${apiOpp.awardCeiling}`
        : apiOpp.awardFloor
          ? `$${apiOpp.awardFloor}`
          : undefined,
      url: `https://sam.gov/opp/${apiOpp.noticeId}/view`,
      link: `https://sam.gov/opp/${apiOpp.noticeId}/view`,
      category:
        apiOpp.type ||
        apiOpp.typeOfSetAsideDescription ||
        'Federal Opportunity',
      confidence: 0.95, // API data is highly reliable
    };
  }

  /**
   * Extract search parameters from SAM.gov URL
   */
  private extractSearchParamsFromURL(url: string): {
    limit?: number;
    offset?: number;
    postedFrom?: string;
    postedTo?: string;
    filters?: Record<string, any>;
  } {
    try {
      const urlObj = new URL(url);
      const params = urlObj.searchParams;

      // Get current date for default range
      const today = new Date();
      const currentYear = today.getFullYear();
      const yearStart = `01/01/${currentYear}`;
      const yearEnd = `12/31/${currentYear + 1}`;

      return {
        limit: parseInt(params.get('limit') || '50', 10),
        offset: parseInt(params.get('offset') || '0', 10),
        postedFrom: params.get('postedFrom') || yearStart,
        postedTo: params.get('postedTo') || yearEnd,
        filters: {
          keyword: params.get('keyword') || undefined,
          organizationName: params.get('organizationName') || undefined,
          state: params.get('state') || undefined,
        },
      };
    } catch {
      // If URL parsing fails, return defaults
      const today = new Date();
      const currentYear = today.getFullYear();
      return {
        limit: 50,
        offset: 0,
        postedFrom: `01/01/${currentYear}`,
        postedTo: `12/31/${currentYear + 1}`,
      };
    }
  }

  /**
   * Extract opportunities from HTML content (fallback method)
   */
  private async extractFromHTML(
    content: string,
    url: string
  ): Promise<RFPOpportunity[]> {
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

    const minConfidence = this.getMinimumConfidenceThreshold();
    const filteredOpportunities = opportunities.filter(
      opp => (opp.confidence || 0) >= minConfidence
    );

    logger.info('SAM.gov HTML extraction completed', {
      url,
      total: opportunities.length,
      filtered: filteredOpportunities.length,
    });

    return this.removeDuplicates(filteredOpportunities);
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
      /Solicitation\s*[#:]?\s*([A-Z0-9_-]+)/i,
      /Sol[#:]?\s*([A-Z0-9_-]+)/i,
      /Number[#:]?\s*([A-Z0-9_-]+)/i,
      /\b([A-Z]{2,}\d{2,}[\w-]*)\b/,
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
  private getMinimumConfidenceThreshold(): number {
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
