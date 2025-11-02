import { describe, it, expect } from '@jest/globals';
import { extractSaflaStrategyDetails } from '../server/services/workflows/saflaStrategyUtils';

describe('SAFLA strategy utilities', () => {
  it('returns strategy metadata when present', () => {
    const { strategy, metadata } = extractSaflaStrategyDetails({
      saflaStrategy: { mode: 'adaptive', retries: 2 },
      saflaStrategyMetadata: { confidence: 0.92, domain: 'portal_navigation' },
    });

    expect(strategy).toEqual({ mode: 'adaptive', retries: 2 });
    expect(metadata).toEqual({
      confidence: 0.92,
      domain: 'portal_navigation',
    });
  });

  it('returns null strategy metadata when missing or invalid', () => {
    const empty = extractSaflaStrategyDetails(null);
    expect(empty).toEqual({ strategy: null, metadata: null });

    const malformed = extractSaflaStrategyDetails({
      saflaStrategy: 'not-an-object',
      saflaStrategyMetadata: 7,
    } as unknown as Record<string, unknown>);
    expect(malformed).toEqual({ strategy: null, metadata: null });
  });
});

