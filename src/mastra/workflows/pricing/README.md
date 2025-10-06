# Pricing Tables Generator

Dynamic pricing table generation for RFP proposals based on requirements, company rates, and budget constraints.

## Overview

The `generatePricingTables` function parses RFP requirements into billable line items, maps them to company or historical rates, applies budget constraints, and generates structured pricing tables with tax calculations.

## Features

- ✅ **Intelligent Requirement Parsing**: Automatically categorizes requirements (PM, development, training, etc.)
- ✅ **Flexible Rate Mapping**: Uses company rates when available, falls back to historical averages
- ✅ **Budget Constraint Handling**: Applies proportional discounts when costs exceed budget
- ✅ **Tax Rate Management**: State-specific tax rates with fallback to defaults
- ✅ **Quantity & Unit Extraction**: Extracts quantities and units from requirement text
- ✅ **Robust Input Validation**: Validates company mapping structure with Zod schemas
- ✅ **Comprehensive Testing**: 29 unit tests covering all scenarios

## Usage

### Basic Example

```typescript
import { generatePricingTables } from './generatePricingTables';

const requirements = [
  'Project management services',
  'Implementation of new system',
  'Training for staff',
];

const companyMapping = {
  businessType: ['construction', 'technology'],
  certifications: ['WBENC', 'HUB', 'DBE', 'MBE', 'WBE'],
  companyInfo: {
    name: 'iByte Enterprises LLC',
    type: 'Woman-owned business',
    capabilities: ['construction services', 'technology solutions'],
    location: {
      state: 'TX',
      city: 'Austin',
    },
  },
  rates: [
    { category: 'project_management', hourlyRate: 150, margin: 40 },
    { category: 'implementation', unitRate: 75000, margin: 35 },
    { category: 'training', dailyRate: 1500, margin: 50 },
  ],
};

const result = generatePricingTables(requirements, undefined, companyMapping);
console.log(result);
// {
//   items: [...],
//   subtotal: "76650.00",
//   taxRate: "8.25",
//   tax: "6323.63",
//   total: "82973.63",
//   defaultMargin: "40.00"
// }
```

### With Budget Constraint

```typescript
const result = generatePricingTables(
  requirements,
  '$100,000', // Budget constraint
  companyMapping
);
// Automatically applies discount if costs exceed budget
```

### Budget Formats Supported

- `$100,000` - Direct amount
- `100000-150000` - Range (uses midpoint)
- `up to $80000` - Maximum amount
- `TBD` or `undefined` - No constraint

## Input Schema

### Requirements
Array of requirement strings. The function will:
- Categorize each requirement based on keywords
- Extract quantities (e.g., "3 developers" → quantity: 3)
- Extract units (e.g., "for 5 days" → unit: "day")

### Company Mapping
```typescript
{
  businessType: string[];
  certifications: string[];
  companyInfo: {
    name: string;
    type: string;
    capabilities: string[];
    location?: {
      state: string;
      city?: string;
    };
  };
  rates?: Array<{
    category: string;
    hourlyRate?: number;
    dailyRate?: number;
    unitRate?: number;
    margin?: number;
  }>;
}
```

## Output Schema

```typescript
{
  items: Array<{
    description: string;
    category?: string;
    quantity: number;
    unit: string;
    unitPrice: string; // Format: "150.00"
    totalPrice: string;
  }>;
  subtotal: string;
  taxRate: string;
  tax: string;
  total: string;
  defaultMargin: string;
}
```

## Requirement Categories

The function recognizes these categories (with fallback to historical rates):

| Category | Keywords | Default Rate |
|----------|----------|--------------|
| `project_management` | project management, pm, project manager | 150/hour |
| `senior_consultant` | senior, lead, architect | 175/hour |
| `consultant` | consult, advise | 125/hour |
| `developer` | develop, code, software | 140/hour |
| `implementation` | implementation, deploy, install | 75000/project |
| `training` | training, education, workshop | 1500/day |
| `support` | support, maintenance | 5000/month |
| `documentation` | document, manual, guide | 2500/deliverable |
| `default` | (fallback) | 100/hour |

## Tax Rates by State

| State | Tax Rate |
|-------|----------|
| TX | 8.25% |
| CA | 7.25% |
| NY | 4.0% |
| FL | 6.0% |
| IL | 6.25% |
| PA | 6.0% |
| OH | 5.75% |
| Default | 8.0% |

## Testing

Run the comprehensive test suite:

```bash
NODE_OPTIONS="--experimental-vm-modules --no-warnings" npx jest tests/pricing/generatePricingTables.test.ts
```

Run sample inputs to see examples:

```bash
npx tsx src/mastra/workflows/pricing/sampleInputs.ts
```

## Integration

Used in `proposal-generation-workflow.ts`:

```typescript
import { generatePricingTables } from './pricing/generatePricingTables';

// In generatePricingTablesStep
const pricingTables = generatePricingTables(
  rfpAnalysis.requirements,
  rfpAnalysis.estimatedBudget,
  companyMapping
);
```

## Error Handling

The function includes robust error handling:

- Throws error if requirements array is empty
- Throws error if company mapping is invalid
- Falls back to historical rates when company rates are missing
- Returns valid pricing even with malformed budget strings

## Files

- `generatePricingTables.ts` - Main implementation
- `generatePricingTables.test.ts` - 29 comprehensive tests
- `sampleInputs.ts` - Example usage and outputs
- `README.md` - This file
