import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Briefcase, User, Settings } from 'lucide-react';
import { useNativeFeel } from '@/hooks/useNativeFeel';
import { usePlatformStyle } from '@/hooks/usePlatformStyle';
import { cn } from '@/lib/utils';

interface NavItem {
  id: string;
  label: string;
  icon: typeof Home;
  path: string;
  badge?: number;
}

const navItems: NavItem[] = [
  { id: 'home', label: 'Home', icon: Home, path: '/employer-portal' },
  { id: 'jobs', label: 'Jobs', icon: Briefcase, path: '/employer-portal?tab=jobs' },
  { id: 'profile', label: 'Profile', icon: User, path: '/employer-profile' },
  { id: 'settings', label: 'Settings', icon: Settings, path: '/employer-settings' },
];

export const NativeBottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { tapFeedback } = useNativeFeel();
  const { isIOS, isAndroid } = usePlatformStyle();

  const isActive = (path: string) => {
    if (path === '/employer-portal') {
      return location.pathname === '/employer-portal' && !location.search.includes('tab=jobs');
    }
    return location.pathname + location.search === path;
  };

  const handleNavClick = (path: string) => {
    tapFeedback();
    navigate(path);
  };

  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 border-t",
        "bg-background/95 backdrop-blur-xl",
        isIOS && "shadow-[0_-2px_10px_rgba(0,0,0,0.05)]",
        isAndroid && "shadow-[0_-4px_12px_rgba(0,0,0,0.1)]"
      )}
      style={{
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          
          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.path)}
              className={cn(
                "flex flex-col items-center justify-center min-w-[60px] px-3 py-2 rounded-xl transition-all",
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
                isIOS && "active:scale-95",
                isAndroid && "active:opacity-70"
              )}
            >
              <div className="relative">
                <Icon className={cn("w-6 h-6", active && "drop-shadow-[0_0_8px_hsl(var(--primary)/0.5)]")} />
                {item.badge && item.badge > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
                    {item.badge > 9 ? '9+' : item.badge}
                  </span>
                )}
              </div>
              <span className={cn(
                "text-[10px] font-medium mt-0.5 transition-all",
                active && "font-semibold"
              )}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
