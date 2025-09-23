import type { RFP, Document } from "@shared/schema";

export interface RFPDetailsProps {
  rfp: RFP;
  documents?: Document[];
  onRescrape?: (data: { url?: string; userNotes?: string }) => void;
  onDownloadDocs?: () => void;
  onDeleteRFP?: () => void;
  onGenerateMaterials?: () => void;
  isDownloading?: boolean;
  isRescrapePending?: boolean;
  isDeletePending?: boolean;
}

export interface RFPOverviewProps {
  rfp: RFP;
}

export interface RFPDocumentsProps {
  rfp: RFP;
  documents: Document[];
  isLoading?: boolean;
  onRescrape?: (data: { url?: string; userNotes?: string }) => void;
  onDownloadDocs?: () => void;
  isDownloading?: boolean;
  isRescrapePending?: boolean;
}

export interface RFPSidebarProps {
  rfp: RFP;
  onDeleteRFP?: () => void;
  onGenerateMaterials?: () => void;
  isDeletePending?: boolean;
}

export interface RFPHeaderProps {
  rfp: RFP;
}

export interface ComplianceChecklistProps {
  complianceItems: Array<{
    item: string;
    status: "pending" | "completed" | "na";
    notes?: string;
  }>;
}

export interface RequirementsListProps {
  requirements: string[];
}

export interface RiskFlagsProps {
  riskFlags: Array<{
    flag: string;
    severity: "low" | "medium" | "high";
    description?: string;
  }>;
}