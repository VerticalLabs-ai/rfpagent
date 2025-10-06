import { z } from 'zod';

// Input schemas
const requirementItemSchema = z.object({
  description: z.string(),
  category: z.string().optional(),
  estimatedQuantity: z.number().optional(),
  unit: z.string().optional(),
});

const companyRateSchema = z.object({
  category: z.string(),
  hourlyRate: z.number().optional(),
  dailyRate: z.number().optional(),
  unitRate: z.number().optional(),
  margin: z.number().optional(), // percentage
});

export const companyMappingExtendedSchema = z.object({
  businessType: z.array(z.string()),
  certifications: z.array(z.string()),
  companyInfo: z.object({
    name: z.string(),
    type: z.string(),
    capabilities: z.array(z.string()),
    location: z
      .object({
        state: z.string(),
        city: z.string().optional(),
      })
      .optional(),
  }),
  rates: z.array(companyRateSchema).optional(),
});

// Output schema
export const pricingTableSchema = z.object({
  items: z.array(
    z.object({
      description: z.string(),
      category: z.string().optional(),
      quantity: z.number(),
      unit: z.string(),
      unitPrice: z.string(), // stored as string to preserve precision
      totalPrice: z.string(),
    })
  ),
  subtotal: z.string(),
  taxRate: z.string(), // percentage as string
  tax: z.string(),
  total: z.string(),
  defaultMargin: z.string(), // percentage as string
});

export type PricingTableOutput = z.infer<typeof pricingTableSchema>;
export type CompanyMappingExtended = z.infer<
  typeof companyMappingExtendedSchema
>;

// Historical average rates by category (fallback)
const HISTORICAL_RATES: Record<string, { unitRate: number; unit: string }> = {
  project_management: { unitRate: 150, unit: 'hour' },
  senior_consultant: { unitRate: 175, unit: 'hour' },
  consultant: { unitRate: 125, unit: 'hour' },
  developer: { unitRate: 140, unit: 'hour' },
  implementation: { unitRate: 75000, unit: 'project' },
  training: { unitRate: 1500, unit: 'day' },
  support: { unitRate: 5000, unit: 'month' },
  documentation: { unitRate: 2500, unit: 'deliverable' },
  default: { unitRate: 100, unit: 'hour' },
};

// State tax rates mapping
const STATE_TAX_RATES: Record<string, number> = {
  TX: 8.25,
  CA: 7.25,
  NY: 4.0,
  FL: 6.0,
  IL: 6.25,
  PA: 6.0,
  OH: 5.75,
  default: 8.0,
};

interface ParsedRequirement {
  description: string;
  category: string;
  quantity: number;
  unit: string;
}

/**
 * Parse RFP requirements into billable line items
 */
function parseRequirements(requirements: string[]): ParsedRequirement[] {
  const parsed: ParsedRequirement[] = [];

  for (const req of requirements) {
    // Try to extract category from requirement text
    const category = categorizeRequirement(req);
    const quantity = extractQuantity(req) || 1;
    const unit = extractUnit(req, category);

    parsed.push({
      description: req,
      category,
      quantity,
      unit,
    });
  }

  return parsed;
}

/**
 * Categorize requirement based on keywords
 */
function categorizeRequirement(requirement: string): string {
  const lowerReq = requirement.toLowerCase();

  if (
    lowerReq.includes('project management') ||
    lowerReq.includes('pm') ||
    lowerReq.includes('project manager')
  ) {
    return 'project_management';
  }
  if (
    lowerReq.includes('senior') ||
    lowerReq.includes('lead') ||
    lowerReq.includes('architect')
  ) {
    return 'senior_consultant';
  }
  if (
    lowerReq.includes('implementation') ||
    lowerReq.includes('deploy') ||
    lowerReq.includes('install')
  ) {
    return 'implementation';
  }
  if (
    lowerReq.includes('training') ||
    lowerReq.includes('education') ||
    lowerReq.includes('workshop')
  ) {
    return 'training';
  }
  if (
    lowerReq.includes('support') ||
    lowerReq.includes('maintenance')
  ) {
    return 'support';
  }
  if (
    lowerReq.includes('document') ||
    lowerReq.includes('manual') ||
    lowerReq.includes('guide')
  ) {
    return 'documentation';
  }
  if (
    lowerReq.includes('develop') ||
    lowerReq.includes('code') ||
    lowerReq.includes('software')
  ) {
    return 'developer';
  }
  if (lowerReq.includes('consult') || lowerReq.includes('advise')) {
    return 'consultant';
  }

  return 'default';
}

/**
 * Extract quantity from requirement text
 */
function extractQuantity(requirement: string): number | null {
  // Look for patterns like "2 developers", "3 months", "1 project"
  const matches = requirement.match(/(\d+)\s+(month|week|day|hour|developer|person|project)/i);
  if (matches && matches[1]) {
    return parseInt(matches[1], 10);
  }
  return null;
}

/**
 * Extract or infer unit from requirement text
 */
function extractUnit(requirement: string, category: string): string {
  const lowerReq = requirement.toLowerCase();

  if (lowerReq.includes('hour')) return 'hour';
  if (lowerReq.includes('day')) return 'day';
  if (lowerReq.includes('week')) return 'week';
  if (lowerReq.includes('month')) return 'month';
  if (lowerReq.includes('project')) return 'project';
  if (lowerReq.includes('deliverable')) return 'deliverable';

  // Use historical unit for category
  return HISTORICAL_RATES[category]?.unit || HISTORICAL_RATES.default.unit;
}

/**
 * Get rate from company mapping or historical averages
 */
function getRate(
  category: string,
  companyMapping: CompanyMappingExtended
): number {
  // First, try to find rate in company mapping
  if (companyMapping.rates) {
    const companyRate = companyMapping.rates.find(
      r => r.category.toLowerCase() === category.toLowerCase()
    );
    if (companyRate) {
      return (
        companyRate.unitRate ||
        companyRate.hourlyRate ||
        companyRate.dailyRate ||
        0
      );
    }
  }

  // Fallback to historical rates
  return HISTORICAL_RATES[category]?.unitRate || HISTORICAL_RATES.default.unitRate;
}

/**
 * Get tax rate from company location or default
 */
function getTaxRate(companyMapping: CompanyMappingExtended): number {
  const state = companyMapping.companyInfo.location?.state;
  if (state && STATE_TAX_RATES[state]) {
    return STATE_TAX_RATES[state];
  }
  return STATE_TAX_RATES.default;
}

/**
 * Get default margin from company rates or use 40%
 */
function getDefaultMargin(companyMapping: CompanyMappingExtended): number {
  if (companyMapping.rates && companyMapping.rates.length > 0) {
    const margins = companyMapping.rates
      .map(r => r.margin)
      .filter((m): m is number => m !== undefined);
    if (margins.length > 0) {
      return margins.reduce((a, b) => a + b, 0) / margins.length;
    }
  }
  return 40.0; // Default 40% margin
}

/**
 * Parse budget string to number
 */
function parseBudget(budgetStr: string | undefined): number | null {
  if (!budgetStr) return null;

  // Remove currency symbols, commas, and text
  const cleaned = budgetStr.replace(/[$,]/g, '').trim();

  // Handle ranges like "100000-150000" - use midpoint
  const rangeMatch = cleaned.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/);
  if (rangeMatch) {
    const min = parseFloat(rangeMatch[1]);
    const max = parseFloat(rangeMatch[2]);
    return (min + max) / 2;
  }

  // Handle "up to" patterns
  const upToMatch = cleaned.match(/up\s+to\s+(\d+(?:\.\d+)?)/i);
  if (upToMatch) {
    return parseFloat(upToMatch[1]);
  }

  // Try to parse as direct number
  const directMatch = cleaned.match(/(\d+(?:\.\d+)?)/);
  if (directMatch) {
    return parseFloat(directMatch[1]);
  }

  return null;
}

/**
 * Apply budget constraints to pricing
 */
function applyBudgetConstraints(
  items: ParsedRequirement[],
  rates: number[],
  budget: number | null,
  margin: number
): { quantities: number[]; unitPrices: number[] } {
  const quantities = items.map(item => item.quantity);
  let unitPrices = rates.slice();

  if (budget === null) {
    return { quantities, unitPrices };
  }

  // Calculate total without margin
  const currentTotal = items.reduce(
    (sum, item, i) => sum + item.quantity * rates[i],
    0
  );

  // If over budget, apply proportional discount
  if (currentTotal > budget) {
    const discountFactor = budget / currentTotal;
    unitPrices = rates.map(rate => rate * discountFactor);
  }

  return { quantities, unitPrices };
}

/**
 * Format number as currency string with 2 decimal places
 */
function formatCurrency(num: number): string {
  return num.toFixed(2);
}

/**
 * Generate pricing tables from RFP requirements
 */
export function generatePricingTables(
  requirements: string[],
  estimatedBudget: string | undefined,
  companyMapping: CompanyMappingExtended
): PricingTableOutput {
  // Validate inputs
  if (!requirements || requirements.length === 0) {
    throw new Error('Requirements array cannot be empty');
  }

  if (!companyMapping || !companyMapping.companyInfo) {
    throw new Error('Company mapping must include companyInfo');
  }

  try {
    // Validate company mapping structure
    companyMappingExtendedSchema.parse(companyMapping);
  } catch (error) {
    throw new Error(
      `Invalid company mapping structure: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // Parse requirements into billable items
  const parsedItems = parseRequirements(requirements);

  // Get rates for each item
  const rates = parsedItems.map(item => getRate(item.category, companyMapping));

  // Parse and apply budget constraints
  const budget = parseBudget(estimatedBudget);
  const defaultMargin = getDefaultMargin(companyMapping);
  const { quantities, unitPrices } = applyBudgetConstraints(
    parsedItems,
    rates,
    budget,
    defaultMargin
  );

  // Build pricing items
  const items = parsedItems.map((item, i) => {
    const quantity = quantities[i];
    const unitPrice = unitPrices[i];
    const totalPrice = quantity * unitPrice;

    return {
      description: item.description,
      category: item.category,
      quantity,
      unit: item.unit,
      unitPrice: formatCurrency(unitPrice),
      totalPrice: formatCurrency(totalPrice),
    };
  });

  // Calculate totals
  const subtotal = items.reduce(
    (sum, item) => sum + parseFloat(item.totalPrice),
    0
  );
  const taxRate = getTaxRate(companyMapping);
  const tax = (subtotal * taxRate) / 100;
  const total = subtotal + tax;

  return {
    items,
    subtotal: formatCurrency(subtotal),
    taxRate: formatCurrency(taxRate),
    tax: formatCurrency(tax),
    total: formatCurrency(total),
    defaultMargin: formatCurrency(defaultMargin),
  };
}
