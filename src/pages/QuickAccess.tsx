import { useState, useEffect } from "react";
import { Search, ArrowLeft, Loader2, Sparkles, Globe, MapPin, Briefcase, TrendingUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAnimatedPlaceholder, searchPlaceholders } from "@/hooks/useAnimatedPlaceholder";
import { useJobSearch } from "@/hooks/useJobSearch";
import { useDebounce } from "@/hooks/useDebounce";
import { usePersonalizedJobs } from "@/hooks/usePersonalizedJobs";
import { useLatestJobs } from "@/hooks/useLatestJobs";
import { useTrendingJobs } from "@/hooks/useTrendingJobs";
import { useLocationJobCounts } from "@/hooks/useLocationJobCounts";
import { useUserLocation } from "@/contexts/UserLocationContext";
import { useAuth } from "@/contexts/AuthContext";
import SEO from "@/components/SEO";
import JobCard from "@/components/JobCard";
import BottomNavigation from "@/components/BottomNavigation";
import LottieSearchIcon from "@/components/LottieSearchIcon";

const QuickAccess = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || "");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { location: userLocation } = useUserLocation();
  const animatedPlaceholder = useAnimatedPlaceholder(searchPlaceholders);
  const { jobs, suggestions, getSuggestions, searchJobs, loading, hasMore, loadMore } = useJobSearch();
  
  // Debounce search query for auto-search
  const debouncedSearchQuery = useDebounce(searchQuery, 500);

  // Initialize search if query param exists
  useEffect(() => {
    const query = searchParams.get('q');
    if (query) {
      setSearchQuery(query);
      setHasSearched(true);
      searchJobs(query, {}, 0, true);
    }
  }, []);

  // Auto-search when debounced query changes
  useEffect(() => {
    if (debouncedSearchQuery.trim().length >= 2) {
      setHasSearched(true);
      searchJobs(debouncedSearchQuery.trim(), {}, 0, true);
      setSearchParams({ q: debouncedSearchQuery.trim() });
    } else if (debouncedSearchQuery.trim().length === 0) {
      setHasSearched(false);
      setSearchParams({});
    }
  }, [debouncedSearchQuery]);

  // Get suggestions when typing
  useEffect(() => {
    if (searchQuery.length >= 2) {
      getSuggestions(searchQuery);
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  }, [searchQuery, getSuggestions]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setHasSearched(true);
      setShowSuggestions(false);
      searchJobs(searchQuery.trim(), {}, 0, true);
      setSearchParams({ q: searchQuery.trim() });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch(e);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setSearchQuery(suggestion);
    setHasSearched(true);
    setShowSuggestions(false);
    searchJobs(suggestion, {}, 0, true);
    setSearchParams({ q: suggestion });
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    setHasSearched(false);
    setShowSuggestions(false);
    setSearchParams({});
  };

  return (
    <>
      <SEO 
        title="Quick Access - AI-Powered Job Search | Workly India"
        description="Find your perfect remote job with AI-powered search. Browse trending jobs, popular locations, and personalized recommendations."
        keywords="job search, AI search, remote jobs, Workly India, job finder"
      />
      
      <div className="min-h-screen bg-gradient-card">
        {/* Header Section */}
        <div className="glass border-b border-primary/20 sticky top-0 z-40 backdrop-blur-xl overflow-visible">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center gap-4 mb-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(-1)}
                className="glass border border-primary/30 hover:border-primary hover:bg-gradient-primary hover:text-primary-foreground transition-all duration-300"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold gradient-text">Quick Access</h1>
                <p className="text-sm text-muted-foreground">AI-powered job search</p>
              </div>
            </div>

            {/* Search Bar */}
            <div className="relative group">
              <div className="absolute left-4 top-1/2 transform -translate-y-1/2 transition-colors group-hover:text-secondary z-10 pointer-events-none"><LottieSearchIcon size={24} /></div>
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                onFocus={() => setShowSuggestions(searchQuery.length >= 2)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                placeholder={animatedPlaceholder}
                className="pl-14 pr-4 py-6 text-lg glass border-primary/30 hover:border-primary focus:border-secondary transition-all duration-300 focus:shadow-glow relative z-10"
                autoFocus
              />
              
              {/* Auto-suggestions Dropdown - like Jobs page */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-background border rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      className="w-full px-3 py-2 text-left hover:bg-muted/50 flex items-center justify-between"
                      onClick={() => handleSuggestionClick(suggestion.suggestion)}
                    >
                      <span className="text-sm">{suggestion.suggestion}</span>
                      <span className="text-xs text-muted-foreground">
                        {suggestion.type === 'job_title' && '📋'}
                        {suggestion.type === 'company' && '🏢'}
                        {suggestion.type === 'skill' && '🎯'}
                        {suggestion.type === 'category' && '📂'}
                        {suggestion.count}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              
              <div className="absolute inset-0 bg-gradient-primary rounded-lg opacity-0 group-hover:opacity-5 transition-opacity duration-300 pointer-events-none"></div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="container mx-auto px-4 py-6 space-y-8 pb-24">
          {/* Show job results when searched */}
          {hasSearched && (
            <div className="mb-8">

              {loading && jobs.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : jobs.length > 0 ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {jobs.map((job) => (
                      <JobCard
                        key={job.id}
                        id={job.id}
                        shortId={job.short_id}
                        title={job.title}
                        company={job.company_name}
                        location={job.location}
                        type={job.job_type}
                        experience={job.experience_level}
                        salary={job.salary_range}
                        description={job.description}
                        posted={job.created_at}
                        tags={job.skills}
                        trendingScore={job.trending_score}
                        organicRank={job.organic_rank}
                        organicScore={job.organic_score}
                        viewsCount={job.views_count}
                        applicationsCount={job.applications_count}
                        callsCount={job.calls_count}
                        sharesCount={job.shares_count}
                        isBoosted={job.is_boosted}
                        boostLevel={job.boost_level}
                        isVerified={job.is_verified}
                        verifiedPlanEnd={job.verified_plan_end}
                        badgeColor={job.badge_color}
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
                  </div>

                  {/* Load More Button */}
                  {hasMore && (
                    <div className="flex justify-center mt-6">
                      <Button
                        onClick={loadMore}
                        disabled={loading}
                        className="bg-gradient-primary text-primary-foreground hover:shadow-neon transition-all duration-300"
                      >
                        {loading ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Loading...
                          </>
                        ) : (
                          "Load More Jobs"
                        )}
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <Card className="p-8 text-center glass border border-primary/20">
                  <span className="mx-auto mb-4 inline-flex"><LottieSearchIcon size={64} /></span>
                  <h3 className="text-xl font-semibold mb-2">No Jobs Found</h3>
                  <p className="text-muted-foreground mb-4">
                    Try adjusting your search terms or browse all jobs
                  </p>
                  <Button
                    onClick={() => navigate('/jobs')}
                    variant="outline"
                  >
                    Browse All Jobs
                  </Button>
                </Card>
              )}
            </div>
          )}

          {/* Quick Search Suggestions - always visible */}
          <div className="space-y-8 animate-fade-in">
            {/* Quick Search Suggestions */}
            <div className="space-y-4">
              <h3 className="text-xl font-semibold gradient-text flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                Popular Searches
              </h3>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { icon: Briefcase, text: "Remote Jobs", color: "from-blue-500 to-cyan-500", action: "search" },
                  { icon: Globe, text: "Latest Jobs", color: "from-purple-500 to-pink-500", action: "latest" },
                  { icon: MapPin, text: "Jobs Near Me", color: "from-green-500 to-emerald-500", action: "foryou" },
                  { icon: TrendingUp, text: "Trending Now", color: "from-orange-500 to-red-500", action: "trending" },
                ].map((item, index) => (
                  <Card
                    key={index}
                    onClick={() => {
                      if (item.action === "search") {
                        setSearchQuery(item.text);
                        setHasSearched(true);
                        searchJobs(item.text, {}, 0, true);
                        setSearchParams({ q: item.text });
                      } else if (item.action === "foryou") {
                        navigate('/jobs?tab=for-you');
                      } else if (item.action === "trending") {
                        navigate('/jobs?tab=trending');
                      } else if (item.action === "latest") {
                        navigate('/jobs?tab=latest');
                      }
                    }}
                    className="group cursor-pointer glass border border-primary/20 p-4 hover:border-primary hover:shadow-glow transition-all duration-300 hover:scale-105 animate-fade-in"
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <div className="flex flex-col items-center text-center space-y-2">
                      <div className={`p-3 rounded-full bg-gradient-to-r ${item.color} shadow-lg group-hover:shadow-xl transition-all duration-300`}>
                        <item.icon className="w-5 h-5 text-white" />
                      </div>
                      <span className="text-sm font-medium">{item.text}</span>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <BottomNavigation />
    </>
  );
};

export default QuickAccess;
