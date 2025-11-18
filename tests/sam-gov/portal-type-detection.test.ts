import { describe, it, expect } from '@jest/globals';
import {
  shouldUseSAMGovExtraction,
  detectPortalTypeFromUrl,
} from '../../server/services/scrapers/utils/portalTypeUtils';

describe('SAM.gov Portal Type Detection', () => {
  describe('shouldUseSAMGovExtraction()', () => {
    it('should detect SAM.gov portal by exact portal type', () => {
      expect(shouldUseSAMGovExtraction('sam.gov', '')).toBe(true);
      expect(shouldUseSAMGovExtraction('sam_gov', '')).toBe(true);
      expect(shouldUseSAMGovExtraction('SAM.GOV', '')).toBe(true);
    });

    it('should detect SAM.gov portal by known aliases', () => {
      expect(shouldUseSAMGovExtraction('sam gov', '')).toBe(true);
      expect(shouldUseSAMGovExtraction('samgov', '')).toBe(true);
      expect(shouldUseSAMGovExtraction('sam', '')).toBe(true);
      expect(
        shouldUseSAMGovExtraction('system for award management', '')
      ).toBe(true);
      expect(shouldUseSAMGovExtraction('federal procurement', '')).toBe(true);
      expect(shouldUseSAMGovExtraction('federal contracting', '')).toBe(true);
      expect(shouldUseSAMGovExtraction('government contracts', '')).toBe(true);
    });

    it('should detect SAM.gov portal by URL pattern', () => {
      expect(
        shouldUseSAMGovExtraction('', 'https://sam.gov/search/?index=opp')
      ).toBe(true);
      expect(
        shouldUseSAMGovExtraction(
          '',
          'https://api.sam.gov/opportunities/v2/search'
        )
      ).toBe(true);
      expect(
        shouldUseSAMGovExtraction(
          '',
          'https://sam.gov/opp/abc123/view?index=opp'
        )
      ).toBe(true);
    });

    it('should detect SAM.gov when portal type contains sam or federal keywords', () => {
      expect(shouldUseSAMGovExtraction('sam portal', '')).toBe(true);
      expect(shouldUseSAMGovExtraction('federal sam system', '')).toBe(true);
      expect(shouldUseSAMGovExtraction('federal rfp portal', '')).toBe(true);
    });

    it('should not detect non-SAM.gov portals', () => {
      expect(shouldUseSAMGovExtraction('bonfire hub', '')).toBe(false);
      expect(shouldUseSAMGovExtraction('austin finance', '')).toBe(false);
      expect(
        shouldUseSAMGovExtraction('', 'https://example.com/procurement')
      ).toBe(false);
      expect(
        shouldUseSAMGovExtraction('generic portal', 'https://city.gov/bids')
      ).toBe(false);
    });

    it('should handle null/undefined portal types gracefully', () => {
      expect(
        shouldUseSAMGovExtraction(null, 'https://sam.gov/search')
      ).toBe(true);
      expect(
        shouldUseSAMGovExtraction(undefined, 'https://sam.gov/opportunities')
      ).toBe(true);
      expect(shouldUseSAMGovExtraction(null, 'https://other.com')).toBe(false);
    });

    it('should handle empty strings', () => {
      expect(shouldUseSAMGovExtraction('', '')).toBe(false);
      expect(
        shouldUseSAMGovExtraction('', 'https://sam.gov/search')
      ).toBe(true);
    });

    it('should be case-insensitive', () => {
      expect(shouldUseSAMGovExtraction('SAM.GOV', '')).toBe(true);
      expect(shouldUseSAMGovExtraction('Sam.Gov', '')).toBe(true);
      expect(shouldUseSAMGovExtraction('FEDERAL PROCUREMENT', '')).toBe(true);
      expect(
        shouldUseSAMGovExtraction('', 'HTTPS://SAM.GOV/SEARCH')
      ).toBe(true);
    });
  });

  describe('detectPortalTypeFromUrl()', () => {
    it('should detect SAM.gov from various URL patterns', () => {
      expect(
        detectPortalTypeFromUrl('https://sam.gov/search/?index=opp&page=1')
      ).toBe('sam_gov');
      expect(
        detectPortalTypeFromUrl('https://api.sam.gov/opportunities/v2/search')
      ).toBe('sam_gov');
      expect(
        detectPortalTypeFromUrl('https://sam.gov/opp/12345/view')
      ).toBe('sam_gov');
      expect(
        detectPortalTypeFromUrl('https://www.sam.gov/portal/public/SAM')
      ).toBe('sam_gov');
    });

    it('should detect Austin Finance portal', () => {
      expect(
        detectPortalTypeFromUrl(
          'https://financeonline.austintexas.gov/afo/account_services/solicitation/solicitations.cfm'
        )
      ).toBe('austin_finance');
      expect(
        detectPortalTypeFromUrl('https://austintexas.gov/procurement')
      ).toBe('austin_finance');
    });

    it('should detect Bonfire portals', () => {
      expect(
        detectPortalTypeFromUrl('https://bonfirehub.com/opportunities')
      ).toBe('bonfire');
      expect(
        detectPortalTypeFromUrl('https://city.bonfirehub.com/login')
      ).toBe('bonfire');
    });

    it('should detect FindRFP portal', () => {
      expect(
        detectPortalTypeFromUrl('https://findrfp.com/service/detail.aspx')
      ).toBe('findrfp');
      expect(
        detectPortalTypeFromUrl('https://www.findrfp.com/search')
      ).toBe('findrfp');
    });

    it('should return generic for unknown portals', () => {
      expect(detectPortalTypeFromUrl('https://example.com/procurement')).toBe(
        'generic'
      );
      expect(detectPortalTypeFromUrl('https://city.gov/bids')).toBe('generic');
      expect(detectPortalTypeFromUrl('https://unknown-portal.com')).toBe(
        'generic'
      );
    });

    it('should handle malformed URLs gracefully', () => {
      expect(detectPortalTypeFromUrl('not-a-url')).toBe('generic');
      expect(detectPortalTypeFromUrl('')).toBe('generic');
      expect(detectPortalTypeFromUrl('http://')).toBe('generic');
    });

    it('should be case-insensitive for URL detection', () => {
      expect(
        detectPortalTypeFromUrl('HTTPS://SAM.GOV/SEARCH')
      ).toBe('sam_gov');
      expect(
        detectPortalTypeFromUrl('HTTPS://AUSTINTEXAS.GOV/FINANCE')
      ).toBe('austin_finance');
      expect(
        detectPortalTypeFromUrl('HTTPS://BONFIREHUB.COM/OPPS')
      ).toBe('bonfire');
    });

    it('should handle URLs with query parameters and fragments', () => {
      expect(
        detectPortalTypeFromUrl(
          'https://sam.gov/search/?index=opp&page=1&sort=date#results'
        )
      ).toBe('sam_gov');
      expect(
        detectPortalTypeFromUrl(
          'https://bonfirehub.com/opportunities?city=seattle#open'
        )
      ).toBe('bonfire');
    });

    it('should handle URLs with subdomains', () => {
      expect(
        detectPortalTypeFromUrl('https://www.sam.gov/opportunities')
      ).toBe('sam_gov');
      expect(
        detectPortalTypeFromUrl('https://portal.sam.gov/public/SAM')
      ).toBe('sam_gov');
      expect(
        detectPortalTypeFromUrl('https://seattle.bonfirehub.com/opps')
      ).toBe('bonfire');
    });

    it('should prioritize more specific matches', () => {
      // SAM.gov should be detected even if URL contains other keywords
      expect(
        detectPortalTypeFromUrl(
          'https://sam.gov/search/austin-contracts'
        )
      ).toBe('sam_gov');

      // Austin should be detected even if it's a bonfire-hosted portal
      expect(
        detectPortalTypeFromUrl(
          'https://austintexas.gov/bonfire/solicitations'
        )
      ).toBe('austin_finance');
    });
  });

  describe('Portal Type Integration', () => {
    it('should have consistent behavior between detection methods', () => {
      const samGovUrl = 'https://sam.gov/search/?index=opp';

      // Both methods should agree on portal type
      const detectedType = detectPortalTypeFromUrl(samGovUrl);
      const shouldUseSAM = shouldUseSAMGovExtraction(detectedType, samGovUrl);

      expect(detectedType).toBe('sam_gov');
      expect(shouldUseSAM).toBe(true);
    });

    it('should handle portal type normalization consistently', () => {
      const portalTypes = ['sam.gov', 'sam_gov', 'SAM.GOV', 'sam gov'];

      portalTypes.forEach((type) => {
        expect(shouldUseSAMGovExtraction(type, '')).toBe(true);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle special characters in portal type', () => {
      expect(shouldUseSAMGovExtraction('sam.gov-portal', '')).toBe(true);
      expect(shouldUseSAMGovExtraction('sam_gov_portal', '')).toBe(true);
    });

    it('should handle URLs with authentication tokens', () => {
      expect(
        detectPortalTypeFromUrl(
          'https://sam.gov/search/?token=abc123&index=opp'
        )
      ).toBe('sam_gov');
    });

    it('should handle international characters in URLs', () => {
      const urlWithIntlChars =
        'https://example.com/procürëmënt?search=tëst';
      expect(detectPortalTypeFromUrl(urlWithIntlChars)).toBe('generic');
    });

    it('should handle very long URLs', () => {
      const longUrl =
        'https://sam.gov/search/?index=opp&' +
        'q='.repeat(100) +
        'verylongsearchquery';
      expect(detectPortalTypeFromUrl(longUrl)).toBe('sam_gov');
    });
  });
});
