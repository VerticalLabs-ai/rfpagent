import React, { Suspense, lazy, useEffect } from 'react';
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
import { MobileSidebarProvider, useMobileSidebar } from '@/contexts/MobileSidebarContext';

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

function MobileOverlay() {
  const { isOpen, close, isMobile } = useMobileSidebar();

  if (!isMobile || !isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity duration-300"
      onClick={close}
      onTouchEnd={close}
      aria-hidden="true"
    />
  );
}

function AppLayout() {
  const { isOpen, close, isMobile } = useMobileSidebar();
  const [location] = useLocation();

  // Close sidebar on route change (mobile only)
  useEffect(() => {
    if (isMobile) {
      close();
    }
  }, [location, isMobile, close]);

  return (
    <div className="flex h-screen h-[100dvh] overflow-hidden">
      {/* Mobile overlay */}
      <MobileOverlay />

      {/* Sidebar - hidden on mobile unless open */}
      <div
        className={`
          fixed md:relative inset-y-0 left-0 z-50
          transform transition-transform duration-300 ease-in-out
          ${isMobile ? (isOpen ? 'translate-x-0' : '-translate-x-full') : 'translate-x-0'}
          md:transform-none
        `}
      >
        <Sidebar />
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Header />
        <main className="flex-1 overflow-auto overscroll-contain touch-pan-y">
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
  );
}

function Router() {
  return (
    <ErrorBoundary>
      <MobileSidebarProvider>
        <AppLayout />
      </MobileSidebarProvider>
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
