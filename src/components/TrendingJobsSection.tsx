import { useTrendingJobs } from '@/hooks/useTrendingJobs';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import { ShimmerSkeleton } from '@/components/ui/shimmer-skeleton';
import { useNativeFeel } from '@/hooks/useNativeFeel';
import VerificationBadge from '@/components/VerificationBadge';
import { Heart } from 'lucide-react';
import { useHybridFavorites } from '@/hooks/useHybridFavorites';
import ShareDialog from '@/components/ShareDialog';
import { formatCount } from '@/utils/formatNumber';
import { useEngagementVisibility } from '@/hooks/useSiteSettings';

interface TrendingJobsSectionProps {
  limit?: number;
}

const TrendingJobsSection = ({ limit = 9 }: TrendingJobsSectionProps) => {
  const isTopRanked = limit === 10;
  const { jobs, loading } = useTrendingJobs({ 
    limit, 
    enabled: true,
    showTopRanked: isTopRanked
  });
  const navigate = useNavigate();
  const { tapFeedback, successFeedback } = useNativeFeel();
  const { isFavorited, toggleFavorite } = useHybridFavorites();
  const { data: visibility } = useEngagementVisibility();

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
          <div className="text-3xl mb-3">🔥</div>
          <h3 className="text-base font-semibold mb-2">
            No Jobs Yet
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

  const displayJobs = isTopRanked ? jobs.slice(0, 10) : jobs;

  return (
    <div className="px-4">
      <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
        {displayJobs.slice(0, limit).map((job, index) => (
          <div
            key={job.job_id}
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
                  <img referrerPolicy="no-referrer" loading="lazy" decoding="async" src={job.logo_url} alt={job.company} className="w-4 h-4 rounded object-cover flex-shrink-0" />
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
            {isTopRanked && job.organic_rank && (
              <div className="text-center mt-2">
                <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">
                  #{job.organic_rank} Ranked
                </span>
              </div>
            )}
            {!isTopRanked && (visibility?.showViews || visibility?.showApplies) && (
              <div className="text-center mt-2 text-xs text-muted-foreground">
                {visibility?.showViews && <span>👁 {formatCount(job.views_count || 0)} views</span>}
                {visibility?.showViews && visibility?.showApplies && <span> • </span>}
                {visibility?.showApplies && <span>📝 {formatCount(job.applications_count || 0)} applies</span>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default TrendingJobsSection;
