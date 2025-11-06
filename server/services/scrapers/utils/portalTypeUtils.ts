const AUSTIN_PORTAL_ALIASES = new Set([
  'austin finance online',
  'austin finance',
  'austin texas',
  'city of austin',
  'austin',
  'austin texas portal',
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
