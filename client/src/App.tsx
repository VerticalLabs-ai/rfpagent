import React, { Suspense, lazy } from 'react';
import { Switch, Route, useLocation } from 'wouter';
import { queryClient } from './lib/queryClient';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { RealtimeProvider } from '@/components/providers/RealtimeProvider';
import { ErrorBoundary } from '@/components/error/ErrorBoundary';
import { DashboardSkeleton } from '@/components/shared/SkeletonLoaders';
import { HelpWidget } from '@/components/support/HelpWidget';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';

// Lazy load pages for code splitting
const Dashboard = lazy(() => import('@/pages/dashboard'));
const RFPDetails = lazy(() => import('@/pages/rfp-details'));
const ScanHistory = lazy(() => import('@/pages/scan-history'));
const Proposals = lazy(() => import('@/pages/proposals'));
const Compliance = lazy(() => import('@/pages/compliance'));
const Submissions = lazy(() => import('@/pages/submissions'));
const PortalSettings = lazy(() => import('@/pages/portal-settings'));
const Analytics = lazy(() => import('@/pages/analytics'));
const CompanyProfiles = lazy(() => import('@/pages/company-profiles'));
const AIChat = lazy(() => import('@/pages/ai-chat'));
const WorkflowManagement = lazy(() => import('@/pages/workflow-management'));
const AgentMonitoring = lazy(() => import('@/pages/agent-monitoring'));
const SAFLADashboard = lazy(() => import('@/pages/safla-dashboard'));
const SystemSettings = lazy(() => import('@/pages/system-settings'));
const NotFound = lazy(() => import('@/pages/not-found'));

// Simple redirect component
function Redirect({ to }: { to: string }) {
  const [, setLocation] = useLocation();

  React.useEffect(() => {
    setLocation(to);
  }, [to, setLocation]);

  return null;
}

function Router() {
  return (
    <ErrorBoundary>
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-auto">
            <Suspense fallback={<DashboardSkeleton />}>
              <Switch>
                <Route path="/" component={Dashboard} />
                <Route
                  path="/discovery"
                  component={() => <Redirect to="/" />}
                />
                <Route path="/rfps" component={() => <Redirect to="/" />} />
                <Route path="/rfps/:id" component={RFPDetails} />
                <Route path="/scan-history" component={ScanHistory} />
                <Route path="/portals" component={PortalSettings} />
                <Route path="/proposals" component={Proposals} />
                <Route path="/compliance" component={Compliance} />
                <Route path="/submissions" component={Submissions} />
                <Route path="/company-profiles" component={CompanyProfiles} />
                <Route path="/portal-settings" component={PortalSettings} />
                <Route path="/analytics" component={Analytics} />
                <Route path="/ai-chat" component={AIChat} />
                <Route
                  path="/workflow-management"
                  component={WorkflowManagement}
                />
                <Route path="/agent-monitoring" component={AgentMonitoring} />
                <Route path="/safla-dashboard" component={SAFLADashboard} />
                <Route path="/system-settings" component={SystemSettings} />
                {/* Activity Feed route - redirects to Dashboard with activity tab */}
                <Route
                  path="/activity-feed"
                  component={() => <Redirect to="/?tab=activity" />}
                />
                <Route component={NotFound} />
              </Switch>
            </Suspense>
          </main>
        </div>
      </div>
    </ErrorBoundary>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <RealtimeProvider showConnectionStatus={true}>
          <Toaster />
          <Router />
          <HelpWidget />
        </RealtimeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
