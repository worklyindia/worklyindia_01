import BottomNavigation from "@/components/BottomNavigation";
import JobCard from "@/components/JobCard";
import ExternalJobCard from "@/components/ExternalJobCard";
import { Heart, Loader2, LogIn, ArrowLeft, Sparkles } from "lucide-react";
import { useHybridFavorites, getExternalFavoriteJob } from "@/hooks/useHybridFavorites";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

const Favorites = () => {
  const { favorites, loading: favoritesLoading, isGuest } = useHybridFavorites();
  const { isBanned, user } = useAuth();
  const navigate = useNavigate();
  const [favoriteJobs, setFavoriteJobs] = useState<any[]>([]);
  const [externalFavoriteJobs, setExternalFavoriteJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isShowingOfflineCache, setIsShowingOfflineCache] = useState(false);

  // Show restricted message for banned users (only if logged in)
  if (user && isBanned()) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center p-8">
          <div className="text-muted-foreground mb-4">
            Saved jobs are not available due to account restrictions.
          </div>
        </div>
      </div>
    );
  }

  useEffect(() => {
    const fetchFavoriteJobs = async () => {
      // Restore public saved-job details immediately so the list remains readable offline.
      const cacheKey = 'workly-saved-jobs-v1:' + (user?.id || 'guest');
      let cachedJobs: any[] = [];
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) {
            cachedJobs = parsed;
            setFavoriteJobs(parsed);
            setLoading(false);
            setIsShowingOfflineCache(true);
          }
        }
      } catch {
        // Ignore unavailable or malformed local cache and continue with the live request.
      }

      // Split favorites into internal (uuid) and external (ext-*)
      const externalIds = favorites.filter((id: string) => id.startsWith('ext-'));
      const internalIds = favorites.filter((id: string) => !id.startsWith('ext-'));

      // Load external jobs from local persisted storage
      const externalJobs = externalIds
        .map((id: string) => getExternalFavoriteJob(id))
        .filter(Boolean);
      setExternalFavoriteJobs(externalJobs);

      if (internalIds.length === 0) {
        setFavoriteJobs([]);
        try { localStorage.setItem(cacheKey, JSON.stringify([])); } catch { /* Storage is optional. */ }
        setIsShowingOfflineCache(false);
        setLoading(false);
        return;
      }

      try {
        // Fetch detailed job data for favorites using secure access
        const jobsData = [];

        for (const jobId of internalIds) {
          const { data: jobDetails, error: jobError } = await supabase
            .from('jobs')
            .select(`
              id, title, location, job_type, experience_level, salary_range, 
              description, requirements, benefits, skills, status, category, 
              education_required, openings, work_mode, shift_timing, city, state, country,
              created_at, trending_score, views_count, applications_count, 
              calls_count, shares_count, is_boosted, boost_level, api_company_name, short_id, public_slug, organic_rank, trending_rank,
              companies(
                company_name, 
                logo_url,
                is_verified,
                verified_plan_end,
                badge_color,
                instagram_link,
                facebook_link,
                youtube_link,
                linkedin_link,
                account_status,
                latitude,
                longitude,
                city,
                state,
                country
              )
            `)
            .eq('id', jobId)
            .eq('status', 'active')
            .maybeSingle();

          if (!jobError && jobDetails && jobDetails.companies?.account_status === 'active') {
            jobsData.push(jobDetails);
          }
        }

        const jobs = jobsData;

        // Transform data to match JobCard props
        const transformedJobs = jobs?.map(job => ({
          id: job.id,
          title: job.title,
          company: job.companies?.company_name || 'Unknown Company',
          location: job.location,
          type: job.job_type,
          experience: job.experience_level,
          salary: job.salary_range,
          description: job.description,
          posted: job.created_at,
          isNew: (new Date().getTime() - new Date(job.created_at).getTime()) < 24 * 60 * 60 * 1000,
          tags: job.skills || [],
          trendingScore: job.trending_score || 0,
          viewsCount: job.views_count || 0,
          applicationsCount: job.applications_count || 0,
          callsCount: job.calls_count || 0,
          sharesCount: job.shares_count || 0,
          isBoosted: job.is_boosted || false,
          boostLevel: job.boost_level || 0,
          organicRank: job.organic_rank,
          trendingRank: job.trending_rank,
          // Company verification
          isVerified: job.companies?.is_verified || false,
          badgeColor: job.companies?.badge_color || 'gold',
          verifiedPlanEnd: job.companies?.verified_plan_end,
          // Location badges
          city: job.city || job.companies?.city,
          state: job.state || job.companies?.state,
          country: job.country || job.companies?.country,
          // Category + education badges
          category: job.category,
          education: job.education_required,
          openings: job.openings,
          workMode: job.work_mode,
          shiftTiming: job.shift_timing,
          // Company coordinates for distance calculation
          companyLatitude: job.companies?.latitude,
          companyLongitude: job.companies?.longitude,
          // API company name
          apiCompanyName: job.api_company_name,
          logoUrl: job.companies?.logo_url,
          // Short URL for sharing
          shortId: job.short_id,
          publicSlug: job.public_slug
        })) || [];

        setFavoriteJobs(transformedJobs);
        try { localStorage.setItem(cacheKey, JSON.stringify(transformedJobs)); } catch { /* Keep the live list usable if storage is full. */ }
        setIsShowingOfflineCache(false);
      } catch (error) {
        console.error('Error fetching favorite jobs:', error);
        if (cachedJobs.length > 0) {
          setFavoriteJobs(cachedJobs);
          setIsShowingOfflineCache(true);
        } else {
          setFavoriteJobs([]);
          setIsShowingOfflineCache(false);
        }
      } finally {
        setLoading(false);
      }
    };

    if (!favoritesLoading) {
      fetchFavoriteJobs();
    }
  }, [favorites, favoritesLoading, user?.id]);

  return (
    <div className="min-h-screen bg-background">
      {/* Native App Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border/50 shadow-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="hover-scale rounded-full"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          
          <div className="flex items-center space-x-2">
            <Heart className="w-5 h-5 text-primary" />
            <h1 className="text-lg font-semibold text-foreground">Saved Jobs</h1>
          </div>
          
          <div className="w-10" /> {/* Spacer for alignment */}
        </div>
        
        {/* Guest banner - compact */}
        {isGuest && (
          <div className="mx-4 mb-3 bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-2xl p-3 animate-fade-in">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="p-1.5 bg-primary/10 rounded-lg shrink-0">
                  <Sparkles className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground">Guest Mode</p>
                  <p className="text-xs text-muted-foreground truncate">Login to sync everywhere</p>
                </div>
              </div>
              <Button 
                onClick={() => navigate('/auth')} 
                size="sm"
                className="shrink-0 h-8 px-3 rounded-full text-xs"
              >
                Login
              </Button>
            </div>
          </div>
        )}

        {/* Job count badge */}
        <div className="px-4 pb-3">
          <div className={cn(
            "inline-flex items-center gap-2 px-3 py-1.5 rounded-full",
            "bg-primary/10 border border-primary/20",
            "animate-fade-in"
          )}>
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-sm font-medium text-foreground">
              {loading ? "..." : `${favoriteJobs.length + externalFavoriteJobs.length} saved`}
            </span>
          </div>
        </div>
      </header>


        {/* Content Area */}
        <main className="px-3 py-4 pb-24 md:pb-8">
        {isShowingOfflineCache && (
          <div className="mb-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-foreground" role="status">
            Offline mode · Showing your last saved job details. Reconnect to refresh job status.
          </div>
        )}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
            <div className="relative">
              <Loader2 className="w-12 h-12 animate-spin text-primary" />
              <div className="absolute inset-0 w-12 h-12 rounded-full bg-primary/20 animate-ping" />
            </div>
            <p className="mt-4 text-sm text-muted-foreground">Loading your saved jobs...</p>
          </div>
        ) : favoriteJobs.length === 0 && externalFavoriteJobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 animate-scale-in">
            <div className="relative mb-6">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                <Heart className="w-12 h-12 text-primary/60" />
              </div>
              <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">No saved jobs yet</h2>
            <p className="text-sm text-muted-foreground text-center max-w-xs mb-6">
              Start browsing jobs and tap the heart icon to save the ones you're interested in
            </p>
            <Button
              onClick={() => navigate('/jobs')}
              className="rounded-full px-6 hover-scale"
            >
              Browse Jobs
            </Button>
          </div>
        ) : (
          <div className="space-y-3 animate-fade-in">
            {favoriteJobs.map((job, index) => (
              <div
                key={job.id || index}
                className="animate-fade-in"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <JobCard {...job} />
              </div>
            ))}
            {externalFavoriteJobs.map((job, index) => (
              <div
                key={`ext-${job.external_id || index}`}
                className="animate-fade-in"
                style={{ animationDelay: `${(favoriteJobs.length + index) * 0.05}s` }}
              >
                <ExternalJobCard job={job} />
              </div>
            ))}
          </div>
        )}
      </main>

      <BottomNavigation />
    </div>
  );
};

export default Favorites;