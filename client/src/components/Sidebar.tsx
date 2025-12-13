import { cn } from '@/lib/utils';
import type { DashboardMetrics } from '@/types/api';
import { useQuery } from '@tanstack/react-query';
import { Link, useLocation } from 'wouter';
import { useCallback, useRef, useEffect } from 'react';
import { useMobileSidebar } from '@/contexts/MobileSidebarContext';

export default function Sidebar() {
  const [location] = useLocation();
  const { close, isMobile } = useMobileSidebar();
  const sidebarRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number>(0);
  const touchCurrentX = useRef<number>(0);

  // Handle swipe to close on mobile
  const handleTouchStart = useCallback((e: TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchCurrentX.current = e.touches[0].clientX;
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    touchCurrentX.current = e.touches[0].clientX;
    const deltaX = touchCurrentX.current - touchStartX.current;

    // Only allow swiping left (to close)
    if (deltaX < 0 && sidebarRef.current) {
      const translateX = Math.max(deltaX, -256);
      sidebarRef.current.style.transform = `translateX(${translateX}px)`;
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    const deltaX = touchCurrentX.current - touchStartX.current;

    if (sidebarRef.current) {
      sidebarRef.current.style.transform = '';

      // If swiped more than 100px left, close the sidebar
      if (deltaX < -100) {
        close();
      }
    }

    touchStartX.current = 0;
    touchCurrentX.current = 0;
  }, [close]);

  useEffect(() => {
    const sidebar = sidebarRef.current;
    if (!sidebar || !isMobile) return;

    sidebar.addEventListener('touchstart', handleTouchStart, { passive: true });
    sidebar.addEventListener('touchmove', handleTouchMove, { passive: true });
    sidebar.addEventListener('touchend', handleTouchEnd);

    return () => {
      sidebar.removeEventListener('touchstart', handleTouchStart);
      sidebar.removeEventListener('touchmove', handleTouchMove);
      sidebar.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isMobile, handleTouchStart, handleTouchMove, handleTouchEnd]);

  const { data: metrics } = useQuery<DashboardMetrics>({
    queryKey: ['/api/dashboard/metrics'],
  });

  const navigationItems = [
    { path: '/', label: 'Dashboard', icon: 'fas fa-tachometer-alt' },
    { path: '/ai-chat', label: 'AI Agent', icon: 'fas fa-robot' },
    {
      path: '/workflow-management',
      label: 'Workflow Management',
      icon: 'fas fa-cogs',
    },
    {
      path: '/agent-monitoring',
      label: 'Agent Monitoring',
      icon: 'fas fa-chart-line',
    },
    {
      path: '/safla-dashboard',
      label: 'SAFLA',
      icon: 'fas fa-brain',
    },
    {
      path: '/system-settings',
      label: 'System Settings',
      icon: 'fas fa-server',
    },
    { path: '/proposals', label: 'Proposals', icon: 'fas fa-file-alt' },
    { path: '/compliance', label: 'Compliance', icon: 'fas fa-tasks' },
    { path: '/submissions', label: 'Submissions', icon: 'fas fa-paper-plane' },
    {
      path: '/company-profiles',
      label: 'Company Profiles',
      icon: 'fas fa-building',
    },
    { path: '/portal-settings', label: 'Portal Settings', icon: 'fas fa-cog' },
    { path: '/analytics', label: 'Analytics', icon: 'fas fa-chart-bar' },
  ];

  return (
    <div
      ref={sidebarRef}
      className="w-64 h-full bg-card border-r border-border shrink-0 sidebar-nav flex flex-col overflow-hidden"
    >
      <div className="p-4 md:p-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-primary flex items-center">
            <i className="fas fa-robot mr-2"></i>
            RFP Agent
          </h1>
          <p className="text-sm text-muted-foreground">Automation Platform</p>
        </div>
        {/* Close button for mobile */}
        {isMobile && (
          <button
            onClick={close}
            className="p-2 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors md:hidden"
            aria-label="Close sidebar"
          >
            <i className="fas fa-times text-lg"></i>
          </button>
        )}
      </div>

      {/* Scrollable navigation area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
        <nav className="px-4 space-y-1" data-testid="sidebar-navigation">
          {navigationItems.map(item => (
            <Link
              key={item.path}
              href={item.path}
              onClick={() => isMobile && close()}
              className={cn(
                'flex items-center px-3 py-2.5 text-sm font-medium rounded-md transition-colors touch-manipulation',
                location === item.path
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground active:bg-accent/80'
              )}
              data-testid={`nav-link-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <i className={`${item.icon} mr-3 w-4`}></i>
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Quick Stats */}
        <div className="p-4 mt-4 md:mt-8">
          <h3 className="text-sm font-semibold text-foreground mb-3">
            Today&apos;s Activity
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">New RFPs</span>
              <span
                className="text-sm font-semibold text-primary"
                data-testid="stat-new-rfps"
              >
                {metrics?.newRfpsToday || 0}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">
                Pending Review
              </span>
              <span
                className="text-sm font-semibold text-orange-600"
                data-testid="stat-pending-review"
              >
                {metrics?.pendingReview || 0}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Submitted</span>
              <span
                className="text-sm font-semibold text-green-600"
                data-testid="stat-submitted"
              >
                {metrics?.submittedToday || 0}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
