import type { z } from 'zod';
import {
  insertCompanyProfileSchema,
  insertCompanyContactSchema,
  type InsertCompanyContact,
} from '@shared/schema';
import type {
  CompanyCertificationRecord,
  CompanyContactRecord,
  CompanyInsuranceRecord,
  CompanyProfileSummary,
} from '@shared/api/company';

export type CompanyProfileFormData = z.infer<typeof insertCompanyProfileSchema>;
export type CompanyContactFormData = z.infer<typeof insertCompanyContactSchema>;

export type CompanyProfile = CompanyProfileSummary;
export type CompanyContact = CompanyContactRecord;
export type CompanyCertification = CompanyCertificationRecord;
export type CompanyInsurance = CompanyInsuranceRecord;

export type NormalizedCompanyContact = CompanyContact & {
  decisionAreas: string[];
};

export interface DecisionArea {
  value: string;
  label: string;
}

export const DECISION_AREAS: DecisionArea[] = [
  { value: 'financial_contracts', label: 'Financial Contracts' },
  { value: 'bids_proposals', label: 'Bids & Proposals' },
  { value: 'technical_decisions', label: 'Technical Decisions' },
  { value: 'strategic_planning', label: 'Strategic Planning' },
  { value: 'operations', label: 'Operations' },
  { value: 'legal_compliance', label: 'Legal & Compliance' },
  { value: 'procurement', label: 'Procurement' },
  { value: 'hr_personnel', label: 'HR & Personnel' },
];

export type { InsertCompanyContact };