/**
 * SAM.gov API Test Fixtures
 * Mock responses for testing SAM.gov integration
 */

export const mockSearchResponse = {
  opportunitiesData: [
    {
      noticeId: 'abc123def456',
      title: 'IT Services and Support Contract',
      solicitationNumber: 'RFP-2025-001',
      fullParentPathName: 'Department of Defense',
      type: 'Solicitation',
      baseType: 'Presolicitation',
      archiveType: 'auto15',
      archiveDate: '2026-01-15',
      typeOfSetAsideDescription: 'Total Small Business Set-Aside (FAR 19.5)',
      typeOfSetAside: 'SBA',
      responseDeadLine: '2025-12-31T23:59:59-05:00',
      naicsCode: '541512',
      classificationCode: 'D307',
      active: 'Yes',
      award: null,
      pointOfContact: [
        {
          fax: '',
          type: 'primary',
          email: 'contracting.officer@agency.gov',
          phone: '202-555-0100',
          title: null,
          fullName: 'John Smith',
        },
      ],
      description:
        'The Department of Defense is seeking qualified contractors to provide comprehensive IT services and support for our enterprise systems.',
      organizationType: 'OFFICE',
      officeAddress: {
        zipcode: '20301',
        city: 'Washington',
        countryCode: 'USA',
        state: 'DC',
      },
      placeOfPerformance: {
        city: {
          code: '51000',
          name: 'Washington',
        },
        state: {
          code: 'DC',
          name: 'District of Columbia',
        },
        country: {
          code: 'USA',
          name: 'UNITED STATES',
        },
      },
      additionalInfoLink:
        'https://sam.gov/opp/abc123def456/view?index=opp&page=1',
      uiLink:
        'https://sam.gov/opp/abc123def456/view?index=opp&keywords=&sort=-modifiedDate',
    },
  ],
  links: [
    {
      rel: 'self',
      href: 'https://api.sam.gov/opportunities/v2/search?limit=50&offset=0',
    },
  ],
  totalRecords: 1,
};

export const mockOpportunityDetailsResponse = {
  noticeId: 'abc123def456',
  title: 'IT Services and Support Contract',
  solicitationNumber: 'RFP-2025-001',
  department: 'DEPT OF DEFENSE',
  subTier: 'DEFENSE INFORMATION SYSTEMS AGENCY',
  office: 'DISA-ENTERPRISE SERVICES DIRECTORATE',
  fullParentPathName:
    'DEPT OF DEFENSE.DEFENSE INFORMATION SYSTEMS AGENCY.DISA-ENTERPRISE SERVICES DIRECTORATE',
  postedDate: '2025-01-15',
  type: 'Solicitation',
  baseType: 'Presolicitation',
  archiveType: 'auto15',
  archiveDate: '2026-01-15',
  responseDeadLine: '2025-12-31T23:59:59-05:00',
  naicsCode: '541512',
  classificationCode: 'D307',
  active: 'Yes',
  description:
    'The Department of Defense is seeking qualified contractors to provide comprehensive IT services and support for our enterprise systems. This includes network administration, cybersecurity, help desk support, and system maintenance.',
  organizationType: 'OFFICE',
  officeAddress: {
    zipcode: '20301',
    city: 'Washington',
    countryCode: 'USA',
    state: 'DC',
  },
  placeOfPerformance: {
    city: {
      code: '51000',
      name: 'Washington',
    },
    state: {
      code: 'DC',
      name: 'District of Columbia',
    },
    country: {
      code: 'USA',
      name: 'UNITED STATES',
    },
  },
  pointOfContact: [
    {
      fax: '',
      type: 'primary',
      email: 'contracting.officer@agency.gov',
      phone: '202-555-0100',
      title: 'Contracting Officer',
      fullName: 'John Smith',
    },
  ],
  attachments: [
    {
      resourceId: 'attach-001',
      name: 'SOW_RFP-2025-001.pdf',
      type: 'Statement of Work',
      postedDate: '2025-01-15',
      accessLevel: 'public',
      downloadUrl:
        'https://sam.gov/api/prod/opps/v3/opportunities/resources/files/abc123def456/download?api_key=',
      fileSize: 524288,
      mimeType: 'application/pdf',
    },
    {
      resourceId: 'attach-002',
      name: 'Pricing_Template.xlsx',
      type: 'Pricing Template',
      postedDate: '2025-01-15',
      accessLevel: 'public',
      downloadUrl:
        'https://sam.gov/api/prod/opps/v3/opportunities/resources/files/abc123def456/download?api_key=',
      fileSize: 102400,
      mimeType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    },
  ],
};

export const mockAttachmentsResponse = {
  content: [
    {
      resourceId: 'attach-001',
      name: 'SOW_RFP-2025-001.pdf',
      type: 'Statement of Work',
      postedDate: '2025-01-15',
      accessLevel: 'public',
      downloadUrl:
        'https://sam.gov/api/prod/opps/v3/opportunities/resources/files/abc123def456/download?api_key=TEST_KEY',
      fileSize: 524288,
      mimeType: 'application/pdf',
    },
    {
      resourceId: 'attach-002',
      name: 'Pricing_Template.xlsx',
      type: 'Pricing Template',
      postedDate: '2025-01-15',
      accessLevel: 'public',
      downloadUrl:
        'https://sam.gov/api/prod/opps/v3/opportunities/resources/files/abc123def456/download?api_key=TEST_KEY',
      fileSize: 102400,
      mimeType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    },
    {
      resourceId: 'attach-003',
      name: 'Requirements_Matrix.docx',
      type: 'Requirements',
      postedDate: '2025-01-15',
      accessLevel: 'public',
      downloadUrl:
        'https://sam.gov/api/prod/opps/v3/opportunities/resources/files/abc123def456/download?api_key=TEST_KEY',
      fileSize: 204800,
      mimeType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    },
  ],
  totalElements: 3,
};

export const mockRateLimitHeaders = {
  'x-ratelimit-limit': '10000',
  'x-ratelimit-remaining': '9995',
  'x-ratelimit-reset': '1735689600',
};

export const mockErrorResponse = {
  error: {
    code: 'INVALID_API_KEY',
    message: 'The API key provided is invalid or expired',
  },
};

export const mockEmptySearchResponse = {
  opportunitiesData: [],
  links: [
    {
      rel: 'self',
      href: 'https://api.sam.gov/opportunities/v2/search?limit=50&offset=0',
    },
  ],
  totalRecords: 0,
};
