import React, { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Bell, 
  Briefcase, 
  Users, 
  Activity, 
  Check, 
  CheckCircle2, 
  AlertCircle, 
  Clock,
  Trash2,
  Filter,
  Heart,
  Star,
  Building
} from 'lucide-react';
import { useNotifications, Notification } from '@/hooks/useNotifications';
import { useAuth } from '@/contexts/AuthContext';
import { useEmployerAuth } from '@/contexts/EmployerAuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface EnhancedNotificationCenterProps {
  showTabs?: boolean;
  maxHeight?: string;
  onNavigate?: (url: string) => void;
}

interface CategorizedNotifications {
  jobs: Notification[];
  applications: Notification[];
  activities: Notification[];
  recommendations: Notification[];
  system: Notification[];
}

export const EnhancedNotificationCenter: React.FC<EnhancedNotificationCenterProps> = ({
  showTabs = true,
  maxHeight = "400px",
  onNavigate
}) => {
  const navigate = useNavigate();
  const { user: jobSeekerUser } = useAuth();
  const { user: employerUser } = useEmployerAuth();
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead, deleteNotification } = useNotifications();
  
  const [activeTab, setActiveTab] = useState('all');
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  const currentUser = jobSeekerUser || employerUser;
  const isEmployer = !!employerUser;

  // Categorize notifications
  const categorizedNotifications = useMemo((): CategorizedNotifications => {
    const categories: CategorizedNotifications = {
      jobs: [],
      applications: [],
      activities: [],
      recommendations: [],
      system: []
    };

    notifications.forEach(notification => {
      const metadata = notification.metadata || {};
      
      // Categorize based on metadata and type
      if (metadata.match_type === 'job_recommendation' || metadata.match_type === 'weekly_digest') {
        categories.recommendations.push(notification);
      } else if (metadata.match_type === 'application' || metadata.application_id) {
        categories.applications.push(notification);
      } else if (metadata.job_id || metadata.match_type === 'profile_match') {
        categories.jobs.push(notification);
      } else if (metadata.interview_id || metadata.scheduled_at) {
        categories.activities.push(notification);
      } else {
        categories.system.push(notification);
      }
    });

    return categories;
  }, [notifications]);

  // Filter notifications based on active tab and unread filter
  const filteredNotifications = useMemo(() => {
    let baseNotifications = notifications;
    
    if (activeTab !== 'all') {
      baseNotifications = categorizedNotifications[activeTab as keyof CategorizedNotifications] || [];
    }
    
    if (showUnreadOnly) {
      baseNotifications = baseNotifications.filter(n => !n.is_read);
    }
    
    return baseNotifications;
  }, [notifications, categorizedNotifications, activeTab, showUnreadOnly]);

  const getNotificationIcon = (notification: Notification) => {
    const metadata = notification.metadata || {};
    
    if (metadata.match_type === 'job_recommendation') return Star;
    if (metadata.match_type === 'application' || metadata.application_id) return Users;
    if (metadata.job_id || metadata.match_type === 'profile_match') return Briefcase;
    if (metadata.interview_id) return Clock;
    
    switch (notification.type) {
      case 'success': return CheckCircle2;
      case 'warning': return AlertCircle;
      case 'error': return AlertCircle;
      default: return Bell;
    }
  };

  const getNotificationColor = (notification: Notification) => {
    const metadata = notification.metadata || {};
    
    if (metadata.match_type === 'job_recommendation') return 'text-yellow-600 bg-yellow-100';
    if (metadata.match_type === 'application') return 'text-green-600 bg-green-100';
    if (metadata.job_id) return 'text-blue-600 bg-blue-100';
    
    switch (notification.type) {
      case 'success': return 'text-green-600 bg-green-100';
      case 'warning': return 'text-orange-600 bg-orange-100';
      case 'error': return 'text-red-600 bg-red-100';
      default: return 'text-blue-600 bg-blue-100';
    }
  };

  const getSmartNavigationUrl = (notification: Notification) => {
    const metadata = notification.metadata || {};
    
    if (metadata.match_type === 'application' || metadata.application_id) {
      return isEmployer ? '/employer-portal/applicants' : '/activity';
    }
    
    if (metadata.job_id) {
      if (metadata.match_type === 'job_recommendation') {
        return `/job/${metadata.job_id}`;
      }
      return isEmployer ? `/employer-portal/job-analytics/${metadata.job_id}` : `/job/${metadata.job_id}`;
    }
    
    if (metadata.interview_id) {
      return isEmployer ? '/employer/interviews' : '/activity';
    }
    
    return notification.action_url || (isEmployer ? '/employer-portal' : '/jobs');
  };

  const handleNotificationClick = (notification: Notification) => {
    const url = getSmartNavigationUrl(notification);
    
    if (!notification.is_read) {
      markAsRead(notification.id);
    }
    
    if (onNavigate) {
      onNavigate(url);
    } else {
      navigate(url);
    }
  };

  const handleDeleteNotification = async (notificationId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    
    const success = await deleteNotification(notificationId);
    if (success) {
      toast.success('Notification deleted');
    } else {
      toast.error('Failed to delete notification');
    }
  };

  const getTimeAgo = (createdAt: string) => {
    const now = new Date();
    const created = new Date(createdAt);
    const diffMs = now.getTime() - created.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return created.toLocaleDateString();
  };

  const getTabCounts = () => {
    return {
      all: notifications.length,
      jobs: categorizedNotifications.jobs.length,
      applications: categorizedNotifications.applications.length,
      activities: categorizedNotifications.activities.length,
      recommendations: categorizedNotifications.recommendations.length,
      system: categorizedNotifications.system.length
    };
  };

  const tabCounts = getTabCounts();

  if (!currentUser) {
    return (
      <Card className="p-6 text-center">
        <Bell className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
        <p className="text-muted-foreground">Please login to view notifications</p>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <div className="p-4 border-b border-border/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Bell className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-foreground">Notifications</h2>
            {unreadCount > 0 && (
              <Badge variant="default" className="text-xs">
                {unreadCount}
              </Badge>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowUnreadOnly(!showUnreadOnly)}
              className="text-xs"
            >
              <Filter className="w-3 h-3 mr-1" />
              {showUnreadOnly ? 'All' : 'Unread'}
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllAsRead}
              className="text-xs"
              disabled={unreadCount === 0}
            >
              <Check className="w-3 h-3 mr-1" />
              Read All
            </Button>
          </div>
        </div>
      </div>

      {showTabs ? (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 lg:grid-cols-6 p-1 m-4 mb-0">
            <TabsTrigger value="all" className="text-xs">
              All {tabCounts.all > 0 && `(${tabCounts.all})`}
            </TabsTrigger>
            <TabsTrigger value="jobs" className="text-xs">
              <Briefcase className="w-3 h-3 mr-1" />
              Jobs {tabCounts.jobs > 0 && `(${tabCounts.jobs})`}
            </TabsTrigger>
            <TabsTrigger value="applications" className="text-xs">
              <Users className="w-3 h-3 mr-1" />
              Apps {tabCounts.applications > 0 && `(${tabCounts.applications})`}
            </TabsTrigger>
            <TabsTrigger value="activities" className="text-xs">
              <Activity className="w-3 h-3 mr-1" />
              Activity {tabCounts.activities > 0 && `(${tabCounts.activities})`}
            </TabsTrigger>
            <TabsTrigger value="recommendations" className="text-xs hidden lg:flex">
              <Star className="w-3 h-3 mr-1" />
              Recs {tabCounts.recommendations > 0 && `(${tabCounts.recommendations})`}
            </TabsTrigger>
            <TabsTrigger value="system" className="text-xs hidden lg:flex">
              <Bell className="w-3 h-3 mr-1" />
              System {tabCounts.system > 0 && `(${tabCounts.system})`}
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-0">
            <div className="max-h-96 overflow-y-auto">
              {loading ? (
                <div className="p-4 space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-start space-x-3 p-3">
                      <div className="w-8 h-8 bg-muted/50 rounded-full animate-pulse" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-3/4 bg-muted/50 rounded animate-pulse" />
                        <div className="h-3 w-full bg-muted/50 rounded animate-pulse" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredNotifications.length === 0 ? (
                <div className="p-6 text-center">
                  <Bell className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">
                    {showUnreadOnly ? 'No unread notifications' : 'No notifications'}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {filteredNotifications.map((notification) => {
                    const IconComponent = getNotificationIcon(notification);
                    const colorClasses = getNotificationColor(notification);
                    
                    return (
                      <div
                        key={notification.id}
                        className={`p-4 hover:bg-accent/50 cursor-pointer transition-colors ${
                          !notification.is_read ? 'bg-primary/5 border-l-2 border-l-primary' : ''
                        }`}
                        onClick={() => handleNotificationClick(notification)}
                      >
                        <div className="flex items-start space-x-3">
                          <div className={`p-2 rounded-full ${colorClasses} flex-shrink-0`}>
                            <IconComponent className="w-4 h-4" />
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <h4 className="font-medium text-sm text-foreground truncate">
                                {notification.title}
                              </h4>
                              <div className="flex items-center space-x-2 flex-shrink-0">
                                <span className="text-xs text-muted-foreground">
                                  {getTimeAgo(notification.created_at)}
                                </span>
                                {!notification.is_read && (
                                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                                )}
                              </div>
                            </div>
                            
                            <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                              {notification.message}
                            </p>
                            
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                {notification.metadata?.match_type && (
                                  <Badge variant="outline" className="text-xs">
                                    {notification.metadata.match_type.replace('_', ' ')}
                                  </Badge>
                                )}
                                {!notification.is_read && (
                                  <Badge variant="default" className="text-xs">
                                    New
                                  </Badge>
                                )}
                              </div>
                              
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => handleDeleteNotification(notification.id, e)}
                                className="text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      ) : (
        <div className="max-h-96 overflow-y-auto" style={{ maxHeight }}>
          {loading ? (
            <div className="p-4 space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="flex items-start space-x-3 p-3">
                  <div className="w-8 h-8 bg-muted/50 rounded-full animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-2/3 bg-muted/50 rounded animate-pulse" />
                    <div className="h-3 w-full bg-muted/50 rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="p-6 text-center">
              <Bell className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No notifications</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {filteredNotifications.map((notification) => {
                const IconComponent = getNotificationIcon(notification);
                const colorClasses = getNotificationColor(notification);
                
                return (
                  <div
                    key={notification.id}
                    className={`p-4 hover:bg-accent/50 cursor-pointer transition-colors group ${
                      !notification.is_read ? 'bg-primary/5 border-l-2 border-l-primary' : ''
                    }`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="flex items-start space-x-3">
                      <div className={`p-2 rounded-full ${colorClasses} flex-shrink-0`}>
                        <IconComponent className="w-4 h-4" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="font-medium text-sm text-foreground truncate">
                            {notification.title}
                          </h4>
                          <div className="flex items-center space-x-2 flex-shrink-0">
                            <span className="text-xs text-muted-foreground">
                              {getTimeAgo(notification.created_at)}
                            </span>
                            {!notification.is_read && (
                              <div className="w-2 h-2 bg-primary rounded-full"></div>
                            )}
                          </div>
                        </div>
                        
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                          {notification.message}
                        </p>
                        
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            {notification.metadata?.match_type && (
                              <Badge variant="outline" className="text-xs">
                                {notification.metadata.match_type.replace('_', ' ')}
                              </Badge>
                            )}
                            {!notification.is_read && (
                              <Badge variant="default" className="text-xs">
                                New
                              </Badge>
                            )}
                          </div>
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => handleDeleteNotification(notification.id, e)}
                            className="text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </Card>
  );
};