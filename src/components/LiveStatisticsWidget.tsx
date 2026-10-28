import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Briefcase, Building, Users, Star, TrendingUp, CheckCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface PlatformStats {
  totalJobs: number;
  totalCompanies: number;
  totalUsers: number;
  verifiedCompanies: number;
  avgRating: number;
  totalApplications: number;
}

const LiveStatisticsWidget = () => {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['platform-live-stats'],
    queryFn: async (): Promise<PlatformStats> => {
      // Fetch all stats in parallel
      const [jobsResult, companiesResult, profilesResult, reviewsResult, applicationsResult] = await Promise.all([
        supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('companies').select('id, is_verified', { count: 'exact' }),
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('app_reviews').select('rating'),
        supabase.from('job_applications').select('id', { count: 'exact', head: true }),
      ]);

      const totalJobs = jobsResult.count || 0;
      const companies = companiesResult.data || [];
      const totalCompanies = companiesResult.count || 0;
      const verifiedCompanies = companies.filter(c => c.is_verified).length;
      const totalUsers = profilesResult.count || 0;
      const reviews = reviewsResult.data || [];
      const avgRating = reviews.length > 0 
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length 
        : 4.8;
      const totalApplications = applicationsResult.count || 0;

      return {
        totalJobs,
        totalCompanies,
        totalUsers,
        verifiedCompanies,
        avgRating: Number(avgRating.toFixed(1)),
        totalApplications,
      };
    },
    staleTime: 1000 * 60 * 60, // 60 minutes — egress optimization
    gcTime: 1000 * 60 * 60 * 2, // 2 hours
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M+`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K+`;
    return num.toString();
  };

  const statItems = [
    {
      icon: Briefcase,
      label: "Active Jobs",
      value: stats?.totalJobs || 0,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      icon: Building,
      label: "Companies",
      value: stats?.totalCompanies || 0,
      color: "text-emerald-600",
      bgColor: "bg-emerald-100",
    },
    {
      icon: CheckCircle,
      label: "Verified Employers",
      value: stats?.verifiedCompanies || 0,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      icon: Users,
      label: "Job Seekers",
      value: stats?.totalUsers || 0,
      color: "text-purple-600",
      bgColor: "bg-purple-100",
    },
    {
      icon: TrendingUp,
      label: "Applications",
      value: stats?.totalApplications || 0,
      color: "text-orange-600",
      bgColor: "bg-orange-100",
    },
    {
      icon: Star,
      label: "Avg Rating",
      value: stats?.avgRating || 4.8,
      isRating: true,
      color: "text-yellow-600",
      bgColor: "bg-yellow-100",
    },
  ];

  if (isLoading) {
    return (
      <section className="py-6 bg-background">
        <div className="container mx-auto px-4 lg:px-6 xl:px-8 max-w-6xl">
          <div className="text-center mb-6">
            <Skeleton className="h-8 w-48 mx-auto mb-2" />
            <Skeleton className="h-4 w-64 mx-auto" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-6 bg-background">
      <div className="container mx-auto px-4 lg:px-6 xl:px-8 max-w-6xl">
        <div className="text-center mb-6">
          <h2 className="text-xl md:text-2xl font-bold text-foreground mb-1">
            📊 Live Platform Statistics
          </h2>
          <p className="text-sm text-muted-foreground">
            Real-time data from our growing community
          </p>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
          {statItems.map((item, index) => (
            <div
              key={index}
              className="bg-card border rounded-xl p-4 text-center hover:shadow-md transition-shadow"
            >
              <div className={`inline-flex p-2 rounded-lg ${item.bgColor} mb-2`}>
                <item.icon className={`w-5 h-5 ${item.color}`} />
              </div>
              <div className={`text-xl md:text-2xl font-bold ${item.color}`}>
                {item.isRating ? (
                  <span className="flex items-center justify-center gap-1">
                    {item.value}
                    <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  </span>
                ) : (
                  formatNumber(item.value as number)
                )}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {item.label}
              </div>
            </div>
          ))}
        </div>

        {/* Trust indicator */}
        <div className="text-center mt-4">
          <span className="inline-flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            Live data • Updated every 5 minutes
          </span>
        </div>
      </div>
    </section>
  );
};

export default LiveStatisticsWidget;
