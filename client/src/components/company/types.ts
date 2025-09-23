import type { z } from "zod";
import type { CompanyContact, InsertCompanyContact, insertCompanyProfileSchema, insertCompanyContactSchema } from "@shared/schema";

export type CompanyProfileFormData = z.infer<typeof insertCompanyProfileSchema>;
export type CompanyContactFormData = z.infer<typeof insertCompanyContactSchema>;

export type CompanyProfile = {
  id: string;
  companyName: string;
  dba: string | null;
  website: string | null;
  primaryBusinessCategory: string | null;
  naicsPrimary: string | null;
  nigpCodes: string | null;
  employeesCount: string | null;
  registrationState: string | null;
  county: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export const DECISION_AREAS = [
  { value: "financial_contracts", label: "Financial Contracts" },
  { value: "bids_proposals", label: "Bids & Proposals" },
  { value: "technical_decisions", label: "Technical Decisions" },
  { value: "strategic_planning", label: "Strategic Planning" },
  { value: "operations", label: "Operations" },
  { value: "legal_compliance", label: "Legal & Compliance" },
  { value: "procurement", label: "Procurement" },
  { value: "hr_personnel", label: "HR & Personnel" }
];

export type { CompanyContact, InsertCompanyContact };