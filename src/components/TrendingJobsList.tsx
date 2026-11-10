import { useTrendingJobs } from '@/hooks/useTrendingJobs';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import JobCardSkeleton from './JobCardSkeleton';
import JobCard from './JobCard';

interface TrendingJobsListProps {
  showTopRanked?: boolean;
}

const TrendingJobsList = ({ showTopRanked = false }: TrendingJobsListProps) => {
  const { jobs, loading, hasMore, loadMore } = useTrendingJobs({ 
    limit: showTopRanked ? 10 : 20,
    enabled: true,
    showTopRanked
  });
  const navigate = useNavigate();

  useInfiniteScroll({
    callback: loadMore,
    loading,
    hasMore,
    enabled: !showTopRanked,
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
          <div className="text-3xl mb-3">🔥</div>
          <h3 className="text-base font-semibold mb-2">No Jobs Yet</h3>
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

  const displayJobs = showTopRanked ? jobs.slice(0, 10) : jobs;

  return (
    <div className="px-4 space-y-3 pb-6">
      {displayJobs.map((job) => (
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
          logoUrl={job.logo_url}
          category={(job as any).category}
          workMode={(job as any).work_mode}
          shiftTiming={(job as any).shift_timing}
          education={(job as any).education_required}
          openings={(job as any).openings}
        />
      ))}
      
      {loading && !showTopRanked && (
        <JobCardSkeleton />
      )}
      
      {!hasMore && jobs.length > 0 && !showTopRanked && (
        <div className="text-center py-4 text-sm text-muted-foreground">
          No more jobs to load
        </div>
      )}
    </div>
  );
};

export default TrendingJobsList;
