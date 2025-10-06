/**
 * Sample inputs and expected outputs for generatePricingTables function
 * Use these examples to verify the pricing generation logic
 */

import {
  generatePricingTables,
  CompanyMappingExtended,
} from './generatePricingTables';

// Sample company mapping with full rate structure
export const sampleCompanyMapping: CompanyMappingExtended = {
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
    { category: 'senior_consultant', hourlyRate: 175, margin: 45 },
    { category: 'consultant', hourlyRate: 125, margin: 40 },
    { category: 'developer', hourlyRate: 140, margin: 40 },
    { category: 'implementation', unitRate: 75000, margin: 35 },
    { category: 'training', dailyRate: 1500, margin: 50 },
    { category: 'support', unitRate: 5000, margin: 30 },
  ],
};

// Example 1: Simple project with no budget constraint
export const example1 = {
  requirements: [
    'Project management services',
    'Implementation of new system',
    'Training for staff',
  ],
  budget: undefined,
  companyMapping: sampleCompanyMapping,
};

console.log('\n=== Example 1: Simple Project (No Budget Constraint) ===');
const result1 = generatePricingTables(
  example1.requirements,
  example1.budget,
  example1.companyMapping
);
console.log(JSON.stringify(result1, null, 2));
console.log(`Total: $${result1.total}`);

// Example 2: Project with explicit budget
export const example2 = {
  requirements: [
    'Senior consultant for 200 hours',
    'Project management for 3 months',
    'Developer for software development',
    'Training for 5 days',
  ],
  budget: '$100,000',
  companyMapping: sampleCompanyMapping,
};

console.log('\n=== Example 2: Project with Budget ($100,000) ===');
const result2 = generatePricingTables(
  example2.requirements,
  example2.budget,
  example2.companyMapping
);
console.log(JSON.stringify(result2, null, 2));
console.log(`Total: $${result2.total}`);
console.log(
  `Subtotal vs Budget: $${result2.subtotal} vs $${parseFloat(example2.budget.replace(/[$,]/g, ''))}`
);

// Example 3: Complex project with budget range
export const example3 = {
  requirements: [
    'Project Manager for 6 months',
    'Senior consultant for technical oversight',
    'Implementation of enterprise system',
    'Documentation and manuals',
    'Training workshop for 10 days',
    'Support and maintenance for 12 months',
  ],
  budget: '$200,000-250,000',
  companyMapping: sampleCompanyMapping,
};

console.log('\n=== Example 3: Complex Project with Budget Range ===');
const result3 = generatePricingTables(
  example3.requirements,
  example3.budget,
  example3.companyMapping
);
console.log(JSON.stringify(result3, null, 2));
console.log(`Total: $${result3.total}`);
console.log(`Number of line items: ${result3.items.length}`);

// Example 4: Project with missing company rates (fallback to historical)
export const example4 = {
  requirements: [
    'Consulting services',
    'Custom software development',
  ],
  budget: undefined,
  companyMapping: {
    ...sampleCompanyMapping,
    rates: [], // No rates specified
  },
};

console.log('\n=== Example 4: Fallback to Historical Rates ===');
const result4 = generatePricingTables(
  example4.requirements,
  example4.budget,
  example4.companyMapping
);
console.log(JSON.stringify(result4, null, 2));
console.log(`Total: $${result4.total}`);
console.log('Note: Using historical rates as no company rates provided');

// Example 5: Different state tax rates
export const example5CA = {
  requirements: ['Project management services'],
  budget: undefined,
  companyMapping: {
    ...sampleCompanyMapping,
    companyInfo: {
      ...sampleCompanyMapping.companyInfo,
      location: { state: 'CA' },
    },
  },
};

console.log('\n=== Example 5: California Tax Rate ===');
const result5 = generatePricingTables(
  example5CA.requirements,
  example5CA.budget,
  example5CA.companyMapping
);
console.log(`Tax Rate: ${result5.taxRate}%`);
console.log(`Tax: $${result5.tax}`);
console.log(`Total: $${result5.total}`);

// Summary table
console.log('\n=== Summary of Examples ===');
console.log('┌─────────┬──────────────┬────────────┬──────────┬───────────┐');
console.log('│ Example │ Requirements │ Budget     │ Subtotal │ Total     │');
console.log('├─────────┼──────────────┼────────────┼──────────┼───────────┤');
console.log(
  `│    1    │      ${example1.requirements.length}       │ None       │ $${result1.subtotal.padEnd(7)} │ $${result1.total.padEnd(8)} │`
);
console.log(
  `│    2    │      ${example2.requirements.length}       │ $100,000   │ $${result2.subtotal.padEnd(7)} │ $${result2.total.padEnd(8)} │`
);
console.log(
  `│    3    │      ${example3.requirements.length}       │ $200-250k  │ $${result3.subtotal.padEnd(7)} │ $${result3.total.padEnd(8)} │`
);
console.log(
  `│    4    │      ${example4.requirements.length}       │ None       │ $${result4.subtotal.padEnd(7)} │ $${result4.total.padEnd(8)} │`
);
console.log(
  `│    5    │      ${example5CA.requirements.length}       │ None       │ $${result5.subtotal.padEnd(7)} │ $${result5.total.padEnd(8)} │`
);
console.log('└─────────┴──────────────┴────────────┴──────────┴───────────┘');
