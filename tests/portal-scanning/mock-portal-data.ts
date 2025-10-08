/**
 * Mock Portal Data Generators
 *
 * Utilities for generating realistic mock portal and RFP data for testing.
 */

import { nanoid } from 'nanoid';

export interface MockRFPData {
  title: string;
  description: string;
  agency: string;
  sourceUrl: string;
  deadline: Date;
  estimatedValue: number;
  portalId: string;
  category?: string;
  documents?: Array<{
    name: string;
    url: string;
    type: string;
  }>;
}

export interface MockPortalData {
  id: string;
  name: string;
  url: string;
  type: 'federal' | 'state' | 'local' | 'municipal';
  status: 'active' | 'inactive' | 'error';
  requiresAuth: boolean;
  authType?: 'basic' | 'oauth' | 'sso';
  credentials?: {
    username: string;
    password: string;
  };
  selectors?: {
    rfpList: string;
    rfpItem: string;
    title: string;
    agency?: string;
    deadline?: string;
    link: string;
  };
}

/**
 * Generate a realistic RFP title
 */
export function generateRFPTitle(category?: string): string {
  const categories = {
    it: [
      'Cloud Infrastructure Migration Services',
      'Cybersecurity Assessment and Remediation',
      'Enterprise Software Development',
      'Data Center Modernization',
      'Network Security Implementation',
      'IT Help Desk Support Services',
      'Database Administration and Support',
      'Application Development and Maintenance',
    ],
    construction: [
      'Building Renovation and Repair',
      'Road Resurfacing and Maintenance',
      'Bridge Inspection and Repair',
      'Facility Construction Management',
      'HVAC System Installation',
      'Electrical Infrastructure Upgrade',
      'Plumbing System Modernization',
    ],
    consulting: [
      'Management Consulting Services',
      'Strategic Planning Assistance',
      'Process Improvement Consulting',
      'Change Management Support',
      'Financial Advisory Services',
      'Human Resources Consulting',
    ],
    equipment: [
      'Office Equipment and Furniture',
      'Medical Equipment Procurement',
      'Vehicle Fleet Acquisition',
      'Laboratory Equipment',
      'Communications Equipment',
    ],
  };

  const selectedCategory = category || Object.keys(categories)[Math.floor(Math.random() * Object.keys(categories).length)] as keyof typeof categories;
  const titles = categories[selectedCategory] || categories.it;

  return titles[Math.floor(Math.random() * titles.length)];
}

/**
 * Generate realistic RFP description
 */
export function generateRFPDescription(title: string): string {
  const templates = [
    `The ${title} project requires a qualified vendor to provide comprehensive services. The selected contractor will be responsible for all aspects of project delivery including planning, implementation, and ongoing support. This is a critical initiative for our organization.`,
    `We are seeking proposals for ${title}. The successful bidder will demonstrate expertise in this domain and provide innovative solutions. Detailed requirements are outlined in the attached documentation. Vendors must meet all mandatory qualifications.`,
    `This RFP is for ${title} services. The contract period will be three years with two optional renewal years. Respondents should have proven experience and strong references. Minority-owned businesses are encouraged to apply.`,
    `The purpose of this solicitation is to obtain ${title}. The selected vendor will work closely with our team to ensure project success. Proposals must include detailed pricing, timeline, and approach methodology.`,
  ];

  return templates[Math.floor(Math.random() * templates.length)];
}

/**
 * Generate a list of government agencies
 */
export function generateAgency(): string {
  const agencies = [
    'Department of Technology',
    'Department of Public Works',
    'Department of Health Services',
    'Department of Education',
    'Department of Transportation',
    'Office of the City Manager',
    'Parks and Recreation Department',
    'Police Department',
    'Fire Department',
    'Department of Finance',
    'Human Resources Department',
    'Department of Environmental Services',
    'Department of Economic Development',
    'Library Services Department',
    'Department of Housing',
  ];

  return agencies[Math.floor(Math.random() * agencies.length)];
}

/**
 * Generate mock RFP data
 */
export function generateMockRFP(portalId: string, options: {
  category?: string;
  daysUntilDeadline?: number;
  includeDocuments?: boolean;
} = {}): MockRFPData {
  const {
    category,
    daysUntilDeadline = 30 + Math.floor(Math.random() * 60),
    includeDocuments = true,
  } = options;

  const title = generateRFPTitle(category);
  const description = generateRFPDescription(title);
  const agency = generateAgency();
  const rfpId = nanoid(8);
  const deadline = new Date(Date.now() + daysUntilDeadline * 24 * 60 * 60 * 1000);
  const estimatedValue = Math.floor(Math.random() * 1000000) + 50000;

  const rfp: MockRFPData = {
    title,
    description,
    agency,
    sourceUrl: `https://test-portal.gov/opportunity/${rfpId}`,
    deadline,
    estimatedValue,
    portalId,
    category,
  };

  if (includeDocuments) {
    rfp.documents = [
      {
        name: 'RFP Document.pdf',
        url: `https://test-portal.gov/documents/${rfpId}/rfp.pdf`,
        type: 'pdf',
      },
      {
        name: 'Technical Specifications.docx',
        url: `https://test-portal.gov/documents/${rfpId}/tech-specs.docx`,
        type: 'docx',
      },
      {
        name: 'Vendor Requirements.pdf',
        url: `https://test-portal.gov/documents/${rfpId}/requirements.pdf`,
        type: 'pdf',
      },
    ];
  }

  return rfp;
}

/**
 * Generate multiple mock RFPs
 */
export function generateMockRFPs(
  portalId: string,
  count: number,
  options: {
    category?: string;
    minDeadline?: number;
    maxDeadline?: number;
    includeDocuments?: boolean;
  } = {}
): MockRFPData[] {
  const rfps: MockRFPData[] = [];

  for (let i = 0; i < count; i++) {
    const daysUntilDeadline = options.minDeadline && options.maxDeadline
      ? options.minDeadline + Math.floor(Math.random() * (options.maxDeadline - options.minDeadline))
      : undefined;

    rfps.push(generateMockRFP(portalId, {
      ...options,
      daysUntilDeadline,
    }));
  }

  return rfps;
}

/**
 * Generate mock portal configuration
 */
export function generateMockPortal(options: {
  type?: 'federal' | 'state' | 'local' | 'municipal';
  requiresAuth?: boolean;
  status?: 'active' | 'inactive' | 'error';
} = {}): MockPortalData {
  const {
    type = 'federal',
    requiresAuth = false,
    status = 'active',
  } = options;

  const portalId = nanoid(10);
  const portalNames = {
    federal: ['SAM.gov Federal Portal', 'FedBizOpps', 'GSA eBuy Portal'],
    state: ['State Procurement Portal', 'State Contracting System'],
    local: ['City Procurement Portal', 'County Bidding System'],
    municipal: ['Municipal RFP Portal', 'Town Contracting System'],
  };

  const names = portalNames[type];
  const name = names[Math.floor(Math.random() * names.length)];

  const portal: MockPortalData = {
    id: portalId,
    name,
    url: `https://${type}-portal-${portalId.substring(0, 6)}.gov`,
    type,
    status,
    requiresAuth,
    selectors: {
      rfpList: '.opportunities-list',
      rfpItem: '.opportunity-item',
      title: '.opportunity-title',
      agency: '.agency-name',
      deadline: '.deadline-date',
      link: 'a.opportunity-link',
    },
  };

  if (requiresAuth) {
    portal.authType = 'basic';
    portal.credentials = {
      username: `test_user_${portalId.substring(0, 6)}`,
      password: 'test-password-123',
    };
  }

  return portal;
}

/**
 * Generate portal with associated RFPs
 */
export function generatePortalWithRFPs(options: {
  rfpCount?: number;
  portalType?: 'federal' | 'state' | 'local' | 'municipal';
  requiresAuth?: boolean;
  includeExpiredRFPs?: boolean;
}): {
  portal: MockPortalData;
  rfps: MockRFPData[];
} {
  const {
    rfpCount = 10,
    portalType = 'federal',
    requiresAuth = false,
    includeExpiredRFPs = false,
  } = options;

  const portal = generateMockPortal({
    type: portalType,
    requiresAuth,
  });

  const rfps: MockRFPData[] = [];

  // Generate active RFPs
  const activeCount = includeExpiredRFPs ? Math.floor(rfpCount * 0.8) : rfpCount;
  rfps.push(...generateMockRFPs(portal.id, activeCount, {
    minDeadline: 1,
    maxDeadline: 90,
  }));

  // Generate expired RFPs if requested
  if (includeExpiredRFPs) {
    const expiredCount = rfpCount - activeCount;
    rfps.push(...generateMockRFPs(portal.id, expiredCount, {
      minDeadline: -30,
      maxDeadline: -1,
    }));
  }

  return { portal, rfps };
}

/**
 * Generate dataset for performance testing
 */
export function generateLargeDataset(options: {
  portalCount?: number;
  rfpsPerPortal?: number;
  includeVariance?: boolean;
}): Array<{
  portal: MockPortalData;
  rfps: MockRFPData[];
}> {
  const {
    portalCount = 10,
    rfpsPerPortal = 100,
    includeVariance = true,
  } = options;

  const dataset: Array<{
    portal: MockPortalData;
    rfps: MockRFPData[];
  }> = [];

  for (let i = 0; i < portalCount; i++) {
    const rfpCount = includeVariance
      ? Math.floor(rfpsPerPortal * (0.5 + Math.random()))
      : rfpsPerPortal;

    const portalType = ['federal', 'state', 'local', 'municipal'][i % 4] as any;

    dataset.push(
      generatePortalWithRFPs({
        rfpCount,
        portalType,
        requiresAuth: i % 3 === 0, // Every 3rd portal requires auth
        includeExpiredRFPs: i % 5 === 0, // Every 5th portal has expired RFPs
      })
    );
  }

  return dataset;
}

/**
 * Generate RFP update scenarios for incremental scanning tests
 */
export function generateRFPUpdates(originalRFP: MockRFPData): {
  unchanged: MockRFPData;
  deadlineChanged: MockRFPData;
  descriptionChanged: MockRFPData;
  valueChanged: MockRFPData;
} {
  return {
    unchanged: { ...originalRFP },
    deadlineChanged: {
      ...originalRFP,
      deadline: new Date(originalRFP.deadline.getTime() + 7 * 24 * 60 * 60 * 1000),
    },
    descriptionChanged: {
      ...originalRFP,
      description: originalRFP.description + ' [UPDATED: Additional requirements added]',
    },
    valueChanged: {
      ...originalRFP,
      estimatedValue: originalRFP.estimatedValue * 1.2,
    },
  };
}

/**
 * Generate network error scenarios
 */
export function generateNetworkErrors(): Array<{
  name: string;
  error: Error;
  shouldRetry: boolean;
}> {
  return [
    {
      name: 'Connection Timeout',
      error: new Error('ETIMEDOUT: Connection timed out'),
      shouldRetry: true,
    },
    {
      name: 'Connection Refused',
      error: new Error('ECONNREFUSED: Connection refused'),
      shouldRetry: true,
    },
    {
      name: 'DNS Lookup Failed',
      error: new Error('ENOTFOUND: DNS lookup failed'),
      shouldRetry: false,
    },
    {
      name: 'HTTP 404',
      error: new Error('HTTP 404: Not Found'),
      shouldRetry: false,
    },
    {
      name: 'HTTP 500',
      error: new Error('HTTP 500: Internal Server Error'),
      shouldRetry: true,
    },
    {
      name: 'HTTP 503',
      error: new Error('HTTP 503: Service Unavailable'),
      shouldRetry: true,
    },
    {
      name: 'SSL Certificate Error',
      error: new Error('SSL certificate validation failed'),
      shouldRetry: false,
    },
    {
      name: 'Rate Limit Exceeded',
      error: new Error('HTTP 429: Too Many Requests'),
      shouldRetry: true,
    },
  ];
}

/**
 * Generate authentication failure scenarios
 */
export function generateAuthErrors(): Array<{
  name: string;
  error: Error;
  recoverable: boolean;
}> {
  return [
    {
      name: 'Invalid Credentials',
      error: new Error('Authentication failed: Invalid username or password'),
      recoverable: false,
    },
    {
      name: 'Account Locked',
      error: new Error('Authentication failed: Account is locked'),
      recoverable: false,
    },
    {
      name: '2FA Required',
      error: new Error('Authentication failed: Two-factor authentication required'),
      recoverable: false,
    },
    {
      name: 'Session Expired',
      error: new Error('Authentication failed: Session expired'),
      recoverable: true,
    },
    {
      name: 'SSO Required',
      error: new Error('Authentication failed: Single Sign-On required'),
      recoverable: false,
    },
    {
      name: 'Token Expired',
      error: new Error('Authentication failed: Access token expired'),
      recoverable: true,
    },
  ];
}
