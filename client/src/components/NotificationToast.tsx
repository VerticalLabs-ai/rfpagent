import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface NotificationToastProps {
  className?: string;
}

export default function NotificationToast({ className }: NotificationToastProps) {
  const [visibleNotification, setVisibleNotification] = useState<any>(null);
  const [previousNotificationCount, setPreviousNotificationCount] = useState(0);

  const { data: notifications } = useQuery({
    queryKey: ["/api/notifications/unread"],
    refetchInterval: 5000, // Check for new notifications every 5 seconds
  });

  // Show toast when new notification arrives
  useEffect(() => {
    if (notifications && notifications.length > previousNotificationCount) {
      const newNotification = notifications[0]; // Show the most recent
      setVisibleNotification(newNotification);
      
      // Auto-hide after 5 seconds
      const timer = setTimeout(() => {
        setVisibleNotification(null);
      }, 5000);

      return () => clearTimeout(timer);
    }
    
    if (notifications) {
      setPreviousNotificationCount(notifications.length);
    }
  }, [notifications, previousNotificationCount]);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "discovery": return { icon: "fas fa-search", color: "text-green-500" };
      case "approval": return { icon: "fas fa-check", color: "text-blue-500" };
      case "submission": return { icon: "fas fa-paper-plane", color: "text-purple-500" };
      case "compliance": return { icon: "fas fa-exclamation-triangle", color: "text-orange-500" };
      default: return { icon: "fas fa-bell", color: "text-blue-500" };
    }
  };

  const getNotificationBadgeVariant = (type: string) => {
    switch (type) {
      case "discovery": return "default";
      case "approval": return "secondary";
      case "submission": return "outline";
      case "compliance": return "destructive";
      default: return "default";
    }
  };

  if (!visibleNotification) {
    return null;
  }

  const notificationIcon = getNotificationIcon(visibleNotification.type);

  return (
    <div 
      className={cn(
        "fixed top-4 right-4 z-50 animate-in slide-in-from-right-2 duration-300",
        className
      )}
      data-testid="notification-toast"
    >
      <Card className="w-80 shadow-lg border border-border bg-card">
        <CardContent className="p-4">
          <div className="flex items-start space-x-3">
            <div className={`w-2 h-2 ${notificationIcon.color.replace('text-', 'bg-')} rounded-full mt-2 flex-shrink-0`}></div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between mb-2">
                <p className="text-sm font-medium text-foreground" data-testid="toast-title">
                  {visibleNotification.title}
                </p>
                <div className="flex items-center space-x-2">
                  <Badge 
                    variant={getNotificationBadgeVariant(visibleNotification.type)}
                    className="text-xs"
                    data-testid="toast-type-badge"
                  >
                    {visibleNotification.type}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => setVisibleNotification(null)}
                    data-testid="toast-close-button"
                  >
                    <i className="fas fa-times text-xs"></i>
                  </Button>
                </div>
              </div>
              
              <p className="text-xs text-muted-foreground mb-3" data-testid="toast-message">
                {visibleNotification.message}
              </p>
              
              {visibleNotification.relatedEntityType && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="text-xs h-7"
                  onClick={() => {
                    // Navigate to related entity - would need routing logic
                    setVisibleNotification(null);
                  }}
                  data-testid="toast-view-details"
                >
                  View Details →
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Real-time notification system component that can be placed in the main app
export function NotificationSystem() {
  const [recentNotifications, setRecentNotifications] = useState<any[]>([]);
  
  const { data: notifications } = useQuery({
    queryKey: ["/api/notifications/unread"],
    refetchInterval: 10000, // Poll every 10 seconds
  });

  useEffect(() => {
    if (notifications && notifications.length > 0) {
      // Simulate real-time behavior by showing notifications as they come in
      const newNotifications = notifications.filter((notification: any) => 
        !recentNotifications.some(recent => recent.id === notification.id)
      );
      
      if (newNotifications.length > 0) {
        setRecentNotifications(prev => [...newNotifications, ...prev].slice(0, 5));
      }
    }
  }, [notifications]);

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2" data-testid="notification-system">
      {recentNotifications.map((notification, index) => (
        <NotificationToast 
          key={notification.id}
          className={`animate-in slide-in-from-right-2 duration-300`}
          style={{ animationDelay: `${index * 100}ms` }}
        />
      ))}
    </div>
  );
}

// Hook for programmatically showing notifications
export function useNotificationToast() {
  const [activeToasts, setActiveToasts] = useState<any[]>([]);

  const showNotification = (notification: {
    title: string;
    message: string;
    type: "discovery" | "approval" | "submission" | "compliance";
    duration?: number;
  }) => {
    const id = Date.now().toString();
    const toast = { ...notification, id, createdAt: new Date().toISOString() };
    
    setActiveToasts(prev => [toast, ...prev]);

    // Auto-remove after duration
    setTimeout(() => {
      setActiveToasts(prev => prev.filter(t => t.id !== id));
    }, notification.duration || 5000);
  };

  const removeNotification = (id: string) => {
    setActiveToasts(prev => prev.filter(t => t.id !== id));
  };

  return {
    showNotification,
    removeNotification,
    activeToasts
  };
}
