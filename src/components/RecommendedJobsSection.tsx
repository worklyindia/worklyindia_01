import { useJobRecommendations } from '@/hooks/useJobRecommendations';
import { useAuth } from '@/contexts/AuthContext';
import JobCard from '@/components/JobCard';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowRight, Sparkles, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';

const RecommendedJobsSection = () => {
  const { user } = useAuth();
  // Pass null if no user to get general recommendations
  const { recommendations, isLoading, error, refreshRecommendations } = useJobRecommendations(user?.id || null);
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <section className="py-8 sm:py-12">
        <div className="container mx-auto px-4 lg:px-6 xl:px-8 max-w-6xl">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
                <Sparkles className="inline w-6 h-6 mr-2 text-primary" />
                {user ? 'Recommended For You' : 'Popular Jobs'}
              </h2>
              <p className="text-muted-foreground">
                {user 
                  ? 'Personalized job matches based on your preferences'
                  : 'Trending Workly India opportunities'
                }
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="p-6">
                <Skeleton className="h-4 w-3/4 mb-2" />
                <Skeleton className="h-3 w-1/2 mb-4" />
                <Skeleton className="h-3 w-full mb-2" />
                <Skeleton className="h-3 w-full mb-2" />
                <Skeleton className="h-3 w-2/3 mb-4" />
                <Skeleton className="h-8 w-24" />
              </Card>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="py-8 sm:py-12">
        <div className="container mx-auto px-4 lg:px-6 xl:px-8 max-w-6xl">
          <Card className="p-6 text-center">
            <p className="text-muted-foreground mb-4">Failed to load recommendations</p>
            <Button onClick={refreshRecommendations} variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          </Card>
        </div>
      </section>
    );
  }

  if (!recommendations.length) {
    return (
      <section className="py-8 sm:py-12">
        <div className="container mx-auto px-4 lg:px-6 xl:px-8 max-w-6xl">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
                <Sparkles className="inline w-6 h-6 mr-2 text-primary" />
                {user ? 'Recommended For You' : 'Popular Jobs'}
              </h2>
              <p className="text-muted-foreground">
                {user 
                  ? 'Complete your profile to get personalized job recommendations'
                  : 'Discover trending Workly India opportunities'
                }
              </p>
            </div>
            {user && (
              <Button 
                onClick={() => navigate("/profile")}
                variant="outline"
                className="hidden sm:flex"
              >
                Complete Profile
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
          
          <Card className="p-6 text-center">
            <div className="text-4xl mb-4">{user ? '🎯' : '💼'}</div>
            <h3 className="text-lg font-semibold mb-2">
              {user ? 'Get Better Recommendations' : 'Browse All Jobs'}
            </h3>
            <p className="text-muted-foreground mb-4">
              {user 
                ? 'Add your skills, preferred location, and job preferences to see personalized job matches'
                : 'Sign up to get personalized job recommendations based on your profile and preferences'
              }
            </p>
            <div className="flex gap-2 justify-center">
              {user ? (
                <Button onClick={() => navigate("/profile")}>
                  Update Profile
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <>
                  <Button onClick={() => navigate("/jobs")}>
                    Browse Jobs
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                  <Button onClick={() => navigate("/auth")} variant="outline">
                    Sign Up
                  </Button>
                </>
              )}
            </div>
          </Card>
        </div>
      </section>
    );
  }

  // Convert recommendations to JobCard format using actual job data
  // Show more jobs (up to 12 instead of 4)
  const jobCards = recommendations.slice(0, 12).map((rec, index) => {
    const daysSincePosted = Math.floor((new Date().getTime() - new Date(rec.created_at).getTime()) / (1000 * 60 * 60 * 24));
    const isNewJob = daysSincePosted <= 7;
    
      return {
        id: rec.job_id,
        shortId: (rec as any).short_id,
        title: rec.title,
        company: rec.company,
        location: rec.location,
        salary: rec.salary_range || "Competitive",
        type: rec.job_type,
        experience: rec.experience_level,
        description: rec.description,
        posted: rec.created_at,
        isNew: isNewJob,
        tags: [
          rec.match_reason !== 'Popular' ? rec.match_reason : 'Recommended',
          ...(rec.skills?.slice(0, 2) || [])
        ],
        trendingScore: rec.score,
        viewsCount: rec.views_count,
        applicationsCount: rec.applications_count,
        isBoosted: rec.is_boosted,
        boostLevel: rec.boost_level,
        // Company verification (from database function)
        isVerified: rec.is_verified || false,
        badgeColor: rec.badge_color || 'gold',
        verifiedPlanEnd: rec.verified_plan_end,
        // Location match for personalization indicator
        locationMatch: (rec as any).location_match,
        matchReason: rec.match_reason,
        // Coordinates for distance calculation
        companyLatitude: rec.company_latitude,
        companyLongitude: rec.company_longitude
      };
  });

  return (
    <section className="py-8 sm:py-12">
      <div className="container mx-auto px-4 lg:px-6 xl:px-8 max-w-6xl">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
              <Sparkles className="inline w-6 h-6 mr-2 text-primary" />
              {user ? 'Recommended For You' : 'Popular Jobs'}
            </h2>
            <p className="text-muted-foreground">
              {user 
                ? `${recommendations.length} personalized job matches based on your profile`
                : `${recommendations.length} trending Workly India opportunities`
              }
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={refreshRecommendations}
              variant="ghost" 
              size="sm"
              className="hidden sm:flex"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button 
              onClick={() => navigate("/jobs")}
              variant="outline"
              className="hidden sm:flex"
            >
              View More Jobs
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {jobCards.map((job, index) => (
            <div key={job.id} className="animate-fade-in" style={{animationDelay: `${index * 0.1}s`}}>
              <JobCard {...job} />
            </div>
          ))}
        </div>
        
        <div className="text-center mt-6 sm:hidden">
          <Button onClick={() => navigate("/jobs")} className="w-full mb-2">
            View More Jobs
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
          <Button onClick={refreshRecommendations} variant="outline" className="w-full">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh Recommendations
          </Button>
        </div>
      </div>
    </section>
  );
};

export default RecommendedJobsSection;