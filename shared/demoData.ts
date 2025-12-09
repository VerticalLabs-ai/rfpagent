/**
 * Demo RFP Data for testing the full pipeline
 * Based on real SAM.gov opportunity structure
 */

export interface DemoRfpData {
  title: string;
  description: string;
  agency: string;
  category: string;
  naicsCode: string;
  naicsDescription: string;
  pscCode: string;
  pscDescription: string;
  setAsideType: string;
  placeOfPerformance: string;
  state: string;
  contractType: string;
  solicitationNumber: string;
  sourceUrl: string;
  deadline: Date;
  estimatedValue: string;
  requirements: DemoRequirement[];
  complianceItems: Record<string, DemoComplianceItem>;
  riskFlags: string[];
  documents: DemoDocument[];
  contactInfo: {
    name: string;
    email: string;
    phone: string;
  };
}

export interface DemoRequirement {
  id: string;
  section: string;
  text: string;
  mandatory: boolean;
  category: string;
}

export interface DemoComplianceItem {
  requirementText: string;
  status: 'not_addressed' | 'compliant' | 'partial' | 'non_compliant';
  notes: string;
}

export interface DemoDocument {
  filename: string;
  fileType: string;
  fileSize: number;
  description: string;
}

export const DEMO_RFP_DATA: DemoRfpData = {
  title: 'R699-- Relocation and Removal Service',
  description: `The Department of Veterans Affairs, Network Contracting Office 7 (NCO 7) is seeking qualified Service-Disabled Veteran-Owned Small Businesses (SDVOSB) to provide relocation and removal services for the Atlanta VA Health Care System.

This combined synopsis/solicitation includes:
- Household goods relocation within the Atlanta metropolitan area
- Office furniture and equipment moving services
- Secure handling of sensitive VA equipment
- Packing, loading, transport, and unpacking services
- Storage services as needed

The contractor must demonstrate experience with government relocations and maintain all required insurance and bonding.`,
  agency: 'Veterans Affairs, Department of',
  category: 'Moving and Relocation Services',
  naicsCode: '484210',
  naicsDescription: 'Used Household and Office Goods Moving',
  pscCode: 'R699',
  pscDescription: 'Relocation Services',
  setAsideType: 'Service-Disabled Veteran-Owned Small Business (SDVOSB)',
  placeOfPerformance: 'Atlanta, GA',
  state: 'GA',
  contractType: 'Firm-Fixed-Price (FFP)',
  solicitationNumber: '36C24726R0007',
  sourceUrl: 'https://sam.gov/opp/demo-36C24726R0007/view',
  deadline: new Date('2025-12-31T16:00:00.000Z'), // Dec 31, 2025 11:00 AM EST
  estimatedValue: '250000.00',
  requirements: [
    {
      id: 'req-1',
      section: 'Technical Requirements',
      text: 'Contractor must be registered and verified in VetBiz as a Service-Disabled Veteran-Owned Small Business (SDVOSB)',
      mandatory: true,
      category: 'eligibility',
    },
    {
      id: 'req-2',
      section: 'Technical Requirements',
      text: 'Contractor must have a minimum of 3 years experience in commercial/government relocation services',
      mandatory: true,
      category: 'experience',
    },
    {
      id: 'req-3',
      section: 'Technical Requirements',
      text: 'Contractor must maintain cargo insurance of at least $1,000,000 per occurrence',
      mandatory: true,
      category: 'insurance',
    },
    {
      id: 'req-4',
      section: 'Technical Requirements',
      text: 'All personnel must pass VA background security checks prior to performing work',
      mandatory: true,
      category: 'security',
    },
    {
      id: 'req-5',
      section: 'Technical Requirements',
      text: 'Contractor must provide detailed inventory and tracking system for all moved items',
      mandatory: true,
      category: 'tracking',
    },
    {
      id: 'req-6',
      section: 'Past Performance',
      text: 'Provide at least 3 references for similar government or commercial relocation projects completed within the last 3 years',
      mandatory: true,
      category: 'references',
    },
    {
      id: 'req-7',
      section: 'Pricing',
      text: 'Pricing must include all labor, equipment, materials, and transportation costs',
      mandatory: true,
      category: 'pricing',
    },
    {
      id: 'req-8',
      section: 'Delivery',
      text: 'Contractor must be available to perform services within 10 business days of task order issuance',
      mandatory: false,
      category: 'schedule',
    },
  ],
  complianceItems: {
    'req-1': {
      requirementText: 'SDVOSB Registration',
      status: 'not_addressed',
      notes: '',
    },
    'req-2': {
      requirementText: '3 years experience',
      status: 'not_addressed',
      notes: '',
    },
    'req-3': {
      requirementText: 'Cargo insurance $1M',
      status: 'not_addressed',
      notes: '',
    },
    'req-4': {
      requirementText: 'VA background checks',
      status: 'not_addressed',
      notes: '',
    },
    'req-5': {
      requirementText: 'Inventory tracking system',
      status: 'not_addressed',
      notes: '',
    },
    'req-6': {
      requirementText: '3 past performance references',
      status: 'not_addressed',
      notes: '',
    },
    'req-7': {
      requirementText: 'All-inclusive pricing',
      status: 'not_addressed',
      notes: '',
    },
    'req-8': {
      requirementText: '10-day availability',
      status: 'not_addressed',
      notes: '',
    },
  },
  riskFlags: [
    'SDVOSB certification verification required',
    'Background check processing time may impact start date',
    'High-value cargo insurance requirement',
  ],
  documents: [
    {
      filename: 'Solicitation_36C24726R0007.pdf',
      fileType: 'application/pdf',
      fileSize: 2457600, // ~2.4 MB
      description: 'Full solicitation document with all requirements and clauses',
    },
    {
      filename: 'Statement_of_Work_Relocation_Services.docx',
      fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      fileSize: 156672, // ~153 KB
      description: 'Detailed statement of work and performance requirements',
    },
  ],
  contactInfo: {
    name: 'Gail Bargaineer',
    email: 'gail.bargaineer2@va.gov',
    phone: '404-321-6069',
  },
};

/**
 * Get demo RFP data with a fresh deadline (30 days from now)
 */
export function getDemoRfpDataWithFreshDeadline(): DemoRfpData {
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  return {
    ...DEMO_RFP_DATA,
    deadline: thirtyDaysFromNow,
  };
}
