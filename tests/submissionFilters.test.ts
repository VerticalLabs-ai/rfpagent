import { describe, expect, it } from "@jest/globals";
import {
  filterSubmissionRfps,
  getSubmissionReadyRfps,
} from "../client/src/utils/submissionFilters";
import type { RfpDetail } from "../client/src/types/api";
import type {
  Proposal,
  PublicPortal,
  RFP,
} from "@shared/schema";

const now = new Date("2024-01-01T00:00:00Z");

const basePortal: PublicPortal = {
  id: "portal-1",
  name: "Test Portal",
  url: "https://portal.example.com",
  type: "general",
  loginRequired: false,
  isActive: true,
  monitoringEnabled: true,
  lastScanned: null,
  status: "active",
  scanFrequency: 24,
  maxRfpsPerScan: 50,
  selectors: null,
  filters: null,
  lastError: null,
  errorCount: 0,
  createdAt: now,
  updatedAt: now,
};

const createRfp = (overrides: Partial<RFP>): RFP => ({
  id: "rfp-1",
  title: "Default RFP",
  description: null,
  agency: "Default Agency",
  category: null,
  portalId: null,
  sourceUrl: "https://example.com/rfp",
  deadline: null,
  estimatedValue: null,
  status: "approved",
  progress: 0,
  requirements: null,
  complianceItems: null,
  riskFlags: null,
  analysis: null,
  addedBy: "automatic",
  manuallyAddedAt: null,
  discoveredAt: now,
  createdAt: now,
  updatedAt: now,
  ...overrides,
});

const createProposal = (overrides: Partial<Proposal>): Proposal => ({
  id: "proposal-1",
  rfpId: "rfp-1",
  content: null,
  narratives: null,
  pricingTables: { totalPrice: 1000 },
  forms: null,
  attachments: null,
  proposalData: null,
  estimatedCost: "1000",
  estimatedMargin: "12.5",
  status: "approved",
  generatedAt: now,
  updatedAt: now,
  ...overrides,
});

const buildDetail = (options?: {
  rfp?: Partial<RFP>;
  portal?: PublicPortal | null;
  proposal?: Proposal | null;
}): RfpDetail => ({
  rfp: createRfp(options?.rfp ?? {}),
  portal: options?.portal ?? basePortal,
  proposal: options?.proposal ?? createProposal({}),
});

describe("submissionFilters", () => {
  it("filters submission-ready RFPs by status", () => {
    const details = [
      buildDetail({ rfp: { id: "rfp-approved", status: "approved" } }),
      buildDetail({ rfp: { id: "rfp-draft", status: "draft" } }),
      buildDetail({ rfp: { id: "rfp-submitted", status: "submitted" } }),
    ];

    const ready = getSubmissionReadyRfps(details);

    expect(ready.map((detail) => detail.rfp.id)).toEqual([
      "rfp-approved",
      "rfp-submitted",
    ]);
  });

  it("applies search and status filters", () => {
    const details = [
      buildDetail({
        rfp: {
          id: "rfp-1",
          title: "City Water Treatment",
          agency: "Philadelphia Water Department",
          status: "approved",
        },
      }),
      buildDetail({
        rfp: {
          id: "rfp-2",
          title: "Parks Maintenance",
          agency: "Philadelphia Parks",
          status: "submitted",
        },
      }),
      buildDetail({
        rfp: {
          id: "rfp-3",
          title: "Fire Station Renovation",
          agency: "City Safety",
          status: "submitted",
        },
      }),
    ];

    const searchFiltered = filterSubmissionRfps(details, "philadelphia", "all");
    expect(searchFiltered.map((detail) => detail.rfp.id)).toEqual([
      "rfp-1",
      "rfp-2",
    ]);

    const statusFiltered = filterSubmissionRfps(details, "", "submitted");
    expect(statusFiltered.map((detail) => detail.rfp.id)).toEqual([
      "rfp-2",
      "rfp-3",
    ]);

    const combinedFilter = filterSubmissionRfps(details, "parks", "submitted");
    expect(combinedFilter.map((detail) => detail.rfp.id)).toEqual(["rfp-2"]);
  });
});
