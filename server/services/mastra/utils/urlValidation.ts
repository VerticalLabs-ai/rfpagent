/**
 * URL Validation Utilities for Mastra Scraping Service
 *
 * Portal-specific URL validation and construction logic
 */

import type { Portal } from '@shared/schema';
import { logger } from '../../../utils/logger';
import { extractRFPId, extractSolicitationId } from './helpers';

/**
 * Validate and fix source URL for a given portal and opportunity
 * Rejects generic category URLs and delegates to portal-specific validators
 */
export function validateAndFixSourceUrl(
  url: string,
  portal: Portal,
  opportunity: any
): string | null {
  if (!url) {
    logger.debug('No URL provided for opportunity', {
      opportunityTitle: opportunity.title,
    });
    return null;
  }

  logger.debug('Validating URL', {
    portal: portal.name,
    url,
  });

  // Portal-specific URL validation and fixing
  // Check these first to allow specific patterns that might be rejected by generic checks
  if (portal.url.includes('findrfp.com')) {
    return validateFindRFPUrl(url, opportunity);
  } else if (portal.url.includes('austintexas.gov')) {
    return validateAustinFinanceUrl(url, opportunity);
  } else if (portal.url.includes('bonfire')) {
    return validateBonfireUrl(url);
  } else if (portal.url.includes('sam.gov')) {
    return validateSAMGovUrl(url);
  } else if (portal.url.includes('beaconbid.com')) {
    return validateBeaconBidUrl(url);
  }

  // List of generic/category URL patterns that should be rejected
  const genericPatterns = [
    '/construction-contracts/',
    '/services/',
    '/bids/',
    '/rfps/',
    '/opportunities/',
    '/solicitations/',
    'bid.aspx$', // Generic bid page without specific ID
    'rfp.aspx$', // Generic RFP page without specific ID
    'search.aspx', // Search result pages
    'category.aspx', // Category pages
    'browse.aspx', // Browse pages
  ];

  // Check if URL is a generic category URL
  for (const pattern of genericPatterns) {
    if (url.match(new RegExp(pattern, 'i'))) {
      logger.debug('Rejecting generic URL pattern', {
        pattern,
        url,
      });
      return null;
    }
  }

  // For other portals, basic validation
  return validateGenericUrl(url);
}

/**
 * Validate FindRFP.com specific URLs
 * Must contain detail pages with rfpid parameter
 */
export function validateFindRFPUrl(
  url: string,
  opportunity: any
): string | null {
  // FindRFP specific URLs must contain detail pages with rfpid parameter
  if (
    url.includes('detail.aspx?rfpid=') ||
    url.includes('service/detail.aspx?rfpid=')
  ) {
    logger.debug('Valid FindRFP detail URL', { url });
    return url;
  }

  // Try to construct a proper URL if we have an RFP ID
  const rfpId = extractRFPId(opportunity);
  if (rfpId && url.includes('findrfp.com')) {
    const baseUrl = 'https://findrfp.com/service/detail.aspx';
    const constructedUrl = `${baseUrl}?rfpid=${rfpId}&s=${encodeURIComponent(
      opportunity.title || 'RFP'
    )}&t=CA&ID=${Date.now()}`;
    logger.debug('Constructed FindRFP URL', { constructedUrl });
    return constructedUrl;
  }

  logger.debug('Invalid FindRFP URL (missing rfpid)', { url });
  return null;
}

/**
 * Validate Austin Finance URLs
 * Must contain solicitation_details.cfm with sid parameter
 */
export function validateAustinFinanceUrl(
  url: string,
  opportunity: any
): string | null {
  // Austin Finance URLs must contain solicitation_details.cfm with sid parameter
  if (url.includes('solicitation_details.cfm?sid=')) {
    logger.debug('Valid Austin Finance detail URL', { url });
    return url;
  }

  // Try to construct a proper URL if we have a solicitation ID
  const solicitationId = extractSolicitationId(opportunity);
  if (solicitationId) {
    const baseUrl =
      'https://financeonline.austintexas.gov/afo/account_services/solicitation/solicitation_details.cfm';
    const constructedUrl = `${baseUrl}?sid=${solicitationId}`;
    logger.debug('Constructed Austin Finance URL', { constructedUrl });
    return constructedUrl;
  }

  logger.debug('Invalid Austin Finance URL (missing sid)', { url });
  return null;
}

/**
 * Validate Bonfire URLs
 * Must contain opportunity or bid IDs
 */
export function validateBonfireUrl(url: string): string | null {
  // Bonfire URLs typically contain opportunity or bid IDs
  if (
    url.includes('/opportunities/') ||
    url.includes('/bids/') ||
    url.includes('opportunity_id=') ||
    url.includes('bid_id=')
  ) {
    logger.debug('Valid Bonfire detail URL', { url });
    return url;
  }

  logger.debug('Invalid Bonfire URL (missing specific ID)', { url });
  return null;
}

/**
 * Validate BeaconBid URLs
 * Must contain solicitations path and UUID
 */
export function validateBeaconBidUrl(url: string): string | null {
  // BeaconBid URLs typically contain /solicitations/ and a UUID
  // Format: /solicitations/[agency]/[uuid]/[slug]
  if (url.includes('/solicitations/') && /[a-f0-9-]{36}/i.test(url)) {
    logger.debug('Valid BeaconBid detail URL', { url });
    return url;
  }

  logger.debug('Invalid BeaconBid URL (missing /solicitations/ path or UUID)', {
    url,
  });
  return null;
}

/**
 * Validate SAM.gov URLs
 * Must contain opportunity IDs
 */
export function validateSAMGovUrl(url: string): string | null {
  // SAM.gov URLs typically contain opportunity IDs
  // Support both /opportunities/ (legacy/search) and /opp/ (direct link) formats
  if (
    (url.includes('/opportunities/') || url.includes('/opp/')) &&
    (url.includes('opp-') ||
      url.includes('opportunity-') ||
      /[a-f0-9]{32}/i.test(url))
  ) {
    logger.debug('Valid SAM.gov detail URL', { url });
    return url;
  }

  logger.debug('Invalid SAM.gov URL (missing opportunity ID)', { url });
  return null;
}

/**
 * Validate generic portal URLs
 * Ensures URL contains some form of ID or specific identifier
 */
export function validateGenericUrl(url: string): string | null {
  // For generic portals, ensure URL contains some form of ID or specific identifier
  const hasId =
    /[?&](id|rfp|bid|opp|solicitation)=/i.test(url) ||
    /\/\d+\/?$/.test(url) || // Ends with numeric ID
    /[?&]\w+id=\w+/i.test(url); // Contains some form of ID parameter

  if (hasId) {
    logger.debug('Valid generic detail URL', { url });
    return url;
  }

  logger.debug('Invalid generic URL (no specific ID found)', { url });
  return null;
}
