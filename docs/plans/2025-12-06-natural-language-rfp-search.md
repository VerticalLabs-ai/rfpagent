# Natural Language RFP Search Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable users to search RFPs using natural language queries like "Construction contracts in Texas" or "SDVOSB set-aside IT services due next month", with AI parsing queries into structured filters.

**Architecture:** Create a NaturalLanguageSearchService that uses OpenAI to parse natural language queries into structured filter objects (NAICS, PSC, set-aside type, location, agency, date range). The frontend will have a prominent search bar that sends queries to a new API endpoint, which returns filtered RFPs along with an explanation of applied filters.

**Tech Stack:** TypeScript, OpenAI GPT-4, Zod schemas, Express, React, TanStack Query, Drizzle ORM

---

## Schema Enhancement

Before implementing search, we need to add government contracting classification fields to the RFP schema.

---

### Task 1: Add Government Contracting Fields to RFP Schema

**Files:**
- Modify: `shared/schema.ts:71-118` (rfps table definition)

**Step 1: Add new classification fields to the rfps table**

Add after line 90 (after `category` field):

```typescript
  // Government contracting classification
  naicsCode: varchar('naics_code', { length: 6 }),        // 6-digit NAICS code
  naicsDescription: text('naics_description'),            // Human-readable NAICS description
  pscCode: varchar('psc_code', { length: 8 }),            // Product/Service Code
  pscDescription: text('psc_description'),                // Human-readable PSC description
  setAsideType: text('set_aside_type'),                   // SDVOSB, 8(a), HUBZone, WOSB, etc.
  placeOfPerformance: text('place_of_performance'),       // City, State or region
  state: varchar('state', { length: 2 }),                 // 2-letter state code
  contractType: text('contract_type'),                    // FFP, T&M, IDIQ, BPA, etc.
  solicitationNumber: varchar('solicitation_number', { length: 50 }),  // Official solicitation ID
```

**Step 2: Run type-check**

Run: `pnpm run type-check`
Expected: No errors

**Step 3: Generate migration**

Run: `pnpm drizzle-kit generate`
Expected: Migration file created in `migrations/`

**Step 4: Commit**

```bash
git add shared/schema.ts migrations/
git commit -m "$(cat <<'EOF'
feat(schema): add government contracting classification fields

Adds NAICS code, PSC code, set-aside type, place of performance,
state, contract type, and solicitation number fields to support
natural language search filtering.
EOF
)"
```

---

### Task 2: Create Search Filter Schema Types

**Files:**
- Create: `shared/searchTypes.ts`

**Step 1: Create the search filter types file**

```typescript
import { z } from 'zod';

/**
 * Structured search filters extracted from natural language queries
 */
export const SearchFiltersSchema = z.object({
  // Text search
  keywords: z.array(z.string()).optional(),
  titleSearch: z.string().optional(),

  // Government classification
  naicsCodes: z.array(z.string()).optional(),       // e.g., ["541512", "541511"]
  pscCodes: z.array(z.string()).optional(),         // e.g., ["D302", "D306"]
  setAsideTypes: z.array(z.string()).optional(),    // e.g., ["SDVOSB", "8(a)"]

  // Location
  states: z.array(z.string()).optional(),           // e.g., ["TX", "CA"]
  placeOfPerformance: z.string().optional(),        // e.g., "Austin, TX"

  // Agency
  agencies: z.array(z.string()).optional(),         // e.g., ["Department of Defense"]

  // Timeline
  deadlineAfter: z.string().optional(),             // ISO date string
  deadlineBefore: z.string().optional(),            // ISO date string
  postedAfter: z.string().optional(),               // ISO date string

  // Financial
  minValue: z.number().optional(),                  // Minimum contract value
  maxValue: z.number().optional(),                  // Maximum contract value

  // Status
  statuses: z.array(z.string()).optional(),         // RFP workflow statuses

  // Contract type
  contractTypes: z.array(z.string()).optional(),    // FFP, T&M, IDIQ, etc.
});

export type SearchFilters = z.infer<typeof SearchFiltersSchema>;

/**
 * Natural language search request
 */
export const NaturalLanguageSearchRequestSchema = z.object({
  query: z.string().min(3, 'Query must be at least 3 characters'),
  conversationId: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

export type NaturalLanguageSearchRequest = z.infer<typeof NaturalLanguageSearchRequestSchema>;

/**
 * Natural language search response
 */
export const NaturalLanguageSearchResponseSchema = z.object({
  rfps: z.array(z.any()), // Will be typed as RFP[]
  totalCount: z.number(),
  appliedFilters: SearchFiltersSchema,
  explanation: z.string(),
  suggestions: z.array(z.string()).optional(), // Related search suggestions
  conversationId: z.string().optional(),
});

export type NaturalLanguageSearchResponse = z.infer<typeof NaturalLanguageSearchResponseSchema>;

/**
 * Common NAICS codes for government contracting
 */
export const COMMON_NAICS_CODES: Record<string, string> = {
  '541512': 'Computer Systems Design Services',
  '541511': 'Custom Computer Programming Services',
  '541513': 'Computer Facilities Management Services',
  '541519': 'Other Computer Related Services',
  '541330': 'Engineering Services',
  '541611': 'Administrative Management Consulting',
  '541618': 'Other Management Consulting Services',
  '561210': 'Facilities Support Services',
  '561320': 'Temporary Help Services',
  '236220': 'Commercial and Institutional Building Construction',
  '237310': 'Highway, Street, and Bridge Construction',
  '238210': 'Electrical Contractors',
  '622110': 'General Medical and Surgical Hospitals',
  '621111': 'Offices of Physicians',
  '611430': 'Professional and Management Development Training',
};

/**
 * Common set-aside types
 */
export const SET_ASIDE_TYPES: Record<string, string> = {
  'SDVOSB': 'Service-Disabled Veteran-Owned Small Business',
  'VOSB': 'Veteran-Owned Small Business',
  '8(a)': '8(a) Business Development Program',
  'HUBZone': 'Historically Underutilized Business Zone',
  'WOSB': 'Women-Owned Small Business',
  'EDWOSB': 'Economically Disadvantaged Women-Owned Small Business',
  'SDB': 'Small Disadvantaged Business',
  'SB': 'Small Business Set-Aside',
  'TOTAL_SB': 'Total Small Business',
  'UNRESTRICTED': 'Full and Open Competition',
};

/**
 * US State codes
 */
export const US_STATES: Record<string, string> = {
  'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas',
  'CA': 'California', 'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware',
  'FL': 'Florida', 'GA': 'Georgia', 'HI': 'Hawaii', 'ID': 'Idaho',
  'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa', 'KS': 'Kansas',
  'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
  'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi',
  'MO': 'Missouri', 'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada',
  'NH': 'New Hampshire', 'NJ': 'New Jersey', 'NM': 'New Mexico', 'NY': 'New York',
  'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio', 'OK': 'Oklahoma',
  'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
  'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah',
  'VT': 'Vermont', 'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia',
  'WI': 'Wisconsin', 'WY': 'Wyoming', 'DC': 'District of Columbia',
};
```

**Step 2: Run type-check**

Run: `pnpm run type-check`
Expected: No errors

**Step 3: Commit**

```bash
git add shared/searchTypes.ts
git commit -m "$(cat <<'EOF'
feat(types): add natural language search filter types

Adds Zod schemas for search filters including NAICS codes, PSC codes,
set-aside types, location, agency, date ranges, and contract values.
Includes reference data for common classifications.
EOF
)"
```

---

### Task 3: Create Natural Language Search Service

**Files:**
- Create: `server/services/search/naturalLanguageSearchService.ts`

**Step 1: Create the natural language search service**

```typescript
import OpenAI from 'openai';
import { z } from 'zod';
import { IStorage } from '../../storage';
import { logger } from '../../utils/logger';
import { circuitBreakerManager } from '../../utils/circuitBreaker';
import {
  SearchFilters,
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
      timeout: 60000,
      requestTimeout: 30000,
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
        filterCount: Object.keys(validated.filters).filter(k => validated.filters[k as keyof SearchFilters] !== undefined).length,
        confidence: validated.confidence,
      });

      return validated;
    } catch (error) {
      log.error('Failed to parse natural language query', error as Error, { query });

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
    const queryParams: any = {
      limit,
      offset,
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

    return rfps;
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
        const searchText = `${rfp.title} ${rfp.description || ''} ${rfp.agency}`.toLowerCase();
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
      filtered = filtered.filter(rfp =>
        rfp.state && filters.states!.includes(rfp.state)
      );
    }

    // NAICS code filter
    if (filters.naicsCodes?.length) {
      filtered = filtered.filter(rfp =>
        rfp.naicsCode && filters.naicsCodes!.some(code =>
          rfp.naicsCode.startsWith(code)
        )
      );
    }

    // Set-aside type filter
    if (filters.setAsideTypes?.length) {
      const setAsides = filters.setAsideTypes.map(s => s.toUpperCase());
      filtered = filtered.filter(rfp =>
        rfp.setAsideType && setAsides.includes(rfp.setAsideType.toUpperCase())
      );
    }

    // Deadline filters
    if (filters.deadlineAfter) {
      const afterDate = new Date(filters.deadlineAfter);
      filtered = filtered.filter(rfp =>
        rfp.deadline && new Date(rfp.deadline) >= afterDate
      );
    }
    if (filters.deadlineBefore) {
      const beforeDate = new Date(filters.deadlineBefore);
      filtered = filtered.filter(rfp =>
        rfp.deadline && new Date(rfp.deadline) <= beforeDate
      );
    }

    // Value range filters
    if (filters.minValue !== undefined) {
      filtered = filtered.filter(rfp =>
        rfp.estimatedValue && parseFloat(rfp.estimatedValue) >= filters.minValue!
      );
    }
    if (filters.maxValue !== undefined) {
      filtered = filtered.filter(rfp =>
        rfp.estimatedValue && parseFloat(rfp.estimatedValue) <= filters.maxValue!
      );
    }

    // Status filter (multiple)
    if (filters.statuses?.length) {
      filtered = filtered.filter(rfp =>
        filters.statuses!.includes(rfp.status)
      );
    }

    return filtered;
  }

  /**
   * Get count of matching RFPs
   */
  private async getSearchCount(filters: SearchFilters): Promise<number> {
    // For now, execute search without limit to get count
    // TODO: Optimize with COUNT query
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
${Object.entries(COMMON_NAICS_CODES).map(([code, desc]) => `- ${code}: ${desc}`).join('\n')}

### Set-Aside Types
${Object.entries(SET_ASIDE_TYPES).map(([code, desc]) => `- ${code}: ${desc}`).join('\n')}

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

export function getNaturalLanguageSearchService(storage: IStorage): NaturalLanguageSearchService {
  if (!naturalLanguageSearchService) {
    naturalLanguageSearchService = new NaturalLanguageSearchService(storage);
  }
  return naturalLanguageSearchService;
}
```

**Step 2: Run type-check**

Run: `pnpm run type-check`
Expected: No errors

**Step 3: Commit**

```bash
git add server/services/search/naturalLanguageSearchService.ts
git commit -m "$(cat <<'EOF'
feat(search): add natural language search service

Implements NaturalLanguageSearchService that uses OpenAI to parse
natural language queries into structured filters (NAICS, PSC,
set-aside type, location, agency, dates, values). Includes
circuit breaker protection and fallback to keyword search.
EOF
)"
```

---

### Task 4: Add Natural Language Search API Endpoint

**Files:**
- Modify: `server/routes/rfps.routes.ts`

**Step 1: Add the natural language search endpoint**

Add after the existing routes (before the export):

```typescript
import { getNaturalLanguageSearchService } from '../services/search/naturalLanguageSearchService';
import { NaturalLanguageSearchRequestSchema } from '@shared/searchTypes';

/**
 * Natural language search for RFPs
 * POST /api/rfps/search/natural
 */
router.post('/search/natural', async (req, res) => {
  try {
    const validated = NaturalLanguageSearchRequestSchema.parse(req.body);

    const searchService = getNaturalLanguageSearchService(storage);
    const result = await searchService.search(validated.query, {
      limit: validated.limit,
      offset: validated.offset,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        details: error.errors,
      });
    }

    console.error('Natural language search error:', error);
    res.status(500).json({
      success: false,
      error: 'Search failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Parse query without executing search (for preview)
 * POST /api/rfps/search/parse
 */
router.post('/search/parse', async (req, res) => {
  try {
    const { query } = z.object({ query: z.string().min(3) }).parse(req.body);

    const searchService = getNaturalLanguageSearchService(storage);
    const parseResult = await searchService.parseQuery(query);

    res.json({
      success: true,
      data: parseResult,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        details: error.errors,
      });
    }

    console.error('Query parse error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to parse query',
    });
  }
});
```

**Step 2: Add the import for z at the top of the file if not present**

```typescript
import { z } from 'zod';
```

**Step 3: Run type-check**

Run: `pnpm run type-check`
Expected: No errors

**Step 4: Commit**

```bash
git add server/routes/rfps.routes.ts
git commit -m "$(cat <<'EOF'
feat(api): add natural language search endpoints

Adds POST /api/rfps/search/natural for AI-powered RFP search
and POST /api/rfps/search/parse for query parsing preview.
Both endpoints use the NaturalLanguageSearchService.
EOF
)"
```

---

### Task 5: Create Search Bar Component

**Files:**
- Create: `client/src/components/search/NaturalLanguageSearchBar.tsx`

**Step 1: Create the search bar component**

```typescript
import { useState, useCallback, useRef, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Search,
  Sparkles,
  X,
  Loader2,
  Filter,
  Calendar,
  DollarSign,
  MapPin,
  Building2,
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { cn } from '@/lib/utils';

interface SearchFilters {
  keywords?: string[];
  naicsCodes?: string[];
  setAsideTypes?: string[];
  states?: string[];
  agencies?: string[];
  deadlineAfter?: string;
  deadlineBefore?: string;
  minValue?: number;
  maxValue?: number;
}

interface ParseResult {
  filters: SearchFilters;
  explanation: string;
  suggestions?: string[];
  confidence: number;
}

interface SearchResult {
  rfps: any[];
  totalCount: number;
  appliedFilters: SearchFilters;
  explanation: string;
  suggestions?: string[];
}

interface NaturalLanguageSearchBarProps {
  onSearchResults: (results: SearchResult | null) => void;
  onClear: () => void;
  className?: string;
  placeholder?: string;
}

export function NaturalLanguageSearchBar({
  onSearchResults,
  onClear,
  className,
  placeholder = 'Search RFPs... Try "IT contracts in Texas" or "SDVOSB construction opportunities"',
}: NaturalLanguageSearchBarProps) {
  const [query, setQuery] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  // Mutation for parsing query (preview)
  const parseMutation = useMutation({
    mutationFn: async (q: string) => {
      const response = await apiRequest('POST', '/api/rfps/search/parse', { query: q });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        setParseResult(data.data);
        setShowPreview(true);
      }
    },
  });

  // Mutation for executing search
  const searchMutation = useMutation({
    mutationFn: async (q: string) => {
      const response = await apiRequest('POST', '/api/rfps/search/natural', {
        query: q,
        limit: 50,
        offset: 0,
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        onSearchResults(data.data);
        setShowPreview(false);
      }
    },
  });

  // Debounced parse on typing
  const handleQueryChange = useCallback((value: string) => {
    setQuery(value);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (value.length >= 5) {
      debounceRef.current = setTimeout(() => {
        parseMutation.mutate(value);
      }, 500);
    } else {
      setShowPreview(false);
      setParseResult(null);
    }
  }, []);

  // Handle search submission
  const handleSearch = useCallback(() => {
    if (query.length >= 3) {
      searchMutation.mutate(query);
    }
  }, [query]);

  // Handle keyboard events
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
    if (e.key === 'Escape') {
      setShowPreview(false);
    }
  }, [handleSearch]);

  // Clear search
  const handleClear = useCallback(() => {
    setQuery('');
    setShowPreview(false);
    setParseResult(null);
    onClear();
    inputRef.current?.focus();
  }, [onClear]);

  // Click outside to close preview
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target as Element).closest('.search-container')) {
        setShowPreview(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const isLoading = parseMutation.isPending || searchMutation.isPending;

  return (
    <div className={cn('search-container relative', className)}>
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-purple-500" />
          <Search className="h-4 w-4 text-muted-foreground" />
        </div>
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => query.length >= 5 && parseResult && setShowPreview(true)}
          placeholder={placeholder}
          className="pl-14 pr-24 h-12 text-base"
          data-testid="nl-search-input"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {query && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleClear}
              data-testid="nl-search-clear"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
          <Button
            onClick={handleSearch}
            disabled={query.length < 3 || isLoading}
            size="sm"
            className="h-8"
            data-testid="nl-search-button"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Search'
            )}
          </Button>
        </div>
      </div>

      {/* Parse Preview Dropdown */}
      {showPreview && parseResult && (
        <Card className="absolute top-full left-0 right-0 mt-2 z-50 shadow-lg">
          <CardContent className="p-4">
            {/* Explanation */}
            <p className="text-sm text-muted-foreground mb-3">
              {parseResult.explanation}
            </p>

            {/* Applied Filters Preview */}
            <div className="flex flex-wrap gap-2 mb-3">
              {parseResult.filters.keywords?.map((kw) => (
                <Badge key={kw} variant="secondary">
                  <Search className="h-3 w-3 mr-1" />
                  {kw}
                </Badge>
              ))}
              {parseResult.filters.states?.map((state) => (
                <Badge key={state} variant="outline" className="bg-blue-50 dark:bg-blue-950">
                  <MapPin className="h-3 w-3 mr-1" />
                  {state}
                </Badge>
              ))}
              {parseResult.filters.setAsideTypes?.map((type) => (
                <Badge key={type} variant="outline" className="bg-green-50 dark:bg-green-950">
                  <Building2 className="h-3 w-3 mr-1" />
                  {type}
                </Badge>
              ))}
              {parseResult.filters.naicsCodes?.map((code) => (
                <Badge key={code} variant="outline" className="bg-purple-50 dark:bg-purple-950">
                  <Filter className="h-3 w-3 mr-1" />
                  NAICS {code}
                </Badge>
              ))}
              {(parseResult.filters.deadlineAfter || parseResult.filters.deadlineBefore) && (
                <Badge variant="outline" className="bg-orange-50 dark:bg-orange-950">
                  <Calendar className="h-3 w-3 mr-1" />
                  {parseResult.filters.deadlineAfter && `After ${parseResult.filters.deadlineAfter}`}
                  {parseResult.filters.deadlineAfter && parseResult.filters.deadlineBefore && ' - '}
                  {parseResult.filters.deadlineBefore && `Before ${parseResult.filters.deadlineBefore}`}
                </Badge>
              )}
              {(parseResult.filters.minValue !== undefined || parseResult.filters.maxValue !== undefined) && (
                <Badge variant="outline" className="bg-yellow-50 dark:bg-yellow-950">
                  <DollarSign className="h-3 w-3 mr-1" />
                  {parseResult.filters.minValue !== undefined && `$${(parseResult.filters.minValue / 1000).toFixed(0)}k`}
                  {parseResult.filters.minValue !== undefined && parseResult.filters.maxValue !== undefined && ' - '}
                  {parseResult.filters.maxValue !== undefined && `$${(parseResult.filters.maxValue / 1000).toFixed(0)}k`}
                </Badge>
              )}
            </div>

            {/* Confidence indicator */}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Confidence: {Math.round(parseResult.confidence * 100)}%
              </span>
              <Button
                size="sm"
                variant="default"
                onClick={handleSearch}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Search className="h-4 w-4 mr-2" />
                )}
                Search Now
              </Button>
            </div>

            {/* Suggestions */}
            {parseResult.suggestions && parseResult.suggestions.length > 0 && (
              <div className="mt-3 pt-3 border-t">
                <p className="text-xs text-muted-foreground mb-2">Related searches:</p>
                <div className="flex flex-wrap gap-2">
                  {parseResult.suggestions.map((suggestion, i) => (
                    <Button
                      key={i}
                      variant="ghost"
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => {
                        setQuery(suggestion);
                        parseMutation.mutate(suggestion);
                      }}
                    >
                      {suggestion}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function NaturalLanguageSearchBarSkeleton() {
  return (
    <Skeleton className="h-12 w-full" />
  );
}
```

**Step 2: Run type-check**

Run: `pnpm run type-check`
Expected: No errors

**Step 3: Commit**

```bash
git add client/src/components/search/NaturalLanguageSearchBar.tsx
git commit -m "$(cat <<'EOF'
feat(ui): add natural language search bar component

Creates NaturalLanguageSearchBar with:
- Debounced query parsing preview
- Visual filter badges for parsed criteria
- Confidence indicator
- Related search suggestions
- Keyboard navigation support
EOF
)"
```

---

### Task 6: Integrate Search Bar into RFPs Page

**Files:**
- Modify: `client/src/pages/rfps.tsx`

**Step 1: Add imports at the top of the file**

```typescript
import { NaturalLanguageSearchBar } from '@/components/search/NaturalLanguageSearchBar';
```

**Step 2: Add state for search results**

Add after existing state declarations:

```typescript
const [searchResults, setSearchResults] = useState<{
  rfps: any[];
  totalCount: number;
  explanation: string;
  appliedFilters: any;
} | null>(null);
```

**Step 3: Add the search bar in the page header**

Add before the RFP list, after the page title:

```typescript
{/* Natural Language Search */}
<div className="mb-6">
  <NaturalLanguageSearchBar
    onSearchResults={(results) => setSearchResults(results)}
    onClear={() => setSearchResults(null)}
    className="max-w-3xl"
  />

  {/* Search results info */}
  {searchResults && (
    <div className="mt-4 p-4 bg-muted rounded-lg">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">
            Found {searchResults.totalCount} RFPs
          </p>
          <p className="text-sm text-muted-foreground">
            {searchResults.explanation}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSearchResults(null)}
        >
          Clear Search
        </Button>
      </div>
    </div>
  )}
</div>
```

**Step 4: Use search results when available**

Update the RFP list to use search results:

```typescript
const displayRfps = searchResults?.rfps || rfpsData?.rfps || [];
```

**Step 5: Run type-check**

Run: `pnpm run type-check`
Expected: No errors

**Step 6: Commit**

```bash
git add client/src/pages/rfps.tsx
git commit -m "$(cat <<'EOF'
feat(ui): integrate natural language search into RFPs page

Adds the NaturalLanguageSearchBar to the RFPs listing page with
search results display showing match count and explanation.
EOF
)"
```

---

### Task 7: Verify Build

**Files:**
- None (verification only)

**Step 1: Run type-check**

Run: `pnpm run type-check`
Expected: No errors

**Step 2: Run linter**

Run: `pnpm run lint`
Expected: No new errors

**Step 3: Run build**

Run: `pnpm run build`
Expected: Build succeeds

**Step 4: Commit any fixes if needed**

---

### Task 8: Add Example Queries and Help Text

**Files:**
- Create: `client/src/components/search/SearchExamples.tsx`

**Step 1: Create example queries component**

```typescript
import { Button } from '@/components/ui/button';
import {
  Building2,
  Calendar,
  DollarSign,
  MapPin,
  Wrench,
  Shield,
  Laptop,
  Truck,
} from 'lucide-react';

interface SearchExamplesProps {
  onSelectExample: (query: string) => void;
}

const EXAMPLE_QUERIES = [
  {
    query: 'IT services contracts in Texas',
    icon: Laptop,
    category: 'Technology',
  },
  {
    query: 'SDVOSB set-aside construction opportunities',
    icon: Shield,
    category: 'Set-Aside',
  },
  {
    query: 'Healthcare tenders due next month',
    icon: Calendar,
    category: 'Healthcare',
  },
  {
    query: 'Federal contracts over $1M in California',
    icon: DollarSign,
    category: 'High Value',
  },
  {
    query: 'Engineering services for Department of Defense',
    icon: Building2,
    category: 'Defense',
  },
  {
    query: 'Transportation and logistics RFPs in the Midwest',
    icon: Truck,
    category: 'Logistics',
  },
  {
    query: '8(a) small business opportunities for maintenance',
    icon: Wrench,
    category: 'Maintenance',
  },
  {
    query: 'Cybersecurity contracts expiring in Q1 2025',
    icon: Shield,
    category: 'Cybersecurity',
  },
];

export function SearchExamples({ onSelectExample }: SearchExamplesProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>Try these example searches:</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {EXAMPLE_QUERIES.map((example, i) => {
          const Icon = example.icon;
          return (
            <Button
              key={i}
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => onSelectExample(example.query)}
            >
              <Icon className="h-3 w-3 mr-1" />
              {example.query}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
```

**Step 2: Run type-check**

Run: `pnpm run type-check`
Expected: No errors

**Step 3: Commit**

```bash
git add client/src/components/search/SearchExamples.tsx
git commit -m "$(cat <<'EOF'
feat(ui): add example search queries component

Provides pre-built example queries for users to understand the
natural language search capabilities including IT, construction,
healthcare, defense, and various set-aside types.
EOF
)"
```

---

### Task 9: Final Integration and Testing

**Files:**
- Modify: `client/src/pages/rfps.tsx` (add examples)

**Step 1: Import and add SearchExamples**

Add import:
```typescript
import { SearchExamples } from '@/components/search/SearchExamples';
```

**Step 2: Add examples below search bar (when no search active)**

```typescript
{!searchResults && (
  <div className="mt-4">
    <SearchExamples
      onSelectExample={(query) => {
        // Trigger search with example query
        const searchBar = document.querySelector('[data-testid="nl-search-input"]') as HTMLInputElement;
        if (searchBar) {
          searchBar.value = query;
          searchBar.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }}
    />
  </div>
)}
```

**Step 3: Run type-check**

Run: `pnpm run type-check`
Expected: No errors

**Step 4: Run build**

Run: `pnpm run build`
Expected: Build succeeds

**Step 5: Commit**

```bash
git add client/src/pages/rfps.tsx
git commit -m "$(cat <<'EOF'
feat(ui): add example queries to RFPs page

Integrates SearchExamples component to help users discover
the natural language search capabilities.
EOF
)"
```

---

## Summary of Changes

| File | Change |
|------|--------|
| `shared/schema.ts` | Add NAICS, PSC, set-aside, location fields |
| `shared/searchTypes.ts` | New search filter types and reference data |
| `server/services/search/naturalLanguageSearchService.ts` | New AI-powered search service |
| `server/routes/rfps.routes.ts` | Add `/search/natural` and `/search/parse` endpoints |
| `client/src/components/search/NaturalLanguageSearchBar.tsx` | New search bar component |
| `client/src/components/search/SearchExamples.tsx` | New example queries component |
| `client/src/pages/rfps.tsx` | Integrate search bar and examples |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | Yes | OpenAI API key for query parsing |
| `OPENAI_MODEL` | No | Model to use (default: gpt-4o) |

## Testing the Feature

After implementation, test with these queries:

1. **Location-based**: "Construction contracts in Texas"
2. **Set-aside**: "SDVOSB IT services opportunities"
3. **Timeline**: "Healthcare RFPs due next month"
4. **Value range**: "Federal contracts over $500k"
5. **Combined**: "8(a) construction in California under $1M"
6. **Agency**: "Department of Defense cybersecurity"
