import { describe, expect, it } from '@jest/globals';
import {
  normalizePortalType,
  shouldUseAustinPortalExtraction,
} from '../../server/services/scrapers/utils/portalTypeUtils';

describe('Austin portal detection helpers', () => {
  it('normalizes portal type by lowering case and collapsing separators', () => {
    expect(normalizePortalType('Austin_Finance-Online')).toBe(
      'austin finance online'
    );
    expect(normalizePortalType('  Austin   Texas ')).toBe('austin texas');
  });

  it('detects Austin portals based on known aliases', () => {
    expect(
      shouldUseAustinPortalExtraction(
        'Austin Finance Online',
        'https://financeonline.austintexas.gov/'
      )
    ).toBe(true);
    expect(
      shouldUseAustinPortalExtraction(
        'City of Austin',
        'https://example.com/some/other/portal'
      )
    ).toBe(true);
  });

  it('detects Austin portals when URL points to austintexas.gov', () => {
    expect(
      shouldUseAustinPortalExtraction(
        'Municipal Procurement',
        'https://financeonline.austintexas.gov/afo/account_services/solicitation/solicitations.cfm'
      )
    ).toBe(true);
  });

  it('does not flag unrelated portals', () => {
    expect(
      shouldUseAustinPortalExtraction(
        'Metropolitan Procurement',
        'https://example.com/solicitations'
      )
    ).toBe(false);
  });
});
