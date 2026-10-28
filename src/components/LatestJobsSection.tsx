import { useLatestJobs } from '@/hooks/useLatestJobs';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import { ShimmerSkeleton } from '@/components/ui/shimmer-skeleton';
import { useNativeFeel } from '@/hooks/useNativeFeel';
import VerificationBadge from '@/components/VerificationBadge';
import { Heart } from 'lucide-react';
import { useHybridFavorites } from '@/hooks/useHybridFavorites';
import ShareDialog from '@/components/ShareDialog';
import { SafeImg } from '@/components/ui/safe-image';

interface LatestJobsSectionProps {
  limit?: number;
}

const LatestJobsSection = ({ limit = 9 }: LatestJobsSectionProps) => {
  const { jobs, loading } = useLatestJobs({ limit, enabled: true });
  const navigate = useNavigate();
  const { tapFeedback, successFeedback } = useNativeFeel();
  const { isFavorited, toggleFavorite } = useHybridFavorites();

  // CLS FIX: Show skeleton with exact same dimensions as content
  if (loading && jobs.length === 0) {
    return (
      <div className="px-4">
        <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2" style={{ minHeight: '180px' }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex-shrink-0 w-[280px]" style={{ minHeight: '170px' }}>
              <Card className="p-4 space-y-2 h-full">
                <ShimmerSkeleton className="h-4 w-3/4" />
                <ShimmerSkeleton className="h-3 w-1/2" />
                <ShimmerSkeleton className="h-3 w-full" />
                <ShimmerSkeleton className="h-8 w-full mt-auto" />
              </Card>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="px-4">
        <Card className="p-6 text-center">
          <div className="text-3xl mb-3">⏰</div>
          <h3 className="text-base font-semibold mb-2">
            No New Jobs Yet
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Check back soon for opportunities
          </p>
          <Button onClick={() => navigate("/jobs")} size="sm">
            Browse All Jobs
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="px-4">
      <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
        {jobs.slice(0, limit).map((job, index) => (
          <div
            key={job.job_id}
            onClick={() => {
              tapFeedback();
              navigate(`/job/${job.job_id}`);
            }}
            className="flex-shrink-0 w-[280px] bg-background rounded-xl p-4 border cursor-pointer hover:shadow-md transition-all hover-lift premium-card animate-slide-up-fade"
            style={{ animationDelay: `${index * 0.06}s`, animationFillMode: 'both' }}
          >
            <div className="flex items-start justify-between mb-2">
              <h3 className="text-xs font-semibold line-clamp-1 flex-1">
                {job.title}
              </h3>
              {job.is_new && (
                <span className="flex-shrink-0 text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded-full ml-2">
                  New
                </span>
              )}
            </div>
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
            <div className="flex gap-1.5 flex-wrap mb-3">
              {job.skills?.slice(0, 2).map((skill: string, idx: number) => (
                <span
                  key={idx}
                  className="text-xs bg-muted px-2 py-0.5 rounded"
                >
                  {skill}
                </span>
              ))}
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
            {job.created_at && (
              <div className="text-center mt-2">
                <span className="text-xs text-muted-foreground">
                  {new Date(job.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}{', '}
                  {new Date(job.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default LatestJobsSection;
