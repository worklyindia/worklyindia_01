import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { useAIAccessStats, useAIAccessTrends, useRecentAIAccess, type AIDataAccessLog } from "@/hooks/useAIDataAccessLogs";
import { 
  Activity, 
  Bot, 
  MessageSquare, 
  Users, 
  Clock, 
  TrendingUp,
  ArrowLeft,
  RefreshCw,
  Eye,
  Phone,
  Mail
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, Legend } from "recharts";

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))'];

const AIAccessMonitoringDashboard = () => {
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState<string>("7");
  
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useAIAccessStats();
  const { data: trends, isLoading: trendsLoading } = useAIAccessTrends(parseInt(timeRange));
  const { data: recentLogs, isLoading: recentLoading, refetch: refetchRecent } = useRecentAIAccess(15);

  const pieData = stats ? [
    { name: 'WhatsApp AI', value: stats.whatsappAccesses },
    { name: 'Career Chat AI', value: stats.careerChatAccesses }
  ] : [];

  const handleRefresh = () => {
    refetchStats();
    refetchRecent();
  };

  const getAITypeIcon = (aiType: string) => {
    return aiType === 'whatsapp_ai' ? (
      <Phone className="h-4 w-4 text-green-500" />
    ) : (
      <MessageSquare className="h-4 w-4 text-blue-500" />
    );
  };

  const getAITypeBadge = (aiType: string) => {
    return aiType === 'whatsapp_ai' ? (
      <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-200">
        WhatsApp AI
      </Badge>
    ) : (
      <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-200">
        Career Chat
      </Badge>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b border-border/10">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-0 sm:justify-between">
            <div className="flex items-center gap-3 sm:gap-4">
              <Button 
                variant="ghost" 
                size="icon"
                className="shrink-0"
                onClick={() => navigate('/owner-portal')}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-2xl font-bold flex items-center gap-2">
                  <Activity className="h-5 w-5 sm:h-6 sm:w-6 text-primary shrink-0" />
                  <span className="truncate">AI Access Monitoring</span>
                </h1>
                <p className="text-muted-foreground text-xs sm:text-sm hidden sm:block">Real-time monitoring of AI data access</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap sm:flex-nowrap">
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger className="w-[120px] sm:w-[140px]">
                  <SelectValue placeholder="Time range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="14">Last 14 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={handleRefresh}>
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button 
                size="sm"
                className="sm:h-10"
                onClick={() => navigate('/owner-portal/user-data-access-logs')}
              >
                <Eye className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">View All Logs</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Accesses</p>
                  {statsLoading ? (
                    <Skeleton className="h-8 w-20 mt-1" />
                  ) : (
                    <p className="text-2xl font-bold">{stats?.totalAccesses?.toLocaleString() || 0}</p>
                  )}
                </div>
                <div className="p-3 bg-primary/10 rounded-full">
                  <Activity className="h-5 w-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Today</p>
                  {statsLoading ? (
                    <Skeleton className="h-8 w-20 mt-1" />
                  ) : (
                    <p className="text-2xl font-bold text-green-600">{stats?.todayAccesses?.toLocaleString() || 0}</p>
                  )}
                </div>
                <div className="p-3 bg-green-500/10 rounded-full">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Unique Users</p>
                  {statsLoading ? (
                    <Skeleton className="h-8 w-20 mt-1" />
                  ) : (
                    <p className="text-2xl font-bold">{stats?.uniqueUsers?.toLocaleString() || 0}</p>
                  )}
                </div>
                <div className="p-3 bg-blue-500/10 rounded-full">
                  <Users className="h-5 w-5 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Avg Response</p>
                  {statsLoading ? (
                    <Skeleton className="h-8 w-20 mt-1" />
                  ) : (
                    <p className="text-2xl font-bold">{stats?.avgResponseTime || 0}ms</p>
                  )}
                </div>
                <div className="p-3 bg-orange-500/10 rounded-full">
                  <Clock className="h-5 w-5 text-orange-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Trends Chart */}
          <Card className="lg:col-span-2 overflow-hidden">
            <CardHeader className="pb-2 sm:pb-6">
              <CardTitle className="text-base sm:text-lg">Access Trends</CardTitle>
            </CardHeader>
            <CardContent className="px-2 sm:px-6">
              {trendsLoading ? (
                <Skeleton className="h-[200px] sm:h-[300px] w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={window.innerWidth < 640 ? 200 : 300}>
                  <LineChart data={trends}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="date" 
                      fontSize={10}
                      tickFormatter={(value) => new Date(value).toLocaleDateString('en-IN', { month: 'long', day: 'numeric' })}
                    />
                    <YAxis fontSize={10} width={30} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--background))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px'
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Line 
                      type="monotone" 
                      dataKey="whatsapp" 
                      name="WhatsApp AI"
                      stroke="hsl(142.1 76.2% 36.3%)" 
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="career_chat" 
                      name="Career Chat AI"
                      stroke="hsl(221.2 83.2% 53.3%)" 
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Pie Chart */}
          <Card className="overflow-hidden">
            <CardHeader className="pb-2 sm:pb-6">
              <CardTitle className="text-base sm:text-lg">AI Type Distribution</CardTitle>
            </CardHeader>
            <CardContent className="px-2 sm:px-6">
              {statsLoading ? (
                <Skeleton className="h-[200px] sm:h-[300px] w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={window.innerWidth < 640 ? 200 : 300}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={window.innerWidth < 640 ? 40 : 60}
                      outerRadius={window.innerWidth < 640 ? 70 : 100}
                      paddingAngle={5}
                      dataKey="value"
                      label={window.innerWidth >= 640 ? ({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%` : false}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index === 0 ? 'hsl(142.1 76.2% 36.3%)' : 'hsl(221.2 83.2% 53.3%)'} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Real-time Activity Feed */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5 text-green-500 animate-pulse" />
              Real-time Activity Feed
            </CardTitle>
            <Badge variant="outline" className="bg-green-500/10 text-green-600">
              Live
            </Badge>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              {recentLoading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : recentLogs && recentLogs.length > 0 ? (
                <div className="space-y-3">
                  {recentLogs.map((log) => (
                    <div 
                      key={log.id} 
                      className="flex items-start gap-4 p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                    >
                      <div className="p-2 rounded-full bg-muted">
                        {getAITypeIcon(log.ai_type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {getAITypeBadge(log.ai_type)}
                          <Badge variant="secondary" className="text-xs">
                            {log.access_type}
                          </Badge>
                          {log.matched_user_type && (
                            <Badge variant="outline" className="text-xs">
                              {log.matched_user_type}
                            </Badge>
                          )}
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-sm">
                          <span className="font-mono text-muted-foreground truncate">
                            {log.user_identifier}
                          </span>
                          {log.matched_user_name && (
                            <>
                              <span className="text-muted-foreground">→</span>
                              <span className="font-medium">{log.matched_user_name}</span>
                            </>
                          )}
                        </div>
                        <div className="mt-1 flex items-center gap-4 text-xs text-muted-foreground">
                          <span>{formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}</span>
                          {log.response_time_ms && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {log.response_time_ms}ms
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
                  <Bot className="h-12 w-12 mb-4 opacity-50" />
                  <p>No AI access logs yet</p>
                  <p className="text-sm">Logs will appear here when AI accesses user data</p>
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AIAccessMonitoringDashboard;
