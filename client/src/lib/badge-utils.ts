// Shared utility functions for consistent badge styling across the application

export const getStatusBadgeVariant = (status: string) => {
  switch (status) {
    case "discovered": return "secondary" as const;
    case "parsing": return "outline" as const;
    case "drafting": return "default" as const;
    case "review": return "secondary" as const;
    case "approved": return "outline" as const;
    case "submitted": return "default" as const;
    default: return "outline" as const;
  }
};

export const getStatusBadgeClassName = (status: string) => {
  switch (status) {
    case "approved": return "border-green-500 text-green-700 dark:text-green-400";
    case "submitted": return "bg-green-600 hover:bg-green-700 text-white border-transparent";
    case "drafting": return "bg-purple-600 hover:bg-purple-700 text-white border-transparent";
    default: return "";
  }
};

export const getStatusLabel = (status: string) => {
  switch (status) {
    case "discovered": return "Discovered";
    case "parsing": return "Parsing";
    case "drafting": return "AI Drafting";
    case "review": return "Pending Review";
    case "approved": return "Approved";
    case "submitted": return "Submitted";
    default: return status;
  }
};

export const getStatusIcon = (status: string) => {
  switch (status) {
    case "discovered": return "fas fa-eye";
    case "parsing": return "fas fa-file-search";
    case "drafting": return "fas fa-edit";
    case "review": return "fas fa-clipboard-check";
    case "approved": return "fas fa-check";
    case "submitted": return "fas fa-paper-plane";
    default: return "fas fa-circle";
  }
};