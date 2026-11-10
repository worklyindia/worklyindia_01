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
import { getWorklyAndroidBridge } from "@/lib/nativeAppBridge";

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
  type NativeMessage = { id: number; source: string; title: string; message: string; time: number; canReply: boolean };
  const [nativeMessages, setNativeMessages] = useState<NativeMessage[]>([]);
  const [nativeAccess, setNativeAccess] = useState(false);
  const [nativeReplies, setNativeReplies] = useState<Record<number, string>>({});
  const [nativeReplyStatus, setNativeReplyStatus] = useState<Record<number, string>>({});
  const nativeBridge = getWorklyAndroidBridge();
  const refreshNativeInbox = () => {
    if (!nativeBridge) return;
    try {
      setNativeAccess(!!nativeBridge.hasExternalNotificationAccess?.());
      const parsed = JSON.parse(nativeBridge.getExternalNotificationInbox?.() || "[]");
      setNativeMessages(Array.isArray(parsed) ? parsed : []);
    } catch (error) {
      console.warn("Could not read device notification inbox", error);
    }
  };
  useEffect(() => { refreshNativeInbox(); }, []);

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


      {nativeBridge && (
        <section className="px-4 pt-4" aria-label="Device message inbox">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <h2 className="font-semibold text-sm">Device message inbox</h2>
              <p className="text-xs text-muted-foreground">Private notifications from supported apps on this phone</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => nativeBridge.openExternalNotificationAccessSettings?.()}>
              {nativeAccess ? "Access enabled" : "Enable access"}
            </Button>
          </div>
          {!nativeAccess ? (
            <p className="text-sm text-muted-foreground rounded-lg border p-3">Enable Workly India notification access in Android Settings to view supported WhatsApp, Instagram and Facebook notifications here.</p>
          ) : nativeMessages.length === 0 ? (
            <p className="text-sm text-muted-foreground rounded-lg border p-3">No supported device messages yet.</p>
          ) : (
            <div className="space-y-3">
              {nativeMessages.slice().sort((a, b) => b.time - a.time).map((item) => (
                <article key={item.id} className="rounded-lg border border-border/60 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">{item.source.replace(/^.*\./, "")}</p>
                      <h3 className="text-sm font-medium">{item.title}</h3>
                    </div>
                    <span className="text-[11px] text-muted-foreground whitespace-nowrap">{format(new Date(item.time), "MMM dd • hh:mm a")}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap break-words">{item.message}</p>
                  {item.canReply && (
                    <div className="flex gap-2 mt-3">
                      <input aria-label={`Reply to ${item.title}`} value={nativeReplies[item.id] || ""} onChange={(event) => setNativeReplies((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="Quick reply…" className="min-w-0 flex-1 h-10 rounded-md border border-input bg-background px-3 text-sm" />
                      <Button size="sm" disabled={!nativeReplies[item.id]?.trim()} onClick={() => {
                        const text = nativeReplies[item.id]?.trim();
                        if (!text) return;
                        const sent = nativeBridge.sendExternalNotificationReply?.(item.id, text) === true;
                        setNativeReplyStatus((current) => ({ ...current, [item.id]: sent ? "Reply sent" : "Open the original app to reply" }));
                        if (sent) setNativeReplies((current) => ({ ...current, [item.id]: "" }));
                      }}>Reply</Button>
                    </div>
                  )}
                  {nativeReplyStatus[item.id] && <p className="text-xs text-muted-foreground mt-2" role="status">{nativeReplyStatus[item.id]}</p>}
                </article>
              ))}
            </div>
          )}
        </section>
      )}

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
