import { BaseContentExtractor } from '../ContentExtractor';
import { RFPOpportunity } from '../../types';
import * as cheerio from 'cheerio';

/**
 * Specialized content extractor for City of Austin Finance portal
 * Handles Austin-specific solicitation structures and patterns
 */
export class AustinFinanceContentExtractor extends BaseContentExtractor {
  constructor() {
    super('austin_finance');
  }

  /**
   * Extract opportunities from Austin Finance content
   */
  async extract(
    content: string,
    url: string,
    portalContext: string
  ): Promise<RFPOpportunity[]> {
    try {
      console.log(`🏛️ Starting Austin Finance content extraction for ${url}`);

      if (!this.validateContent(content)) {
        console.warn(
          `⚠️ Invalid content provided for Austin Finance extraction`
        );
        return [];
      }

      const $ = cheerio.load(content);
      const opportunities: RFPOpportunity[] = [];

      // Austin Finance specific extraction
      const detailLinkOpportunities = this.extractFromDetailLinks($, url);
      const tableOpportunities = this.extractFromTables($, url);
      const listOpportunities = this.extractFromLists($, url);

      opportunities.push(
        ...detailLinkOpportunities,
        ...tableOpportunities,
        ...listOpportunities
      );

      // Calculate confidence scores and filter
      opportunities.forEach(opp => {
        opp.confidence = this.getConfidenceScore(opp);
      });

      const minConfidence = this.getMinimumConfidenceThreshold(portalContext);
      const filteredOpportunities = opportunities.filter(
        opp => (opp.confidence || 0) >= minConfidence
      );

      // Remove duplicates based on solicitation ID
      const uniqueOpportunities = this.removeDuplicatesBySolicitationId(
        filteredOpportunities
      );

      console.log(
        `🏛️ Austin Finance extraction completed: ${opportunities.length} found, ${uniqueOpportunities.length} unique opportunities above confidence threshold`
      );

      return uniqueOpportunities;
    } catch (error) {
      console.error(
        `❌ Austin Finance content extraction failed for ${url}:`,
        error
      );
      return [];
    }
  }

  /**
   * Enhanced content validation for Austin Finance pages
   */
  validateContent(content: string): boolean {
    if (!super.validateContent(content)) {
      return false;
    }

    // Check for Austin-specific indicators
    const hasAustinIndicators =
      content.includes('austintexas.gov') ||
      content.includes('City of Austin') ||
      content.includes('solicitation_details.cfm') ||
      content.includes('IFQ') ||
      content.includes('IFB') ||
      content.includes('RFP') ||
      this.hasRFPKeywords(content);

    return hasAustinIndicators;
  }

  /**
   * Extract opportunities from solicitation detail links
   * This is the primary method for Austin Finance portal
   */
  private extractFromDetailLinks(
    $: cheerio.CheerioAPI,
    baseUrl: string
  ): RFPOpportunity[] {
    const opportunities: RFPOpportunity[] = [];

    // Target solicitation detail links directly
    const detailLinks = $('a[href*="solicitation_details.cfm"]');
    console.log(`🔗 Austin Finance: Found ${detailLinks.length} detail links`);

    detailLinks.each((_, linkElement) => {
      const $link = $(linkElement);
      const href = $link.attr('href');

      if (!href) return;

      // Find the container element that holds this link
      const $container = this.findOpportunityContainer($link);
      let text = this.normalizeText($container.text());

      if (text.length < 10) {
        // If container is too small, try a larger parent
        text = this.normalizeText($container.parent().text());
      }

      console.log(
        `📄 Austin Finance: Processing container text (${text.length} chars): ${text.substring(0, 100)}...`
      );

      const opportunity = this.parseAustinOpportunity(text, href, baseUrl);
      if (opportunity) {
        opportunities.push(opportunity);
        console.log(
          `🎯 Austin Finance: Created opportunity: ${(opportunity as any).solicitationId || opportunity.title} - ${opportunity.title}`
        );
      }
    });

    return opportunities;
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
      const text = this.normalizeText($row.text());

      if (cells.length >= 2 && this.hasAustinSolicitationPattern(text)) {
        const opportunity = this.parseAustinOpportunity(text, '', baseUrl);
        if (opportunity) {
          // Look for links in the row
          const link = $row
            .find('a[href*="solicitation_details.cfm"]')
            .first()
            .attr('href');
          if (link) {
            opportunity.url = this.validateAndFixSourceUrl(link, baseUrl);
            opportunity.link = opportunity.url;
          }

          opportunities.push(opportunity);
          console.log(
            `✅ Austin Finance table opportunity found: ${opportunity.title}`
          );
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

    $('li, div').each((_, element) => {
      const $item = $(element);
      const text = this.normalizeText($item.text());

      if (
        this.hasAustinSolicitationPattern(text) &&
        text.length > 20 &&
        text.length < 1000
      ) {
        const opportunity = this.parseAustinOpportunity(text, '', baseUrl);
        if (opportunity) {
          // Look for links in the item
          const link = $item
            .find('a[href*="solicitation_details.cfm"]')
            .first()
            .attr('href');
          if (link) {
            opportunity.url = this.validateAndFixSourceUrl(link, baseUrl);
            opportunity.link = opportunity.url;
          }

          opportunities.push(opportunity);
          console.log(
            `✅ Austin Finance list opportunity found: ${opportunity.title}`
          );
        }
      }
    });

    return opportunities;
  }

  /**
   * Find the appropriate container element for an opportunity
   */
  private findOpportunityContainer(
    $link: cheerio.Cheerio<cheerio.Element>
  ): cheerio.Cheerio<cheerio.Element> {
    // Try different container types in order of preference
    const containerSelectors = ['tr', 'li', 'div', 'td', 'p'];

    for (const selector of containerSelectors) {
      const $container = $link.closest(selector);
      if ($container.length && $container.text().trim().length > 10) {
        return $container;
      }
    }

    // Fallback to parent
    return $link.parent();
  }

  /**
   * Normalize text by replacing NBSP and collapsing whitespace
   */
  private normalizeText(text: string): string {
    return text
      .replace(/\u00A0/g, ' ') // Replace NBSP
      .replace(/\s+/g, ' ') // Collapse whitespace
      .trim();
  }

  /**
   * Check if text contains Austin solicitation patterns
   */
  private hasAustinSolicitationPattern(text: string): boolean {
    const patterns = [
      /\b(?:IFQ|IFB|RFP|RFQS)\s*[#:.-]?\s*\d{3,5}/i,
      /\b(?:IFQ|IFB|RFP|RFQS)\s*\d+\b/i,
      /solicitation\s*[#:.-]?\s*\d+/i,
    ];

    return patterns.some(pattern => pattern.test(text));
  }

  /**
   * Parse Austin-specific opportunity from text
   */
  private parseAustinOpportunity(
    text: string,
    href: string,
    baseUrl: string
  ): RFPOpportunity | null {
    // Extract solicitation ID using tolerant patterns
    const tolerantPattern =
      /\b(?:IFQ|IFB|RFP|RFQS)\s*[#:.-]?\s*\d{3,5}(?:\s+[A-Z]{2,}\d{3,5})?\b/i;
    const fallbackPattern = /\b(?:IFQ|IFB|RFP|RFQS)\s*\d+\b/i;

    const idMatch = text.match(tolerantPattern) || text.match(fallbackPattern);

    if (!idMatch) {
      console.log(
        `⚠️ Austin Finance: No solicitation ID found in: ${text.substring(0, 50)}...`
      );
      return null;
    }

    const solicitationId = idMatch[0].trim();
    console.log(`✅ Austin Finance: Found solicitation ID: ${solicitationId}`);

    // Extract title - look for text in bold/strong or after ID
    const title = this.extractTitle(text, solicitationId);

    // Extract due date
    const dueDate = this.extractDueDate(text);

    // Extract description
    const description = this.extractDescription(
      text,
      title,
      solicitationId,
      dueDate
    );

    // Determine category
    const category = this.inferAustinCategory(solicitationId);

    if (!title) {
      console.log(
        `⚠️ Austin Finance: No title found for solicitation ${solicitationId}`
      );
      return null;
    }

    return {
      title: this.cleanText(title),
      description: description ? this.cleanText(description) : '',
      deadline: this.parseDate(dueDate),
      agency: 'City of Austin',
      url: href ? this.validateAndFixSourceUrl(href, baseUrl) : '',
      link: href ? this.validateAndFixSourceUrl(href, baseUrl) : undefined,
      category,
      confidence: 0.8,
    } as any;
  }

  /**
   * Extract title from Austin opportunity text
   */
  private extractTitle(text: string, solicitationId: string): string {
    // First, remove common prefixes that get concatenated
    const cleanedText = text
      .replace(/^view\s+details\s*/i, '')
      .replace(
        /^due\s+date:\s*\d{1,2}\/\d{1,2}\/\d{4}\s+at\s+\d{1,2}[AP]M\s*/i,
        ''
      )
      .trim();

    // Try to find title after the ID
    const afterId = cleanedText
      .substring(cleanedText.indexOf(solicitationId) + solicitationId.length)
      .trim();

    // Split on various delimiters to isolate the title
    const lines = afterId.split(/\n|due\s+date|view\s+details|deadline/i);
    let title = lines[0] ? lines[0].trim() : '';

    // Clean up common patterns more aggressively
    title = title
      .replace(/^[-:\s]+/, '') // Remove leading punctuation
      .replace(/\s+due\s+date.*$/i, '') // Remove due date suffix
      .replace(/\s+view\s+details.*$/i, '') // Remove view details suffix
      .replace(/^at\s+\d{1,2}[AP]M\s*/i, '') // Remove time prefix
      .replace(/^\d{1,2}\/\d{1,2}\/\d{4}\s+at\s+\d{1,2}[AP]M\s*/i, '') // Remove date/time prefix
      .trim();

    // If title is still empty or too short, try alternative methods
    if (!title || title.length < 5) {
      // Look for text after the date pattern but before other keywords
      const afterDatePattern = cleanedText.match(
        /\d{1,2}\/\d{1,2}\/\d{4}\s+at\s+\d{1,2}[AP]M\s+(.+?)(?:due\s+date|view\s+details|$)/i
      );

      if (afterDatePattern && afterDatePattern[1]) {
        title = afterDatePattern[1].trim();
      } else {
        // Look for text before "Due Date" or before the solicitation ID
        const beforeDueDate = cleanedText.split(/due\s+date/i)[0];
        const beforeId = beforeDueDate.substring(
          0,
          beforeDueDate.indexOf(solicitationId)
        );

        if (beforeId.trim().length > 10) {
          title = beforeId.trim();
        } else {
          // Use a portion of the description as title
          title = afterId
            .substring(0, 100)
            .replace(/[\n\r]/g, ' ')
            .trim();
        }
      }
    }

    return title;
  }

  /**
   * Extract due date from Austin opportunity text
   */
  private extractDueDate(text: string): string {
    const dueDatePattern = /(\d{1,2}\/\d{1,2}\/\d{4})/;
    const match = text.match(dueDatePattern);
    return match ? match[1] : '';
  }

  /**
   * Extract description from Austin opportunity text
   */
  private extractDescription(
    text: string,
    title: string,
    solicitationId: string,
    dueDate: string
  ): string {
    let description = text;

    // Remove various components from description
    if (title) description = description.replace(title, '');
    description = description.replace(solicitationId, '');
    if (dueDate) description = description.replace(dueDate, '');

    description = description
      .replace(/due\s+date:?/i, '')
      .replace(/view\s+details/i, '')
      .replace(/^\s*[-:\s]+/, '') // Remove leading punctuation
      .trim();

    // Limit length
    return description.substring(0, 500);
  }

  /**
   * Infer category from Austin solicitation ID
   */
  private inferAustinCategory(solicitationId: string): string {
    const type = solicitationId.substring(0, 3).toUpperCase();

    switch (type) {
      case 'IFQ':
        return 'Invitation for Quote';
      case 'IFB':
        return 'Invitation for Bid';
      case 'RFP':
        return 'Request for Proposal';
      case 'RFQ':
        return 'Request for Quote';
      default:
        return 'Solicitation';
    }
  }

  /**
   * Remove duplicates based on solicitation ID
   */
  private removeDuplicatesBySolicitationId(
    opportunities: RFPOpportunity[]
  ): RFPOpportunity[] {
    const seen = new Set<string>();
    const unique: RFPOpportunity[] = [];

    for (const opp of opportunities) {
      const key = (opp as any).solicitationId || opp.title?.toLowerCase() || '';

      if (key && !seen.has(key)) {
        seen.add(key);
        unique.push(opp);
      }
    }

    return unique;
  }

  /**
   * Get minimum confidence threshold for Austin Finance
   */
  private getMinimumConfidenceThreshold(portalContext: string): number {
    // Austin Finance has specific patterns, so we can be more selective
    return 0.6;
  }

  /**
   * Enhanced confidence scoring for Austin Finance opportunities
   */
  getConfidenceScore(opportunity: RFPOpportunity): number {
    let score = super.getConfidenceScore(opportunity);

    // Boost score for Austin-specific patterns
    const solicitationId = (opportunity as any).solicitationId;
    if (solicitationId) {
      score += 0.2;

      // Boost for specific Austin patterns
      if (solicitationId.match(/^(IFQ|IFB|RFP|RFQS)\s*\d+/i)) {
        score += 0.15;
      }
    }

    // Boost score for City of Austin agency
    if (opportunity.agency === 'City of Austin') {
      score += 0.1;
    }

    // Boost score for solicitation detail URLs
    if (
      opportunity.url &&
      opportunity.url.includes('solicitation_details.cfm')
    ) {
      score += 0.15;
    }

    // Boost score for proper category assignment
    if (
      opportunity.category &&
      [
        'Invitation for Quote',
        'Invitation for Bid',
        'Request for Proposal',
      ].includes(opportunity.category)
    ) {
      score += 0.1;
    }

    return Math.min(1.0, score);
  }
}
