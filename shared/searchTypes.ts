import { z } from 'zod';

/**
 * Structured search filters extracted from natural language queries
 */
export const SearchFiltersSchema = z.object({
  // Text search
  keywords: z.array(z.string()).optional(),
  titleSearch: z.string().optional(),

  // Government classification
  naicsCodes: z.array(z.string()).optional(), // e.g., ["541512", "541511"]
  pscCodes: z.array(z.string()).optional(), // e.g., ["D302", "D306"]
  setAsideTypes: z.array(z.string()).optional(), // e.g., ["SDVOSB", "8(a)"]

  // Location
  states: z.array(z.string()).optional(), // e.g., ["TX", "CA"]
  placeOfPerformance: z.string().optional(), // e.g., "Austin, TX"

  // Agency
  agencies: z.array(z.string()).optional(), // e.g., ["Department of Defense"]

  // Timeline
  deadlineAfter: z.string().optional(), // ISO date string
  deadlineBefore: z.string().optional(), // ISO date string
  postedAfter: z.string().optional(), // ISO date string

  // Financial
  minValue: z.number().optional(), // Minimum contract value
  maxValue: z.number().optional(), // Maximum contract value

  // Status
  statuses: z.array(z.string()).optional(), // RFP workflow statuses

  // Contract type
  contractTypes: z.array(z.string()).optional(), // FFP, T&M, IDIQ, etc.
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

export type NaturalLanguageSearchRequest = z.infer<
  typeof NaturalLanguageSearchRequestSchema
>;

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

export type NaturalLanguageSearchResponse = z.infer<
  typeof NaturalLanguageSearchResponseSchema
>;

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
  SDVOSB: 'Service-Disabled Veteran-Owned Small Business',
  VOSB: 'Veteran-Owned Small Business',
  '8(a)': '8(a) Business Development Program',
  HUBZone: 'Historically Underutilized Business Zone',
  WOSB: 'Women-Owned Small Business',
  EDWOSB: 'Economically Disadvantaged Women-Owned Small Business',
  SDB: 'Small Disadvantaged Business',
  SB: 'Small Business Set-Aside',
  TOTAL_SB: 'Total Small Business',
  UNRESTRICTED: 'Full and Open Competition',
};

/**
 * US State codes
 */
export const US_STATES: Record<string, string> = {
  AL: 'Alabama',
  AK: 'Alaska',
  AZ: 'Arizona',
  AR: 'Arkansas',
  CA: 'California',
  CO: 'Colorado',
  CT: 'Connecticut',
  DE: 'Delaware',
  FL: 'Florida',
  GA: 'Georgia',
  HI: 'Hawaii',
  ID: 'Idaho',
  IL: 'Illinois',
  IN: 'Indiana',
  IA: 'Iowa',
  KS: 'Kansas',
  KY: 'Kentucky',
  LA: 'Louisiana',
  ME: 'Maine',
  MD: 'Maryland',
  MA: 'Massachusetts',
  MI: 'Michigan',
  MN: 'Minnesota',
  MS: 'Mississippi',
  MO: 'Missouri',
  MT: 'Montana',
  NE: 'Nebraska',
  NV: 'Nevada',
  NH: 'New Hampshire',
  NJ: 'New Jersey',
  NM: 'New Mexico',
  NY: 'New York',
  NC: 'North Carolina',
  ND: 'North Dakota',
  OH: 'Ohio',
  OK: 'Oklahoma',
  OR: 'Oregon',
  PA: 'Pennsylvania',
  RI: 'Rhode Island',
  SC: 'South Carolina',
  SD: 'South Dakota',
  TN: 'Tennessee',
  TX: 'Texas',
  UT: 'Utah',
  VT: 'Vermont',
  VA: 'Virginia',
  WA: 'Washington',
  WV: 'West Virginia',
  WI: 'Wisconsin',
  WY: 'Wyoming',
  DC: 'District of Columbia',
};
