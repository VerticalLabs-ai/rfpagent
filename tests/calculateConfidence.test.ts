import { calculateConfidence } from '../src/mastra/workflows/rfp-discovery-workflow';

describe('calculateConfidence', () => {
  describe('Base score and field weighting', () => {
    it('should return base score of 0.5 for empty opportunity', () => {
      const result = calculateConfidence({});
      // Empty object: 0.5 (base) - 0.3 (missing title) = 0.2
      expect(result).toBeCloseTo(0.2, 2);
    });

    it('should penalize missing title significantly', () => {
      const withoutTitle = calculateConfidence({
        description: 'Test description',
        agency: 'Test Agency',
      });
      // 0.5 (base) - 0.3 (no title) + 0.05 (description) + 0.08 (agency) = 0.33
      expect(withoutTitle).toBeCloseTo(0.33, 2);
    });

    it('should reward presence of title', () => {
      const result = calculateConfidence({
        title: 'Test RFP',
      });
      // 0.5 (base) + 0.2 (title) = 0.7
      expect(result).toBeCloseTo(0.7, 2);
    });

    it('should give bonus for descriptive titles (>20 chars)', () => {
      const result = calculateConfidence({
        title: 'Comprehensive RFP for Software Development Services',
      });
      // 0.5 (base) + 0.2 (title) + 0.05 (long title) = 0.75
      expect(result).toBeCloseTo(0.75, 2);
    });

    it('should not give bonus for short titles', () => {
      const result = calculateConfidence({
        title: 'Short RFP',
      });
      // 0.5 (base) + 0.2 (title) = 0.7
      expect(result).toBeCloseTo(0.7, 2);
    });
  });

  describe('URL validation', () => {
    it('should reward valid HTTP URL', () => {
      const result = calculateConfidence({
        title: 'Test RFP',
        url: 'http://example.com/rfp',
      });
      // 0.5 + 0.2 (title) + 0.15 (valid URL) = 0.85
      expect(result).toBeCloseTo(0.85, 2);
    });

    it('should reward valid HTTPS URL', () => {
      const result = calculateConfidence({
        title: 'Test RFP',
        url: 'https://example.com/rfp',
      });
      // 0.5 + 0.2 (title) + 0.15 (valid URL) = 0.85
      expect(result).toBeCloseTo(0.85, 2);
    });

    it('should penalize invalid URL format', () => {
      const result = calculateConfidence({
        title: 'Test RFP',
        url: 'not-a-valid-url',
      });
      // 0.5 + 0.2 (title) - 0.05 (invalid URL) = 0.65
      expect(result).toBeCloseTo(0.65, 2);
    });

    it('should handle empty URL string', () => {
      const result = calculateConfidence({
        title: 'Test RFP',
        url: '',
      });
      // 0.5 + 0.2 (title) = 0.7
      expect(result).toBeCloseTo(0.7, 2);
    });
  });

  describe('Deadline validation', () => {
    it('should reward valid future deadline', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);

      const result = calculateConfidence({
        title: 'Test RFP',
        deadline: futureDate.toISOString(),
      });
      // 0.5 + 0.2 (title) + 0.1 (valid date) + 0.05 (future) = 0.85
      expect(result).toBeCloseTo(0.85, 2);
    });

    it('should reward valid past deadline without future bonus', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 30);

      const result = calculateConfidence({
        title: 'Test RFP',
        deadline: pastDate.toISOString(),
      });
      // 0.5 + 0.2 (title) + 0.1 (valid date) = 0.8
      expect(result).toBeCloseTo(0.8, 2);
    });

    it('should penalize invalid deadline format', () => {
      const result = calculateConfidence({
        title: 'Test RFP',
        deadline: 'not-a-date',
      });
      // 0.5 + 0.2 (title) - 0.03 (invalid date) = 0.67
      expect(result).toBeCloseTo(0.67, 2);
    });

    it('should handle empty deadline string', () => {
      const result = calculateConfidence({
        title: 'Test RFP',
        deadline: '',
      });
      // 0.5 + 0.2 (title) = 0.7
      expect(result).toBeCloseTo(0.7, 2);
    });
  });

  describe('Supporting fields', () => {
    it('should reward agency presence', () => {
      const result = calculateConfidence({
        title: 'Test RFP',
        agency: 'Department of Defense',
      });
      // 0.5 + 0.2 (title) + 0.08 (agency) = 0.78
      expect(result).toBeCloseTo(0.78, 2);
    });

    it('should reward description presence', () => {
      const result = calculateConfidence({
        title: 'Test RFP',
        description: 'Short description',
      });
      // 0.5 + 0.2 (title) + 0.05 (description) = 0.75
      expect(result).toBeCloseTo(0.75, 2);
    });

    it('should give bonus for detailed descriptions (>100 chars)', () => {
      const longDesc =
        'This is a very detailed description of the RFP that contains more than one hundred characters to test the bonus scoring.';

      const result = calculateConfidence({
        title: 'Test RFP',
        description: longDesc,
      });
      // 0.5 + 0.2 (title) + 0.05 (description) + 0.03 (long desc) = 0.78
      expect(result).toBeCloseTo(0.78, 2);
    });

    it('should reward category presence', () => {
      const result = calculateConfidence({
        title: 'Test RFP',
        category: 'IT Services',
      });
      // 0.5 + 0.2 (title) + 0.04 (category) = 0.74
      expect(result).toBeCloseTo(0.74, 2);
    });

    it('should reward estimated value presence', () => {
      const result = calculateConfidence({
        title: 'Test RFP',
        estimatedValue: '$1,000,000',
      });
      // 0.5 + 0.2 (title) + 0.04 (estimatedValue) = 0.74
      expect(result).toBeCloseTo(0.74, 2);
    });
  });

  describe('Complete opportunity scoring', () => {
    it('should give high score for complete, valid opportunity', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);

      const result = calculateConfidence({
        title: 'Comprehensive RFP for Enterprise Software Development',
        description:
          'Detailed description of requirements for a multi-year enterprise software development contract including system architecture, security requirements, and performance benchmarks.',
        agency: 'General Services Administration',
        deadline: futureDate.toISOString(),
        estimatedValue: '$5,000,000 - $10,000,000',
        url: 'https://sam.gov/opp/12345',
        category: 'IT Services',
      });

      // All fields present with bonuses:
      // 0.5 (base) + 0.2 (title) + 0.05 (long title) + 0.15 (URL)
      // + 0.1 (valid deadline) + 0.05 (future) + 0.08 (agency)
      // + 0.05 (description) + 0.03 (long desc) + 0.04 (category) + 0.04 (value)
      // = 1.29, clamped to 1.0
      expect(result).toBe(1.0);
    });

    it('should give low score for incomplete opportunity', () => {
      const result = calculateConfidence({
        title: 'RFP',
        url: 'invalid-url',
      });

      // 0.5 (base) + 0.2 (title) - 0.05 (invalid URL) = 0.65
      expect(result).toBeCloseTo(0.65, 2);
    });
  });

  describe('Extraction metadata integration', () => {
    it('should incorporate extraction tool confidence', () => {
      const result = calculateConfidence(
        {
          title: 'Test RFP',
        },
        {
          confidence: 0.8,
        }
      );

      // Base calculation: 0.5 + 0.2 = 0.7
      // With metadata: 0.7 * 0.8 + 0.8 * 0.2 = 0.56 + 0.16 = 0.72
      expect(result).toBeCloseTo(0.72, 2);
    });

    it('should incorporate extraction quality', () => {
      const result = calculateConfidence(
        {
          title: 'Test RFP',
        },
        {
          extractionQuality: 0.9,
        }
      );

      // Base calculation: 0.5 + 0.2 = 0.7
      // With quality: 0.7 * 0.9 + 0.9 * 0.1 = 0.63 + 0.09 = 0.72
      expect(result).toBeCloseTo(0.72, 2);
    });

    it('should incorporate both confidence and quality', () => {
      const result = calculateConfidence(
        {
          title: 'Test RFP',
        },
        {
          confidence: 0.8,
          extractionQuality: 0.9,
        }
      );

      // Base: 0.7
      // After confidence: 0.7 * 0.8 + 0.8 * 0.2 = 0.72
      // After quality: 0.72 * 0.9 + 0.9 * 0.1 = 0.648 + 0.09 = 0.738
      expect(result).toBeCloseTo(0.738, 2);
    });

    it('should handle low extraction confidence', () => {
      const result = calculateConfidence(
        {
          title: 'Test RFP',
        },
        {
          confidence: 0.3,
        }
      );

      // Base: 0.7
      // With low confidence: 0.7 * 0.8 + 0.3 * 0.2 = 0.56 + 0.06 = 0.62
      expect(result).toBeCloseTo(0.62, 2);
    });
  });

  describe('Edge cases and boundary conditions', () => {
    it('should never return negative confidence', () => {
      const result = calculateConfidence(
        {
          url: 'invalid',
          deadline: 'invalid',
        },
        {
          confidence: 0,
          extractionQuality: 0,
        }
      );

      expect(result).toBeGreaterThanOrEqual(0);
    });

    it('should never return confidence greater than 1', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);

      const result = calculateConfidence(
        {
          title:
            'Very long and comprehensive title that should get bonuses for being descriptive',
          description:
            'Extremely detailed description with more than one hundred characters to ensure bonus points are awarded for comprehensive content.',
          agency: 'Test Agency',
          deadline: futureDate.toISOString(),
          estimatedValue: '$1,000,000',
          url: 'https://example.com/rfp',
          category: 'IT',
        },
        {
          confidence: 1.0,
          extractionQuality: 1.0,
        }
      );

      expect(result).toBeLessThanOrEqual(1);
      expect(result).toBe(1);
    });

    it('should handle whitespace-only fields as empty', () => {
      const result = calculateConfidence({
        title: '   ',
        description: '\t\n',
        agency: '  ',
      });

      // Should be treated as missing title
      expect(result).toBeCloseTo(0.2, 2);
    });

    it('should be deterministic for same inputs', () => {
      const input = {
        title: 'Test RFP',
        url: 'https://example.com',
      };
      const metadata = { confidence: 0.8 };

      const result1 = calculateConfidence(input, metadata);
      const result2 = calculateConfidence(input, metadata);

      expect(result1).toBe(result2);
    });
  });

  describe('Realistic scenarios', () => {
    it('should score a typical government RFP highly', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 45);

      const result = calculateConfidence({
        title: 'Cloud Infrastructure Modernization Services',
        description:
          'The agency seeks a contractor to provide cloud migration and modernization services.',
        agency: 'Department of Veterans Affairs',
        deadline: futureDate.toISOString(),
        url: 'https://sam.gov/opp/abc123',
        category: 'IT Services',
      });

      expect(result).toBeGreaterThan(0.85);
    });

    it('should score an incomplete scrape result lower', () => {
      const result = calculateConfidence({
        title: 'RFP #2024-001',
        url: 'https://portal.example.com/rfp/2024-001',
      });

      expect(result).toBeGreaterThan(0.7);
      expect(result).toBeLessThan(0.9);
    });

    it('should score a low-quality extraction appropriately', () => {
      const result = calculateConfidence(
        {
          title: 'Untitled',
          description: 'N/A',
        },
        {
          confidence: 0.4,
          extractionQuality: 0.3,
        }
      );

      // Base: 0.5 + 0.2 (title) + 0.05 (description) = 0.75
      // After confidence: 0.75 * 0.8 + 0.4 * 0.2 = 0.6 + 0.08 = 0.68
      // After quality: 0.68 * 0.9 + 0.3 * 0.1 = 0.612 + 0.03 = 0.642
      expect(result).toBeCloseTo(0.642, 2);
      expect(result).toBeLessThan(0.7);
    });
  });
});
