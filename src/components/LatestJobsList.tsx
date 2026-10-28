import { useLatestJobs } from '@/hooks/useLatestJobs';
import { useJoobleJobs } from '@/hooks/useJoobleJobs';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import JobCardSkeleton from './JobCardSkeleton';
import JobCard from './JobCard';
import ExternalJobCard from './ExternalJobCard';

const LatestJobsList = () => {
  const { jobs, loading, loadingMore, hasMore, loadMore } = useLatestJobs({ 
    limit: 20,
    enabled: true 
  });
  const navigate = useNavigate();

  // External Jooble + Adzuna feed – kicks in once internal jobs are exhausted
  // to keep the scroll unlimited.
  const {
    jobs: externalJobs,
    loading: externalLoading,
    hasMore: externalHasMore,
    loadMore: loadMoreExternal,
  } = useJoobleJobs({ enabled: true, limit: 20, sort: 'latest' });

  useInfiniteScroll({
    callback: hasMore ? loadMore : loadMoreExternal,
    loading: loadingMore || externalLoading,
    hasMore: hasMore || externalHasMore,
    enabled: true,
    threshold: 300
  });

  if (loading && jobs.length === 0) {
    return (
      <div className="px-4 space-y-3">
        {[1, 2, 3].map((i) => (
          <JobCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="px-4">
        <Card className="p-6 text-center">
          <div className="text-3xl mb-3">⏰</div>
          <h3 className="text-base font-semibold mb-2">No New Jobs Yet</h3>
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
    <div className="px-4 space-y-3 pb-6">
      {jobs.map((job) => (
        <JobCard
          key={job.job_id}
          id={job.job_id}
          shortId={job.short_id}
          publicSlug={job.public_slug}
          title={job.title}
          company={job.company}
          location={job.location}
          salary={job.salary_range || 'Competitive'}
          type={job.job_type || 'Full Time'}
          experience={job.experience_level || 'Entry'}
          description={job.description || ''}
          posted={job.created_at}
          isNew={job.is_new}
          tags={job.skills?.slice(0, 3) || []}
          trendingScore={job.trending_score}
          organicScore={job.base_score}
          trendingRank={job.trending_rank}
          organicRank={job.organic_rank}
          viewsCount={job.views_count}
          applicationsCount={job.applications_count}
          isBoosted={job.is_boosted}
          boostLevel={job.boost_level}
          isVerified={job.is_verified}
          badgeColor={job.badge_color}
          verifiedPlanEnd={job.verified_plan_end}
          city={job.city}
          state={job.state}
          country={job.country}
          latitude={job.latitude}
          longitude={job.longitude}
          showProminentDate={true}
          hideEngagementStats={true}
          logoUrl={job.logo_url}
          category={(job as any).category}
          workMode={(job as any).work_mode}
          shiftTiming={(job as any).shift_timing}
          education={(job as any).education_required}
          openings={(job as any).openings}
        />
      ))}
      
      {loadingMore && <JobCardSkeleton />}

      {externalJobs.length > 0 && (
        <div className="space-y-3">
          {externalJobs.map((job) => (
            <ExternalJobCard key={job.external_id} job={job} />
          ))}
        </div>
      )}

      {externalLoading && externalJobs.length > 0 && (
        <div className="text-center py-4 text-sm text-muted-foreground animate-pulse">
          Loading more jobs...
        </div>
      )}
    </div>
  );
};

export default LatestJobsList;
