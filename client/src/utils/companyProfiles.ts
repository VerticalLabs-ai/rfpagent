import {
  DECISION_AREAS,
  type CompanyContact,
  type CompanyProfile,
  type DecisionArea,
  type NormalizedCompanyContact,
} from '@/components/company/types';

type DecisionAreaCoverage = DecisionArea & { count: number };

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

export const normalizeCompanyContact = (
  contact: CompanyContact
): NormalizedCompanyContact => {
  const decisionAreas = Array.isArray(contact.decisionAreas)
    ? contact.decisionAreas.filter(isNonEmptyString)
    : [];

  return {
    ...contact,
    decisionAreas,
  };
};

export const isDecisionMakerContact = (
  contact: NormalizedCompanyContact
): boolean =>
  contact.contactType === 'decision_maker' || contact.contactType === 'owner';

export const getDecisionMakers = (
  contacts: NormalizedCompanyContact[]
): NormalizedCompanyContact[] => contacts.filter(isDecisionMakerContact);

export const calculateDecisionAreaCoverage = (
  decisionMakers: NormalizedCompanyContact[]
): DecisionAreaCoverage[] =>
  DECISION_AREAS.map(area => ({
    ...area,
    count: decisionMakers.filter(dm => dm.decisionAreas.includes(area.value))
      .length,
  }));

export const countCompaniesWithDecisionMakers = (
  profiles: CompanyProfile[],
  contacts: NormalizedCompanyContact[]
): number => {
  const companiesWithCoverage = new Set(
    contacts
      .filter(isDecisionMakerContact)
      .map(contact => contact.companyProfileId)
  );

  return profiles.filter(profile => companiesWithCoverage.has(profile.id))
    .length;
};
