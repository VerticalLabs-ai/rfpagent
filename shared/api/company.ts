import type {
  CompanyCertification as DbCompanyCertification,
  CompanyContact as DbCompanyContact,
  CompanyInsurance as DbCompanyInsurance,
  CompanyProfile as DbCompanyProfile,
} from '@shared/schema';

export type IsoDateString = string;

export type CompanyProfileSummary = Omit<
  DbCompanyProfile,
  'createdAt' | 'updatedAt'
> & {
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
};

export type CompanyContactRecord = Omit<
  DbCompanyContact,
  'createdAt' | 'decisionAreas'
> & {
  createdAt: IsoDateString;
  decisionAreas: string[] | null;
};

export type CompanyCertificationRecord = Omit<
  DbCompanyCertification,
  | 'certificationDate'
  | 'expirationDate'
  | 'recertificationDate'
  | 'applicationStarted'
  | 'submittedDate'
  | 'createdAt'
  | 'updatedAt'
> & {
  certificationDate: IsoDateString | null;
  expirationDate: IsoDateString | null;
  recertificationDate: IsoDateString | null;
  applicationStarted: IsoDateString | null;
  submittedDate: IsoDateString | null;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
};

export type CompanyInsuranceRecord = Omit<
  DbCompanyInsurance,
  'effectiveDate' | 'expirationDate' | 'createdAt' | 'updatedAt'
> & {
  effectiveDate: IsoDateString | null;
  expirationDate: IsoDateString | null;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
  policyDetails: Record<string, unknown> | null;
};
