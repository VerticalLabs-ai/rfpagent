import OpenAI from 'openai';
import { z } from 'zod';
import type { IStorage } from '../../storage';
import { logger } from '../../utils/logger';
import { circuitBreakerManager } from '../../utils/circuitBreaker';
import {
  type SearchFilters,
  SearchFiltersSchema,
  COMMON_NAICS_CODES,
  SET_ASIDE_TYPES,
  US_STATES,
} from '@shared/searchTypes';

const log = logger.child({ service: 'NaturalLanguageSearch' });

/**
 * AI response schema for query parsing
 */
const AIQueryParseResponseSchema = z.object({
  filters: SearchFiltersSchema,
  explanation: z.string(),
  suggestions: z.array(z.string()).optional(),
  confidence: z.number().min(0).max(1),
});

type AIQueryParseResponse = z.infer<typeof AIQueryParseResponseSchema>;

export class NaturalLanguageSearchService {
  private openai: OpenAI;
  private circuitBreaker;

  constructor(private storage: IStorage) {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    this.circuitBreaker = circuitBreakerManager.getBreaker('nl-search', {
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 60000,
    });
  }

  /**
   * Parse a natural language query into structured search filters
   */
  async parseQuery(query: string): Promise<AIQueryParseResponse> {
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(query);

    try {
      const response = await this.circuitBreaker.execute(async () => {
        return this.openai.chat.completions.create({
          model: process.env.OPENAI_MODEL || 'gpt-4o',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.1, // Low temperature for consistent parsing
          max_tokens: 1000,
        });
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response from AI');
      }

      const parsed = JSON.parse(content);
      const validated = AIQueryParseResponseSchema.parse(parsed);

      log.info('Query parsed successfully', {
        query,
        filterCount: Object.keys(validated.filters).filter(
          k => validated.filters[k as keyof SearchFilters] !== undefined
        ).length,
        confidence: validated.confidence,
      });

      return validated;
    } catch (error) {
      log.error('Failed to parse natural language query', error as Error, {
        query,
      });

      // Return a fallback with keyword search
      return {
        filters: {
          keywords: query.split(/\s+/).filter(w => w.length > 2),
        },
        explanation: `Searching for RFPs containing: "${query}"`,
        confidence: 0.3,
      };
    }
  }

  /**
   * Search RFPs using natural language query
   */
  async search(
    query: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<{
    rfps: any[];
    totalCount: number;
    appliedFilters: SearchFilters;
    explanation: string;
    suggestions?: string[];
  }> {
    const { limit = 20, offset = 0 } = options;

    // Step 1: Parse the natural language query
    const parseResult = await this.parseQuery(query);

    // Step 2: Build database query from filters
    const rfps = await this.executeSearch(parseResult.filters, limit, offset);

    // Step 3: Get total count for pagination
    const totalCount = await this.getSearchCount(parseResult.filters);

    return {
      rfps,
      totalCount,
      appliedFilters: parseResult.filters,
      explanation: parseResult.explanation,
      suggestions: parseResult.suggestions,
    };
  }

  /**
   * Execute the search with structured filters
   */
  private async executeSearch(
    filters: SearchFilters,
    limit: number,
    offset: number
  ): Promise<any[]> {
    // Build query parameters for storage layer
    const queryParams: {
      limit: number;
      offset: number;
      status?: string;
    } = {
      limit: 500, // Fetch more to filter in memory
      offset: 0,
    };

    // Apply filters
    if (filters.statuses?.length === 1) {
      queryParams.status = filters.statuses[0];
    }

    // Get all RFPs with basic filtering
    const result = await this.storage.getAllRFPs(queryParams);
    let rfps = result.rfps;

    // Apply additional filters in memory (until we optimize with SQL)
    rfps = this.applyFiltersInMemory(rfps, filters);

    // Apply pagination after in-memory filtering
    return rfps.slice(offset, offset + limit);
  }

  /**
   * Apply filters that aren't yet supported in the database layer
   */
  private applyFiltersInMemory(rfps: any[], filters: SearchFilters): any[] {
    let filtered = [...rfps];

    // Keyword search in title and description
    if (filters.keywords?.length) {
      const keywords = filters.keywords.map(k => k.toLowerCase());
      filtered = filtered.filter(rfp => {
        const searchText =
          `${rfp.title} ${rfp.description || ''} ${rfp.agency}`.toLowerCase();
        return keywords.some(kw => searchText.includes(kw));
      });
    }

    // Title search
    if (filters.titleSearch) {
      const search = filters.titleSearch.toLowerCase();
      filtered = filtered.filter(rfp =>
        rfp.title.toLowerCase().includes(search)
      );
    }

    // Agency filter
    if (filters.agencies?.length) {
      const agencies = filters.agencies.map(a => a.toLowerCase());
      filtered = filtered.filter(rfp =>
        agencies.some(a => rfp.agency.toLowerCase().includes(a))
      );
    }

    // State filter
    if (filters.states?.length) {
      filtered = filtered.filter(
        rfp => rfp.state && filters.states!.includes(rfp.state)
      );
    }

    // NAICS code filter
    if (filters.naicsCodes?.length) {
      filtered = filtered.filter(
        rfp =>
          rfp.naicsCode &&
          filters.naicsCodes!.some(code => rfp.naicsCode.startsWith(code))
      );
    }

    // Set-aside type filter
    if (filters.setAsideTypes?.length) {
      const setAsides = filters.setAsideTypes.map(s => s.toUpperCase());
      filtered = filtered.filter(
        rfp =>
          rfp.setAsideType && setAsides.includes(rfp.setAsideType.toUpperCase())
      );
    }

    // Deadline filters
    if (filters.deadlineAfter) {
      const afterDate = new Date(filters.deadlineAfter);
      filtered = filtered.filter(
        rfp => rfp.deadline && new Date(rfp.deadline) >= afterDate
      );
    }
    if (filters.deadlineBefore) {
      const beforeDate = new Date(filters.deadlineBefore);
      filtered = filtered.filter(
        rfp => rfp.deadline && new Date(rfp.deadline) <= beforeDate
      );
    }

    // Value range filters
    if (filters.minValue !== undefined) {
      filtered = filtered.filter(
        rfp =>
          rfp.estimatedValue &&
          parseFloat(rfp.estimatedValue) >= filters.minValue!
      );
    }
    if (filters.maxValue !== undefined) {
      filtered = filtered.filter(
        rfp =>
          rfp.estimatedValue &&
          parseFloat(rfp.estimatedValue) <= filters.maxValue!
      );
    }

    // Status filter (multiple)
    if (filters.statuses?.length) {
      filtered = filtered.filter(rfp => filters.statuses!.includes(rfp.status));
    }

    return filtered;
  }

  /**
   * Get count of matching RFPs
   */
  private async getSearchCount(filters: SearchFilters): Promise<number> {
    // For now, execute search without limit to get count
    const rfps = await this.executeSearch(filters, 1000, 0);
    return rfps.length;
  }

  /**
   * Build system prompt for the AI
   */
  private buildSystemPrompt(): string {
    return `You are a government contracting RFP search assistant. Your job is to parse natural language search queries into structured filters.

## Available Filter Fields

### NAICS Codes (North American Industry Classification System)
Common codes:
${Object.entries(COMMON_NAICS_CODES)
  .map(([code, desc]) => `- ${code}: ${desc}`)
  .join('\n')}

### Set-Aside Types
${Object.entries(SET_ASIDE_TYPES)
  .map(([code, desc]) => `- ${code}: ${desc}`)
  .join('\n')}

### US States
Use 2-letter state codes: ${Object.keys(US_STATES).join(', ')}

### Date Ranges
- For "next month", "next week", calculate actual dates from today
- For "Q1 2024", use January 1 - March 31, 2024
- Today's date: ${new Date().toISOString().split('T')[0]}

### Contract Values
- Parse "$500k" as 500000, "$1M" as 1000000
- "under $500k" means maxValue: 500000
- "over $1M" means minValue: 1000000

### Contract Types
- FFP: Firm Fixed Price
- T&M: Time and Materials
- IDIQ: Indefinite Delivery/Indefinite Quantity
- BPA: Blanket Purchase Agreement

## Response Format

You MUST respond with valid JSON in this exact format:
{
  "filters": {
    "keywords": ["string array of search terms"],
    "titleSearch": "optional exact title search",
    "naicsCodes": ["541512"],
    "pscCodes": ["D302"],
    "setAsideTypes": ["SDVOSB"],
    "states": ["TX", "CA"],
    "agencies": ["Department of Defense"],
    "deadlineAfter": "2024-01-01",
    "deadlineBefore": "2024-12-31",
    "minValue": 50000,
    "maxValue": 500000,
    "statuses": ["discovered", "review"],
    "contractTypes": ["FFP", "IDIQ"]
  },
  "explanation": "Human-readable explanation of the search",
  "suggestions": ["related search 1", "related search 2"],
  "confidence": 0.85
}

Only include filter fields that are relevant to the query. Omit fields that weren't mentioned.`;
  }

  /**
   * Build user prompt for the query
   */
  private buildUserPrompt(query: string): string {
    return `Parse this RFP search query into structured filters:

"${query}"

Respond with JSON only.`;
  }
}

// Singleton instance
let naturalLanguageSearchService: NaturalLanguageSearchService | null = null;

export function getNaturalLanguageSearchService(
  storage: IStorage
): NaturalLanguageSearchService {
  if (!naturalLanguageSearchService) {
    naturalLanguageSearchService = new NaturalLanguageSearchService(storage);
  }
  return naturalLanguageSearchService;
}
