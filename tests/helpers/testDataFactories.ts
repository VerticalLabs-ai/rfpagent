/**
 * Test Data Factories for RFP Agent Platform
 * Provides consistent test data generation for automated testing
 */

import { randomUUID } from 'crypto';

/**
 * Create a valid RFP payload for testing
 */
export function createTestRfp(overrides: Partial<any> = {}) {
  const now = new Date();
  const deadline = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from now

  return {
    title: `Test RFP - ${randomUUID().substring(0, 8)}`,
    agency: 'Test Government Agency',
    sourceUrl: `https://example.gov/rfps/${randomUUID()}`,
    description: 'Test RFP description for automated testing',
    category: 'IT Services',
    deadline: deadline.toISOString(),
    estimatedValue: 100000,
    status: 'discovered',
    progress: 0,
    addedBy: 'manual',
    ...overrides,
  };
}

/**
 * Create a valid RFP payload with portal reference
 */
export function createTestRfpWithPortal(portalId: string, overrides: Partial<any> = {}) {
  return createTestRfp({
    portalId,
    ...overrides,
  });
}

/**
 * Create a minimal valid RFP (only required fields)
 */
export function createMinimalRfp(overrides: Partial<any> = {}) {
  return {
    title: `Minimal Test RFP`,
    agency: 'Test Agency',
    sourceUrl: 'https://example.gov/rfp/test',
    ...overrides,
  };
}

/**
 * Create a valid portal payload
 */
export function createTestPortal(overrides: Partial<any> = {}) {
  return {
    name: `Test Portal - ${randomUUID().substring(0, 8)}`,
    url: `https://portal-${randomUUID().substring(0, 8)}.example.gov`,
    type: 'general',
    isActive: true,
    monitoringEnabled: true,
    loginRequired: false,
    status: 'active',
    scanFrequency: 24,
    maxRfpsPerScan: 50,
    ...overrides,
  };
}

/**
 * Create a valid proposal payload
 */
export function createTestProposal(rfpId: string, overrides: Partial<any> = {}) {
  return {
    rfpId,
    content: {},
    narratives: {},
    pricingTables: {},
    forms: {},
    attachments: {},
    proposalData: {},
    status: 'draft',
    ...overrides,
  };
}

/**
 * Create a valid company profile payload
 */
export function createTestCompanyProfile(overrides: Partial<any> = {}) {
  return {
    name: `Test Company - ${randomUUID().substring(0, 8)}`,
    description: 'Test company for automated testing',
    companyData: {
      address: '123 Test St, Test City, TS 12345',
      phone: '555-0100',
      email: 'test@example.com',
      website: 'https://example.com',
      ...overrides.companyData,
    },
    ...overrides,
  };
}

/**
 * Create a valid discovery workflow payload
 */
export function createTestDiscoveryWorkflow(portalIds: string[], overrides: Partial<any> = {}) {
  return {
    portalIds,
    sessionId: `test-session-${randomUUID()}`,
    priority: 5,
    options: {},
    ...overrides,
  };
}

/**
 * Create a valid document payload
 */
export function createTestDocument(rfpId: string, overrides: Partial<any> = {}) {
  return {
    rfpId,
    filename: `test-document-${randomUUID().substring(0, 8)}.pdf`,
    fileType: 'application/pdf',
    objectPath: `/documents/${randomUUID()}.pdf`,
    ...overrides,
  };
}

/**
 * Create a batch of test RFPs
 */
export function createTestRfpBatch(count: number, overrides: Partial<any> = {}) {
  return Array.from({ length: count }, (_, index) =>
    createTestRfp({
      title: `Test RFP Batch Item ${index + 1}`,
      ...overrides,
    })
  );
}

/**
 * Create test data with relationships
 */
export function createCompleteTestData() {
  const portalId = randomUUID();
  const rfpId = randomUUID();
  const proposalId = randomUUID();
  const companyProfileId = randomUUID();

  return {
    portal: createTestPortal({ id: portalId }),
    rfp: createTestRfpWithPortal(portalId, { id: rfpId }),
    proposal: createTestProposal(rfpId, { id: proposalId }),
    companyProfile: createTestCompanyProfile({ id: companyProfileId }),
    document: createTestDocument(rfpId),
  };
}

/**
 * Validation helpers for test assertions
 */
export const testValidators = {
  isValidRfp: (rfp: any): boolean => {
    return !!(
      rfp &&
      rfp.title &&
      rfp.agency &&
      rfp.sourceUrl &&
      rfp.id
    );
  },

  isValidPortal: (portal: any): boolean => {
    return !!(
      portal &&
      portal.name &&
      portal.url &&
      portal.id
    );
  },

  isValidProposal: (proposal: any): boolean => {
    return !!(
      proposal &&
      proposal.rfpId &&
      proposal.id &&
      proposal.status
    );
  },

  isPaginatedResponse: (response: any): boolean => {
    return !!(
      response &&
      response.success &&
      Array.isArray(response.data) &&
      response.pagination &&
      typeof response.pagination.total === 'number' &&
      typeof response.pagination.page === 'number' &&
      typeof response.pagination.limit === 'number'
    );
  },

  isErrorResponse: (response: any): boolean => {
    return !!(
      response &&
      response.success === false &&
      response.error
    );
  },

  hasValidationErrors: (response: any): boolean => {
    return !!(
      response &&
      response.success === false &&
      response.error === 'Validation failed' &&
      Array.isArray(response.details)
    );
  },
};

/**
 * API response helpers for testing
 */
export const testResponses = {
  success: (data: any, message?: string) => ({
    success: true,
    data,
    message: message || 'Operation successful',
  }),

  error: (error: string, details?: any) => ({
    success: false,
    error,
    details,
  }),

  paginated: (data: any[], total: number, page: number = 1, limit: number = 20) => ({
    success: true,
    data,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  }),

  validationError: (errors: Array<{ field: string; message: string }>) => ({
    success: false,
    error: 'Validation failed',
    details: errors,
    summary: `${errors.length} validation error(s) found`,
  }),
};

/**
 * Example usage patterns for documentation
 */
export const examples = {
  // Create a single RFP
  singleRfp: createTestRfp(),

  // Create an RFP with custom values
  customRfp: createTestRfp({
    title: 'Custom RFP Title',
    estimatedValue: 500000,
    status: 'drafting',
  }),

  // Create minimal RFP (required fields only)
  minimalRfp: createMinimalRfp(),

  // Create complete test dataset with relationships
  completeData: createCompleteTestData(),

  // Create RFP batch for pagination testing
  rfpBatch: createTestRfpBatch(25),

  // Create discovery workflow
  discoveryWorkflow: (portalIds: string[]) => createTestDiscoveryWorkflow(portalIds),
};
