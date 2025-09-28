import {
  SUBMISSION_PROGRESS_STATUSES,
  type RfpDetail,
  type SubmissionProgressStatus,
  type SubmissionStatusFilter,
} from "../types/api";

export function isSubmissionProgressStatus(
  status: string,
): status is SubmissionProgressStatus {
  return (SUBMISSION_PROGRESS_STATUSES as readonly string[]).includes(status);
}

export function getSubmissionReadyRfps(
  items: RfpDetail[],
): RfpDetail[] {
  return items.filter((item) => isSubmissionProgressStatus(item.rfp.status));
}

export function filterSubmissionRfps(
  items: RfpDetail[],
  searchQuery: string,
  statusFilter: SubmissionStatusFilter,
): RfpDetail[] {
  const normalizedQuery = searchQuery.trim().toLowerCase();

  return items.filter((item) => {
    const { rfp } = item;
    const matchesStatus =
      statusFilter === "all" ||
      (isSubmissionProgressStatus(rfp.status) && rfp.status === statusFilter);

    if (!matchesStatus) {
      return false;
    }

    if (normalizedQuery.length === 0) {
      return true;
    }

    return (
      rfp.title.toLowerCase().includes(normalizedQuery) ||
      rfp.agency.toLowerCase().includes(normalizedQuery)
    );
  });
}
