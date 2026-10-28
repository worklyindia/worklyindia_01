import { Badge } from "@/components/ui/badge";
import { useLocation, useNavigate } from "react-router-dom";
import { useNotifications } from "@/hooks/useNotifications";
import { useFavorites } from "@/hooks/useFavorites";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState, useRef, type MouseEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import NavigationErrorBoundary from "./NavigationErrorBoundary";
import { handleNavigationError } from "@/utils/errorMonitoring";
import { useNativeFeel } from "@/hooks/useNativeFeel";
import { AnimatedTabIndicator } from "@/components/animations/AnimatedTabIndicator";
import { useRipple, RippleContainer } from "@/components/animations/RippleEffect";
import { shouldEnableRealtime } from "@/hooks/useEgressProtection";
import { Home, Briefcase, Activity, Menu, type LucideIcon } from "lucide-react";

type NavItem = {
  label: string;
  path: string;
  hasNotification: boolean | null;
  notificationCount?: string;
  icon: LucideIcon;
};


const BottomNavigation = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isBanned } = useAuth();
  const { unreadCount } = useNotifications();
  const { favorites } = useFavorites();
  const { tapFeedback } = useNativeFeel();
  const { ripples, createRipple } = useRipple();
  const [newJobsCount, setNewJobsCount] = useState(0);
  const [newActivitiesCount, setNewActivitiesCount] = useState(0);
  const mountedRef = useRef(false);
  const lastNavigationRef = useRef(0);

  // Initialize component readiness
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Track last visit timestamps and calculate new counts with mounting guards
  useEffect(() => {
    
    let isMounted = true;
    const getLastVisitKey = (page: string) => `last_${page}_visit`;
    
    const fetchNewJobsCount = async () => {
      if (!isMounted) return;
      
      try {
        const lastVisit = localStorage.getItem(getLastVisitKey('jobs'));
        
        // If no last visit recorded, set it to now and show 0 count (first time user)
        if (!lastVisit) {
          localStorage.setItem(getLastVisitKey('jobs'), new Date().toISOString());
          setNewJobsCount(0);
          return;
        }
        
        const lastVisitDate = new Date(lastVisit);
        
        const { count, error } = await supabase
          .from('jobs')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'active')
          .gt('created_at', lastVisitDate.toISOString());
        
        if (!error && isMounted) {
          setNewJobsCount(count || 0);
        } else if (error && isMounted) {
          console.error('Error fetching new jobs count:', error);
          handleNavigationError(error, 'BottomNavigation - Jobs Count');
          // Set count to 0 on error to prevent UI issues
          setNewJobsCount(0);
        }
      } catch (error) {
        console.error('Error fetching new jobs count:', error);
        handleNavigationError(error, 'BottomNavigation - Jobs Count Exception');
        if (isMounted) setNewJobsCount(0);
      }
    };

    const fetchNewActivitiesCount = async () => {
      if (!isMounted) return;
      
      try {
        if (!user) {
          if (isMounted) setNewActivitiesCount(0);
          return;
        }

        const lastVisit = localStorage.getItem(getLastVisitKey('activity'));
        
        // If no last visit recorded, set it to now and show 0 count (first time user)
        if (!lastVisit) {
          localStorage.setItem(getLastVisitKey('activity'), new Date().toISOString());
          setNewActivitiesCount(0);
          return;
        }
        
        const lastVisitDate = new Date(lastVisit);
        
        const { count, error } = await supabase
          .from('job_applications')
          .select('*', { count: 'exact', head: true })
          .eq('applicant_id', user.id)
          .gt('created_at', lastVisitDate.toISOString());
        
        if (!error && isMounted) {
          setNewActivitiesCount(count || 0);
        } else if (error && isMounted) {
          console.error('Error fetching new activities count:', error);
          handleNavigationError(error, 'BottomNavigation - Activities Count');
          setNewActivitiesCount(0);
        }
      } catch (error) {
        console.error('Error fetching new activities count:', error);
        handleNavigationError(error, 'BottomNavigation - Activities Count Exception');
        if (isMounted) setNewActivitiesCount(0);
      }
    };
    
    // Fetch counts with small delay
    const fetchTimer = setTimeout(() => {
      if (isMounted) {
        fetchNewJobsCount();
        fetchNewActivitiesCount();
      }
    }, 50);

    if (!shouldEnableRealtime()) {
      return () => {
        isMounted = false;
        clearTimeout(fetchTimer);
      };
    }

    // Set up real-time subscriptions
    const jobsChannel = supabase
      .channel('new-jobs-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'jobs'
        },
        () => {
          if (isMounted) fetchNewJobsCount();
        }
      )
      .subscribe();

    const applicationsChannel = supabase
      .channel('new-applications-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'job_applications',
          filter: user ? `applicant_id=eq.${user.id}` : undefined
        },
        () => {
          if (isMounted) fetchNewActivitiesCount();
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      clearTimeout(fetchTimer);
      supabase.removeChannel(jobsChannel);
      supabase.removeChannel(applicationsChannel);
    };
  }, [user]);

  // Clear counts when user visits respective pages
  useEffect(() => {
    const currentPath = location.pathname;
    const now = new Date().toISOString();
    
    if (currentPath === '/jobs') {
      localStorage.setItem('last_jobs_visit', now);
      setNewJobsCount(0);
    } else if (currentPath === '/activity') {
      localStorage.setItem('last_activity_visit', now);
      setNewActivitiesCount(0);
    }
  }, [location.pathname]);

  const formatCount = (count: number) => {
    if (count >= 1000) {
      return `${Math.floor(count / 1000)}k${count % 1000 >= 100 ? '+' : ''}`;
    }
    return count.toString();
  };

  const navItems: NavItem[] = [
    {
      icon: Home,
      label: "Home",
      path: "/",
      hasNotification: false,
    },
    {
      icon: Briefcase,
      label: "Jobs",
      path: "/jobs",
      hasNotification: user && !isBanned() ? newJobsCount > 0 : false,
      notificationCount: formatCount(newJobsCount),
    },
    {
      icon: Activity,
      label: "Activity",
      path: "/activity",
      hasNotification: user && !isBanned() ? newActivitiesCount > 0 : false,
      notificationCount: newActivitiesCount.toString(),
    },
    {
      icon: Menu,
      label: "More",
      path: "/more",
      hasNotification: user && !isBanned() ? unreadCount > 0 : false,
      notificationCount: unreadCount.toString(),
    },
  ];


  const activeIndex = navItems.findIndex(item => location.pathname === item.path);

  const handleNavClick = (e: MouseEvent<HTMLButtonElement>, item: NavItem) => {
    e.preventDefault();
    tapFeedback();
    createRipple(e as MouseEvent<HTMLElement>);

    const now = Date.now();
    const isSamePath = location.pathname === item.path;
    const isTooSoon = now - lastNavigationRef.current < 250;

    if (isSamePath || isTooSoon) {
      return;
    }

    lastNavigationRef.current = now;
    navigate(item.path);
  };

  return (
    <NavigationErrorBoundary>
      {/* Premium Native Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 native-bottom-nav z-50 md:hidden" style={{ position: 'fixed', bottom: 0, left: 0, right: 0 }}>
        {/* Subtle top accent */}
        <div className="gradient-header-bar" />
        <div className="grid grid-cols-4 h-[60px] max-w-full relative">
          {/* Animated pill indicator */}
          <AnimatedTabIndicator activeIndex={activeIndex >= 0 ? activeIndex : 0} itemCount={4} />
          {navItems.map((item, index) => {
            const isActive = location.pathname === item.path;
            return (
              <button 
                key={index} 
                type="button"
                aria-label={item.label}
                className={`nav-tab-press flex flex-col items-center justify-center h-full rounded-none gap-0.5 w-full relative overflow-hidden transition-all duration-200 px-0 py-1 ${
                  isActive 
                    ? "text-primary" 
                    : "text-muted-foreground"
                }`}
                onClick={(e) => handleNavClick(e, item)}
              >
                <div className="relative">
                  {isActive && (
                    <div className="absolute -inset-2 bg-primary/8 rounded-full" />
                  )}
                  <div className={`relative z-10 flex items-center justify-center transition-transform duration-200 ${isActive ? "scale-110" : ""}`} style={{ width: 24, height: 24 }}>
                    <item.icon size={24} strokeWidth={isActive ? 2.4 : 2} />
                  </div>

                  {item.hasNotification && (
                    <Badge 
                      variant="destructive" 
                      className="badge-pulse absolute -top-2 -right-3 w-[18px] h-[18px] p-0 flex items-center justify-center text-[9px] min-w-0 shadow-lg border-2 border-background"
                    >
                      {item.notificationCount || ""}
                    </Badge>
                  )}
                </div>
                <span className={`text-[10px] truncate w-full text-center transition-all duration-200 ${
                  isActive ? "text-primary font-bold" : "font-medium"
                }`}>
                  {item.label}
                </span>
                <RippleContainer ripples={ripples} />
              </button>
            );
          })}
        </div>
      </nav>
    </NavigationErrorBoundary>
  );
};

export default BottomNavigation;