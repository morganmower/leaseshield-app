import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Bell, Check, FileText, AlertCircle } from "lucide-react";
import { type UserNotification } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";

export function NotificationCenter() {
  const [open, setOpen] = useState(false);

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ['/api/notifications/unread-count'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const unreadCount = unreadData?.count ?? 0;

  const { data: notifications = [] } = useQuery<UserNotification[]>({
    queryKey: ['/api/notifications'],
    enabled: open, // Only fetch when dropdown is open
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const res = await apiRequest("PATCH", `/api/notifications/${notificationId}/read`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread-count'] });
    },
  });

  const handleMarkAsRead = (notificationId: string) => {
    markAsReadMutation.mutate(notificationId);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          data-testid="button-notifications"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
              data-testid="badge-unread-count"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end" data-testid="popover-notifications">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-foreground">Notifications</h3>
          {unreadCount > 0 && (
            <Badge variant="secondary" data-testid="badge-header-unread-count">
              {unreadCount} unread
            </Badge>
          )}
        </div>
        <ScrollArea className="h-96">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Bell className="h-12 w-12 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 hover-elevate ${!notification.isRead ? 'bg-muted/50' : ''}`}
                  data-testid={`notification-${notification.id}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-1">
                      {notification.legalUpdateId ? (
                        <AlertCircle className="h-5 w-5 text-primary" />
                      ) : (
                        <FileText className="h-5 w-5 text-primary" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground mb-1">
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {notification.createdAt && formatDistanceToNow(new Date(notification.createdAt), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                    {!notification.isRead && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="flex-shrink-0"
                        onClick={() => handleMarkAsRead(notification.id)}
                        data-testid={`button-mark-read-${notification.id}`}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
