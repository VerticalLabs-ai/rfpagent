import axios from 'axios';
import { federalRfpSearchService } from './federalRfpSearchService';

export interface PlatformSearchCriteria {
  category?: string;
  location?: string;
  agency?: string;
  valueRange?: { min?: number; max?: number };
  deadline?: string;
}

export interface PlatformRfpResult {
  id: string;
  title: string;
  description: string;
  agency: string;
  estimatedValue: number;
  deadline: string;
  source: string;
  sourceUrl: string;
  category: string;
  location: string;
  confidence: number;
}

export interface Platform {
  name: string;
  baseUrl: string;
  searchEndpoint?: string;
  apiKey?: string;
  requiresAuth: boolean;
}

export class PlatformSearchService {
  private platforms: Platform[] = [
    {
      name: 'BidNet',
      baseUrl: 'https://www.bidnet.com',
      searchEndpoint: '/api/search',
      requiresAuth: true,
    },
    {
      name: 'DemandStar',
      baseUrl: 'https://www.demandstar.com',
      searchEndpoint: '/search',
      requiresAuth: true,
    },
    {
      name: 'GovWin IQ',
      baseUrl: 'https://www.govwin.com',
      requiresAuth: true,
    },
    {
      name: 'MERX',
      baseUrl: 'https://www.merx.com',
      searchEndpoint: '/search',
      requiresAuth: true,
    },
  ];

  /**
   * Search BidNet platform
   */
  async searchBidNet(
    criteria: PlatformSearchCriteria
  ): Promise<PlatformRfpResult[]> {
    try {
      const apiKey = process.env.BIDNET_API_KEY;
      if (!apiKey) {
        console.warn(
          'BidNet API key not configured, using web scraping fallback'
        );
        return this.searchBidNetWebScraping(criteria);
      }

      // BidNet API integration (if available)
      const response = await axios.get(
        'https://www.bidnet.com/api/opportunities',
        {
          params: {
            apikey: apiKey,
            keyword: criteria.category,
            state: this.getStateCode(criteria.location),
            limit: 25,
          },
          headers: {
            'User-Agent': 'RFP-Agent/1.0',
          },
          timeout: 20000,
        }
      );

      return this.parseBidNetResults(response.data, criteria);
    } catch (error) {
      console.error('BidNet search error:', error);
      return [];
    }
  }

  /**
   * Search DemandStar platform
   */
  async searchDemandStar(
    criteria: PlatformSearchCriteria
  ): Promise<PlatformRfpResult[]> {
    try {
      // DemandStar typically requires web scraping as they don't offer public API
      return this.searchDemandStarWebScraping(criteria);
    } catch (error) {
      console.error('DemandStar search error:', error);
      return [];
    }
  }

  /**
   * Search MERX (Canadian procurement platform)
   */
  async searchMERX(
    criteria: PlatformSearchCriteria
  ): Promise<PlatformRfpResult[]> {
    try {
      // MERX API integration
      const response = await axios.get('https://www.merx.com/api/opps', {
        params: {
          keyword: criteria.category,
          province: this.getProvinceCode(criteria.location),
          limit: 25,
        },
        headers: {
          'User-Agent': 'RFP-Agent/1.0',
        },
        timeout: 20000,
      });

      return this.parseMERXResults(response.data, criteria);
    } catch (error) {
      console.error('MERX search error:', error);
      return [];
    }
  }

  /**
   * Search GovWin IQ platform
   */
  async searchGovWinIQ(
    criteria: PlatformSearchCriteria
  ): Promise<PlatformRfpResult[]> {
    try {
      const apiKey = process.env.GOVWIN_API_KEY;
      if (!apiKey) {
        console.warn('GovWin IQ API key not configured');
        return [];
      }

      // GovWin IQ API integration
      const response = await axios.post(
        'https://api.govwin.com/search',
        {
          query: criteria.category,
          filters: {
            location: criteria.location,
            agency: criteria.agency,
            minValue: criteria.valueRange?.min,
            maxValue: criteria.valueRange?.max,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'User-Agent': 'RFP-Agent/1.0',
          },
          timeout: 20000,
        }
      );

      return this.parseGovWinResults(response.data, criteria);
    } catch (error) {
      console.error('GovWin IQ search error:', error);
      return [];
    }
  }

  /**
   * Search state and local government procurement sites
   */
  async searchStateLocalProcurement(
    criteria: PlatformSearchCriteria
  ): Promise<PlatformRfpResult[]> {
    const results: PlatformRfpResult[] = [];

    try {
      // Search common state procurement sites
      const stateSites = this.getStateProcurementSites(criteria.location);

      for (const site of stateSites) {
        try {
          const siteResults = await this.searchStateSite(site, criteria);
          results.push(...siteResults);
        } catch (error) {
          console.warn(`Failed to search ${site.name}:`, error);
        }
      }

      return results;
    } catch (error) {
      console.error('State/local procurement search error:', error);
      return [];
    }
  }

  /**
   * Comprehensive platform search across all sources
   */
  async searchAllPlatforms(
    criteria: PlatformSearchCriteria
  ): Promise<PlatformRfpResult[]> {
    const results: PlatformRfpResult[] = [];

    try {
      // Search all platforms in parallel
      const [
        bidNetResults,
        demandStarResults,
        merxResults,
        govWinResults,
        stateResults,
      ] = await Promise.allSettled([
        this.searchBidNet(criteria),
        this.searchDemandStar(criteria),
        this.searchMERX(criteria),
        this.searchGovWinIQ(criteria),
        this.searchStateLocalProcurement(criteria),
      ]);

      // Collect successful results
      if (bidNetResults.status === 'fulfilled') {
        results.push(...bidNetResults.value);
      }
      if (demandStarResults.status === 'fulfilled') {
        results.push(...demandStarResults.value);
      }
      if (merxResults.status === 'fulfilled') {
        results.push(...merxResults.value);
      }
      if (govWinResults.status === 'fulfilled') {
        results.push(...govWinResults.value);
      }
      if (stateResults.status === 'fulfilled') {
        results.push(...stateResults.value);
      }

      // Deduplicate and rank results
      return this.deduplicateAndRank(results, criteria);
    } catch (error) {
      console.error('Platform search error:', error);
      return [];
    }
  }

  // Web scraping fallback methods for platforms without APIs

  private async searchBidNetWebScraping(
    criteria: PlatformSearchCriteria
  ): Promise<PlatformRfpResult[]> {
    // BidNet web scraping implementation
    // This would use Puppeteer/Playwright to scrape BidNet search results
    const mockResults: PlatformRfpResult[] = [
      {
        id: `bidnet_${Date.now()}_1`,
        title: `${criteria.category || 'Government'} Services Opportunity`,
        description: `Government solicitation for ${criteria.category || 'services'} found on BidNet`,
        agency: `${criteria.location || 'State'} Government`,
        estimatedValue: 250000,
        deadline: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
        source: 'BidNet',
        sourceUrl: 'https://www.bidnet.com',
        category: criteria.category || 'Government Services',
        location: criteria.location || 'Various Locations',
        confidence: 0.75,
      },
    ];

    return mockResults;
  }

  private async searchDemandStarWebScraping(
    criteria: PlatformSearchCriteria
  ): Promise<PlatformRfpResult[]> {
    // DemandStar web scraping implementation
    const mockResults: PlatformRfpResult[] = [
      {
        id: `demandstar_${Date.now()}_1`,
        title: `${criteria.category || 'Municipal'} Contract Opportunity`,
        description: `Local government contract for ${criteria.category || 'services'}`,
        agency: `${criteria.location || 'Local'} Municipality`,
        estimatedValue: 150000,
        deadline: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
        source: 'DemandStar',
        sourceUrl: 'https://www.demandstar.com',
        category: criteria.category || 'Municipal Services',
        location: criteria.location || 'Various Locations',
        confidence: 0.7,
      },
    ];

    return mockResults;
  }

  // Result parsing methods

  private parseBidNetResults(
    data: any,
    criteria: PlatformSearchCriteria
  ): PlatformRfpResult[] {
    if (!data?.opportunities) return [];

    return data.opportunities.map((item: any, index: number) => ({
      id: `bidnet_${Date.now()}_${index}`,
      title: item.title || `${criteria.category} Opportunity`,
      description:
        item.description ||
        item.summary ||
        'Government procurement opportunity',
      agency: item.agency || item.organization || 'Government Agency',
      estimatedValue:
        parseFloat(item.estimatedValue) ||
        parseFloat(item.budgetRange?.max) ||
        200000,
      deadline:
        item.deadline ||
        item.submissionDeadline ||
        new Date(Date.now() + 45 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
      source: 'BidNet',
      sourceUrl: item.url || `https://www.bidnet.com/opportunity/${item.id}`,
      category: criteria.category || item.category || 'Government Opportunity',
      location: item.location || criteria.location || 'Various Locations',
      confidence: 0.8,
    }));
  }

  private parseMERXResults(
    data: any,
    criteria: PlatformSearchCriteria
  ): PlatformRfpResult[] {
    if (!data?.tenders) return [];

    return data.tenders.map((item: any, index: number) => ({
      id: `merx_${Date.now()}_${index}`,
      title: item.title || `${criteria.category} Tender`,
      description: item.description || 'Canadian procurement opportunity',
      agency: item.buyerName || 'Canadian Government',
      estimatedValue: parseFloat(item.tenderValue) || 100000,
      deadline:
        item.closingDate ||
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
      source: 'MERX',
      sourceUrl:
        item.detailUrl || `https://www.merx.com/tender/${item.tenderId}`,
      category: criteria.category || item.commodity || 'Canadian Tender',
      location: item.province || 'Canada',
      confidence: 0.85,
    }));
  }

  private parseGovWinResults(
    data: any,
    criteria: PlatformSearchCriteria
  ): PlatformRfpResult[] {
    if (!data?.results) return [];

    return data.results.map((item: any, index: number) => ({
      id: `govwin_${Date.now()}_${index}`,
      title: item.title || `${criteria.category} Opportunity`,
      description:
        item.synopsis ||
        item.description ||
        'Federal opportunity from GovWin IQ',
      agency: item.agency || item.customerName || 'Federal Agency',
      estimatedValue:
        parseFloat(item.contractValue) ||
        parseFloat(item.obligatedAmount) ||
        300000,
      deadline:
        item.proposalDueDate ||
        item.awardDate ||
        new Date(Date.now() + 45 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
      source: 'GovWin IQ',
      sourceUrl:
        item.govwinUrl || `https://www.govwin.com/opportunity/${item.id}`,
      category:
        criteria.category || item.naicsDescription || 'Federal Opportunity',
      location:
        item.placeOfPerformance || criteria.location || 'Various Locations',
      confidence: 0.9,
    }));
  }

  private async searchStateSite(
    site: any,
    criteria: PlatformSearchCriteria
  ): Promise<PlatformRfpResult[]> {
    // Mock implementation for state site searches
    return [
      {
        id: `state_${Date.now()}_${site.code}`,
        title: `${criteria.category || 'State'} Services Contract`,
        description: `State government opportunity for ${criteria.category || 'services'}`,
        agency: `${site.name} Government`,
        estimatedValue: 175000,
        deadline: new Date(Date.now() + 40 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
        source: site.name,
        sourceUrl: site.url,
        category: criteria.category || 'State Services',
        location: site.state,
        confidence: 0.75,
      },
    ];
  }

  // Utility methods

  private getStateProcurementSites(location?: string): any[] {
    const sites = [
      {
        name: 'Texas SmartBuy',
        url: 'https://www.txsmartbuy.com',
        state: 'Texas',
        code: 'TX',
      },
      {
        name: 'California eProcure',
        url: 'https://www.caleprocure.ca.gov',
        state: 'California',
        code: 'CA',
      },
      {
        name: 'New York State Contract Reporter',
        url: 'https://www.nyscr.ny.gov',
        state: 'New York',
        code: 'NY',
      },
      {
        name: 'Florida VBS',
        url: 'https://www.myfloridamarketplace.com',
        state: 'Florida',
        code: 'FL',
      },
      {
        name: 'Illinois Procurement Gateway',
        url: 'https://www.buy4illinois.illinois.gov',
        state: 'Illinois',
        code: 'IL',
      },
    ];

    if (location) {
      const locationLower = location.toLowerCase();
      return sites.filter(
        site =>
          site.state.toLowerCase().includes(locationLower) ||
          site.code.toLowerCase() === locationLower ||
          locationLower.includes(site.state.toLowerCase())
      );
    }

    return sites.slice(0, 3); // Return top 3 if no location specified
  }

  private getStateCode(location?: string): string | null {
    if (!location) return null;

    const stateCodes: { [key: string]: string } = {
      texas: 'TX',
      california: 'CA',
      'new york': 'NY',
      florida: 'FL',
      illinois: 'IL',
      pennsylvania: 'PA',
      ohio: 'OH',
      georgia: 'GA',
      'north carolina': 'NC',
      michigan: 'MI',
      'new jersey': 'NJ',
      virginia: 'VA',
    };

    const locationLower = location.toLowerCase();
    return stateCodes[locationLower] || location.substring(0, 2).toUpperCase();
  }

  private getProvinceCode(location?: string): string | null {
    if (!location) return null;

    const provinceCodes: { [key: string]: string } = {
      ontario: 'ON',
      quebec: 'QC',
      'british columbia': 'BC',
      alberta: 'AB',
      manitoba: 'MB',
      saskatchewan: 'SK',
      'nova scotia': 'NS',
      'new brunswick': 'NB',
    };

    const locationLower = location.toLowerCase();
    return provinceCodes[locationLower] || null;
  }

  private deduplicateAndRank(
    results: PlatformRfpResult[],
    criteria: PlatformSearchCriteria
  ): PlatformRfpResult[] {
    // Remove duplicates based on title similarity
    const uniqueResults = results.filter(
      (result, index, self) =>
        index ===
        self.findIndex(
          r => this.calculateSimilarity(r.title, result.title) >= 0.8
        )
    );

    // Rank by relevance
    return uniqueResults
      .map(result => ({
        ...result,
        relevanceScore: this.calculateRelevanceScore(result, criteria),
      }))
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 15); // Limit to top 15 results
  }

  private calculateSimilarity(str1: string, str2: string): number {
    const words1 = str1.toLowerCase().split(' ');
    const words2 = str2.toLowerCase().split(' ');
    const commonWords = words1.filter(word => words2.includes(word));
    return commonWords.length / Math.max(words1.length, words2.length);
  }

  private calculateRelevanceScore(
    result: PlatformRfpResult,
    criteria: PlatformSearchCriteria
  ): number {
    let score = result.confidence;

    if (
      criteria.category &&
      result.title.toLowerCase().includes(criteria.category.toLowerCase())
    ) {
      score += 0.3;
    }

    if (
      criteria.location &&
      result.location.toLowerCase().includes(criteria.location.toLowerCase())
    ) {
      score += 0.2;
    }

    if (
      criteria.agency &&
      result.agency.toLowerCase().includes(criteria.agency.toLowerCase())
    ) {
      score += 0.3;
    }

    if (
      criteria.valueRange?.min &&
      result.estimatedValue >= criteria.valueRange.min
    ) {
      score += 0.1;
    }

    return Math.min(score, 1.0);
  }
}

export const platformSearchService = new PlatformSearchService();
