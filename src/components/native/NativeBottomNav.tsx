import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Briefcase, Activity, Menu } from 'lucide-react';
import { useNativeFeel } from '@/hooks/useNativeFeel';
import { usePlatformStyle } from '@/hooks/usePlatformStyle';
import { cn } from '@/lib/utils';

interface NavItem {
  id: string;
  label: string;
  icon: typeof Home;
  path: string;
}

const navItems: NavItem[] = [
  { id: 'home', label: 'Home', icon: Home, path: '/' },
  { id: 'jobs', label: 'Jobs', icon: Briefcase, path: '/jobs' },
  { id: 'activity', label: 'Activity', icon: Activity, path: '/activity' },
  { id: 'more', label: 'More', icon: Menu, path: '/more' },
];

export const NativeBottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { tapFeedback } = useNativeFeel();
  const { isIOS, isAndroid } = usePlatformStyle();

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const handleNavClick = (path: string) => {
    tapFeedback();
    navigate(path);
  };

  return (
    <nav
      aria-label="Main navigation"
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
              type="button"
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
              onClick={() => handleNavClick(item.path)}
              className={cn(
                "flex flex-col items-center justify-center min-w-[60px] px-3 py-2 rounded-xl transition-all",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                isIOS && "active:scale-95",
                isAndroid && "active:opacity-70"
              )}
            >
              <Icon className={cn("w-6 h-6", active && "drop-shadow-[0_0_8px_hsl(var(--primary)/0.5)]")} />
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
