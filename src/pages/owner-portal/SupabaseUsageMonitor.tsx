import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { CleanupPowerSettings } from "@/components/supabase-monitor/CleanupPowerSettings";

import { toast } from "sonner";
import { useSupabaseMonitor, useAutoCleanup } from "@/hooks/useSupabaseMonitor";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, BarChart, Bar
} from 'recharts';
import { 
  Database, 
  HardDrive, 
  Zap, 
  Users, 
  Activity,
  Trash2,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  History,
  Table,
  Bell,
  Lightbulb,
  Calendar,
  Shield,
  ArrowDownCircle,
  Download,
  FileText,
  BellRing,
  FileSpreadsheet,
  BarChart3,
  Settings as SettingsIcon
} from "lucide-react";

const SupabaseUsageMonitor = () => {
  const { data: monitorData, isLoading, refetch, isRefetching, isEdgeFunctionError, errorMessage } = useSupabaseMonitor();
  const autoCleanup = useAutoCleanup();
  const [autoCleanupEnabled, setAutoCleanupEnabled] = useState(true);
  const [alerts, setAlerts] = useState<any[]>([]);
  // Generate alerts based on metrics
  useEffect(() => {
    if (monitorData?.metrics) {
      const newAlerts: any[] = [];
      
      monitorData.metrics.forEach((metric) => {
        if (metric.percentage >= 90) {
          newAlerts.push({
            metric: metric.type,
            percentage: metric.percentage,
            severity: 'critical',
            message: `🚨 ${formatMetricName(metric.type)}: ${metric.percentage.toFixed(1)}% used - Immediate action required!`
          });
        } else if (metric.percentage >= 70) {
          newAlerts.push({
            metric: metric.type,
            percentage: metric.percentage,
            severity: 'warning',
            message: `⚠️ ${formatMetricName(metric.type)}: ${metric.percentage.toFixed(1)}% used - Consider cleanup`
          });
        }
      });
      
      setAlerts(newAlerts);
    }
  }, [monitorData]);

  const formatMetricName = (type: string): string => {
    const names: Record<string, string> = {
      'cached_egress': 'Cached Egress',
      'egress': 'Egress',
      'database_size': 'Database Size',
      'edge_invocations': 'Edge Functions',
      'mau': 'Monthly Active Users',
      'storage_size': 'Storage',
      'realtime_messages': 'Realtime Messages',
      'realtime_connections': 'Realtime Connections',
    };
    return names[type] || type;
  };

  const runCleanup = async (level: 'light' | 'normal' | 'aggressive') => {
    autoCleanup.mutate({ 
      forceCleanup: true, 
      cleanupLevel: level 
    });
  };

  const toggleAutoCleanup = async (enabled: boolean) => {
    setAutoCleanupEnabled(enabled);
    toast.success(enabled ? "Auto-Cleanup will run every 4 hours" : "Auto-Cleanup disabled");
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-IN').format(num);
  };

  // Export functionality
  const exportUsageReport = () => {
    if (!monitorData) return;
    
    const report = {
      generatedAt: new Date().toISOString(),
      healthScore: monitorData.healthScore,
      summary: monitorData.summary,
      metrics: monitorData.metrics,
      topTables: monitorData.topTables?.slice(0, 10),
    };
    
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `supabase-usage-report-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Usage report exported!");
  };

  const exportCleanupHistory = () => {
    if (!monitorData?.recentOptimizations) return;
    
    const csvRows = [
      ['Date', 'Type', 'Rows Deleted', 'Egress Saved', 'Execution Time (ms)', 'Status'],
      ...monitorData.recentOptimizations.map((opt: any) => [
        new Date(opt.created_at).toLocaleString('en-IN'),
        opt.optimization_type,
        opt.rows_deleted || 0,
        formatBytes(opt.egress_saved_bytes || 0),
        opt.execution_time_ms || 0,
        opt.status
      ])
    ];
    
    const csvContent = csvRows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cleanup-history-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Cleanup history exported!");
  };

  const getHealthColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 50) return 'text-yellow-500';
    return 'text-destructive';
  };

  const healthScore = monitorData?.healthScore ?? 0;
  const criticalAlerts = alerts.filter(a => a.severity === 'critical');
  const warningAlerts = alerts.filter(a => a.severity === 'warning');
  const hasData = monitorData?.success !== false && (monitorData?.metrics?.length || 0) > 0;

  // Safe date formatting
  const formatDate = (dateStr: string | undefined | null): string => {
    if (!dateStr) return 'Never';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return 'Invalid';
      return date.toLocaleString('en-IN', { 
        day: '2-digit', 
        month: 'long', 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } catch {
      return 'Invalid';
    }
  };

  const formatTime = (dateStr: string | undefined | null): string => {
    if (!dateStr) return '--:--';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return '--:--';
      return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '--:--';
    }
  };

  const getHealthStatus = () => {
    if (isLoading) return { label: 'Loading...', color: 'text-muted-foreground' };
    if (!hasData) return { label: 'No Data', color: 'text-muted-foreground' };
    if (criticalAlerts.length > 0) return { label: `${criticalAlerts.length} critical`, color: 'text-destructive' };
    if (warningAlerts.length > 0) return { label: `${warningAlerts.length} warnings`, color: 'text-yellow-600' };
    if (healthScore >= 80) return { label: 'All good!', color: 'text-green-600' };
    return { label: 'Check usage', color: 'text-muted-foreground' };
  };

  const healthStatus = getHealthStatus();

  return (
    <div className="space-y-4 p-3 sm:p-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-lg sm:text-xl font-bold truncate">Supabase Usage Monitor</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Auto-Cleanup Every 4 Hours</p>
        </div>
        <Button 
          variant="outline" 
          size="icon"
          className="shrink-0"
          onClick={() => refetch()}
          disabled={isRefetching || isLoading}
        >
          <RefreshCw className={`w-4 h-4 ${(isRefetching || isLoading) ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Loading State */}
      {isLoading && (
        <Card className="border-primary/20">
          <CardContent className="p-6 text-center">
            <RefreshCw className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Loading usage data...</p>
          </CardContent>
        </Card>
      )}

      {/* Edge Function Error State */}
      {!isLoading && isEdgeFunctionError && (
        <Card className="border-yellow-500 bg-yellow-500/10">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-yellow-700 text-sm">Edge Function Not Available</h3>
                <p className="text-xs text-yellow-600 mt-1">
                  {errorMessage || "Unable to fetch usage data. The monitoring function may be deploying."}
                </p>
              </div>
              <Button 
                size="sm" 
                variant="secondary"
                className="shrink-0 text-xs h-8"
                onClick={() => refetch()}
                disabled={isRefetching}
              >
                {isRefetching ? 'Retrying...' : 'Retry'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Critical Alerts Banner */}
      {!isLoading && !isEdgeFunctionError && criticalAlerts.length > 0 && (
        <Card className="border-destructive bg-destructive/10">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-start gap-3">
              <BellRing className="w-5 h-5 text-destructive animate-pulse shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-destructive text-sm">🚨 Critical Alerts!</h3>
                {criticalAlerts.slice(0, 2).map((alert, i) => (
                  <p key={i} className="text-xs text-destructive truncate">{alert.message}</p>
                ))}
              </div>
              <Button 
                size="sm" 
                variant="destructive"
                className="shrink-0 text-xs h-8"
                onClick={() => runCleanup('aggressive')}
                disabled={autoCleanup.isPending}
              >
                {autoCleanup.isPending ? 'Cleaning...' : 'Fix Now'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Warning Alerts */}
      {!isLoading && !isEdgeFunctionError && warningAlerts.length > 0 && criticalAlerts.length === 0 && (
        <Card className="border-yellow-500 bg-yellow-500/10">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-start gap-3">
              <Bell className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-yellow-700 text-sm">⚠️ Warnings</h3>
                {warningAlerts.slice(0, 2).map((alert, i) => (
                  <p key={i} className="text-xs text-yellow-600 truncate">{alert.message}</p>
                ))}
              </div>
              <Button 
                size="sm" 
                variant="secondary"
                className="shrink-0 text-xs h-8"
                onClick={() => runCleanup('normal')}
                disabled={autoCleanup.isPending}
              >
                Clean Now
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Health Score Card */}
      {!isLoading && (
        <Card className={`${
          !hasData ? 'border-muted' :
          healthScore < 50 ? 'border-destructive' : 
          healthScore < 80 ? 'border-yellow-500' : 
          'border-green-500'
        }`}>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center shrink-0 ${
                  !hasData ? 'bg-muted text-muted-foreground' :
                  healthScore < 50 ? 'bg-destructive/20 text-destructive' : 
                  healthScore < 80 ? 'bg-yellow-500/20 text-yellow-600' : 
                  'bg-green-500/20 text-green-600'
                }`}>
                  <Shield className="w-6 h-6 sm:w-7 sm:h-7" />
                </div>
                <div>
                  <div className={`text-2xl sm:text-3xl font-bold ${hasData ? getHealthColor(healthScore) : 'text-muted-foreground'}`}>
                    {hasData ? `${healthScore}/100` : '--'}
                  </div>
                  <div className="text-xs sm:text-sm text-muted-foreground">Health Score</div>
                </div>
              </div>
              <div className="text-right">
                <Badge variant={!hasData ? 'outline' : healthScore < 50 ? 'destructive' : healthScore < 80 ? 'secondary' : 'default'}>
                  {!hasData ? 'No Data' : healthScore < 50 ? 'Critical' : healthScore < 80 ? 'Warning' : 'Healthy'}
                </Badge>
                <p className={`text-xs mt-1 ${healthStatus.color}`}>
                  {healthStatus.label}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      {!isLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Button 
            onClick={() => runCleanup('light')}
            disabled={autoCleanup.isPending || isEdgeFunctionError}
            variant="outline"
            className="h-auto py-4 flex-col gap-1.5"
          >
            <Zap className="w-6 h-6 text-blue-500" />
            <div className="text-sm font-medium">Quick</div>
            <div className="text-xs text-muted-foreground leading-tight">Light Cleanup</div>
          </Button>
          <Button 
            onClick={() => runCleanup('normal')}
            disabled={autoCleanup.isPending || isEdgeFunctionError}
            variant="secondary"
            className="h-auto py-4 flex-col gap-1.5"
          >
            <Trash2 className="w-6 h-6" />
            <div className="text-sm font-medium">Deep</div>
            <div className="text-xs text-muted-foreground leading-tight">Normal Cleanup</div>
          </Button>
          <Button 
            onClick={() => runCleanup('aggressive')}
            disabled={autoCleanup.isPending || isEdgeFunctionError}
            className="h-auto py-4 flex-col gap-1.5 bg-destructive hover:bg-destructive/90 col-span-2 sm:col-span-1"
          >
            <Shield className="w-6 h-6" />
            <div className="text-sm font-medium">Aggressive</div>
            <div className="text-xs text-destructive-foreground/80 leading-tight">Maximum Cleanup</div>
          </Button>
        </div>
      )}

      <Tabs defaultValue="usage" className="w-full">
        <div className="w-full overflow-x-auto pb-2 scrollbar-hide">
          <TabsList className="inline-flex w-max h-auto p-1 gap-1 min-w-0">
            <TabsTrigger value="usage" className="text-xs sm:text-sm py-2 px-3 whitespace-nowrap flex items-center gap-1.5">
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Usage</span>
            </TabsTrigger>
            <TabsTrigger value="tables" className="text-xs sm:text-sm py-2 px-3 whitespace-nowrap flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5" />
              <span>Tables</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="text-xs sm:text-sm py-2 px-3 whitespace-nowrap flex items-center gap-1.5">
              <SettingsIcon className="w-3.5 h-3.5" />
              <span>Settings</span>
            </TabsTrigger>
            <TabsTrigger value="alerts" className="text-xs sm:text-sm py-2 px-3 whitespace-nowrap flex items-center gap-1.5 relative">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Alerts</span>
              {alerts.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-[10px] text-white rounded-full flex items-center justify-center font-medium">
                  {alerts.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="schedule" className="text-xs sm:text-sm py-2 px-3 whitespace-nowrap flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>Schedule</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="text-xs sm:text-sm py-2 px-3 whitespace-nowrap flex items-center gap-1.5">
              <History className="w-3.5 h-3.5" />
              <span>History</span>
            </TabsTrigger>
            <TabsTrigger value="export" className="text-xs sm:text-sm py-2 px-3 whitespace-nowrap flex items-center gap-1.5">
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="usage" className="space-y-3 mt-3">
          {/* Database Card */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Database className="w-5 h-5 text-blue-500" />
                  <span className="font-medium">Database Size</span>
                </div>
                <Badge variant={(monitorData?.summary?.databasePercentage || 0) >= 80 ? "destructive" : "secondary"}>
                  {monitorData?.summary?.databasePercentage || 0}%
                </Badge>
              </div>
              <Progress value={monitorData?.summary?.databasePercentage || 0} className="h-2 mb-2" />
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>{monitorData?.summary?.totalDatabaseSize || '0 B'}</span>
                <span>500 MB limit</span>
              </div>
            </CardContent>
          </Card>

          {/* Edge Functions Card */}
          {monitorData?.metrics?.find(m => m.type === 'edge_invocations') && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-yellow-500" />
                    <span className="font-medium">Edge Functions</span>
                  </div>
                  <Badge variant={monitorData.metrics.find(m => m.type === 'edge_invocations')!.percentage >= 80 ? "destructive" : "secondary"}>
                    {monitorData.metrics.find(m => m.type === 'edge_invocations')!.percentage.toFixed(1)}%
                  </Badge>
                </div>
                <Progress value={monitorData.metrics.find(m => m.type === 'edge_invocations')!.percentage} className="h-2 mb-2" />
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>{formatNumber(monitorData?.summary?.edgeInvocationsUsed || 0)} invocations</span>
                  <span>500K limit</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Egress Cards */}
          {monitorData?.metrics?.find(m => m.type === 'cached_egress') && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <ArrowDownCircle className="w-5 h-5 text-purple-500" />
                    <span className="font-medium">Cached Egress</span>
                  </div>
                  <Badge variant={monitorData.metrics.find(m => m.type === 'cached_egress')!.percentage >= 80 ? "destructive" : "secondary"}>
                    {monitorData.metrics.find(m => m.type === 'cached_egress')!.percentage.toFixed(1)}%
                  </Badge>
                </div>
                <Progress value={monitorData.metrics.find(m => m.type === 'cached_egress')!.percentage} className="h-2 mb-2" />
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>{monitorData.metrics.find(m => m.type === 'cached_egress')!.formatted}</span>
                  <span>2 GB limit</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* MAU Card */}
          {monitorData?.metrics?.find(m => m.type === 'mau') && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-orange-500" />
                    <span className="font-medium">Monthly Active Users</span>
                  </div>
                  <Badge variant={monitorData.metrics.find(m => m.type === 'mau')!.percentage >= 80 ? "destructive" : "secondary"}>
                    {monitorData.metrics.find(m => m.type === 'mau')!.percentage.toFixed(1)}%
                  </Badge>
                </div>
                <Progress value={monitorData.metrics.find(m => m.type === 'mau')!.percentage} className="h-2 mb-2" />
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>{formatNumber(monitorData?.summary?.mauUsed || 0)} users</span>
                  <span>50K limit</span>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="tables" className="mt-3">
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Table className="w-4 h-4" />
                Top Tables by Size
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {monitorData?.topTables?.map((table) => (
                  <div key={table.tableName} className="p-3 flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{table.tableName}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatNumber(table.rowCount)} rows
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {table.sizeFormatted}
                    </Badge>
                  </div>
                ))}
                {(!monitorData?.topTables || monitorData.topTables.length === 0) && (
                  <div className="p-4 text-center text-muted-foreground">
                    No table data available
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="mt-3">
          <CleanupPowerSettings />
        </TabsContent>

        <TabsContent value="alerts" className="mt-3">
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <BellRing className="w-4 h-4" />
                Alert Notifications
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {alerts.length === 0 ? (
                  <div className="p-8 text-center">
                    <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                    <h3 className="font-medium text-green-600">All Clear!</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      No alerts found. Everything is running smoothly.
                    </p>
                  </div>
                ) : (
                  alerts.map((alert, i) => (
                    <div key={i} className={`p-4 ${
                      alert.severity === 'critical' ? 'bg-destructive/5' : 'bg-yellow-500/5'
                    }`}>
                      <div className="flex items-center gap-2 mb-1">
                        {alert.severity === 'critical' ? (
                          <AlertTriangle className="w-4 h-4 text-destructive" />
                        ) : (
                          <Bell className="w-4 h-4 text-yellow-600" />
                        )}
                        <Badge variant={alert.severity === 'critical' ? 'destructive' : 'secondary'}>
                          {alert.severity === 'critical' ? 'Critical' : 'Warning'}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatMetricName(alert.metric)}
                        </span>
                      </div>
                      <p className="text-sm mt-1">{alert.message}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Progress value={alert.percentage} className="flex-1 h-1.5" />
                        <span className="text-xs font-medium">{alert.percentage.toFixed(1)}%</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Alert Thresholds Info */}
          <Card className="mt-3">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-yellow-500" />
                Alert Thresholds
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-2 space-y-2">
              <div className="flex items-center justify-between p-2 bg-yellow-500/10 rounded">
                <span className="text-sm">⚠️ Warning</span>
                <Badge variant="secondary">70%+</Badge>
              </div>
              <div className="flex items-center justify-between p-2 bg-destructive/10 rounded">
                <span className="text-sm">🚨 Critical</span>
                <Badge variant="destructive">90%+</Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="schedule" className="mt-3">
          {/* Auto-Cleanup Settings */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-primary" />
                  </div>
                <div>
                    <div className="font-medium">Auto-Cleanup Schedule</div>
                    <div className="text-xs text-muted-foreground">Automatic cleanup every 4 hours</div>
                  </div>
                </div>
                <Switch 
                  checked={autoCleanupEnabled}
                  onCheckedChange={toggleAutoCleanup}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="mt-3">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                4-Hour Schedule (6 times daily)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-2">
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="p-2 bg-primary/10 rounded text-center font-medium">00:00 IST</div>
                <div className="p-2 bg-primary/10 rounded text-center font-medium">04:00 IST</div>
                <div className="p-2 bg-primary/10 rounded text-center font-medium">08:00 IST</div>
                <div className="p-2 bg-primary/10 rounded text-center font-medium">12:00 IST</div>
                <div className="p-2 bg-primary/10 rounded text-center font-medium">16:00 IST</div>
                <div className="p-2 bg-primary/10 rounded text-center font-medium">20:00 IST</div>
              </div>
            </CardContent>
          </Card>

          <Card className="mt-3">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-base">Retention Periods (Aggressive Mode)</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-2 space-y-2 text-sm">
              <div className="flex justify-between p-2 bg-destructive/10 rounded">
                <span>🔴 OTPs, Sessions</span>
                <span className="font-medium">1-6 hours</span>
              </div>
              <div className="flex justify-between p-2 bg-destructive/10 rounded">
                <span>🔴 Health Checks</span>
                <span className="font-medium">6 hours</span>
              </div>
              <div className="flex justify-between p-2 bg-yellow-500/10 rounded">
                <span>🟡 API/Function Logs</span>
                <span className="font-medium">1-3 days</span>
              </div>
              <div className="flex justify-between p-2 bg-yellow-500/10 rounded">
                <span>🟡 Notifications (read)</span>
                <span className="font-medium">3-7 days</span>
              </div>
              <div className="flex justify-between p-2 bg-green-500/10 rounded">
                <span>🟢 Chat, Messages</span>
                <span className="font-medium">7-14 days</span>
              </div>
              <div className="flex justify-between p-2 bg-green-500/10 rounded">
                <span>🟢 Cache, Audio</span>
                <span className="font-medium">3-14 days</span>
              </div>
              <div className="flex justify-between p-2 bg-muted rounded">
                <span>📦 Audit Logs (archived)</span>
                <span className="font-medium">14-60 days</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-3">
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <History className="w-4 h-4" />
                Cleanup History
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {(!monitorData?.recentOptimizations || monitorData.recentOptimizations.length === 0) ? (
                  <div className="p-4 text-center text-muted-foreground">
                    No cleanup history yet
                  </div>
                ) : (
                  monitorData.recentOptimizations.map((log: any) => (
                    <div key={log.id} className="p-3">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          {log.status === 'success' ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : (
                            <AlertTriangle className="w-4 h-4 text-destructive" />
                          )}
                          <span className="font-medium text-sm capitalize">
                            {log.optimization_type || 'Cleanup'}
                          </span>
                        </div>
                        <Badge variant={log.status === 'success' ? 'secondary' : 'destructive'} className="text-xs">
                          {log.status}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{formatNumber(log.rows_deleted || 0)} records deleted</span>
                        <span>{formatBytes(log.egress_saved_bytes || 0)} saved</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {formatDate(log.created_at)}
                        <span className="ml-2">• {log.execution_time_ms || 0}ms</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="export" className="mt-3 space-y-3">
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Download className="w-4 h-4" />
                Export Reports
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-2 space-y-3">
              <Button 
                variant="outline" 
                className="w-full justify-start gap-3 h-auto py-3"
                onClick={exportUsageReport}
              >
                <FileText className="w-5 h-5 text-blue-500" />
                <div className="text-left">
                  <div className="font-medium">Usage Report (JSON)</div>
                  <div className="text-xs text-muted-foreground">
                    Current usage metrics, health score, top tables
                  </div>
                </div>
              </Button>
              
              <Button 
                variant="outline" 
                className="w-full justify-start gap-3 h-auto py-3"
                onClick={exportCleanupHistory}
              >
                <FileSpreadsheet className="w-5 h-5 text-green-500" />
                <div className="text-left">
                  <div className="font-medium">Cleanup History (CSV)</div>
                  <div className="text-xs text-muted-foreground">
                    Recent cleanup logs with details
                  </div>
                </div>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Quick Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-2 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Health Score</span>
                <span className={`font-bold ${getHealthColor(healthScore)}`}>{healthScore}/100</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Database Size</span>
                <span className="font-medium">{monitorData?.summary?.totalDatabaseSize || '0 B'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Critical Alerts</span>
                <span className={criticalAlerts.length > 0 ? 'text-destructive font-bold' : ''}>
                  {criticalAlerts.length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Warnings</span>
                <span className={warningAlerts.length > 0 ? 'text-yellow-600 font-bold' : ''}>
                  {warningAlerts.length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last Updated</span>
                <span className="text-xs">{formatTime(monitorData?.timestamp)}</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SupabaseUsageMonitor;
