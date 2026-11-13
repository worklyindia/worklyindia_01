import BottomNavigation from "@/components/BottomNavigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SafeAvatarImage } from "@/components/ui/safe-image";
import { 
  FileText, 
  TrendingUp, 
  Heart,
  User,
  ChevronRight,
  CalendarDays,
  PartyPopper,
  Sunrise,
  Sun,
  Sunset,
  Moon
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserStats } from "@/hooks/useUserStats";
import { formatInTimeZone } from 'date-fns-tz';
import { supabase } from "@/integrations/supabase/client";
import { getLocalApplications, getLocalFavorites } from "@/lib/localDataStorage";
import { expandFestivalDays, selectFestivalDay } from "@/lib/festivals";


const More = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { stats, loading: statsLoading } = useUserStats();
  
  // Get stats - use local data for guests, server data for logged-in users
  const getDisplayStats = () => {
    if (!user) {
      const localApps = getLocalApplications();
      const localFavs = getLocalFavorites();
      return {
        applications: localApps.length,
        savedJobs: localFavs.length,
        applicationResponseRate: 0
      };
    }
    return stats || { applications: 0, savedJobs: 0, applicationResponseRate: 0 };
  };
  
  const displayStats = getDisplayStats();
  const loading = statsLoading && user !== null;



  // Date & Time state for live display with IST timezone
  const [now, setNow] = useState<Date>(new Date());
  
  useEffect(() => {
    // Sync with server time on mount
    const syncServerTime = async () => {
      try {
        const { data, error } = await supabase.rpc('get_server_time_ist');
        if (!error && data) {
          const serverTimeEpoch = data as number;
          setNow(new Date(serverTimeEpoch));
        }
      } catch (error) {
        console.error('Failed to sync server time:', error);
      }
    };
    
    syncServerTime();
    
    // Update time every second
    const id = setInterval(() => setNow(prev => new Date(prev.getTime() + 1000)), 1000);
    return () => clearInterval(id);
  }, []);
  
  const IST_TIMEZONE = 'Asia/Kolkata';
  const formattedDate = formatInTimeZone(now, IST_TIMEZONE, 'dd MMMM yyyy'); // DD/MM/YYYY in IST
  const dayOfWeek = formatInTimeZone(now, IST_TIMEZONE, 'EEEE');
  
  // Greeting based on IST hour
  const hour = parseInt(formatInTimeZone(now, IST_TIMEZONE, 'HH'));
  const greeting = hour >= 5 && hour < 12
    ? { text: 'Good Morning', Icon: Sunrise }
    : hour >= 12 && hour < 17
      ? { text: 'Good Afternoon', Icon: Sun }
      : hour >= 17 && hour < 20
        ? { text: 'Good Evening', Icon: Sunset }
        : { text: 'Good Night', Icon: Moon };
  const clockHm = formatInTimeZone(now, IST_TIMEZONE, 'hh:mm');
  const clockSec = formatInTimeZone(now, IST_TIMEZONE, 'ss');
  const clockAmPm = formatInTimeZone(now, IST_TIMEZONE, 'a');

  // Expand calendar starts into daily entries and retain every same-day festival.
  const [festivals, setFestivals] = useState<Array<{date:string;name:string}>>([]);
  const [festivalsLoaded, setFestivalsLoaded] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from('google_calendar_api')
          .select('data')
          .eq('name', 'Google Calendar API JSON')
          .maybeSingle();
        if (cancelled) return;
        const list = (data?.data as any)?.festivals;
        if (Array.isArray(list)) {
          setFestivals(expandFestivalDays(list));
        } else {
          setFestivals([]);
        }
      } catch {
        if (!cancelled) setFestivals([]);
      } finally {
        if (!cancelled) setFestivalsLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);
  const todayKey = formatInTimeZone(now, IST_TIMEZONE, 'yyyy-MM-dd');
  const { current: todayFestivals, upcoming: upcomingFestivals } = selectFestivalDay(festivals, todayKey);
  // Festival dates are plain calendar days, so format them in UTC to avoid shifting a day.
  const festDateUtc = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number);
    return Date.UTC(y, (m || 1) - 1, d || 1);
  };
  const formatFestDate = (iso: string) => formatInTimeZone(new Date(festDateUtc(iso)), 'UTC', 'd MMM yyyy');
  const daysUntil = (iso: string) => Math.round((festDateUtc(iso) - festDateUtc(todayKey)) / 86400000);
  const isTodayFestival = todayFestivals.length > 0;
  const shownFestivals = isTodayFestival ? todayFestivals : upcomingFestivals;
  const nextFestivalDate = !isTodayFestival && upcomingFestivals.length ? upcomingFestivals[0].date : null;
  const nextIn = nextFestivalDate ? daysUntil(nextFestivalDate) : null;

  // Dashboard Stats - No badges for guest users (Local/Guest removed)
  const statsData = [
    { label: "Applications", value: (loading && user) ? "..." : displayStats.applications.toString(), icon: FileText },
    { label: "Saved Jobs", value: (loading && user) ? "..." : displayStats.savedJobs.toString(), icon: Heart },
    { label: "Response", value: (loading && user) ? "..." : `${displayStats.applicationResponseRate}%`, icon: TrendingUp },
  ];

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
        <main className="max-w-6xl mx-auto py-4 sm:py-6 pb-24 md:pb-8">
          <div className="px-3 sm:px-4">
          {/* Guest user banner */}
          {!user && (
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 mb-6">
              <div className="flex items-center space-x-3">
                <User className="w-5 h-5 text-primary" />
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground">Browsing as Guest</h3>
                  <p className="text-sm text-muted-foreground">Login to unlock all features and sync your data across devices.</p>
                </div>
                <Button onClick={() => navigate('/auth')} size="sm">
                  Login
                </Button>
              </div>
            </div>
          )}
          
          {/* Header Section with Profile */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <Avatar className="w-12 h-12 border-2 border-primary/20">
              <SafeAvatarImage 
                src={user ? (profile?.profile_image_url || "/placeholder.svg") : "https://api.dicebear.com/7.x/avataaars/svg?seed=guest&backgroundColor=b6e3f4"}
                width={96}
                alt={profile?.full_name || "Guest User"} 
              />
              <AvatarFallback className="bg-gradient-to-br from-purple-500 to-blue-600 text-white font-semibold">
                {profile?.full_name 
                  ? profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase()
                  : user?.email?.charAt(0).toUpperCase() || 'G'
                }
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {profile?.full_name || user?.email?.split('@')[0] || 'Guest User'}
              </h1>
              <p className="text-sm text-muted-foreground">
                {user ? 'Complete job search dashboard' : 'Explore features - Login for full access'}
              </p>
            </div>
          </div>
        </div>

        {/* Date, time & festival card */}
        <Card
          role="link"
          tabIndex={0}
          aria-label={`View festivals for ${formattedDate}`}
          onClick={() => navigate('/festivals', { state: { from: window.location.pathname } })}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              navigate('/festivals', { state: { from: window.location.pathname } });
            }
          }}
          className="mb-3 cursor-pointer overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-primary/15 via-card to-card p-0 shadow-sm transition-shadow hover:shadow-md active:scale-[0.99]"
        >
          <div className="flex items-start justify-between gap-3 p-4">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                <greeting.Icon className="h-3.5 w-3.5" />
                {greeting.text}
              </span>
              <p className="mt-3 flex items-baseline gap-1.5 leading-none text-foreground">
                <span className="text-4xl font-bold tabular-nums tracking-tight">{clockHm}</span>
                <span className="text-sm font-semibold tabular-nums text-muted-foreground">{clockSec}</span>
                <span className="text-sm font-semibold uppercase text-muted-foreground">{clockAmPm}</span>
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{dayOfWeek}</span>, {formattedDate}
              </p>
            </div>
            <div className="shrink-0 rounded-xl bg-primary/10 p-2.5">
              <CalendarDays className="h-5 w-5 text-primary" />
            </div>
          </div>

          <div className="flex items-center gap-3 border-t border-border/60 bg-muted/30 px-4 py-3">
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${isTodayFestival ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary'}`}>
              <PartyPopper className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              {!festivalsLoaded ? (
                <div className="space-y-1.5">
                  <div className="h-2.5 w-20 animate-pulse rounded bg-muted" />
                  <div className="h-3.5 w-36 animate-pulse rounded bg-muted" />
                </div>
              ) : shownFestivals.length ? (
                <>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {isTodayFestival ? "Today's Festival" : 'Upcoming Festival'}
                  </p>
                  <p className="text-sm font-semibold leading-snug text-foreground line-clamp-2">
                    {shownFestivals.map(f => f.name).join(' • ')}
                  </p>
                </>
              ) : (
                <p className="text-sm font-medium text-foreground">View festival calendar</p>
              )}
            </div>
            {festivalsLoaded && nextFestivalDate && (
              <div className="shrink-0 text-right">
                <p className="text-xs font-semibold text-foreground">{formatFestDate(nextFestivalDate)}</p>
                {nextIn !== null && nextIn > 0 && (
                  <p className="text-[11px] text-muted-foreground">{nextIn === 1 ? 'Tomorrow' : `in ${nextIn} days`}</p>
                )}
              </div>
            )}
            {festivalsLoaded && isTodayFestival && (
              <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">Today</span>
            )}
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </div>
        </Card>

        {/* Android home-screen widget guide */}
        <Card className="mb-6 rounded-2xl border border-primary/20 bg-primary/5 p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold text-foreground">Workly Date &amp; Time Widget</h2>
              <p className="mt-1 text-xs text-muted-foreground">Add the live India clock and date to your Android home screen.</p>
            </div>
          </div>
          <div className="mt-3 rounded-xl bg-card/80 p-3 text-sm text-muted-foreground">
            On your phone, long-press an empty area of the Home screen → Widgets → Workly India → Date &amp; Time, then drag it onto the screen.
          </div>
        </Card>

        {/* Stats Dashboard */}
        <div className="mb-8 grid grid-cols-3 gap-3">
          {statsData.map((stat) => (
            <Card
              key={stat.label}
              className="rounded-2xl border border-border/60 bg-gradient-to-br from-card to-muted/40 p-3 shadow-sm"
            >
              <div className="mb-2 inline-flex rounded-lg bg-primary/10 p-1.5">
                <stat.icon className="h-4 w-4 text-primary" />
              </div>
              <p className="text-2xl font-bold leading-none text-foreground tabular-nums">{stat.value}</p>
              <p className="mt-1 truncate text-xs text-muted-foreground">{stat.label}</p>
            </Card>
          ))}
        </div>
          </div>

          {/* Footer Links as Full-Width Menu List (edge-to-edge) */}
          <div className="mt-8">
            <div className="border-y border-border/60 divide-y divide-border/60">
            {[
              { label: "App Settings", path: "/settings" },
              { label: "Website Pricing", path: "/pricing" },
              { label: "About Us", path: "/about-us" },
              { label: "Mission", path: "/mission" },
              { label: "Vision", path: "/vision" },
              { label: "Why Choose Workly India", path: "/why-choose-us" },
              { label: "Blog", path: "/blog" },
              { label: "Trust & Safety", path: "/trust-safety" },
              { label: "Employer Guidelines", path: "/employer-guidelines" },
              { label: "Job Seeker Guidelines", path: "/job-seeker-guidelines" },
              { label: "Community Guidelines", path: "/community-guidelines" },
              { label: "Accessibility Statement", path: "/accessibility" },
              { label: "Privacy Policy", path: "/privacy" },
              { label: "Refund & Cancellation", path: "/refund-policy" },
              { label: "Terms & Conditions", path: "/terms-conditions" },
              { label: "FAQ", path: "/faq" },
              { label: "Cookie Policy", path: "/cookie-policy" },
              { label: "Disclaimer", path: "/disclaimer" },
              { label: "DMCA / Copyright Policy", path: "/dmca" },
              { label: "Contact Us", path: "/contact-us" },
              { label: "Sitemap", path: "/sitemap" },
              { label: "Careers", path: "/careers" },
              { label: "Press / Media Kit", path: "/press-kit" },
            ].map((link) => (
              <button
                key={link.path}
                onClick={() => navigate(link.path)}
                className="w-full flex items-center justify-between px-5 py-3.5 text-left text-sm font-medium text-foreground hover:bg-muted/50 active:bg-muted transition-colors"
              >
                <span>{link.label}</span>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </button>
            ))}
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-6 px-2 pt-2 pb-2 text-center">
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Workly India. All Rights Reserved.</p>
        </div>
      </main>

      <BottomNavigation />
    </div>
  );
};

export default More;
