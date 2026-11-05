import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useNotifications } from "@/hooks/useNotifications";
import { Button } from "@/components/ui/button";
import { Bell, ArrowLeft, Check, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { BlockingNotificationPermission } from "@/components/BlockingNotificationPermission";
import { FirebasePushService } from "@/services/FirebasePushService";
import Header from "@/components/Header";
import LazyImage from "@/components/LazyImage";
import { getOptimizedLogo } from "@/utils/performance";

const logoUrl = "https://worklyindia.devs.surf/icons/icon-512x512.png";

const Notifications = () => {
  const navigate = useNavigate();
  const { 
    notifications, 
    loading, 
    markAsRead, 
    deleteNotification, 
    markAllAsRead,
    unreadCount
  } = useNotifications();
  
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const filteredNotifications = filter === "unread" 
    ? notifications.filter(n => !n.is_read)
    : notifications;

  const handleNotificationClick = async (notification: any) => {
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }
    
    console.log('📍 Notification clicked:', notification);
    
    // Priority 1: Check for job_id in metadata (most common for job recommendations)
    if (notification.metadata?.job_id) {
      console.log('📍 Navigating to job:', notification.metadata.job_id);
      navigate(`/job/${notification.metadata.job_id}`);
      return;
    }
    
    // Priority 2: Check for interview_id in metadata
    if (notification.metadata?.interview_id) {
      console.log('📍 Navigating to activity (interview)');
      navigate('/activity');
      return;
    }
    
    // Priority 3: Check action_url patterns
    if (notification.action_url) {
      const url = notification.action_url;
      
      if (url.includes('/job/')) {
        console.log('📍 Navigating to:', url);
        navigate(url);
        return;
      } else if (url.includes('/interview') || url.includes('/activity')) {
        console.log('📍 Navigating to activity');
        navigate('/activity');
        return;
      }
    }
    
    // Default fallback: Dashboard
    console.log('📍 Navigating to dashboard (fallback)');
    navigate('/');
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteNotification(id);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Native-style top bar */}
      <div className="sticky top-0 z-50 bg-background border-b border-border/40">
        <div className="flex items-center h-14 px-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/')}
            className="mr-3"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-semibold">Notifications</h1>
        </div>
      </div>
      
      {/* Filter and Actions */}
      <div className="bg-background px-4 py-3 border-b border-border/40">
        <div className="flex items-center justify-between gap-3">
          <div className="flex gap-2">
            <Button
              variant={filter === "all" ? "default" : "ghost"}
              size="sm"
              onClick={() => setFilter("all")}
              className="rounded-full text-xs h-8"
            >
              All ({notifications.length})
            </Button>
            <Button
              variant={filter === "unread" ? "default" : "ghost"}
              size="sm"
              onClick={() => setFilter("unread")}
              className="rounded-full text-xs h-8"
            >
              Unread ({unreadCount})
            </Button>
          </div>
          
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllAsRead}
              className="text-xs h-8"
            >
              <Check className="w-3.5 h-3.5 mr-1" />
              Mark All Read
            </Button>
          )}
        </div>
      </div>


        <div className="px-4 py-2">

        {/* Notifications List */}
        {loading ? (
          <div className="text-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-3"></div>
            <p className="text-sm text-muted-foreground">Loading...</p>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="text-center py-16">
            <Bell className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
            <h3 className="text-base font-medium mb-1">No notifications</h3>
            <p className="text-sm text-muted-foreground">
              {filter === "unread" 
                ? "You're all caught up!" 
                : "You don't have any notifications yet."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {filteredNotifications.map((notification) => (
              <div
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className={`relative bg-background hover:bg-muted/30 active:bg-muted/50 cursor-pointer transition-colors ${
                  !notification.is_read ? 'before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-primary' : ''
                }`}
              >
                <div className="flex items-start gap-3 p-4 pl-5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      {!notification.is_read && (
                        <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                      )}
                      <h3 className={`font-medium text-sm ${notification.is_read ? 'text-foreground/70' : 'text-foreground'}`}>
                        {notification.title}
                      </h3>
                    </div>
                    <p className={`text-sm leading-relaxed ${notification.is_read ? 'text-muted-foreground/60' : 'text-muted-foreground'}`}>
                      {notification.message}
                    </p>
                    <p className="text-xs text-muted-foreground/40 mt-1">
                      {format(new Date(notification.created_at), 'MMMM dd • hh:mm a')}
                    </p>
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => handleDelete(notification.id, e)}
                    className="flex-shrink-0 h-8 w-8 hover:bg-destructive/10 hover:text-destructive -mr-2"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Notifications;
