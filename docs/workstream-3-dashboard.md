# Workstream 3 – Dashboard Contract Notes

_Last updated: 2025-09-28_

## Dashboard Metrics API
- **Endpoint:** `GET /api/dashboard/metrics`
- **Contract:** `DashboardMetrics` (defined in `shared/api/dashboard.ts`, re-exported to the client via `client/src/types/api.ts`).
- **Fields:**
  - `activeRfps`: count of RFPs that are in discovery through approval stages.
  - `submittedRfps`: count of RFPs marked as `submitted`.
  - `totalValue`: aggregate estimated value for approved or submitted RFPs.
  - `portalsTracked`: total portals configured in the system.
  - `newRfpsToday`: RFPs discovered since the start of the current day (local server time).
  - `pendingReview`: RFPs currently in the `review` stage.
  - `submittedToday`: submissions marked as `submitted` with a `submittedAt` timestamp today.
  - `winRate`: quick approximation using submitted vs. active pipeline counts (placeholder until win/loss data is wired).
  - `avgResponseTime`: placeholder for SLA tracking; currently returns `0` until workflow durations are captured.

## Front-end Consumers
- `MetricsCards`, `Sidebar`, and the dashboard analytics page now consume the shared contract through React Query generics instead of manual casts.
- Sidebar quick stats reuse the same API payload—no duplicate fetch helpers required because the global query client handles credentialed requests.

## Agent Monitoring Contracts
- Added `shared/api/agentMonitoring.ts` to describe the `/api/agent-performance`, `/api/system-health`, `/api/agent-activity`, `/api/agent-coordination`, `/api/work-items`, and `/api/workflows/*` payloads.
- Implemented `agentMonitoringService` so routes reuse typed aggregations for performance metrics, registry summaries, workflow states, and transition stats.
- Updated `client/src/pages/agent-monitoring.tsx` to import the shared types, remove `@ts-nocheck`, and surface queue/tier summaries using the strongly typed responses.
- Added Jest coverage for `agentMonitoringService` aggregations to lock in the workflow overview and phase statistics transformations.

## Follow-ups
- Replace the placeholder `winRate` and `avgResponseTime` calculations once historical win/loss and workflow SLA metrics are available.
- Backfill React Query caches or selectors so additional dashboard widgets (e.g., charts) pull from the same typed source instead of bespoke fetches.
- Extend `client/src/types/api.ts` with additional dashboard-related payloads (activity feed, portal health) as their endpoints are typed.
