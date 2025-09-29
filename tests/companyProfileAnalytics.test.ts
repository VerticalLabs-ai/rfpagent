import {
  calculateDecisionAreaCoverage,
  countCompaniesWithDecisionMakers,
  getDecisionMakers,
  normalizeCompanyContact,
} from '../client/src/utils/companyProfiles';
import type {
  CompanyContact,
  CompanyProfile,
  NormalizedCompanyContact,
} from '../client/src/components/company/types';

describe('company profile analytics helpers', () => {
  const baseContact: CompanyContact = {
    id: 'contact-1',
    companyProfileId: 'company-1',
    contactType: 'decision_maker',
    name: 'Ada Lovelace',
    role: 'CTO',
    email: 'ada@example.com',
    officePhone: null,
    mobilePhone: null,
    fax: null,
    decisionAreas: ['technical_decisions', 'operations'],
    ownershipPercent: null,
    gender: null,
    ethnicity: null,
    citizenship: null,
    hoursPerWeek: null,
    isActive: true,
    createdAt: new Date().toISOString(),
  };

  const makeProfile = (id: string): CompanyProfile => ({
    id,
    companyName: `Company ${id}`,
    dba: null,
    website: null,
    primaryBusinessCategory: null,
    naicsPrimary: null,
    nigpCodes: null,
    employeesCount: null,
    registrationState: 'PA',
    county: null,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  it('normalizes contact decision areas to string arrays', () => {
    const contact: CompanyContact = {
      ...baseContact,
      decisionAreas: ['technical_decisions', 42, ''],
    } as unknown as CompanyContact;

    const normalized = normalizeCompanyContact(contact);

    expect(normalized.decisionAreas).toEqual(['technical_decisions']);
  });

  it('filters decision makers and calculates coverage counts', () => {
    const normalizedContacts: NormalizedCompanyContact[] = [
      normalizeCompanyContact(baseContact),
      normalizeCompanyContact({
        ...baseContact,
        id: 'contact-2',
        contactType: 'owner',
        decisionAreas: ['strategic_planning'],
      }),
      normalizeCompanyContact({
        ...baseContact,
        id: 'contact-3',
        contactType: 'primary',
        decisionAreas: ['operations'],
      }),
    ];

    const decisionMakers = getDecisionMakers(normalizedContacts);
    const coverage = calculateDecisionAreaCoverage(decisionMakers);

    expect(decisionMakers).toHaveLength(2);
    const strategic = coverage.find(area => area.value === 'strategic_planning');
    const technical = coverage.find(area => area.value === 'technical_decisions');

    expect(strategic?.count).toBe(1);
    expect(technical?.count).toBe(1);
  });

  it('counts companies that have at least one decision maker contact', () => {
    const profiles = [makeProfile('company-1'), makeProfile('company-2')];

    const contacts: NormalizedCompanyContact[] = [
      normalizeCompanyContact(baseContact),
      normalizeCompanyContact({
        ...baseContact,
        id: 'contact-4',
        companyProfileId: 'company-2',
        contactType: 'primary',
      }),
    ];

    const count = countCompaniesWithDecisionMakers(profiles, contacts);

    expect(count).toBe(1);
  });
});
