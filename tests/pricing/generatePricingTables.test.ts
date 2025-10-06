import { describe, it, expect } from '@jest/globals';
import {
  generatePricingTables,
  CompanyMappingExtended,
} from '../../src/mastra/workflows/pricing/generatePricingTables';

describe('generatePricingTables', () => {
  const baseCompanyMapping: CompanyMappingExtended = {
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

  describe('Basic Functionality', () => {
    it('should generate pricing tables with simple requirements', () => {
      const requirements = [
        'Project management services',
        'Implementation of new system',
        'Training for staff',
      ];

      const result = generatePricingTables(
        requirements,
        undefined,
        baseCompanyMapping
      );

      expect(result).toBeDefined();
      expect(result.items).toHaveLength(3);
      expect(result.items[0].description).toBe('Project management services');
      expect(parseFloat(result.subtotal)).toBeGreaterThan(0);
      expect(parseFloat(result.total)).toBeGreaterThan(
        parseFloat(result.subtotal)
      );
    });

    it('should calculate correct totals', () => {
      const requirements = ['Project management services'];

      const result = generatePricingTables(
        requirements,
        undefined,
        baseCompanyMapping
      );

      const subtotal = parseFloat(result.subtotal);
      const tax = parseFloat(result.tax);
      const total = parseFloat(result.total);

      expect(total).toBeCloseTo(subtotal + tax, 2);
    });

    it('should use correct tax rate for TX', () => {
      const requirements = ['Project management services'];

      const result = generatePricingTables(
        requirements,
        undefined,
        baseCompanyMapping
      );

      expect(parseFloat(result.taxRate)).toBe(8.25);
    });
  });

  describe('Requirement Parsing', () => {
    it('should categorize project management requirements', () => {
      const requirements = ['Project Manager for 6 months'];

      const result = generatePricingTables(
        requirements,
        undefined,
        baseCompanyMapping
      );

      expect(result.items[0].category).toBe('project_management');
    });

    it('should categorize implementation requirements', () => {
      const requirements = ['Implementation of software system'];

      const result = generatePricingTables(
        requirements,
        undefined,
        baseCompanyMapping
      );

      expect(result.items[0].category).toBe('implementation');
    });

    it('should extract quantities from requirements', () => {
      const requirements = ['3 developers for software development'];

      const result = generatePricingTables(
        requirements,
        undefined,
        baseCompanyMapping
      );

      expect(result.items[0].quantity).toBe(3);
    });

    it('should extract units from requirements', () => {
      const requirements = ['Training for 5 days'];

      const result = generatePricingTables(
        requirements,
        undefined,
        baseCompanyMapping
      );

      expect(result.items[0].unit).toBe('day');
    });
  });

  describe('Rate Mapping', () => {
    it('should use company rates when available', () => {
      const requirements = ['Project management services'];

      const result = generatePricingTables(
        requirements,
        undefined,
        baseCompanyMapping
      );

      // PM rate is 150/hour in company rates
      expect(parseFloat(result.items[0].unitPrice)).toBe(150);
    });

    it('should use historical rates when company rate is missing', () => {
      const companyMappingNoRates: CompanyMappingExtended = {
        ...baseCompanyMapping,
        rates: [],
      };

      const requirements = ['Project management services'];

      const result = generatePricingTables(
        requirements,
        undefined,
        companyMappingNoRates
      );

      // Historical rate for PM is 150/hour
      expect(parseFloat(result.items[0].unitPrice)).toBe(150);
    });

    it('should handle default category fallback', () => {
      const requirements = ['Unknown service type'];

      const result = generatePricingTables(
        requirements,
        undefined,
        baseCompanyMapping
      );

      // Default rate is 100/hour
      expect(parseFloat(result.items[0].unitPrice)).toBe(100);
    });
  });

  describe('Budget Constraints', () => {
    it('should parse budget string with dollar sign', () => {
      const requirements = [
        'Project management services',
        'Implementation services',
      ];

      const result = generatePricingTables(
        requirements,
        '$50000',
        baseCompanyMapping
      );

      expect(parseFloat(result.subtotal)).toBeLessThanOrEqual(50000);
    });

    it('should parse budget string with commas', () => {
      const requirements = [
        'Project management services',
        'Implementation services',
      ];

      const result = generatePricingTables(
        requirements,
        '$100,000',
        baseCompanyMapping
      );

      expect(parseFloat(result.subtotal)).toBeLessThanOrEqual(100000);
    });

    it('should parse budget range and use midpoint', () => {
      const requirements = [
        'Project management services',
        'Implementation services',
      ];

      const result = generatePricingTables(
        requirements,
        '$100000-150000',
        baseCompanyMapping
      );

      // Subtotal should be constrained around midpoint (125000)
      expect(parseFloat(result.subtotal)).toBeLessThanOrEqual(125000);
    });

    it('should parse "up to" budget pattern', () => {
      const requirements = [
        'Project management services',
        'Implementation services',
      ];

      const result = generatePricingTables(
        requirements,
        'up to $80000',
        baseCompanyMapping
      );

      expect(parseFloat(result.subtotal)).toBeLessThanOrEqual(80000);
    });

    it('should apply discount when over budget', () => {
      const requirements = [
        'Project management for 1000 hours',
        'Senior consultant for 500 hours',
        'Implementation of large system',
      ];

      const result = generatePricingTables(
        requirements,
        '$50000',
        baseCompanyMapping
      );

      // Total should be constrained to budget
      expect(parseFloat(result.subtotal)).toBeLessThanOrEqual(50000);
    });
  });

  describe('Margin Calculation', () => {
    it('should calculate average margin from company rates', () => {
      const requirements = ['Project management services'];

      const result = generatePricingTables(
        requirements,
        undefined,
        baseCompanyMapping
      );

      // Average margin from company rates: (40+45+40+40+35+50+30)/7 ≈ 40
      expect(parseFloat(result.defaultMargin)).toBeCloseTo(40, 0);
    });

    it('should use default margin when no company rates', () => {
      const companyMappingNoRates: CompanyMappingExtended = {
        ...baseCompanyMapping,
        rates: undefined,
      };

      const requirements = ['Project management services'];

      const result = generatePricingTables(
        requirements,
        undefined,
        companyMappingNoRates
      );

      expect(parseFloat(result.defaultMargin)).toBe(40.0);
    });
  });

  describe('Tax Rate Handling', () => {
    it('should use CA tax rate when company is in CA', () => {
      const companyMappingCA: CompanyMappingExtended = {
        ...baseCompanyMapping,
        companyInfo: {
          ...baseCompanyMapping.companyInfo,
          location: { state: 'CA' },
        },
      };

      const requirements = ['Project management services'];

      const result = generatePricingTables(
        requirements,
        undefined,
        companyMappingCA
      );

      expect(parseFloat(result.taxRate)).toBe(7.25);
    });

    it('should use default tax rate for unknown state', () => {
      const companyMappingUnknown: CompanyMappingExtended = {
        ...baseCompanyMapping,
        companyInfo: {
          ...baseCompanyMapping.companyInfo,
          location: { state: 'XX' },
        },
      };

      const requirements = ['Project management services'];

      const result = generatePricingTables(
        requirements,
        undefined,
        companyMappingUnknown
      );

      expect(parseFloat(result.taxRate)).toBe(8.0);
    });

    it('should use default tax rate when no location', () => {
      const companyMappingNoLocation: CompanyMappingExtended = {
        ...baseCompanyMapping,
        companyInfo: {
          ...baseCompanyMapping.companyInfo,
          location: undefined,
        },
      };

      const requirements = ['Project management services'];

      const result = generatePricingTables(
        requirements,
        undefined,
        companyMappingNoLocation
      );

      expect(parseFloat(result.taxRate)).toBe(8.0);
    });
  });

  describe('Input Validation', () => {
    it('should throw error for empty requirements', () => {
      expect(() => {
        generatePricingTables([], undefined, baseCompanyMapping);
      }).toThrow('Requirements array cannot be empty');
    });

    it('should throw error for missing company mapping', () => {
      expect(() => {
        generatePricingTables(['Test'], undefined, {} as any);
      }).toThrow('Company mapping must include companyInfo');
    });

    it('should throw error for invalid company mapping structure', () => {
      const invalidMapping = {
        businessType: 'invalid', // should be array
        companyInfo: { name: 'Test' },
      };

      expect(() => {
        generatePricingTables(['Test'], undefined, invalidMapping as any);
      }).toThrow('Invalid company mapping structure');
    });
  });

  describe('Edge Cases', () => {
    it('should handle very large budgets', () => {
      const requirements = ['Project management services'];

      const result = generatePricingTables(
        requirements,
        '$10000000',
        baseCompanyMapping
      );

      expect(result).toBeDefined();
      expect(parseFloat(result.total)).toBeGreaterThan(0);
    });

    it('should handle very small budgets', () => {
      const requirements = ['Project management services'];

      const result = generatePricingTables(
        requirements,
        '$1',
        baseCompanyMapping
      );

      expect(result).toBeDefined();
      expect(parseFloat(result.subtotal)).toBeLessThanOrEqual(1);
    });

    it('should handle budget with no numeric value', () => {
      const requirements = ['Project management services'];

      const result = generatePricingTables(
        requirements,
        'TBD',
        baseCompanyMapping
      );

      // Should proceed without budget constraint
      expect(result).toBeDefined();
      expect(parseFloat(result.total)).toBeGreaterThan(0);
    });

    it('should handle multiple items of same category', () => {
      const requirements = [
        'Project manager',
        'Project management oversight',
        'PM coordination',
      ];

      const result = generatePricingTables(
        requirements,
        undefined,
        baseCompanyMapping
      );

      expect(result.items).toHaveLength(3);
      result.items.forEach(item => {
        expect(item.category).toBe('project_management');
      });
    });
  });

  describe('Output Format', () => {
    it('should format currency with 2 decimal places', () => {
      const requirements = ['Project management services'];

      const result = generatePricingTables(
        requirements,
        undefined,
        baseCompanyMapping
      );

      expect(result.subtotal).toMatch(/^\d+\.\d{2}$/);
      expect(result.tax).toMatch(/^\d+\.\d{2}$/);
      expect(result.total).toMatch(/^\d+\.\d{2}$/);
      result.items.forEach(item => {
        expect(item.unitPrice).toMatch(/^\d+\.\d{2}$/);
        expect(item.totalPrice).toMatch(/^\d+\.\d{2}$/);
      });
    });

    it('should include all required fields in output', () => {
      const requirements = ['Project management services'];

      const result = generatePricingTables(
        requirements,
        undefined,
        baseCompanyMapping
      );

      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('subtotal');
      expect(result).toHaveProperty('taxRate');
      expect(result).toHaveProperty('tax');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('defaultMargin');

      expect(result.items[0]).toHaveProperty('description');
      expect(result.items[0]).toHaveProperty('category');
      expect(result.items[0]).toHaveProperty('quantity');
      expect(result.items[0]).toHaveProperty('unit');
      expect(result.items[0]).toHaveProperty('unitPrice');
      expect(result.items[0]).toHaveProperty('totalPrice');
    });
  });
});
