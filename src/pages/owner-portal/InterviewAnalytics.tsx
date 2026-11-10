import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, Users, Clock, PlayCircle, BookOpen, Award, BarChart3, Calendar, Video } from "lucide-react";
import SEO from "@/components/SEO";
import { Badge } from "@/components/ui/badge";
import { useInterviewAnalytics } from "@/hooks/useInterviewAnalytics";

const InterviewAnalytics = () => {
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'all'>('month');

  // Fetch interview statistics
  const { data: interviewStats, isLoading } = useInterviewAnalytics(dateRange);

  const stats = [
    {
      title: "Total Interviews",
      value: interviewStats?.totalSessions || 0,
      icon: PlayCircle,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      trend: interviewStats?.totalSessions ? `${interviewStats.totalSessions} total` : "No data"
    },
    {
      title: "Active Sessions",
      value: interviewStats?.activeSessions || 0,
      icon: TrendingUp,
      color: "text-green-600",
      bgColor: "bg-green-50",
      trend: "Live now"
    },
    {
      title: "Total Participants",
      value: interviewStats?.totalParticipants || 0,
      icon: Users,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
      trend: "all time"
    },
    {
      title: "Avg Attendance",
      value: interviewStats?.avgAttendance || 0,
      icon: BookOpen,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
      trend: "per session"
    },
    {
      title: "Avg Duration",
      value: `${interviewStats?.avgDuration || 0} min`,
      icon: Clock,
      color: "text-cyan-600",
      bgColor: "bg-cyan-50",
      trend: "average"
    },
    {
      title: "Completion Rate",
      value: `${interviewStats?.completionRate || 0}%`,
      icon: Award,
      color: "text-pink-600",
      bgColor: "bg-pink-50",
      trend: interviewStats?.completedSessions ? `${interviewStats.completedSessions} completed` : "0 completed"
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <SEO 
        title="Interview Analytics - Owner Portal"
        description="Comprehensive analytics for video interview sessions"
        noindex
      />

      <div className="container mx-auto p-4 md:p-6 max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              Interview Analytics
            </h1>
            <p className="text-muted-foreground mt-1">
              Track and analyze video interview session metrics
            </p>
          </div>

          {/* Date Range Selector */}
          <Tabs value={dateRange} onValueChange={(v) => setDateRange(v as any)} className="w-auto">
            <TabsList>
              <TabsTrigger value="today">Today</TabsTrigger>
              <TabsTrigger value="week">Week</TabsTrigger>
              <TabsTrigger value="month">Month</TabsTrigger>
              <TabsTrigger value="all">All Time</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {stats.map((stat, index) => (
            <Card key={index} className="hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stat.trend}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Detailed Analytics Tabs */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="sessions">Sessions</TabsTrigger>
            <TabsTrigger value="participants">Participants</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Session Overview</CardTitle>
                  <CardDescription>Total interview sessions breakdown</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Completed Sessions</span>
                    <Badge variant="outline" className="bg-green-50">
                      {interviewStats?.completedSessions || 0}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Active Sessions</span>
                    <Badge variant="outline" className="bg-blue-50">
                      {interviewStats?.activeSessions || 0}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Upcoming Sessions</span>
                    <Badge variant="outline" className="bg-purple-50">
                      {interviewStats?.upcomingSessions || 0}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Engagement Metrics</CardTitle>
                  <CardDescription>Participant engagement statistics</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Average Attendance</span>
                    <span className="font-semibold">{interviewStats?.avgAttendance || 0} users</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Completion Rate</span>
                    <span className="font-semibold">{interviewStats?.completionRate || 0}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Total Participants</span>
                    <span className="font-semibold">{interviewStats?.totalParticipants || 0}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="sessions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Session Details</CardTitle>
                <CardDescription>Detailed information about interview sessions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Session details will be displayed here</p>
                  <p className="text-sm mt-2">Individual interview session records and details</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="participants" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Participant Analytics</CardTitle>
                <CardDescription>Detailed participant engagement data</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Participant analytics will be displayed here</p>
                  <p className="text-sm mt-2">View attendance records, engagement metrics, and participation rates</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="performance" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Performance Metrics</CardTitle>
                <CardDescription>Interview effectiveness and outcomes</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Performance metrics will be displayed here</p>
                  <p className="text-sm mt-2">Track interview effectiveness, mode distribution, and success rates</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default InterviewAnalytics;
