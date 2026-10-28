import { usePersonalizedJobs } from '@/hooks/usePersonalizedJobs';
import { useAuth } from '@/contexts/AuthContext';
import { useUserLocation } from '@/contexts/UserLocationContext';
import { useLocationJobCounts } from '@/hooks/useLocationJobCounts';
import JobCard from '@/components/JobCard';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowRight, Heart, RefreshCw, MapPin, Map, Share2 } from 'lucide-react';
import { useHybridFavorites } from '@/hooks/useHybridFavorites';
import ShareDialog from '@/components/ShareDialog';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { useState } from 'react';
import { useNativeFeel } from '@/hooks/useNativeFeel';
import { SafeImg } from '@/components/ui/safe-image';
import VerificationBadge from '@/components/VerificationBadge';

const ForYouSection = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { location, isDetecting } = useUserLocation();
  const { tapFeedback, successFeedback } = useNativeFeel();
  const { isFavorited, toggleFavorite } = useHybridFavorites();

  // Priority: Use profile location (from database) > IP detection (from UserLocationContext)
  const city = profile?.city || location.city;
  const state = profile?.state || location.state;
  const country = profile?.country || location.country;

  console.log('📍 [FOR YOU] Location from profile/context:', { 
    profileCity: profile?.city, 
    profileState: profile?.state, 
    profileCountry: profile?.country,
    ipCity: location.city,
    ipState: location.state,
    ipCountry: location.country,
    finalCity: city,
    finalState: state,
    finalCountry: country,
    isDetecting 
  });

  // Get real-time job counts for location (must call hooks unconditionally)
  const { cityCount, stateCount, countryCount, loading: countsLoading } = useLocationJobCounts({
    city,
    state,
    country
  });

  console.log('📊 [FOR YOU] Job counts:', { cityCount, stateCount, countryCount, countsLoading });

  // Fetch personalized jobs with location filter - only when counts are ready
  const { jobs, loading, refresh } = usePersonalizedJobs({ 
    limit: 20, 
    enabled: !!user && !countsLoading && !!state,
    matchLevel: 'state', // Always show state-level jobs
    locationFilter: {
      city,
      state,
      country,
      cityCount,
      stateCount,
      countryCount
    }
  });

  console.log('🎯 [FOR YOU RENDER]', { 
    renderTime: new Date().toISOString(),
    user: user?.id || 'no user', 
    jobsCount: jobs.length, 
    loading,
    city,
    state,
    country,
    cityCount,
    stateCount,
    countryCount
  });


  // Don't show section if user is not logged in
  if (!user) {
    console.log('❌ ForYouSection: No user, returning null');
    return null;
  }

  // Don't show section until state is detected
  if (!state) {
    console.log('⏳ ForYouSection: Waiting for state detection...');
    return null;
  }
  
  // Don't show if no state jobs available
  if (stateCount === 0) {
    console.log('❌ ForYouSection: No jobs in state');
    return null;
  }

  if (loading && jobs.length === 0) {
    return (
      <div className="py-4">
        <div className="px-4">
          <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex-shrink-0 w-[280px]">
                <Card className="p-4 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-8 w-full" />
                </Card>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (jobs.length === 0) {
    return null;
  }

  return (
    <div className="py-4">
      <div className="px-4 mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Heart className="w-5 h-5 text-pink-500" />
            For You
          </h2>
          <p className="text-xs text-muted-foreground">Jobs near you in {state}</p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={refresh}
            variant="ghost" 
            size="sm"
            className="text-xs hidden sm:flex"
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            Refresh
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate("/jobs")}
            className="text-xs"
          >
            View All <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        </div>
      </div>


      <div className="px-4">
        <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
          {jobs.slice(0, 9).map((job, index) => (
            <div
              key={`for-you-${job.job_id}`}
              onClick={() => {
                tapFeedback();
                navigate(`/job/${job.job_id}`);
              }}
              className="flex-shrink-0 w-[280px] bg-background rounded-xl p-4 border cursor-pointer hover:shadow-md transition-all hover-lift premium-card animate-slide-up-fade"
              style={{ animationDelay: `${index * 0.06}s`, animationFillMode: 'both' }}
            >
              <h3 className="text-sm font-semibold line-clamp-1 mb-2">
                {job.title}
              </h3>
              <div className="text-xs text-muted-foreground mb-3">
                <div className="flex items-center gap-1 line-clamp-1">
                  {job.logo_url ? (
                    <SafeImg loading="lazy" decoding="async" src={job.logo_url} alt={job.company} fallbackSrc="" className="w-4 h-4 rounded object-cover flex-shrink-0" />
                  ) : null}
                  <span className="truncate">{job.company}</span>
                  {job.is_verified && job.verified_plan_end && new Date(job.verified_plan_end) > new Date() && (
                    <VerificationBadge color={job.badge_color as 'gold' | 'blue' | 'green' | 'silver'} size={12} />
                  )}
                </div>
                <div className="line-clamp-1">{job.location}</div>
              </div>
              {job.salary_range && (
                <div className="text-xs font-medium text-primary mb-2">
                  {job.salary_range}
                </div>
              )}
              <div className="flex gap-1 flex-wrap mb-3">
                {job.job_type && (
                  <span className="text-[10px] border rounded px-1.5 py-0.5">
                    {job.job_type}
                  </span>
                )}
                {job.category && (
                  <span className="text-[10px] border rounded px-1.5 py-0.5 truncate max-w-[120px]" title={job.category}>
                    {job.category}
                  </span>
                )}
                {(job as any).education_required && (
                  <span className="text-[10px] border rounded px-1.5 py-0.5">
                    🎓 {(job as any).education_required}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <Button variant="outline" size="sm" className="flex-1 h-7 text-[10px]" onClick={(e) => { e.stopPropagation(); navigate(`/job/${job.job_id}`); }}>
                  View Details
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className={`w-7 h-7 shrink-0 ${isFavorited(job.job_id) ? 'text-red-500 hover:text-red-600' : 'text-muted-foreground hover:text-primary'}`}
                  onClick={(e) => { e.stopPropagation(); successFeedback(); toggleFavorite(job.job_id); }}
                >
                  <Heart className={`w-3.5 h-3.5 ${isFavorited(job.job_id) ? 'fill-current' : ''}`} />
                </Button>
                <div onClick={(e) => e.stopPropagation()} className="shrink-0">
                  <ShareDialog 
                    jobTitle={job.title}
                    company={job.company}
                    jobId={job.job_id}
                    location={job.location}
                  />
                </div>
              </div>
              {state && (
                <div className="text-center mt-2">
                  <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                    📍 {state}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ForYouSection;
