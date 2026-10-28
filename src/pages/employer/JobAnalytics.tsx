import { useState, useEffect } from "react";
import { goBack } from "@/lib/goBack";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  ArrowLeft, 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Eye, 
  Clock,
  MapPin,
  Download,
  Share2,
  Calendar,
  Phone
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useJobAnalytics } from "@/hooks/useJobAnalytics";
import { useWakeRefetch } from "@/hooks/useWakeRefetch";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const JobAnalytics = () => {
  const navigate = useNavigate();
  const { jobId } = useParams();
  const [timeRange, setTimeRange] = useState("30d");
  const [jobTitle, setJobTitle] = useState("Senior Frontend Developer");
  const [realTimeData, setRealTimeData] = useState({
    dailyViews: [],
    recentActivity: [],
    topSources: [],
    locationData: [],
    experienceData: [],
    applicationsData: []
  });
  
  const { analytics, loading, error, refetch } = useJobAnalytics(jobId, timeRange);

  // Refetch on tab wake so page doesn't stay stuck after mobile screen off/on
  useWakeRefetch(refetch, !!jobId);

  // Fetch job title and real analytics data with real-time updates
  useEffect(() => {
    const fetchJobData = async () => {
      if (!jobId) return;
      
      try {
        // Fetch job details
        const { data: jobData, error: jobError } = await supabase
          .from('jobs')
          .select('title, created_at')
          .eq('id', jobId)
          .maybeSingle();
          
        if (jobError) throw jobError;
        if (jobData?.title) {
          setJobTitle(jobData.title);
        }

        // Calculate date range based on timeRange
        const getDaysAgo = (range: string) => {
          switch (range) {
            case '7d': return 7;
            case '30d': return 30;
            case '90d': return 90;
            case '1y': return 365;
            default: return 30;
          }
        };

        const daysAgo = getDaysAgo(timeRange);
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - daysAgo);

        // Fetch real applications data
        const { data: applicationsData, error: appsError } = await supabase
          .from('job_applications')
          .select('*')
          .eq('job_id', jobId)
          .gte('applied_at', startDate.toISOString())
          .order('applied_at', { ascending: false });

        if (appsError) throw appsError;

        // Fetch profiles for applicants
        let profilesData = [];
        if (applicationsData && applicationsData.length > 0) {
          const userIds = applicationsData.map(app => app.applicant_id);
          const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('user_id, full_name, location, city, state, current_position, experience_level, experience_years')
            .in('user_id', userIds);
          
          if (!profilesError) {
            profilesData = profiles || [];
          }
        }

        // Merge applications with profiles
        const applicationsWithProfiles = applicationsData?.map(app => ({
          ...app,
          profile: profilesData.find(profile => profile.user_id === app.applicant_id)
        })) || [];

        // Fetch real job interactions (views, calls, shares)
        const { data: interactionsData, error: intError } = await supabase
          .from('job_interactions')
          .select('*')
          .eq('job_id', jobId)
          .gte('created_at', startDate.toISOString())
          .order('created_at', { ascending: false });

        if (intError) throw intError;

        // Process daily views and applications
        const dailyStats = new Map();
        
        // Process interactions for daily views
        interactionsData?.forEach(interaction => {
          if (interaction.interaction_type === 'view') {
            const date = new Date(interaction.created_at).toLocaleDateString();
            if (!dailyStats.has(date)) {
              dailyStats.set(date, { date, views: 0, applications: 0 });
            }
            dailyStats.get(date).views++;
          }
        });

        // Process applications for daily applications
        applicationsWithProfiles?.forEach(app => {
          const date = new Date(app.applied_at).toLocaleDateString();
          if (!dailyStats.has(date)) {
            dailyStats.set(date, { date, views: 0, applications: 0 });
          }
          dailyStats.get(date).applications++;
        });

        const dailyViews = Array.from(dailyStats.values()).slice(-7);

        // Process location data from applications
        const locationStats = new Map();
        applicationsWithProfiles?.forEach(app => {
          const location = app.profile?.city || app.profile?.location || 'Unknown';
          locationStats.set(location, (locationStats.get(location) || 0) + 1);
        });
        
        const locationData = Array.from(locationStats.entries())
          .map(([location, count]) => ({ location, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

        // Process experience data from applications
        const expStats = new Map();
        applicationsWithProfiles?.forEach(app => {
          const expYears = app.profile?.experience_years;
          let level = 'Unknown';
          
          if (expYears !== null && expYears !== undefined) {
            if (expYears <= 1) level = '0-1 years';
            else if (expYears <= 3) level = '1-3 years';
            else if (expYears <= 5) level = '3-5 years';
            else if (expYears <= 8) level = '5-8 years';
            else level = '8+ years';
          }
          
          expStats.set(level, (expStats.get(level) || 0) + 1);
        });

        const totalApps = applicationsWithProfiles?.length || 0;
        const experienceData = Array.from(expStats.entries())
          .map(([level, count]) => ({
            level,
            count,
            percentage: totalApps > 0 ? Math.round((count / totalApps) * 100) : 0
          }))
          .sort((a, b) => b.count - a.count);

        // Create mock sources data based on real applications count
        const totalApplications = applicationsWithProfiles?.length || 0;
        const topSources = [
          { source: "Direct Applications", applications: Math.ceil(totalApplications * 0.4), percentage: 40 },
          { source: "LinkedIn", applications: Math.ceil(totalApplications * 0.25), percentage: 25 },
          { source: "Job Portals", applications: Math.ceil(totalApplications * 0.20), percentage: 20 },
          { source: "Referrals", applications: Math.ceil(totalApplications * 0.10), percentage: 10 },
          { source: "Other", applications: Math.ceil(totalApplications * 0.05), percentage: 5 }
        ].filter(source => source.applications > 0);

        // Create recent activity from real data
        const recentActivity = [];
        
        // Add recent applications
        applicationsWithProfiles?.slice(0, 3).forEach(app => {
          const timeAgo = getTimeAgo(app.applied_at);
          recentActivity.push({
            type: 'application',
            message: `New application from ${app.profile?.full_name || 'Candidate'}`,
            time: timeAgo,
            color: 'blue'
          });
        });

        // Add recent views (sample from interactions)
        const recentViews = interactionsData?.filter(i => i.interaction_type === 'view').slice(0, 2);
        recentViews?.forEach(view => {
          const timeAgo = getTimeAgo(view.created_at);
          recentActivity.push({
            type: 'view',
            message: `Job viewed by visitor`,
            time: timeAgo,
            color: 'green'
          });
        });

        // Sort by most recent
        recentActivity.sort((a: any, b: any) => {
          const dateA = new Date(a.created_at || new Date());
          const dateB = new Date(b.created_at || new Date());
          return dateB.getTime() - dateA.getTime();
        });

        setRealTimeData({
          dailyViews: dailyViews.length > 0 ? dailyViews : [{ date: 'Today', views: 0, applications: 0 }],
          recentActivity: recentActivity.slice(0, 5),
          topSources,
          locationData: locationData.length > 0 ? locationData : [{ location: 'No data', count: 0 }],
          experienceData: experienceData.length > 0 ? experienceData : [{ level: 'No data', count: 0, percentage: 0 }],
          applicationsData: applicationsData || []
        });

      } catch (error) {
        console.error('Error fetching analytics data:', error);
        toast.error('Failed to load analytics data');
      }
    };

    fetchJobData();

    // Set up real-time subscriptions for live updates
    const applicationsChannel = supabase
      .channel(`job-applications-${jobId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'job_applications',
          filter: `job_id=eq.${jobId}`
        },
        () => {
          console.log('New application detected, refreshing data...');
          fetchJobData();
        }
      )
      .subscribe();

    const interactionsChannel = supabase
      .channel(`job-interactions-${jobId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'job_interactions',
          filter: `job_id=eq.${jobId}`
        },
        () => {
          console.log('New interaction detected, refreshing data...');
          fetchJobData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(applicationsChannel);
      supabase.removeChannel(interactionsChannel);
    };
  }, [jobId, timeRange]);

  // Helper function to get time ago
  const getTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return 'Just now';
  };

  // Download analytics data as CSV
  const downloadAnalytics = () => {
    if (!analytics) return;
    
    const csvData = [
      ['Metric', 'Value'],
      ['Total Views', analytics.total_views],
      ['Unique Views', analytics.unique_views],
      ['Total Applications', analytics.total_applications],
      ['Applications This Week', analytics.applications_this_week],
      ['Views This Week', analytics.views_this_week],
      ['Conversion Rate (%)', analytics.conversion_rate],
      ['Calls Count', analytics.calls_count],
      ['Shares Count', analytics.shares_count],
      ['Time Range', getTimeRangeLabel(timeRange)],
      ['Export Date', new Date().toLocaleDateString()],
    ];

    // Add source data
    csvData.push([''], ['Traffic Sources', '']);
    realTimeData.topSources.forEach(source => {
      csvData.push([source.source, `${source.applications} applications (${source.percentage}%)`]);
    });

    // Add location data
    csvData.push([''], ['Top Locations', '']);
    realTimeData.locationData.forEach(location => {
      csvData.push([location.location, location.count]);
    });

    // Add experience data
    csvData.push([''], ['Experience Levels', '']);
    realTimeData.experienceData.forEach(exp => {
      csvData.push([exp.level, `${exp.count} candidates (${exp.percentage}%)`]);
    });

    const csvContent = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `job-analytics-${jobId}-${timeRange}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    
    toast.success('Analytics data exported successfully!');
  };

  // Get human readable time range label
  const getTimeRangeLabel = (range: string) => {
    switch (range) {
      case '7d': return 'Last 7 days';
      case '30d': return 'Last 30 days';
      case '90d': return 'Last 90 days';
      case '1y': return 'Last year';
      default: return range;
    }
  };

  // Handle time range change
  const handleTimeRangeChange = (newRange: string) => {
    setTimeRange(newRange);
    toast.success(`Analytics updated for ${getTimeRangeLabel(newRange)}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={() => goBack(navigate, "/employer-portal")}>Back to Dashboard</Button>
        </div>
      </div>
    );
  }

  if (!analytics) return null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-background overflow-x-hidden">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-2 sm:space-x-4 min-w-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/employer-portal")}
                className="text-slate-600 hover:text-slate-900 shrink-0"
              >
                <ArrowLeft className="w-4 h-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Back to Jobs</span>
                <span className="sm:hidden">Back</span>
              </Button>
            </div>
            <div className="text-center min-w-0 flex-1">
              <h1 className="text-lg sm:text-xl font-semibold text-slate-900 truncate">Job Analytics</h1>
              <p className="text-xs sm:text-sm text-slate-500 truncate">{jobTitle}</p>
            </div>
            <div className="flex items-center space-x-1 sm:space-x-2 shrink-0">
              <Button variant="outline" size="sm" className="hidden sm:flex">
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </Button>
              <Button variant="outline" size="sm" onClick={downloadAnalytics}>
                <Download className="w-4 h-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Export</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-4 sm:py-6">
        {/* Time Range Selector */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div className="flex items-center space-x-2 min-w-0">
            <Calendar className="w-4 h-4 text-slate-500 shrink-0" />
            <span className="text-sm text-slate-600 shrink-0">Time Range:</span>
            <Select value={timeRange} onValueChange={handleTimeRangeChange}>
              <SelectTrigger className="w-28 sm:w-32 bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-50 bg-white">
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
                <SelectItem value="1y">Last year</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Badge variant="outline" className="text-green-600 border-green-200 shrink-0">
            Active Job
          </Badge>
        </div>

        {/* Key Metrics - Mobile Responsive */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          <Card className="p-4 sm:p-5 bg-gradient-to-br from-blue-50 to-white border-blue-100 hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-slate-600 text-xs sm:text-sm font-medium mb-1">Total Views</p>
                <p className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">{analytics.total_views}</p>
                <div className="flex items-center">
                  <span className="text-slate-600 text-xs sm:text-sm">Unique: {analytics.unique_views}</span>
                </div>
              </div>
              <div className="p-2 sm:p-3 bg-blue-100 rounded-lg">
                <Eye className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
              </div>
            </div>
          </Card>

          <Card className="p-4 sm:p-5 bg-gradient-to-br from-green-50 to-white border-green-100 hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-slate-600 text-xs sm:text-sm font-medium mb-1">Applications</p>
                <p className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">{analytics.total_applications}</p>
                <div className="flex items-center">
                  <span className="text-green-600 text-xs sm:text-sm font-medium">+{analytics.applications_this_week} this week</span>
                </div>
              </div>
              <div className="p-2 sm:p-3 bg-green-100 rounded-lg">
                <Users className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
              </div>
            </div>
          </Card>

          <Card className="p-4 sm:p-5 bg-gradient-to-br from-purple-50 to-white border-purple-100 hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-slate-600 text-xs sm:text-sm font-medium mb-1">Conversion</p>
                <p className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">{analytics.conversion_rate}%</p>
                <div className="flex items-center">
                  <TrendingUp className={`w-3 h-3 sm:w-4 sm:h-4 mr-1 ${analytics.conversion_rate > 15 ? 'text-green-500' : 'text-slate-500'}`} />
                  <span className={`text-xs sm:text-sm ${analytics.conversion_rate > 15 ? 'text-green-600 font-medium' : 'text-slate-600'}`}>
                    {analytics.conversion_rate > 15 ? 'Above avg' : 'Avg: 15%'}
                  </span>
                </div>
              </div>
              <div className="p-2 sm:p-3 bg-purple-100 rounded-lg">
                <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600" />
              </div>
            </div>
          </Card>

          <Card className="p-4 sm:p-5 bg-gradient-to-br from-orange-50 to-white border-orange-100 hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-slate-600 text-xs sm:text-sm font-medium mb-1">Engagement</p>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div>
                    <p className="text-xl sm:text-2xl font-bold text-slate-900">{analytics.calls_count}</p>
                    <p className="text-xs text-slate-600">Calls</p>
                  </div>
                  <div>
                    <p className="text-xl sm:text-2xl font-bold text-slate-900">{analytics.shares_count}</p>
                    <p className="text-xs text-slate-600">Shares</p>
                  </div>
                </div>
              </div>
              <div className="p-2 sm:p-3 bg-orange-100 rounded-lg">
                <Phone className="w-5 h-5 sm:w-6 sm:h-6 text-orange-600" />
              </div>
            </div>
          </Card>
        </div>

        {/* Detailed Analytics - Mobile Responsive Tabs */}
        <Tabs defaultValue="overview" className="space-y-4 sm:space-y-6">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 gap-1 h-auto bg-slate-100 p-1">
            <TabsTrigger value="overview" className="text-xs sm:text-sm py-2">Overview</TabsTrigger>
            <TabsTrigger value="sources" className="text-xs sm:text-sm py-2">Sources</TabsTrigger>
            <TabsTrigger value="demographics" className="text-xs sm:text-sm py-2">Demographics</TabsTrigger>
            <TabsTrigger value="performance" className="text-xs sm:text-sm py-2">Performance</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 sm:space-y-6">
            {/* Daily Views Chart - Mobile Friendly */}
            <Card className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base sm:text-lg font-semibold text-slate-900">Daily Trends</h3>
                <Badge variant="outline" className="text-xs">Real-time</Badge>
              </div>
              <div className="h-48 sm:h-64 bg-gradient-to-br from-slate-50 to-blue-50 rounded-lg flex items-center justify-center p-4">
                <div className="text-center">
                  <TrendingUp className="w-8 h-8 sm:w-12 sm:h-12 text-blue-400 mx-auto mb-2" />
                  <p className="text-sm sm:text-base text-slate-600 font-medium">Views & Applications Trend</p>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1">{realTimeData.dailyViews.length} days tracked</p>
                </div>
              </div>
            </Card>

            {/* Recent Activity - Mobile Responsive */}
            <Card className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base sm:text-lg font-semibold text-slate-900">Recent Activity</h3>
                <Badge variant="secondary" className="text-xs">Live</Badge>
              </div>
              <div className="space-y-2 sm:space-y-3">
                {realTimeData.recentActivity.length > 0 ? (
                  realTimeData.recentActivity.map((activity, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gradient-to-r from-slate-50 to-transparent rounded-lg border border-slate-100">
                      <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${
                          activity.color === 'blue' ? 'bg-blue-500' : 
                          activity.color === 'green' ? 'bg-green-500' : 
                          'bg-purple-500'
                        }`}></div>
                        <span className="text-xs sm:text-sm truncate">{activity.message}</span>
                      </div>
                      <span className="text-xs text-slate-500 shrink-0 ml-2">{activity.time}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    <Clock className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                    <p className="text-sm">No recent activity</p>
                    <p className="text-xs text-slate-400 mt-1">New updates will appear here</p>
                  </div>
                )}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="sources" className="space-y-4 sm:space-y-6">
            <Card className="p-4 sm:p-6">
              <h3 className="text-base sm:text-lg font-semibold text-slate-900 mb-4">Application Sources</h3>
              <div className="space-y-3 sm:space-y-4">
                {realTimeData.topSources.map((source, index) => (
                  <div key={source.source} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className={`w-3 h-3 rounded-full ${
                        index === 0 ? 'bg-blue-500' :
                        index === 1 ? 'bg-green-500' :
                        index === 2 ? 'bg-purple-500' :
                        index === 3 ? 'bg-orange-500' : 'bg-slate-500'
                      }`}></div>
                      <span className="font-medium text-sm sm:text-base">{source.source}</span>
                    </div>
                    <div className="flex items-center space-x-3 sm:space-x-4 ml-6 sm:ml-0">
                      <span className="text-xs sm:text-sm text-slate-600">{source.applications} apps</span>
                      <Badge variant="secondary" className="text-xs">{source.percentage}%</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="demographics" className="space-y-4 sm:space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              <Card className="p-4 sm:p-6 bg-gradient-to-br from-white to-blue-50">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base sm:text-lg font-semibold text-slate-900">Top Locations</h3>
                  <MapPin className="w-5 h-5 text-blue-500" />
                </div>
                <div className="space-y-3">
                  {realTimeData.locationData.length > 0 && realTimeData.locationData[0].location !== 'No data' ? (
                    realTimeData.locationData.map((location, index) => (
                      <div key={location.location} className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-100">
                        <div className="flex items-center space-x-3">
                          <div className="flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 bg-blue-100 rounded-full">
                            <span className="text-xs sm:text-sm font-bold text-blue-600">{index + 1}</span>
                          </div>
                          <div>
                            <p className="font-medium text-sm sm:text-base">{location.location}</p>
                            <p className="text-xs text-slate-500">Applicants: {location.count}</p>
                          </div>
                        </div>
                        <span className="font-bold text-slate-900 text-lg">{location.count}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-slate-500">
                      <MapPin className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                      <p className="text-sm">No location data yet</p>
                      <p className="text-xs text-slate-400 mt-1">Data will appear as applications come in</p>
                    </div>
                  )}
                </div>
              </Card>

              <Card className="p-4 sm:p-6 bg-gradient-to-br from-white to-green-50">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base sm:text-lg font-semibold text-slate-900">Experience Levels</h3>
                  <Users className="w-5 h-5 text-green-500" />
                </div>
                <div className="space-y-3">
                  {realTimeData.experienceData.length > 0 && realTimeData.experienceData[0].level !== 'No data' ? (
                    realTimeData.experienceData.map((exp, index) => (
                      <div key={exp.level} className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-100">
                        <div className="flex items-center space-x-3">
                          <div className="flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 bg-green-100 rounded-full">
                            <span className="text-xs sm:text-sm font-bold text-green-600">{index + 1}</span>
                          </div>
                          <div>
                            <p className="font-medium text-sm sm:text-base">{exp.level}</p>
                            <p className="text-xs text-slate-500">{exp.percentage}% of total</p>
                          </div>
                        </div>
                        <span className="font-bold text-slate-900 text-lg">{exp.count}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-slate-500">
                      <Users className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                      <p className="text-sm">No experience data yet</p>
                      <p className="text-xs text-slate-400 mt-1">Data will appear as applications come in</p>
                    </div>
                  )}
                </div>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="performance" className="space-y-4 sm:space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              <Card className="p-4 sm:p-6 bg-gradient-to-br from-white to-purple-50">
                <h3 className="text-base sm:text-lg font-semibold text-slate-900 mb-4">Performance Metrics</h3>
                <div className="space-y-3 sm:space-y-4">
                  <div className="flex justify-between p-3 bg-white rounded-lg border border-slate-100">
                    <span className="text-xs sm:text-sm text-slate-600">Views per day</span>
                    <span className="font-bold text-sm sm:text-base text-slate-900">
                      {(analytics.total_views / Math.max(realTimeData.dailyViews.length, 1)).toFixed(1)}
                    </span>
                  </div>
                  <div className="flex justify-between p-3 bg-white rounded-lg border border-slate-100">
                    <span className="text-xs sm:text-sm text-slate-600">Applications per day</span>
                    <span className="font-bold text-sm sm:text-base text-slate-900">
                      {(analytics.total_applications / Math.max(realTimeData.dailyViews.length, 1)).toFixed(1)}
                    </span>
                  </div>
                  <div className="flex justify-between p-3 bg-white rounded-lg border border-slate-100">
                    <span className="text-xs sm:text-sm text-slate-600">View-to-apply rate</span>
                    <span className="font-bold text-sm sm:text-base text-green-600">{analytics.conversion_rate}%</span>
                  </div>
                  <div className="flex justify-between p-3 bg-white rounded-lg border border-slate-100">
                    <span className="text-xs sm:text-sm text-slate-600">Engagement score</span>
                    <Badge variant="secondary" className="text-xs sm:text-sm">
                      {analytics.calls_count + analytics.shares_count > 10 ? 'High' : 'Medium'}
                    </Badge>
                  </div>
                </div>
              </Card>

              <Card className="p-4 sm:p-6 bg-gradient-to-br from-white to-green-50">
                <h3 className="text-base sm:text-lg font-semibold text-slate-900 mb-4">Benchmarks</h3>
                <div className="space-y-3 sm:space-y-4">
                  <div className="flex justify-between p-3 bg-white rounded-lg border border-slate-100">
                    <span className="text-xs sm:text-sm text-slate-600">Industry avg conversion</span>
                    <span className="font-medium text-sm sm:text-base">15.8%</span>
                  </div>
                  <div className="flex justify-between p-3 bg-white rounded-lg border border-green-100 bg-green-50">
                    <span className="text-xs sm:text-sm text-slate-600">Your conversion</span>
                    <div className="flex items-center space-x-1">
                      <span className="font-bold text-sm sm:text-base text-green-600">{analytics.conversion_rate}%</span>
                      <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 text-green-600" />
                    </div>
                  </div>
                  <div className="flex justify-between p-3 bg-white rounded-lg border border-slate-100">
                    <span className="text-xs sm:text-sm text-slate-600">Avg views to hire</span>
                    <span className="font-medium text-sm sm:text-base">50-80</span>
                  </div>
                  <div className="flex justify-between p-3 bg-white rounded-lg border border-green-100 bg-green-50">
                    <span className="text-xs sm:text-sm text-slate-600">Your performance</span>
                    <Badge className="bg-green-600 text-white text-xs">
                      {analytics.conversion_rate > 15 ? 'Excellent' : 'Good'}
                    </Badge>
                  </div>
                </div>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default JobAnalytics;