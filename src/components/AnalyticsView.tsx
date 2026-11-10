import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Eye, 
  Calendar,
  Download,
  Share2,
  BarChart3,
  Target,
  Award
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useEmployerAuth } from "@/contexts/EmployerAuthContext";

const AnalyticsView = () => {
  const navigate = useNavigate();
  const { user, company } = useEmployerAuth();
  const [timeRange, setTimeRange] = useState("30d");
  const [analytics, setAnalytics] = useState({
    totalViews: 0,
    totalApplications: 0,
    responseRate: 0,
    hireRate: 0,
    uniqueViews: 0,
    conversionRate: 0,
    activeJobs: 0
  });
  const [loading, setLoading] = useState(true);

  // Debug logging
  console.log('AnalyticsView - user:', user?.id, 'company:', company?.id);

  useEffect(() => {
    if (company?.id) {
      fetchAnalytics();
    } else {
      console.log('No company found, setting loading to false');
      setLoading(false);
    }
  }, [company?.id, timeRange]);

  const fetchAnalytics = async () => {
    if (!company?.id) return;
    
    try {
      setLoading(true);
      
      // Get company jobs
      const { data: jobs } = await supabase
        .from('jobs')
        .select('id')
        .eq('company_id', company.id);

      if (!jobs?.length) {
        setAnalytics({
          totalViews: 0,
          totalApplications: 0,
          responseRate: 0,
          hireRate: 0,
          uniqueViews: 0,
          conversionRate: 0,
          activeJobs: 0
        });
        return;
      }

      const jobIds = jobs.map(job => job.id);

      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      switch(timeRange) {
        case '7d': startDate.setDate(endDate.getDate() - 7); break;
        case '30d': startDate.setDate(endDate.getDate() - 30); break;
        case '90d': startDate.setDate(endDate.getDate() - 90); break;
        case '1y': startDate.setFullYear(endDate.getFullYear() - 1); break;
        default: startDate.setDate(endDate.getDate() - 30);
      }

      // Fetch views
      const { data: viewsData } = await supabase
        .from('job_interactions')
        .select('id, user_id')
        .in('job_id', jobIds)
        .eq('interaction_type', 'view')
        .gte('created_at', startDate.toISOString());

      // Fetch applications
      const { data: applicationsData } = await supabase
        .from('job_applications')
        .select('id, status')
        .in('job_id', jobIds)
        .gte('applied_at', startDate.toISOString());

      // Calculate metrics
      const totalViews = viewsData?.length || 0;
      const uniqueViews = new Set(viewsData?.map(v => v.user_id).filter(Boolean)).size;
      const totalApplications = applicationsData?.length || 0;
      const hiredCount = applicationsData?.filter(app => app.status === 'hired').length || 0;
      
      const responseRate = totalViews > 0 ? (totalApplications / totalViews) * 100 : 0;
      const hireRate = totalApplications > 0 ? (hiredCount / totalApplications) * 100 : 0;
      const conversionRate = responseRate;

      // Get active jobs count
      const { data: activeJobsData } = await supabase
        .from('jobs')
        .select('id')
        .eq('company_id', company.id)
        .eq('status', 'active');

      setAnalytics({
        totalViews,
        totalApplications,
        responseRate: Math.round(responseRate * 10) / 10,
        hireRate: Math.round(hireRate * 10) / 10,
        uniqueViews,
        conversionRate: Math.round(conversionRate * 10) / 10,
        activeJobs: activeJobsData?.length || 0
      });

    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="py-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-card border rounded-lg p-4 space-y-2">
              <div className="h-4 w-24 bg-muted/50 rounded animate-pulse" />
              <div className="h-8 w-16 bg-muted/50 rounded animate-pulse" />
            </div>
          ))}
        </div>
        <div className="h-64 bg-card border rounded-lg p-4">
          <div className="h-4 w-32 bg-muted/50 rounded animate-pulse mb-4" />
          <div className="h-48 bg-muted/30 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  // If no company is found, show a message
  if (!company) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="text-slate-500 mb-4">
          <BarChart3 className="w-16 h-16 mx-auto mb-4" />
          <h3 className="text-lg font-medium">No Company Profile Found</h3>
          <p className="text-sm mt-2">Please complete your company profile to view analytics.</p>
        </div>
        <Button onClick={() => navigate('/employer-portal')}>
          Go to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Analytics & Reports</h1>
          <p className="text-slate-600">Track your hiring performance and metrics</p>
        </div>
        <div className="flex items-center space-x-3">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="1y">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Views */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-600 text-sm font-medium">Total Views</p>
              <p className="text-3xl font-bold text-slate-900">{analytics.totalViews.toLocaleString()}</p>
              <div className="flex items-center mt-2">
                <span className="text-slate-600 text-sm">Unique: {analytics.uniqueViews}</span>
              </div>
            </div>
            <Eye className="w-8 h-8 text-blue-500" />
          </div>
        </Card>

        {/* Applications */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-600 text-sm font-medium">Applications</p>
              <p className="text-3xl font-bold text-slate-900">{analytics.totalApplications}</p>
              <div className="flex items-center mt-2">
                <TrendingUp className="w-4 h-4 mr-1 text-green-500" />
                <span className="text-green-600 text-sm">Active jobs: {analytics.activeJobs}</span>
              </div>
            </div>
            <Users className="w-8 h-8 text-green-500" />
          </div>
        </Card>

        {/* Response Rate */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-600 text-sm font-medium">Response Rate</p>
              <p className="text-3xl font-bold text-slate-900">{analytics.responseRate}%</p>
              <div className="flex items-center mt-2">
                <Target className={`w-4 h-4 mr-1 ${analytics.responseRate > 15 ? 'text-green-500' : 'text-slate-500'}`} />
                <span className={`text-sm ${analytics.responseRate > 15 ? 'text-green-600' : 'text-slate-600'}`}>
                  {analytics.responseRate > 15 ? 'Above average' : 'Industry avg: 15%'}
                </span>
              </div>
            </div>
            <BarChart3 className="w-8 h-8 text-yellow-500" />
          </div>
        </Card>

        {/* Hire Rate */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-600 text-sm font-medium">Hire Rate</p>
              <p className="text-3xl font-bold text-slate-900">{analytics.hireRate}%</p>
              <div className="flex items-center mt-2">
                <Award className={`w-4 h-4 mr-1 ${analytics.hireRate > 10 ? 'text-green-500' : 'text-slate-500'}`} />
                <span className={`text-sm ${analytics.hireRate > 10 ? 'text-green-600' : 'text-slate-600'}`}>
                  {analytics.hireRate > 10 ? 'Great performance' : 'Industry avg: 12%'}
                </span>
              </div>
            </div>
            <Award className="w-8 h-8 text-purple-500" />
          </div>
        </Card>
      </div>

      {/* Performance Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Conversion Funnel */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Conversion Funnel</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Job Views</span>
              <div className="flex items-center space-x-2">
                <div className="w-32 bg-slate-200 rounded-full h-2">
                  <div className="bg-blue-500 h-2 rounded-full" style={{ width: '100%' }}></div>
                </div>
                <span className="font-medium">{analytics.totalViews}</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Applications</span>
              <div className="flex items-center space-x-2">
                <div className="w-32 bg-slate-200 rounded-full h-2">
                  <div className="bg-green-500 h-2 rounded-full" style={{ 
                    width: analytics.totalViews > 0 ? `${(analytics.totalApplications / analytics.totalViews) * 100}%` : '0%' 
                  }}></div>
                </div>
                <span className="font-medium">{analytics.totalApplications}</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Conversion Rate</span>
              <div className="flex items-center space-x-2">
                <Badge variant={analytics.conversionRate > 15 ? "default" : "secondary"}>
                  {analytics.conversionRate}%
                </Badge>
              </div>
            </div>
          </div>
        </Card>

        {/* Performance Insights */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Performance Insights</h3>
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center space-x-2">
                <Eye className="w-5 h-5 text-blue-600" />
                <span className="text-blue-900 font-medium">View Performance</span>
              </div>
              <p className="text-blue-800 text-sm mt-1">
                {analytics.totalViews > 100 ? 'Excellent visibility!' : 'Consider boosting job posts for more visibility'}
              </p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <div className="flex items-center space-x-2">
                <Users className="w-5 h-5 text-green-600" />
                <span className="text-green-900 font-medium">Application Quality</span>
              </div>
              <p className="text-green-800 text-sm mt-1">
                {analytics.responseRate > 15 ? 'Great response rate!' : 'Try optimizing job descriptions'}
              </p>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg">
              <div className="flex items-center space-x-2">
                <Award className="w-5 h-5 text-purple-600" />
                <span className="text-purple-900 font-medium">Hiring Success</span>
              </div>
              <p className="text-purple-800 text-sm mt-1">
                {analytics.hireRate > 10 ? 'Strong hiring performance!' : 'Focus on improving candidate screening'}
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default AnalyticsView;