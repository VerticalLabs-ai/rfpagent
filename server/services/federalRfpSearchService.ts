import axios from 'axios';

export interface FederalSearchCriteria {
  category?: string;
  location?: string;
  agency?: string;
  valueRange?: { min?: number; max?: number };
  deadline?: string;
}

export interface FederalRfpResult {
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

export class FederalRfpSearchService {
  private readonly USASPENDING_BASE_URL = 'https://api.usaspending.gov/api/v2';
  private readonly SAM_BASE_URL = 'https://api.sam.gov/opportunities/v2';

  /**
   * Search federal contracts using USAspending.gov API
   */
  async searchUSASpending(
    criteria: FederalSearchCriteria
  ): Promise<FederalRfpResult[]> {
    try {
      const searchParams = this.buildUSASpendingQuery(criteria);

      const response = await axios.post(
        `${this.USASPENDING_BASE_URL}/search/spending_by_award/`,
        {
          filters: searchParams.filters,
          fields: [
            'Award ID',
            'Recipient Name',
            'Award Amount',
            'Description',
            'Period of Performance Start Date',
            'Period of Performance Current End Date',
            'Awarding Agency',
            'Awarding Sub Agency',
            'Award Type',
          ],
          limit: 50,
          sort: 'Award Amount',
          order: 'desc',
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'RFP-Agent/1.0',
          },
          timeout: 30000,
        }
      );

      return this.parseUSASpendingResults(response.data, criteria);
    } catch (error) {
      console.error('USAspending.gov API error:', error);
      return [];
    }
  }

  /**
   * Search SAM.gov opportunities API
   */
  async searchSAMGov(
    criteria: FederalSearchCriteria
  ): Promise<FederalRfpResult[]> {
    try {
      const apiKey = process.env.SAM_GOV_API_KEY;
      if (!apiKey) {
        console.warn('SAM.gov API key not configured');
        return [];
      }

      const params = this.buildSAMQuery(criteria);

      const response = await axios.get(`${this.SAM_BASE_URL}/search`, {
        params,
        headers: {
          'X-Api-Key': apiKey,
          'User-Agent': 'RFP-Agent/1.0',
        },
        timeout: 30000,
      });

      return this.parseSAMResults(response.data, criteria);
    } catch (error) {
      console.error('SAM.gov API error:', error);
      return [];
    }
  }

  /**
   * Search FPDS.gov (Federal Procurement Data System)
   */
  async searchFPDS(
    criteria: FederalSearchCriteria
  ): Promise<FederalRfpResult[]> {
    try {
      // FPDS provides historical contract data
      const atomUrl = 'https://www.fpds.gov/ezsearch/FEEDS/ATOM';
      const params = new URLSearchParams({
        FEEDNAME: 'PUBLIC',
        VERSION: '1.4.3',
        q: this.buildFPDSQuery(criteria),
      });

      const response = await axios.get(`${atomUrl}?${params.toString()}`, {
        headers: {
          'User-Agent': 'RFP-Agent/1.0',
        },
        timeout: 30000,
      });

      return this.parseFPDSResults(response.data, criteria);
    } catch (error) {
      console.error('FPDS.gov API error:', error);
      return [];
    }
  }

  /**
   * Comprehensive federal search across all APIs
   */
  async searchFederalOpportunities(
    criteria: FederalSearchCriteria
  ): Promise<FederalRfpResult[]> {
    const results: FederalRfpResult[] = [];

    try {
      // Search multiple federal sources in parallel
      const [usaSpendingResults, samResults, fpdsResults] =
        await Promise.allSettled([
          this.searchUSASpending(criteria),
          this.searchSAMGov(criteria),
          this.searchFPDS(criteria),
        ]);

      // Collect successful results
      if (usaSpendingResults.status === 'fulfilled') {
        results.push(...usaSpendingResults.value);
      }
      if (samResults.status === 'fulfilled') {
        results.push(...samResults.value);
      }
      if (fpdsResults.status === 'fulfilled') {
        results.push(...fpdsResults.value);
      }

      // Deduplicate and sort by relevance
      return this.deduplicateAndRank(results, criteria);
    } catch (error) {
      console.error('Federal search error:', error);
      return [];
    }
  }

  private buildUSASpendingQuery(criteria: FederalSearchCriteria) {
    const filters: any = {
      award_type_codes: ['A', 'B', 'C', 'D'], // Contract types
      time_period: [
        {
          start_date: '2024-01-01',
          end_date: '2025-12-31',
        },
      ],
    };

    // Add location filter
    if (criteria.location) {
      const stateCode = this.getStateCode(criteria.location);
      if (stateCode) {
        filters.place_of_performance_locations = [
          {
            country: 'USA',
            state: stateCode,
          },
        ];
      }
    }

    // Add value range filter
    if (criteria.valueRange?.min) {
      filters.award_amounts = [
        {
          lower_bound: criteria.valueRange.min,
        },
      ];
      if (criteria.valueRange.max) {
        filters.award_amounts[0].upper_bound = criteria.valueRange.max;
      }
    }

    // Add agency filter
    if (criteria.agency) {
      filters.agencies = [
        {
          type: 'awarding',
          tier: 'toptier',
          name: criteria.agency,
        },
      ];
    }

    return { filters };
  }

  private buildSAMQuery(criteria: FederalSearchCriteria) {
    const params: any = {
      api_key: process.env.SAM_GOV_API_KEY,
      limit: 50,
      offset: 0,
      postedFrom: '01/01/2024',
      postedTo: '12/31/2025',
    };

    if (criteria.category) {
      params.keyword = criteria.category;
    }

    if (criteria.location) {
      params.state = this.getStateCode(criteria.location);
    }

    if (criteria.agency) {
      params.organizationName = criteria.agency;
    }

    return params;
  }

  private buildFPDSQuery(criteria: FederalSearchCriteria): string {
    const queryParts: string[] = [];

    if (criteria.category) {
      queryParts.push(`PRODUCT_OR_SERVICE_CODE:${criteria.category}`);
    }

    if (criteria.location) {
      const stateCode = this.getStateCode(criteria.location);
      if (stateCode) {
        queryParts.push(
          `PRINCIPAL_PLACE_OF_PERFORMANCE_STATE_CODE:${stateCode}`
        );
      }
    }

    // Add date range for recent contracts
    queryParts.push('SIGNED_DATE:[2024-01-01 TO *]');

    return queryParts.join(' AND ');
  }

  private parseUSASpendingResults(
    data: any,
    criteria: FederalSearchCriteria
  ): FederalRfpResult[] {
    if (!data?.results) return [];

    return data.results
      .map((item: any, index: number) => ({
        id: `usa_spending_${Date.now()}_${index}`,
        title: item.Description || `${item['Award Type']} Contract`,
        description: item.Description || 'Federal contract opportunity',
        agency: item['Awarding Agency'] || 'Federal Agency',
        estimatedValue: parseFloat(item['Award Amount']) || 0,
        deadline:
          item['Period of Performance Current End Date'] ||
          new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0],
        source: 'USAspending.gov',
        sourceUrl: `https://www.usaspending.gov/award/${item['Award ID']}`,
        category: criteria.category || 'Federal Contract',
        location: criteria.location || 'Various Locations',
        confidence: 0.9,
      }))
      .filter(result => result.estimatedValue > 0);
  }

  private parseSAMResults(
    data: any,
    criteria: FederalSearchCriteria
  ): FederalRfpResult[] {
    if (!data?.opportunitiesData) return [];

    return data.opportunitiesData.map((item: any, index: number) => ({
      id: `sam_gov_${Date.now()}_${index}`,
      title: item.title || 'Federal Opportunity',
      description:
        item.description || item.synopsis || 'Federal procurement opportunity',
      agency: item.organizationName || item.department || 'Federal Agency',
      estimatedValue:
        parseFloat(item.awardCeiling) || parseFloat(item.awardFloor) || 100000,
      deadline:
        item.responseDeadLine ||
        new Date(Date.now() + 45 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
      source: 'SAM.gov',
      sourceUrl: `https://sam.gov/opp/${item.noticeId}/view`,
      category: criteria.category || item.naicsCode || 'Federal Opportunity',
      location:
        item.placeOfPerformance || criteria.location || 'Various Locations',
      confidence: 0.95,
    }));
  }

  private parseFPDSResults(
    xmlData: string,
    criteria: FederalSearchCriteria
  ): FederalRfpResult[] {
    // Parse ATOM/XML feed from FPDS
    try {
      // Simple XML parsing - in production, use a proper XML parser
      const entries = xmlData.match(/<entry[^>]*>[\s\S]*?<\/entry>/gi) || [];

      return entries.slice(0, 10).map((entry, index) => {
        const title = this.extractXMLValue(entry, 'title') || 'FPDS Contract';
        const summary =
          this.extractXMLValue(entry, 'summary') || 'Historical contract data';
        const link =
          this.extractXMLValue(entry, 'link.*href="([^"]*)"') ||
          'https://fpds.gov';

        return {
          id: `fpds_${Date.now()}_${index}`,
          title,
          description: summary,
          agency: 'Federal Agency',
          estimatedValue: 50000, // FPDS doesn't always provide amounts in feed
          deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0],
          source: 'FPDS.gov',
          sourceUrl: link,
          category: criteria.category || 'Historical Contract',
          location: criteria.location || 'Various Locations',
          confidence: 0.7,
        };
      });
    } catch (error) {
      console.error('Error parsing FPDS XML:', error);
      return [];
    }
  }

  private extractXMLValue(xml: string, pattern: string): string | null {
    const match = xml.match(
      new RegExp(`<${pattern}[^>]*>([^<]*)</${pattern.split(' ')[0]}>`, 'i')
    );
    return match ? match[1].trim() : null;
  }

  private deduplicateAndRank(
    results: FederalRfpResult[],
    criteria: FederalSearchCriteria
  ): FederalRfpResult[] {
    // Remove duplicates based on title similarity
    const uniqueResults = results.filter(
      (result, index, self) =>
        index ===
        self.findIndex(
          r => this.calculateSimilarity(r.title, result.title) < 0.8
        )
    );

    // Rank by relevance to search criteria
    return uniqueResults
      .map(result => ({
        ...result,
        relevanceScore: this.calculateRelevanceScore(result, criteria),
      }))
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 20); // Limit to top 20 results
  }

  private calculateSimilarity(str1: string, str2: string): number {
    // Simple similarity calculation
    const words1 = str1.toLowerCase().split(' ');
    const words2 = str2.toLowerCase().split(' ');
    const commonWords = words1.filter(word => words2.includes(word));
    return commonWords.length / Math.max(words1.length, words2.length);
  }

  private calculateRelevanceScore(
    result: FederalRfpResult,
    criteria: FederalSearchCriteria
  ): number {
    let score = result.confidence;

    // Boost score based on criteria matches
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

    // Boost based on estimated value being in range
    if (
      criteria.valueRange?.min &&
      result.estimatedValue >= criteria.valueRange.min
    ) {
      score += 0.1;
    }

    return Math.min(score, 1.0);
  }

  private getStateCode(location: string): string | null {
    const stateCodes: { [key: string]: string } = {
      alabama: 'AL',
      alaska: 'AK',
      arizona: 'AZ',
      arkansas: 'AR',
      california: 'CA',
      colorado: 'CO',
      connecticut: 'CT',
      delaware: 'DE',
      florida: 'FL',
      georgia: 'GA',
      hawaii: 'HI',
      idaho: 'ID',
      illinois: 'IL',
      indiana: 'IN',
      iowa: 'IA',
      kansas: 'KS',
      kentucky: 'KY',
      louisiana: 'LA',
      maine: 'ME',
      maryland: 'MD',
      massachusetts: 'MA',
      michigan: 'MI',
      minnesota: 'MN',
      mississippi: 'MS',
      missouri: 'MO',
      montana: 'MT',
      nebraska: 'NE',
      nevada: 'NV',
      'new hampshire': 'NH',
      'new jersey': 'NJ',
      'new mexico': 'NM',
      'new york': 'NY',
      'north carolina': 'NC',
      'north dakota': 'ND',
      ohio: 'OH',
      oklahoma: 'OK',
      oregon: 'OR',
      pennsylvania: 'PA',
      'rhode island': 'RI',
      'south carolina': 'SC',
      'south dakota': 'SD',
      tennessee: 'TN',
      texas: 'TX',
      utah: 'UT',
      vermont: 'VT',
      virginia: 'VA',
      washington: 'WA',
      'west virginia': 'WV',
      wisconsin: 'WI',
      wyoming: 'WY',
    };

    const locationLower = location.toLowerCase();

    // Direct state name match
    if (stateCodes[locationLower]) {
      return stateCodes[locationLower];
    }

    // Check if already a state code
    if (
      location.length === 2 &&
      Object.values(stateCodes).includes(location.toUpperCase())
    ) {
      return location.toUpperCase();
    }

    // Partial matches for major cities
    const cityToState: { [key: string]: string } = {
      austin: 'TX',
      houston: 'TX',
      dallas: 'TX',
      'san antonio': 'TX',
      'new york': 'NY',
      'los angeles': 'CA',
      chicago: 'IL',
      phoenix: 'AZ',
      philadelphia: 'PA',
      'san diego': 'CA',
      'san jose': 'CA',
      'san francisco': 'CA',
      seattle: 'WA',
      denver: 'CO',
      washington: 'DC',
      boston: 'MA',
      atlanta: 'GA',
      miami: 'FL',
      orlando: 'FL',
      'las vegas': 'NV',
    };

    for (const [city, state] of Object.entries(cityToState)) {
      if (locationLower.includes(city)) {
        return state;
      }
    }

    return null;
  }
}

export const federalRfpSearchService = new FederalRfpSearchService();
