import { BaseContentExtractor } from '../ContentExtractor';
import { RFPOpportunity } from '../../types';
import * as cheerio from 'cheerio';

/**
 * General-purpose HTML content extractor using Cheerio
 * Provides fallback extraction for unknown or generic portal types
 */
export class HTMLContentExtractor extends BaseContentExtractor {
  constructor() {
    super('html');
  }

  /**
   * Extract opportunities from HTML content using generic patterns
   */
  async extract(
    content: string,
    url: string,
    portalContext: string
  ): Promise<RFPOpportunity[]> {
    try {
      console.log(`🔍 Starting HTML content extraction for ${url}`);

      if (!this.validateContent(content)) {
        console.warn(`⚠️ Invalid content provided for HTML extraction`);
        return [];
      }

      const $ = cheerio.load(content);
      const opportunities: RFPOpportunity[] = [];

      // Multiple extraction strategies
      const semanticOpportunities = this.extractSemantic($, url);
      const tableOpportunities = this.extractFromTables($, url);
      const listOpportunities = this.extractFromLists($, url);
      const linkOpportunities = this.extractFromLinks($, url);
      const classBasedOpportunities = this.extractFromClasses($, url);

      opportunities.push(
        ...semanticOpportunities,
        ...tableOpportunities,
        ...listOpportunities,
        ...linkOpportunities,
        ...classBasedOpportunities
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
        `🔍 HTML extraction completed: ${opportunities.length} found, ${filteredOpportunities.length} above confidence threshold`
      );

      return this.removeDuplicates(filteredOpportunities);
    } catch (error) {
      console.error(`❌ HTML content extraction failed for ${url}:`, error);
      return [];
    }
  }

  /**
   * Enhanced content validation for HTML
   */
  validateContent(content: string): boolean {
    if (!super.validateContent(content)) {
      return false;
    }

    // Check for valid HTML structure
    const hasHtmlStructure = /<[^>]+>/.test(content);
    const hasSubstantialContent = content.length >= 500;

    return hasHtmlStructure || hasSubstantialContent;
  }

  /**
   * Extract using semantic HTML patterns
   */
  private extractSemantic(
    $: cheerio.CheerioAPI,
    baseUrl: string
  ): RFPOpportunity[] {
    const opportunities: RFPOpportunity[] = [];

    // Look for semantic structures
    $('article, section, main').each((_, element) => {
      const $section = $(element);
      const text = this.cleanText($section.text());

      if (this.hasRFPKeywords(text) && text.length > 50) {
        const opportunity = this.extractOpportunityFromElement(
          $section,
          baseUrl,
          'semantic'
        );
        if (opportunity) {
          opportunities.push(opportunity);
          console.log(
            `✅ HTML semantic opportunity found: ${opportunity.title}`
          );
        }
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

    $('table').each((_, table) => {
      const $table = $(table);
      const headers = this.extractTableHeaders($table, $);

      $table.find('tbody tr, tr').each((index, row) => {
        if (index === 0 && headers.length > 0) return; // Skip header row

        const $row = $(row);
        const cells = $row.find('td, th');

        if (cells.length >= 2) {
          const opportunity = this.extractOpportunityFromTableRow(
            $row,
            headers,
            baseUrl,
            $
          );
          if (opportunity) {
            opportunities.push(opportunity);
            console.log(
              `✅ HTML table opportunity found: ${opportunity.title}`
            );
          }
        }
      });
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

    $('ul, ol').each((_, list) => {
      const $list = $(list);

      $list.find('li').each((_, item) => {
        const $item = $(item);
        const text = this.cleanText($item.text());

        if (this.hasRFPKeywords(text) && text.length > 30) {
          const opportunity = this.extractOpportunityFromElement(
            $item,
            baseUrl,
            'list'
          );
          if (opportunity && !this.isDuplicate(opportunity, opportunities)) {
            opportunities.push(opportunity);
            console.log(`✅ HTML list opportunity found: ${opportunity.title}`);
          }
        }
      });
    });

    return opportunities;
  }

  /**
   * Extract opportunities by following links with RFP-related patterns
   */
  private extractFromLinks(
    $: cheerio.CheerioAPI,
    baseUrl: string
  ): RFPOpportunity[] {
    const opportunities: RFPOpportunity[] = [];

    // Target links with RFP-related text or URLs
    $('a').each((_, link) => {
      const $link = $(link);
      const href = $link.attr('href');
      const linkText = this.cleanText($link.text());
      const parentText = this.cleanText($link.parent().text());

      if (!href || href.startsWith('#') || href.startsWith('javascript:'))
        return;

      const combinedText = `${linkText} ${parentText}`;

      if (this.hasRFPKeywords(combinedText) || this.isRFPUrl(href)) {
        const opportunity = this.createOpportunityFromLink(
          $link,
          href,
          baseUrl
        );
        if (opportunity && !this.isDuplicate(opportunity, opportunities)) {
          opportunities.push(opportunity);
          console.log(`✅ HTML link opportunity found: ${opportunity.title}`);
        }
      }
    });

    return opportunities;
  }

  /**
   * Extract opportunities based on CSS classes
   */
  private extractFromClasses(
    $: cheerio.CheerioAPI,
    baseUrl: string
  ): RFPOpportunity[] {
    const opportunities: RFPOpportunity[] = [];

    // Common class patterns for opportunities
    const classSelectors = [
      '.opportunity',
      '.rfp',
      '.bid',
      '.procurement',
      '.solicitation',
      '.tender',
      '.contract',
      '.quote',
      '.proposal',
      '[class*="opportunity"]',
      '[class*="rfp"]',
      '[class*="bid"]',
      '[class*="procurement"]',
      '[class*="solicitation"]',
      '[class*="tender"]',
      '[class*="contract"]',
    ];

    classSelectors.forEach(selector => {
      $(selector).each((_, element) => {
        const $element = $(element);
        const text = this.cleanText($element.text());

        if (text.length > 30) {
          const opportunity = this.extractOpportunityFromElement(
            $element,
            baseUrl,
            'class'
          );
          if (opportunity && !this.isDuplicate(opportunity, opportunities)) {
            opportunities.push(opportunity);
            console.log(
              `✅ HTML class-based opportunity found: ${opportunity.title}`
            );
          }
        }
      });
    });

    return opportunities;
  }

  /**
   * Extract table headers for better column mapping
   */
  private extractTableHeaders(
    $table: cheerio.Cheerio<cheerio.Element>,
    $: cheerio.CheerioAPI
  ): string[] {
    const headers: string[] = [];

    $table
      .find('thead th, tr:first-child th, tr:first-child td')
      .each((_, header) => {
        const headerText = this.cleanText($(header).text()).toLowerCase();
        headers.push(headerText);
      });

    return headers;
  }

  /**
   * Extract opportunity from table row with header mapping
   */
  private extractOpportunityFromTableRow(
    $row: cheerio.Cheerio<cheerio.Element>,
    headers: string[],
    baseUrl: string,
    $: cheerio.CheerioAPI
  ): RFPOpportunity | null {
    const cells = $row.find('td, th');
    const rowText = this.cleanText($row.text());

    if (!this.hasRFPKeywords(rowText) && rowText.length < 20) {
      return null;
    }

    let title = '';
    let description = '';
    let agency = '';
    let deadline = '';
    let link = '';

    // Map cells to fields based on headers
    cells.each((index, cell) => {
      const $cell = $(cell);
      const cellText = this.cleanText($cell.text());
      const cellLink = $cell.find('a').first().attr('href');
      const headerText = headers[index] || '';

      // Determine field based on header text or content
      if (
        this.isHeaderMatch(headerText, [
          'title',
          'name',
          'opportunity',
          'subject',
          'description',
        ])
      ) {
        title = title || cellText;
      } else if (
        this.isHeaderMatch(headerText, ['description', 'details', 'summary'])
      ) {
        description = description || cellText;
      } else if (
        this.isHeaderMatch(headerText, [
          'agency',
          'department',
          'organization',
          'entity',
        ])
      ) {
        agency = agency || cellText;
      } else if (
        this.isHeaderMatch(headerText, [
          'deadline',
          'due',
          'date',
          'closes',
          'expir',
        ])
      ) {
        deadline = deadline || cellText;
      }

      // Look for links
      if (cellLink && !link) {
        link = cellLink;
      }

      // If no header match, use heuristics
      if (!title && cellText.length > 10 && cellText.length < 200) {
        title = cellText;
      }
    });

    // Use first cell as title if no title found
    if (!title && cells.length > 0) {
      title = this.cleanText(cells.eq(0).text());
    }

    if (!title || title.length < 5) {
      return null;
    }

    return {
      title,
      description: description || '',
      agency: agency || undefined,
      deadline: this.parseDate(deadline),
      url: this.validateAndFixSourceUrl(link, baseUrl) || '',
      link: this.validateAndFixSourceUrl(link, baseUrl),
      category: this.inferCategoryFromText(title + ' ' + description),
      confidence: 0.5,
    };
  }

  /**
   * Extract opportunity from a generic element
   */
  private extractOpportunityFromElement(
    $element: cheerio.Cheerio<cheerio.Element>,
    baseUrl: string,
    source: string
  ): RFPOpportunity | null {
    const text = this.cleanText($element.text());

    if (!this.hasRFPKeywords(text) || text.length < 30) {
      return null;
    }

    // Extract title from headings or strong text
    let title = $element.find('h1, h2, h3, h4, h5, h6').first().text().trim();
    if (!title) {
      title = $element
        .find('strong, b, .title, [class*="title"]')
        .first()
        .text()
        .trim();
    }
    if (!title) {
      title = text.substring(0, 100).replace(/\n.*$/, '').trim();
    }

    // Extract description
    let description = $element
      .find('p, .description, [class*="description"]')
      .first()
      .text()
      .trim();
    if (!description || description === title) {
      description = text.length > 200 ? text.substring(0, 200) + '...' : text;
    }

    // Extract link
    const link = $element.find('a').first().attr('href');

    // Extract other fields using patterns
    const deadline = this.extractDateFromText(text);
    const agency = this.extractAgencyFromText(text);

    if (!title || title.length < 5) {
      return null;
    }

    return {
      title: this.cleanText(title),
      description: description ? this.cleanText(description) : '',
      agency: agency || undefined,
      deadline: this.parseDate(deadline),
      url: this.validateAndFixSourceUrl(link, baseUrl) || '',
      link: this.validateAndFixSourceUrl(link, baseUrl),
      category: this.inferCategoryFromText(title + ' ' + description),
      confidence: source === 'semantic' ? 0.7 : source === 'class' ? 0.6 : 0.5,
    };
  }

  /**
   * Create opportunity from link element
   */
  private createOpportunityFromLink(
    $link: cheerio.Cheerio<cheerio.Element>,
    href: string,
    baseUrl: string
  ): RFPOpportunity | null {
    const linkText = this.cleanText($link.text());
    const parentText = this.cleanText($link.parent().text());
    const containerText = this.cleanText(
      $link.closest('div, li, td, section').text()
    );

    const title =
      linkText.length > 10 ? linkText : parentText.substring(0, 100);
    const description =
      containerText.length > linkText.length ? containerText : parentText;

    if (!title || title.length < 5) {
      return null;
    }

    return {
      title,
      description: description !== title ? description : '',
      url: this.validateAndFixSourceUrl(href, baseUrl) || '',
      link: this.validateAndFixSourceUrl(href, baseUrl),
      category: this.inferCategoryFromText(title + ' ' + description),
      confidence: 0.4,
    };
  }

  /**
   * Check if header text matches any of the given patterns
   */
  private isHeaderMatch(headerText: string, patterns: string[]): boolean {
    return patterns.some(pattern => headerText.includes(pattern));
  }

  /**
   * Check if URL indicates RFP content
   */
  private isRFPUrl(url: string): boolean {
    const rfpPatterns = [
      'rfp',
      'bid',
      'procurement',
      'solicitation',
      'tender',
      'opportunity',
      'contract',
      'proposal',
      'quote',
    ];

    const lowerUrl = url.toLowerCase();
    return rfpPatterns.some(pattern => lowerUrl.includes(pattern));
  }

  /**
   * Extract date from text using various patterns
   */
  private extractDateFromText(text: string): string {
    const datePatterns = [
      /(\d{1,2}\/\d{1,2}\/\d{2,4})/,
      /(\d{1,2}-\d{1,2}-\d{2,4})/,
      /(\w+\s+\d{1,2},?\s+\d{4})/,
      /(\d{1,2}\s+\w+\s+\d{4})/,
    ];

    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return '';
  }

  /**
   * Extract agency from text using patterns
   */
  private extractAgencyFromText(text: string): string {
    const agencyPatterns = [
      /(?:agency|department|office|bureau|administration|commission)[:\s]+([^.\n]+)/i,
      /(?:city|county|state|federal)\s+of\s+([^.\n]+)/i,
      /([^.\n]*(?:city|county|state|department|agency|office)[^.\n]*)/i,
    ];

    for (const pattern of agencyPatterns) {
      const match = text.match(pattern);
      if (match && match[1] && match[1].length < 100) {
        return match[1].trim();
      }
    }

    return '';
  }

  /**
   * Infer category from text content
   */
  private inferCategoryFromText(text: string): string | undefined {
    const lowerText = text.toLowerCase();

    if (lowerText.includes('rfp') || lowerText.includes('request for proposal'))
      return 'Request for Proposal';
    if (lowerText.includes('ifb') || lowerText.includes('invitation for bid'))
      return 'Invitation for Bid';
    if (lowerText.includes('rfq') || lowerText.includes('request for quote'))
      return 'Request for Quote';
    if (
      lowerText.includes('rfi') ||
      lowerText.includes('request for information')
    )
      return 'Request for Information';
    if (lowerText.includes('solicitation')) return 'Solicitation';
    if (lowerText.includes('procurement')) return 'Procurement';
    if (lowerText.includes('tender')) return 'Tender';
    if (lowerText.includes('contract')) return 'Contract';

    return undefined;
  }

  /**
   * Check if opportunity is duplicate
   */
  private isDuplicate(
    opportunity: RFPOpportunity,
    opportunities: RFPOpportunity[]
  ): boolean {
    return opportunities.some(
      existing =>
        existing.title?.toLowerCase() === opportunity.title?.toLowerCase() ||
        (existing.url && opportunity.url && existing.url === opportunity.url)
    );
  }

  /**
   * Get minimum confidence threshold for HTML extraction
   */
  private getMinimumConfidenceThreshold(portalContext: string): number {
    // HTML extraction is less specific, so use lower threshold
    return 0.3;
  }

  /**
   * Enhanced confidence scoring for HTML opportunities
   */
  getConfidenceScore(opportunity: RFPOpportunity): number {
    let score = super.getConfidenceScore(opportunity);

    // Boost score for semantic HTML structures
    if (opportunity.confidence === 0.7) {
      score += 0.1;
    }

    // Boost score for class-based extraction
    if (opportunity.confidence === 0.6) {
      score += 0.05;
    }

    // Boost score for structured data (agency, deadline, etc.)
    if (opportunity.agency && opportunity.deadline) {
      score += 0.15;
    }

    // Boost score for proper URLs
    if (opportunity.url && this.isRFPUrl(opportunity.url)) {
      score += 0.1;
    }

    return Math.min(1.0, score);
  }
}
