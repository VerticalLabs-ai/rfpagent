const AUSTIN_PORTAL_ALIASES = new Set([
  'austin finance online',
  'austin finance',
  'austin texas',
  'city of austin',
  'austin',
  'austin texas portal',
]);

const SAM_GOV_PORTAL_ALIASES = new Set([
  'sam.gov',
  'sam gov',
  'samgov',
  'sam',
  'system for award management',
  'federal procurement',
  'federal contracting',
  'government contracts',
]);

export function normalizePortalType(
  portalType: string | null | undefined
): string {
  return (portalType || '')
    .toLowerCase()
    .replace(/[\s_-]+/g, ' ')
    .trim();
}

export function shouldUseAustinPortalExtraction(
  portalType: string | null | undefined,
  url: string
): boolean {
  const normalizedType = normalizePortalType(portalType);
  if (!normalizedType && !url) {
    return false;
  }

  if (AUSTIN_PORTAL_ALIASES.has(normalizedType)) {
    return true;
  }

  if (normalizedType.includes('austin')) {
    return true;
  }

  return (url || '').toLowerCase().includes('austintexas.gov');
}

/**
 * Detect if a portal is SAM.gov (System for Award Management)
 *
 * @param portalType - Portal type identifier
 * @param url - Portal URL
 * @returns True if portal is SAM.gov
 */
export function shouldUseSAMGovExtraction(
  portalType: string | null | undefined,
  url: string
): boolean {
  const normalizedType = normalizePortalType(portalType);

  // Check portal type aliases
  if (SAM_GOV_PORTAL_ALIASES.has(normalizedType)) {
    return true;
  }

  // Check if type contains SAM or federal keywords
  if (
    normalizedType.includes('sam') ||
    normalizedType.includes('federal') ||
    normalizedType.includes('government')
  ) {
    return true;
  }

  // Check URL patterns
  const urlLower = (url || '').toLowerCase();
  return (
    urlLower.includes('sam.gov') ||
    urlLower.includes('api.sam.gov') ||
    urlLower.includes('beta.sam.gov')
  );
}

/**
 * Detect portal type from URL
 *
 * @param url - Portal URL
 * @returns Detected portal type identifier
 */
export function detectPortalTypeFromUrl(url: string): string {
  const urlLower = url.toLowerCase();

  // SAM.gov detection
  if (urlLower.includes('sam.gov')) {
    return 'sam_gov';
  }

  // Austin Finance Online detection
  if (
    urlLower.includes('austintexas.gov') ||
    urlLower.includes('financeonline')
  ) {
    return 'austin_finance';
  }

  // Philadelphia detection
  if (urlLower.includes('phila.gov') || urlLower.includes('phlcontracts')) {
    return 'philadelphia';
  }

  // BeaconBid detection
  if (urlLower.includes('beaconbid.com')) {
    return 'beacon_bid';
  }

  // BonfireHub detection
  if (urlLower.includes('bonfirehub.com')) {
    return 'bonfire_hub';
  }

  return 'generic';
}
