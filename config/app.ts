/**
 * Application Configuration
 *
 * Centralized configuration for application settings.
 * Environment variables take precedence over defaults.
 */

import { createDefaultCompanyMapping } from '../server/config/defaultCompanyMapping';

/**
 * Get the company name from configuration
 * Priority order:
 * 1. COMPANY_NAME environment variable
 * 2. Default company mapping configuration
 *
 * @throws {Error} If no company name is configured
 */
export function getCompanyName(): string {
  const envCompanyName = process.env.COMPANY_NAME;

  if (envCompanyName && envCompanyName.trim()) {
    return envCompanyName.trim();
  }

  // Fallback to default company mapping
  const defaultMapping = createDefaultCompanyMapping();
  const defaultCompanyName = defaultMapping.profile.companyName;

  if (!defaultCompanyName) {
    throw new Error(
      'COMPANY_NAME is not configured. Please set the COMPANY_NAME environment variable or update the default company mapping.'
    );
  }

  return defaultCompanyName;
}

/**
 * Application configuration object
 */
export const appConfig = {
  /**
   * Company name used in proposals and documents
   */
  get companyName(): string {
    return getCompanyName();
  },

  /**
   * Get full company profile from default mapping
   */
  getCompanyProfile() {
    return createDefaultCompanyMapping();
  },
};
