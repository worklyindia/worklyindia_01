import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { useGoogleIntegrations, GA4Data, FunctionLog } from "@/hooks/useGoogleIntegrations";
import { useGoogleIndexing, IndexingStats } from "@/hooks/useGoogleIndexing";
import { ArrowLeft, RefreshCw, Settings, BarChart3, FileSpreadsheet, HardDrive, Activity, Check, X, ExternalLink, Users, Eye, Clock, TrendingUp, TrendingDown, Smartphone, Monitor, Tablet, Globe, Loader2, AlertCircle, Play, FileText, Search, Send, RotateCcw, Trash2, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, Legend } from "recharts";
import { format, parseISO } from "date-fns";
import LottieSearchIcon from "@/components/LottieSearchIcon";
import { CANONICAL_URL } from '@/config/domainConfig';

const DEVICE_COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--success))'];
const SOURCE_COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--success))', 'hsl(var(--warning))', 'hsl(var(--accent-pink))'];

const GoogleIntegrations = () => {
  const navigate = useNavigate();
  const { 
    loading, 
    fetchGA4Analytics, 
    syncGoogleSheets, 
    generateDriveInvoices, 
    getFunctionLogs, 
    getAppSettings, 
    updateAppSetting 
  } = useGoogleIntegrations();

  // Indexing hook
  const {
    loading: indexingLoading,
    fetchIndexingStats,
    submitUrls,
    submitStaticPages,
    processQueue,
    retryFailedUrls,
    clearCompletedQueue
  } = useGoogleIndexing();

  const [activeTab, setActiveTab] = useState("analytics");
  const [ga4Data, setGA4Data] = useState<GA4Data | null>(null);
  const [functionLogs, setFunctionLogs] = useState<FunctionLog[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [sheetsResult, setSheetsResult] = useState<any>(null);
  const [driveResult, setDriveResult] = useState<any>(null);
  const [editingSettings, setEditingSettings] = useState(false);
  const [tempSettings, setTempSettings] = useState<Record<string, string>>({});
  
  // Indexing state
  const [indexingStats, setIndexingStats] = useState<IndexingStats | null>(null);
  const [manualUrls, setManualUrls] = useState("");

  // Load initial data
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    const [appSettings, logs] = await Promise.all([
      getAppSettings(),
      getFunctionLogs()
    ]);
    setSettings(appSettings);
    setTempSettings(appSettings);
    setFunctionLogs(logs);

    // Try to load cached GA4 data
    if (appSettings.ga4_latest_data) {
      try {
        const cached = JSON.parse(appSettings.ga4_latest_data);
        setGA4Data(cached);
      } catch (e) {
        console.error('Error parsing cached GA4 data:', e);
      }
    }
  };

  const handleFetchGA4 = async (type: 'daily' | 'realtime' | 'weekly' | 'custom-events' | 'all' = 'all') => {
    const data = await fetchGA4Analytics(type);
    if (data) {
      setGA4Data(prev => ({ ...prev, ...data }));
    }
    const logs = await getFunctionLogs();
    setFunctionLogs(logs);
  };

  const handleSyncSheets = async (type: 'jobs' | 'analytics' | 'financial' | 'all' = 'all') => {
    const result = await syncGoogleSheets(type);
    if (result) {
      setSheetsResult(result);
    }
    const logs = await getFunctionLogs();
    setFunctionLogs(logs);
  };

  const handleGenerateInvoices = async (generateAll = true) => {
    const result = await generateDriveInvoices({ generateAll });
    if (result) {
      setDriveResult(result);
    }
    const logs = await getFunctionLogs();
    setFunctionLogs(logs);
  };

  const handleSaveSettings = async () => {
    for (const [key, value] of Object.entries(tempSettings)) {
      if (value !== settings[key]) {
        await updateAppSetting(key, value);
      }
    }
    setSettings(tempSettings);
    setEditingSettings(false);
  };

  const formatDate = (dateStr: string) => {
    try {
      // Handle YYYYMMDD format
      if (dateStr.length === 8 && !dateStr.includes('-')) {
        return format(parseISO(`${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`), 'MMMM dd');
      }
      return format(parseISO(dateStr), 'MMMM dd');
    } catch {
      return dateStr;
    }
  };

  const getPercentageChange = (today: number, yesterday: number) => {
    if (yesterday === 0) return { value: 100, isPositive: true };
    const change = ((today - yesterday) / yesterday) * 100;
    return { value: Math.abs(change).toFixed(1), isPositive: change >= 0 };
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/owner-portal')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Google Cloud Integrations
              </h1>
              <p className="text-muted-foreground">GA4 Analytics, Sheets Sync & Drive Invoices</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => setEditingSettings(!editingSettings)}>
            <Settings className="h-4 w-4 mr-2" />
            Configure
          </Button>
        </div>

        {/* Configuration Panel */}
        {editingSettings && (
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Configuration Settings
              </CardTitle>
              <CardDescription>Configure Google Cloud integration IDs</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>GA4 Property ID</Label>
                  <Input 
                    placeholder="properties/XXXXXXXXX" 
                    value={tempSettings.ga4_property_id || ''} 
                    onChange={(e) => setTempSettings(prev => ({ ...prev, ga4_property_id: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Drive Invoices Folder ID</Label>
                  <Input 
                    placeholder="Folder ID from Drive URL" 
                    value={tempSettings.google_drive_invoices_folder || ''} 
                    onChange={(e) => setTempSettings(prev => ({ ...prev, google_drive_invoices_folder: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Jobs Spreadsheet ID</Label>
                  <Input 
                    placeholder="Spreadsheet ID" 
                    value={tempSettings.google_sheets_jobs_id || ''} 
                    onChange={(e) => setTempSettings(prev => ({ ...prev, google_sheets_jobs_id: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Analytics Spreadsheet ID</Label>
                  <Input 
                    placeholder="Spreadsheet ID" 
                    value={tempSettings.google_sheets_analytics_id || ''} 
                    onChange={(e) => setTempSettings(prev => ({ ...prev, google_sheets_analytics_id: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Financial Spreadsheet ID</Label>
                  <Input 
                    placeholder="Spreadsheet ID" 
                    value={tempSettings.google_sheets_financial_id || ''} 
                    onChange={(e) => setTempSettings(prev => ({ ...prev, google_sheets_financial_id: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSaveSettings} disabled={loading.settings}>
                  {loading.settings ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                  Save Settings
                </Button>
                <Button variant="outline" onClick={() => { setTempSettings(settings); setEditingSettings(false); }}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
            <TabsTrigger value="analytics" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">GA4</span>
            </TabsTrigger>
            <TabsTrigger value="indexing" className="gap-2">
              <LottieSearchIcon size={16} />
              <span className="hidden sm:inline">Indexing</span>
            </TabsTrigger>
            <TabsTrigger value="sheets" className="gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              <span className="hidden sm:inline">Sheets</span>
            </TabsTrigger>
            <TabsTrigger value="drive" className="gap-2">
              <HardDrive className="h-4 w-4" />
              <span className="hidden sm:inline">Drive</span>
            </TabsTrigger>
            <TabsTrigger value="logs" className="gap-2">
              <Activity className="h-4 w-4" />
              <span className="hidden sm:inline">Logs</span>
            </TabsTrigger>
          </TabsList>

          {/* GA4 Analytics Tab */}
          <TabsContent value="analytics" className="space-y-4">
            {/* Quick Actions */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-primary" />
                    Google Analytics 4
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleFetchGA4('realtime')} disabled={loading.ga4}>
                      {loading.ga4 ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
                      <span className="ml-2 hidden sm:inline">Realtime</span>
                    </Button>
                    <Button size="sm" onClick={() => handleFetchGA4('all')} disabled={loading.ga4}>
                      {loading.ga4 ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                      <span className="ml-2 hidden sm:inline">Fetch All</span>
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>

            {/* Realtime Users */}
            {ga4Data?.realtime && (
              <Card className="border-green-500/20 bg-gradient-to-r from-green-500/5 to-transparent">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 rounded-full bg-green-500/20 flex items-center justify-center">
                      <Activity className="h-8 w-8 text-green-500 animate-pulse" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Active Users Right Now</p>
                      <p className="text-4xl font-bold text-green-500">{ga4Data.realtime.activeUsers}</p>
                      <p className="text-xs text-muted-foreground">Updated: {format(new Date(ga4Data.realtime.fetchedAt), 'HH:mm:ss')}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Today vs Yesterday Stats */}
            {ga4Data?.daily && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {[
                  { label: 'Active Users', today: ga4Data.daily.today.activeUsers, yesterday: ga4Data.daily.yesterday.activeUsers, icon: Users },
                  { label: 'Sessions', today: ga4Data.daily.today.sessions, yesterday: ga4Data.daily.yesterday.sessions, icon: Eye },
                  { label: 'Page Views', today: ga4Data.daily.today.pageViews, yesterday: ga4Data.daily.yesterday.pageViews, icon: FileText },
                  { label: 'New Users', today: ga4Data.daily.today.newUsers, yesterday: ga4Data.daily.yesterday.newUsers, icon: Users },
                  { label: 'Bounce Rate', today: parseFloat(ga4Data.daily.today.bounceRate), yesterday: parseFloat(ga4Data.daily.yesterday.bounceRate), icon: TrendingDown, suffix: '%', invertColor: true },
                  { label: 'Avg Duration', today: parseInt(ga4Data.daily.today.avgSessionDuration), yesterday: parseInt(ga4Data.daily.yesterday.avgSessionDuration), icon: Clock, suffix: 's' },
                ].map((stat, idx) => {
                  const change = getPercentageChange(stat.today, stat.yesterday);
                  const isPositive = stat.invertColor ? !change.isPositive : change.isPositive;
                  return (
                    <Card key={idx}>
                      <CardContent className="pt-4 pb-3">
                        <div className="flex items-center justify-between mb-2">
                          <stat.icon className="h-4 w-4 text-muted-foreground" />
                          <Badge variant={isPositive ? "default" : "destructive"} className="text-xs">
                            {isPositive ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                            {change.value}%
                          </Badge>
                        </div>
                        <p className="text-2xl font-bold">{stat.today.toLocaleString()}{stat.suffix || ''}</p>
                        <p className="text-xs text-muted-foreground">{stat.label}</p>
                        <p className="text-xs text-muted-foreground">Yesterday: {stat.yesterday.toLocaleString()}{stat.suffix || ''}</p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Weekly Trend Chart */}
            {ga4Data?.weekly?.dailyTrend && ga4Data.weekly.dailyTrend.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Weekly Traffic Trend</CardTitle>
                  <CardDescription>{ga4Data.weekly.dateRange.startDate} to {ga4Data.weekly.dateRange.endDate}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={ga4Data.weekly.dailyTrend.map(d => ({ ...d, date: formatDate(d.date) }))}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                      <Legend />
                      <Line type="monotone" dataKey="activeUsers" name="Users" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="sessions" name="Sessions" stroke="hsl(var(--secondary))" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="pageViews" name="Page Views" stroke="hsl(var(--success))" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Device & Traffic Sources */}
            {ga4Data?.weekly && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Devices */}
                {ga4Data.weekly.devices && ga4Data.weekly.devices.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Monitor className="h-5 w-5" />
                        Device Breakdown
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie
                            data={ga4Data.weekly.devices}
                            dataKey="users"
                            nameKey="device"
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            label={({ device, percent }) => `${device} ${(percent * 100).toFixed(0)}%`}
                          >
                            {ga4Data.weekly.devices.map((_, idx) => (
                              <Cell key={idx} fill={DEVICE_COLORS[idx % DEVICE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="flex flex-wrap gap-2 mt-4 justify-center">
                        {ga4Data.weekly.devices.map((d, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            {d.device === 'mobile' && <Smartphone className="h-4 w-4" />}
                            {d.device === 'desktop' && <Monitor className="h-4 w-4" />}
                            {d.device === 'tablet' && <Tablet className="h-4 w-4" />}
                            <span className="text-sm">{d.device}: {d.users.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Traffic Sources */}
                {ga4Data.weekly.trafficSources && ga4Data.weekly.trafficSources.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Globe className="h-5 w-5" />
                        Traffic Sources
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={ga4Data.weekly.trafficSources.slice(0, 5)} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis type="number" className="text-xs" />
                          <YAxis type="category" dataKey="source" className="text-xs" width={100} />
                          <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                          <Bar dataKey="users" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* Top Pages */}
            {ga4Data?.weekly?.topPages && ga4Data.weekly.topPages.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Top 10 Pages</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-2">
                      {ga4Data.weekly.topPages.slice(0, 10).map((page, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-mono text-muted-foreground w-6">{idx + 1}</span>
                            <span className="text-sm font-medium truncate max-w-[300px]">{page.path}</span>
                          </div>
                          <div className="flex items-center gap-4 text-sm">
                            <span className="text-muted-foreground">{page.users.toLocaleString()} users</span>
                            <Badge variant="secondary">{page.pageViews.toLocaleString()} views</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}

            {/* Custom Events */}
            {ga4Data?.customEvents?.events && ga4Data.customEvents.events.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Custom Events (Last 30 Days)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                    {ga4Data.customEvents.events.map((event, idx) => (
                      <div key={idx} className="p-3 rounded-lg bg-muted/50 text-center">
                        <p className="text-sm font-medium">{event.eventName}</p>
                        <p className="text-2xl font-bold text-primary">{event.count.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">{event.users} users</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Empty State */}
            {!ga4Data?.daily && !ga4Data?.realtime && !loading.ga4 && (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Analytics Data</h3>
                  <p className="text-muted-foreground text-center mb-4">Click "Fetch All" to load GA4 analytics data</p>
                  <Button onClick={() => handleFetchGA4('all')} disabled={loading.ga4}>
                    {loading.ga4 ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                    Fetch Analytics
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Google Sheets Tab */}
          <TabsContent value="sheets" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <FileSpreadsheet className="h-5 w-5 text-green-600" />
                      Google Sheets Sync
                    </CardTitle>
                    <CardDescription>Sync data to Google Sheets</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Button 
                    variant="outline" 
                    className="h-20 flex-col" 
                    onClick={() => handleSyncSheets('jobs')}
                    disabled={loading.sheets}
                  >
                    {loading.sheets ? <Loader2 className="h-6 w-6 animate-spin" /> : <FileSpreadsheet className="h-6 w-6 text-blue-500" />}
                    <span className="mt-2">Sync Jobs</span>
                  </Button>
                  <Button 
                    variant="outline" 
                    className="h-20 flex-col" 
                    onClick={() => handleSyncSheets('analytics')}
                    disabled={loading.sheets}
                  >
                    {loading.sheets ? <Loader2 className="h-6 w-6 animate-spin" /> : <BarChart3 className="h-6 w-6 text-purple-500" />}
                    <span className="mt-2">Sync Analytics</span>
                  </Button>
                  <Button 
                    variant="outline" 
                    className="h-20 flex-col" 
                    onClick={() => handleSyncSheets('financial')}
                    disabled={loading.sheets}
                  >
                    {loading.sheets ? <Loader2 className="h-6 w-6 animate-spin" /> : <FileText className="h-6 w-6 text-green-500" />}
                    <span className="mt-2">Sync Financial</span>
                  </Button>
                  <Button 
                    className="h-20 flex-col bg-gradient-to-r from-primary to-secondary" 
                    onClick={() => handleSyncSheets('all')}
                    disabled={loading.sheets}
                  >
                    {loading.sheets ? <Loader2 className="h-6 w-6 animate-spin" /> : <RefreshCw className="h-6 w-6" />}
                    <span className="mt-2">Sync All</span>
                  </Button>
                </div>

                {/* Sync Result */}
                {sheetsResult && (
                  <Card className="bg-muted/50">
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-medium">Last Sync Result</h4>
                        <Badge variant="outline">{sheetsResult.executionTimeMs}ms</Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        {Object.entries(sheetsResult.results || {}).map(([key, value]: [string, any]) => (
                          <div key={key} className="p-3 rounded-lg bg-background">
                            <div className="flex items-center gap-2 mb-1">
                              {value.success ? <Check className="h-4 w-4 text-green-500" /> : <X className="h-4 w-4 text-red-500" />}
                              <span className="font-medium capitalize">{key}</span>
                            </div>
                            {value.success ? (
                              <p className="text-sm text-muted-foreground">{value.rowsWritten} rows written</p>
                            ) : (
                              <p className="text-sm text-destructive">{value.error}</p>
                            )}
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground mt-4">Synced at: {sheetsResult.syncedAt}</p>
                    </CardContent>
                  </Card>
                )}

                {/* Sheet Links */}
                <Separator />
                <div className="space-y-2">
                  <h4 className="font-medium">Configured Sheets</h4>
                  {settings.google_sheets_jobs_id && (
                    <Button variant="link" asChild className="p-0 h-auto">
                      <a href={`https://docs.google.com/spreadsheets/d/${settings.google_sheets_jobs_id}`} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Jobs Spreadsheet
                      </a>
                    </Button>
                  )}
                  {settings.google_sheets_analytics_id && (
                    <Button variant="link" asChild className="p-0 h-auto">
                      <a href={`https://docs.google.com/spreadsheets/d/${settings.google_sheets_analytics_id}`} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Analytics Spreadsheet
                      </a>
                    </Button>
                  )}
                  {settings.google_sheets_financial_id && (
                    <Button variant="link" asChild className="p-0 h-auto">
                      <a href={`https://docs.google.com/spreadsheets/d/${settings.google_sheets_financial_id}`} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Financial Spreadsheet
                      </a>
                    </Button>
                  )}
                  {!settings.google_sheets_jobs_id && !settings.google_sheets_analytics_id && !settings.google_sheets_financial_id && (
                    <p className="text-sm text-muted-foreground">No sheets configured. Click "Configure" to add spreadsheet IDs.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Google Drive Tab */}
          <TabsContent value="drive" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <HardDrive className="h-5 w-5 text-yellow-600" />
                      Google Drive Invoices
                    </CardTitle>
                    <CardDescription>Generate and upload PDF invoices to Drive</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Button 
                    className="h-20 flex-col bg-gradient-to-r from-yellow-500 to-orange-500" 
                    onClick={() => handleGenerateInvoices(true)}
                    disabled={loading.drive}
                  >
                    {loading.drive ? <Loader2 className="h-6 w-6 animate-spin" /> : <HardDrive className="h-6 w-6" />}
                    <span className="mt-2">Generate Pending Invoices (Last 7 Days)</span>
                  </Button>
                  {settings.google_drive_invoices_folder && (
                    <Button variant="outline" asChild className="h-20">
                      <a href={`https://drive.google.com/drive/folders/${settings.google_drive_invoices_folder}`} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-6 w-6 mr-2" />
                        Open Invoices Folder
                      </a>
                    </Button>
                  )}
                </div>

                {/* Invoice Result */}
                {driveResult && (
                  <Card className="bg-muted/50">
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-medium">Generation Result</h4>
                        <Badge variant="outline">{driveResult.executionTimeMs}ms</Badge>
                      </div>
                      <p className="text-lg font-bold text-primary">{driveResult.generated} invoices generated</p>
                      {driveResult.invoices && driveResult.invoices.length > 0 && (
                        <ScrollArea className="h-[200px] mt-4">
                          <div className="space-y-2">
                            {driveResult.invoices.map((inv: any, idx: number) => (
                              <div key={idx} className="flex items-center justify-between p-2 rounded bg-background">
                                <span className="text-sm font-mono">{inv.invoiceId}</span>
                                <Button variant="link" size="sm" asChild>
                                  <a href={inv.driveUrl} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="h-4 w-4 mr-1" />
                                    View
                                  </a>
                                </Button>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      )}
                    </CardContent>
                  </Card>
                )}

                {!settings.google_drive_invoices_folder && (
                  <Card className="border-dashed border-yellow-500/50 bg-yellow-500/5">
                    <CardContent className="flex items-center gap-4 py-4">
                      <AlertCircle className="h-8 w-8 text-yellow-500" />
                      <div>
                        <p className="font-medium">Drive Folder Not Configured</p>
                        <p className="text-sm text-muted-foreground">Click "Configure" to add your Google Drive folder ID</p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Logs Tab */}
          <TabsContent value="logs" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Function Logs
                  </CardTitle>
                  <Button size="sm" variant="outline" onClick={() => getFunctionLogs().then(setFunctionLogs)}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <div className="space-y-3">
                    {functionLogs.map((log) => (
                      <div key={log.id} className="p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge variant={log.status === 'success' ? 'default' : 'destructive'}>
                              {log.status === 'success' ? <Check className="h-3 w-3 mr-1" /> : <X className="h-3 w-3 mr-1" />}
                              {log.status}
                            </Badge>
                            <span className="font-mono text-sm">{log.function_name}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            {log.execution_time_ms}ms
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">{format(new Date(log.created_at), 'PPpp')}</p>
                        {log.request_data && (
                          <details className="mt-2">
                            <summary className="text-xs text-muted-foreground cursor-pointer">Request Data</summary>
                            <pre className="text-xs mt-1 p-2 bg-muted rounded overflow-x-auto">{JSON.stringify(log.request_data, null, 2)}</pre>
                          </details>
                        )}
                      </div>
                    ))}
                    {functionLogs.length === 0 && (
                      <div className="text-center py-12 text-muted-foreground">
                        <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No logs found</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Indexing Tab */}
          <TabsContent value="indexing" className="space-y-4">
            {/* Quota Card */}
            <Card className="border-primary/20">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <LottieSearchIcon size={20} />
                    Google Indexing API
                  </CardTitle>
                  <Button size="sm" onClick={async () => { const stats = await fetchIndexingStats(); if (stats) setIndexingStats(stats); }} disabled={indexingLoading.stats}>
                    {indexingLoading.stats ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    <span className="ml-2">Refresh</span>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground">Today's Quota</p>
                    <p className="text-2xl font-bold">{indexingStats?.quota?.quota_used || 0}/{indexingStats?.quota?.quota_limit || 200}</p>
                    <Progress value={((indexingStats?.quota?.quota_used || 0) / 200) * 100} className="mt-2" />
                  </div>
                  <div className="p-4 rounded-lg bg-yellow-500/10">
                    <p className="text-sm text-muted-foreground">Pending</p>
                    <p className="text-2xl font-bold text-yellow-600">{indexingStats?.queueStats?.pending || 0}</p>
                  </div>
                  <div className="p-4 rounded-lg bg-green-500/10">
                    <p className="text-sm text-muted-foreground">Completed</p>
                    <p className="text-2xl font-bold text-green-600">{indexingStats?.queueStats?.completed || 0}</p>
                  </div>
                  <div className="p-4 rounded-lg bg-blue-500/10">
                    <p className="text-sm text-muted-foreground">IndexNow Fallback</p>
                    <p className="text-2xl font-bold text-blue-600">{indexingStats?.quota?.indexnow_fallback_count || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Button onClick={submitStaticPages} disabled={indexingLoading.staticPages}>
                    {indexingLoading.staticPages ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />}
                    Submit Static Pages
                  </Button>
                  <Button variant="outline" onClick={processQueue} disabled={indexingLoading.processQueue}>
                    {indexingLoading.processQueue ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                    Process Queue
                  </Button>
                  <Button variant="outline" onClick={retryFailedUrls} disabled={indexingLoading.retry}>
                    {indexingLoading.retry ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RotateCcw className="h-4 w-4 mr-2" />}
                    Retry Failed
                  </Button>
                  <Button variant="ghost" onClick={clearCompletedQueue} disabled={indexingLoading.clear}>
                    {indexingLoading.clear ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                    Clear Completed
                  </Button>
                </div>

                <Separator />

                {/* Manual URL Submission */}
                <div className="space-y-2">
                  <Label>Submit URLs Manually (one per line)</Label>
                  <Textarea 
                    placeholder={`${CANONICAL_URL}/jobs?tab=latest&#10;${CANONICAL_URL}/jobs?tab=trending`}
                    value={manualUrls}
                    onChange={(e) => setManualUrls(e.target.value)}
                    rows={4}
                  />
                  <Button 
                    onClick={async () => {
                      const urls = manualUrls.split('\n').map(u => u.trim()).filter(u => u.startsWith('http'));
                      if (urls.length > 0) {
                        await submitUrls(urls);
                        setManualUrls("");
                        const stats = await fetchIndexingStats();
                        if (stats) setIndexingStats(stats);
                      }
                    }}
                    disabled={indexingLoading.submit || !manualUrls.trim()}
                  >
                    {indexingLoading.submit ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                    Submit URLs
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Recent Queue */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Queue Items</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  <div className="space-y-2">
                    {indexingStats?.recentQueue?.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30 text-sm">
                        <div className="flex-1 truncate mr-2">
                          <p className="truncate font-mono text-xs">{item.url}</p>
                          <p className="text-xs text-muted-foreground">Priority: {item.priority} | Retries: {item.retry_count}</p>
                        </div>
                        <Badge variant={item.status === 'completed' ? 'default' : item.status === 'failed' ? 'destructive' : 'secondary'}>
                          {item.status}
                        </Badge>
                      </div>
                    ))}
                    {(!indexingStats?.recentQueue || indexingStats.recentQueue.length === 0) && (
                      <div className="text-center py-8 text-muted-foreground">
                        <span className="mx-auto mb-2 opacity-50 inline-flex"><LottieSearchIcon size={32} /></span>
                        <p>No queue items. Click Refresh to load.</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default GoogleIntegrations;
