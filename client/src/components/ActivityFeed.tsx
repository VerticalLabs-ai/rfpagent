import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

export default function ActivityFeed() {
  const { data: notifications, isLoading: notificationsLoading } = useQuery({
    queryKey: ['/api/notifications'],
    refetchInterval: 30000, // Refetch every 30 seconds for real-time updates
  });

  const { data: rfps, isLoading: rfpsLoading } = useQuery({
    queryKey: ['/api/rfps', 'detailed'],
  });

  const isLoading = notificationsLoading || rfpsLoading;

  // Filter notifications for recent activity
  const recentNotifications = Array.isArray(notifications)
    ? notifications.slice(0, 5)
    : [];

  // Filter for compliance alerts
  const complianceAlerts = Array.isArray(notifications)
    ? notifications.filter((n: any) => n.type === 'compliance').slice(0, 4)
    : [];

  // Get RFPs with high risk flags for compliance alerts
  const highRiskRfps = Array.isArray(rfps)
    ? rfps
        .filter((item: any) =>
          item.rfp?.riskFlags?.some((flag: any) => flag.type === 'high')
        )
        .slice(0, 4)
    : [];

  if (isLoading) {
    return (
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3, 4].map(i => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3, 4].map(i => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Recent Activity */}
      <Card data-testid="recent-activity-card">
        <CardHeader className="border-b border-border">
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4 max-h-96 overflow-y-auto">
          {recentNotifications.length > 0 ? (
            recentNotifications.map((notification: any, index: number) => (
              <ActivityItem
                key={notification.id}
                notification={notification}
                index={index}
              />
            ))
          ) : (
            <div className="text-center py-8">
              <i className="fas fa-clock text-3xl text-muted-foreground mb-3"></i>
              <p className="text-sm text-muted-foreground">
                No recent activity
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Compliance Alerts */}
      <Card data-testid="compliance-alerts-card">
        <CardHeader className="border-b border-border">
          <CardTitle>Compliance Alerts</CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4 max-h-96 overflow-y-auto">
          {highRiskRfps.length > 0 ? (
            highRiskRfps.map((item: any, index: number) => (
              <ComplianceAlert key={item.rfp.id} rfp={item.rfp} index={index} />
            ))
          ) : complianceAlerts.length > 0 ? (
            complianceAlerts.map((notification: any, index: number) => (
              <ComplianceNotificationAlert
                key={notification.id}
                notification={notification}
                index={index}
              />
            ))
          ) : (
            <div className="text-center py-8">
              <i className="fas fa-shield-alt text-3xl text-green-500 mb-3"></i>
              <p className="text-sm text-muted-foreground">
                No compliance alerts
              </p>
              <p className="text-xs text-green-600 mt-1">
                All RFPs are compliant
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ActivityItem({
  notification,
  index,
}: {
  notification: any;
  index: number;
}) {
  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'discovery':
        return { icon: 'fas fa-search', color: 'text-green-500' };
      case 'approval':
        return { icon: 'fas fa-check', color: 'text-blue-500' };
      case 'submission':
        return { icon: 'fas fa-paper-plane', color: 'text-purple-500' };
      case 'compliance':
        return {
          icon: 'fas fa-exclamation-triangle',
          color: 'text-orange-500',
        };
      default:
        return { icon: 'fas fa-circle', color: 'text-gray-500' };
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const notificationTime = new Date(timestamp);
    const diffMs = now.getTime() - notificationTime.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes} minutes ago`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)} hours ago`;
    return `${Math.floor(diffMinutes / 1440)} days ago`;
  };

  const activityIcon = getActivityIcon(notification.type);

  return (
    <div
      className={`flex items-start space-x-3`}
      data-testid={`activity-item-${notification.id}`}
    >
      <div
        className={`w-2 h-2 ${activityIcon.color.replace('text-', 'bg-')} rounded-full mt-2 shrink-0`}
      ></div>
      <div className="flex-1 min-w-0">
        <p
          className="text-sm text-foreground"
          data-testid={`activity-title-${notification.id}`}
        >
          {notification.title}
        </p>
        <p
          className="text-xs text-muted-foreground"
          data-testid={`activity-message-${notification.id}`}
        >
          {notification.message} • {formatTimeAgo(notification.createdAt)}
        </p>
      </div>
    </div>
  );
}

function ComplianceAlert({ rfp, index }: { rfp: any; index: number }) {
  const highRiskFlags =
    rfp.riskFlags?.filter((flag: any) => flag.type === 'high') || [];
  const primaryFlag = highRiskFlags[0];

  if (!primaryFlag) return null;

  const getRiskIcon = (category: string) => {
    if (category.toLowerCase().includes('notarization')) return 'fas fa-stamp';
    if (category.toLowerCase().includes('cashier')) return 'fas fa-money-check';
    if (category.toLowerCase().includes('insurance'))
      return 'fas fa-shield-alt';
    if (category.toLowerCase().includes('bond')) return 'fas fa-handshake';
    return 'fas fa-exclamation-triangle';
  };

  const formatDeadline = (deadline: string | null) => {
    if (!deadline) return 'No deadline set';

    const deadlineDate = new Date(deadline);
    const now = new Date();
    const diffTime = deadlineDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) return 'Deadline passed';
    if (diffDays === 1) return 'Deadline: Tomorrow';
    if (diffDays <= 7) return `Deadline: ${diffDays} days`;
    return `Deadline: ${deadlineDate.toLocaleDateString()}`;
  };

  return (
    <div
      className={`flex items-start space-x-3 p-3 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-900`}
      data-testid={`compliance-alert-${rfp.id}`}
    >
      <i
        className={`${getRiskIcon(primaryFlag.category)} text-red-500 mt-1 shrink-0`}
      ></i>
      <div className="flex-1 min-w-0">
        <p
          className="text-sm font-medium text-red-800 dark:text-red-200"
          data-testid={`compliance-alert-title-${rfp.id}`}
        >
          High Risk: {primaryFlag.category}
        </p>
        <p
          className="text-xs text-red-600 dark:text-red-300"
          data-testid={`compliance-alert-description-${rfp.id}`}
        >
          {primaryFlag.description}
        </p>
        <div className="flex items-center justify-between mt-2">
          <p
            className="text-xs text-red-500"
            data-testid={`compliance-alert-rfp-${rfp.id}`}
          >
            {rfp.title}
          </p>
          <p
            className="text-xs text-red-500"
            data-testid={`compliance-alert-deadline-${rfp.id}`}
          >
            {formatDeadline(rfp.deadline)}
          </p>
        </div>
      </div>
    </div>
  );
}

function ComplianceNotificationAlert({
  notification,
  index,
}: {
  notification: any;
  index: number;
}) {
  return (
    <div
      className={`flex items-start space-x-3 p-3 bg-orange-50 dark:bg-orange-950 rounded-lg border border-orange-200 dark:border-orange-900`}
      data-testid={`compliance-notification-${notification.id}`}
    >
      <i className="fas fa-exclamation-circle text-orange-500 mt-1 shrink-0"></i>
      <div className="flex-1 min-w-0">
        <p
          className="text-sm font-medium text-orange-800 dark:text-orange-200"
          data-testid={`compliance-notification-title-${notification.id}`}
        >
          {notification.title}
        </p>
        <p
          className="text-xs text-orange-600 dark:text-orange-300"
          data-testid={`compliance-notification-message-${notification.id}`}
        >
          {notification.message}
        </p>
      </div>
    </div>
  );
}
