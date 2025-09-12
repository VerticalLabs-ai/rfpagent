import MetricsCards from "@/components/MetricsCards";
import PortalStatusGrid from "@/components/PortalStatusGrid";
import ActiveRFPsTable from "@/components/ActiveRFPsTable";
import ActivityFeed from "@/components/ActivityFeed";

export default function Dashboard() {
  return (
    <div className="p-6">
      {/* Key Metrics Cards */}
      <MetricsCards />

      {/* Portal Status Grid */}
      <PortalStatusGrid />

      {/* Active RFPs Table */}
      <ActiveRFPsTable />

      {/* Recent Activity & Notifications */}
      <ActivityFeed />
    </div>
  );
}
