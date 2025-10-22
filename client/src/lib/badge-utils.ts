// Shared utility functions for consistent badge styling across the application

export const getStatusBadgeVariant = (status: string) => {
  switch (status) {
    case 'discovered':
      return 'secondary' as const;
    case 'parsing':
      return 'outline-solid' as const;
    case 'drafting':
      return 'default' as const;
    case 'review':
      return 'secondary' as const;
    case 'approved':
      return 'outline-solid' as const;
    case 'submitted':
      return 'default' as const;
    case 'closed':
      return 'outline-solid' as const;
    case 'open':
      return 'secondary' as const;
    default:
      return 'secondary' as const;
  }
};

export const getStatusBadgeClassName = (status: string) => {
  const baseClasses =
    'text-xs font-medium px-3 py-1 min-w-[80px] justify-center';
  switch (status) {
    case 'approved':
      return `${baseClasses} border-green-500 text-green-700 dark:text-green-400`;
    case 'submitted':
      return `${baseClasses} bg-green-600 hover:bg-green-700 text-white border-transparent`;
    case 'drafting':
      return `${baseClasses} bg-purple-600 hover:bg-purple-700 text-white border-transparent`;
    default:
      return baseClasses;
  }
};

export const getStatusLabel = (status: string) => {
  switch (status) {
    case 'discovered':
      return 'Discovered';
    case 'parsing':
      return 'Parsing';
    case 'drafting':
      return 'AI Drafting';
    case 'review':
      return 'Pending Review';
    case 'approved':
      return 'Approved';
    case 'submitted':
      return 'Submitted';
    case 'closed':
      return 'Closed';
    case 'open':
      return 'Open';
    default:
      return status.charAt(0).toUpperCase() + status.slice(1);
  }
};

export const getStatusIcon = (status: string) => {
  switch (status) {
    case 'discovered':
      return 'fas fa-eye';
    case 'parsing':
      return 'fas fa-file-search';
    case 'drafting':
      return 'fas fa-edit';
    case 'review':
      return 'fas fa-clipboard-check';
    case 'approved':
      return 'fas fa-check';
    case 'submitted':
      return 'fas fa-paper-plane';
    case 'closed':
      return 'fas fa-times-circle';
    case 'open':
      return 'fas fa-folder-open';
    default:
      return 'fas fa-circle';
  }
};
