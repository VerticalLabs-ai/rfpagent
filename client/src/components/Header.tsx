import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu,
  DropdownMenuContent, 
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function Header() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const { data: unreadNotifications } = useQuery({
    queryKey: ["/api/notifications/unread"],
  });

  const unreadCount = Array.isArray(unreadNotifications) ? unreadNotifications.length : 0;

  const clearAllMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/notifications/clear-all");
      return await response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread"] });
      toast({
        title: "Notifications Cleared",
        description: `Successfully cleared ${data.cleared} notifications`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: "Failed to clear notifications",
        variant: "destructive",
      });
    },
  });

  const handleClearAll = () => {
    clearAllMutation.mutate();
  };

  return (
    <header className="bg-card border-b border-border px-6 py-4 flex items-center justify-between">
      <div>
        <h2 className="text-2xl font-bold text-foreground" data-testid="page-title">
          RFP Dashboard
        </h2>
        <p className="text-sm text-muted-foreground">
          Monitor and manage your automated RFP workflow
        </p>
      </div>
      
      <div className="flex items-center space-x-4">
        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className="relative"
              data-testid="notifications-button"
            >
              <i className="fas fa-bell"></i>
              {unreadCount > 0 && (
                <Badge 
                  variant="destructive" 
                  className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 text-xs"
                  data-testid="notification-badge"
                >
                  {unreadCount}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            {Array.isArray(unreadNotifications) && unreadNotifications.slice(0, 5).map((notification: any) => (
              <DropdownMenuItem 
                key={notification.id}
                className="flex flex-col items-start p-3"
                data-testid={`notification-${notification.id}`}
              >
                <div className="font-medium text-sm">{notification.title}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {notification.message}
                </div>
              </DropdownMenuItem>
            )) || (
              <DropdownMenuItem disabled>
                <span className="text-muted-foreground">No new notifications</span>
              </DropdownMenuItem>
            )}
            {unreadCount > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={handleClearAll}
                  className="justify-center text-sm font-medium"
                  data-testid="clear-all-notifications"
                >
                  Clear All ({unreadCount})
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        
        {/* Settings */}
        <Button variant="ghost" size="icon" data-testid="settings-button">
          <i className="fas fa-cog"></i>
        </Button>
        
        {/* User Menu */}
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
            <span className="text-xs font-semibold text-primary-foreground">JD</span>
          </div>
          <span className="text-sm font-medium" data-testid="user-name">John Doe</span>
        </div>
      </div>
    </header>
  );
}
