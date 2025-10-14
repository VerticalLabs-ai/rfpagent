/**
 * Default Company Mapping Configuration
 *
 * This file contains the default company profile data used when no company profile
 * is provided during proposal generation. This ensures consistent default values
 * across all services.
 *
 * Used by:
 * - server/services/proposals/enhancedProposalService.ts
 * - server/services/specialists/proposalGenerationSpecialists.ts
 */

export interface DefaultCompanyMappingConfig {
  profile: {
    id: string;
    companyName: string;
    dba: string | null;
    businessAddress: string;
    mailingAddress: string;
    phoneNumber: string;
    emailAddress: string;
    website: string;
    federalTaxId: string;
    dunsNumber: string | null;
    cageCode: string | null;
    primaryBusinessCategory: string;
    yearEstablished: number;
    numberOfEmployees: number;
    annualRevenue: number;
    businessDescription: string;
    createdAt: Date;
    updatedAt: Date;
  };
  relevantCertifications: Array<{
    id: string;
    companyProfileId: string;
    certificationType: string;
    certificationNumber: string;
    certifyingAgency: string;
    issueDate: Date;
    expirationDate: Date;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }>;
  applicableInsurance: Array<{
    id: string;
    companyProfileId: string;
    insuranceType: string;
    carrier: string;
    policyNumber: string;
    coverageAmount: number;
    effectiveDate: Date;
    expirationDate: Date;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }>;
  assignedContacts: Array<{
    role: string;
    contact: {
      id: string;
      companyProfileId: string;
      firstName: string;
      lastName: string;
      title: string;
      department: string;
      phoneNumber: string;
      emailAddress: string;
      isPrimary: boolean;
      createdAt: Date;
      updatedAt: Date;
    };
    reason: string;
  }>;
  businessClassifications: {
    naics: string[];
    nigp: string[];
    categories: string[];
  };
  socioEconomicQualifications: {
    smallBusiness: boolean;
    womanOwned: boolean;
    minorityOwned: boolean;
    veteranOwned: boolean;
    hubZone: boolean;
  };
  identifiers: Array<{
    id: string;
    companyProfileId: string;
    identifierType: string;
    identifierValue: string;
    issuingEntity?: string;
    description?: string;
    isActive: boolean;
    createdAt: Date;
  }>;
  addresses: Array<{
    type: string;
    line1: string;
    line2?: string;
    city: string;
    state: string;
    zipCode: string;
  }>;
}

/**
 * Factory function to create a fresh default company mapping with current timestamps
 */
export function createDefaultCompanyMapping(): DefaultCompanyMappingConfig {
  const now = new Date();

  return {
    profile: {
      id: 'default',
      companyName: 'iByte Enterprises LLC',
      dba: null,
      businessAddress: '123 Main St, City, State 12345',
      mailingAddress: '123 Main St, City, State 12345',
      phoneNumber: '(555) 123-4567',
      emailAddress: 'contact@ibyte.com',
      website: 'https://ibyte.com',
      federalTaxId: '12-3456789',
      dunsNumber: null,
      cageCode: null,
      primaryBusinessCategory: 'Technology Services',
      yearEstablished: 2020,
      numberOfEmployees: 10,
      annualRevenue: 1000000,
      businessDescription:
        'Leading provider of technology and consulting services',
      createdAt: now,
      updatedAt: now,
    },
    relevantCertifications: [
      {
        id: 'cert1',
        companyProfileId: 'default',
        certificationType: 'Woman-Owned Business Enterprise',
        certificationNumber: 'WBENC-12345',
        certifyingAgency: 'WBENC',
        issueDate: new Date('2024-01-01'),
        expirationDate: new Date('2026-01-01'),
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
    ],
    applicableInsurance: [
      {
        id: 'ins1',
        companyProfileId: 'default',
        insuranceType: 'General Liability',
        carrier: 'Insurance Company',
        policyNumber: 'GL-123456',
        coverageAmount: 2000000,
        effectiveDate: new Date('2024-01-01'),
        expirationDate: new Date('2025-01-01'),
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
    ],
    assignedContacts: [
      {
        role: 'Primary Contact',
        contact: {
          id: 'contact1',
          companyProfileId: 'default',
          firstName: 'Jane',
          lastName: 'Doe',
          title: 'CEO',
          department: 'Executive',
          phoneNumber: '(555) 123-4567',
          emailAddress: 'jane.doe@ibyte.com',
          isPrimary: true,
          createdAt: now,
          updatedAt: now,
        },
        reason: 'Primary business contact',
      },
    ],
    businessClassifications: {
      naics: ['541511', '541512'],
      nigp: ['925-20', '960-50'],
      categories: ['Technology Services', 'Consulting'],
    },
    socioEconomicQualifications: {
      smallBusiness: true,
      womanOwned: true,
      minorityOwned: false,
      veteranOwned: false,
      hubZone: false,
    },
    identifiers: [
      {
        id: 'id-duns',
        companyProfileId: 'default',
        identifierType: 'duns',
        identifierValue: '000000000',
        issuingEntity: 'Dun & Bradstreet',
        description: 'DUNS Number',
        isActive: true,
        createdAt: now,
      },
      {
        id: 'id-ein',
        companyProfileId: 'default',
        identifierType: 'ein',
        identifierValue: '12-3456789',
        issuingEntity: 'IRS',
        description: 'Employer Identification Number',
        isActive: true,
        createdAt: now,
      },
    ],
    addresses: [
      {
        type: 'primary_mailing',
        line1: '123 Main St',
        city: 'City',
        state: 'State',
        zipCode: '12345',
      },
      {
        type: 'physical',
        line1: '123 Main St',
        city: 'City',
        state: 'State',
        zipCode: '12345',
      },
    ],
  };
}

// Export constants for backward compatibility
// Note: These use factory functions internally to ensure fresh Date objects
export const DEFAULT_COMPANY_MAPPING = createDefaultCompanyMapping();
