import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";

export default function Sidebar() {
  const [location] = useLocation();

  const { data: metrics } = useQuery({
    queryKey: ["/api/dashboard/metrics"],
  });

  const navigationItems = [
    { path: "/", label: "Dashboard", icon: "fas fa-tachometer-alt" },
    { path: "/discovery", label: "RFP Discovery", icon: "fas fa-search" },
    { path: "/ai-chat", label: "AI Agent", icon: "fas fa-robot" },
    { path: "/proposals", label: "Proposals", icon: "fas fa-file-alt" },
    { path: "/compliance", label: "Compliance", icon: "fas fa-tasks" },
    { path: "/submissions", label: "Submissions", icon: "fas fa-paper-plane" },
    { path: "/company-profiles", label: "Company Profiles", icon: "fas fa-building" },
    { path: "/portal-settings", label: "Portal Settings", icon: "fas fa-cog" },
    { path: "/analytics", label: "Analytics", icon: "fas fa-chart-bar" },
  ];

  return (
    <div className="w-64 bg-card border-r border-border flex-shrink-0 sidebar-nav">
      <div className="p-6">
        <h1 className="text-xl font-bold text-primary flex items-center">
          <i className="fas fa-robot mr-2"></i>
          RFP Agent
        </h1>
        <p className="text-sm text-muted-foreground">Automation Platform</p>
      </div>
      
      <nav className="px-4 space-y-2" data-testid="sidebar-navigation">
        {navigationItems.map((item) => (
          <Link 
            key={item.path} 
            href={item.path}
            className={cn(
              "flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
              location === item.path
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
            data-testid={`nav-link-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
          >
            <i className={`${item.icon} mr-3 w-4`}></i>
            {item.label}
          </Link>
        ))}
      </nav>
      
      {/* Quick Stats */}
      <div className="p-4 mt-8">
        <h3 className="text-sm font-semibold text-foreground mb-3">Today's Activity</h3>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">New RFPs</span>
            <span className="text-sm font-semibold text-primary" data-testid="stat-new-rfps">
              {metrics?.newRfpsToday || 0}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">Pending Review</span>
            <span className="text-sm font-semibold text-orange-600" data-testid="stat-pending-review">
              {metrics?.pendingReview || 0}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">Submitted</span>
            <span className="text-sm font-semibold text-green-600" data-testid="stat-submitted">
              {metrics?.submittedToday || 0}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
