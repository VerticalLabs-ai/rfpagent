export interface DashboardMetrics {
  activeRfps: number;
  submittedRfps: number;
  totalValue: number;
  portalsTracked: number;
  newRfpsToday: number;
  pendingReview: number;
  submittedToday: number;
  winRate?: number;
  avgResponseTime?: number;
}
