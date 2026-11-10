import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw, Users, Eye, TrendingUp, Globe, Smartphone, Monitor, Tablet, MapPin, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface DailyData {
  date: string;
  activeUsers: number;
  sessions: number;
  pageViews: number;
  bounceRate: string;
  avgSessionDuration: string;
  newUsers: number;
}

interface RealtimeData {
  activeUsers: number;
  byLocation: { country: string; city: string; users: number }[];
  fetchedAt: string;
}

interface WeeklyData {
  dailyTrend: { date: string; activeUsers: number; sessions: number; pageViews: number; newUsers: number }[];
  devices: { device: string; users: number; sessions: number }[];
  trafficSources: { source: string; users: number; sessions: number }[];
  topPages: { path: string; pageViews: number; users: number }[];
  geography: { country: string; region: string; users: number }[];
}

interface CustomEvent {
  eventName: string;
  count: number;
  users: number;
}

interface GA4Data {
  daily?: { today: DailyData; yesterday: DailyData };
  realtime?: RealtimeData;
  weekly?: WeeklyData;
  customEvents?: { events: CustomEvent[] };
  fetchedAt?: string;
}

const GA4AnalyticsWidget = () => {
  const [data, setData] = useState<GA4Data | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastFetch, setLastFetch] = useState<string | null>(null);

  useEffect(() => {
    loadCachedData();
  }, []);

  const loadCachedData = async () => {
    try {
      const { data: setting } = await supabase
        .from('app_settings')
        .select('setting_value, updated_at')
        .eq('setting_key', 'ga4_latest_data')
        .single();

      if (setting?.setting_value) {
        const parsed = JSON.parse(setting.setting_value);
        setData(parsed);
        setLastFetch(parsed.fetchedAt);
      }
    } catch (error) {
      console.error('Failed to load cached GA4 data:', error);
    }
  };

  const fetchGA4Data = async (type: 'all' | 'realtime' = 'all') => {
    setIsLoading(true);
    try {
      const { data: result, error } = await supabase.functions.invoke('unified-google-api', {
        body: { service: 'analytics', type }
      });

      if (error) throw error;

      if (result?.success) {
        if (type === 'all') {
          setData(result.data);
        } else if (type === 'realtime' && result.data?.realtime) {
          setData(prev => ({ ...prev, realtime: result.data.realtime }));
        }
        setLastFetch(result.fetchedAt);
        toast.success(`GA4 ${type} data fetched successfully`);
      } else {
        throw new Error(result?.error || 'Failed to fetch GA4 data');
      }
    } catch (error: any) {
      console.error('GA4 fetch error:', error);
      toast.error(error.message || 'Failed to fetch GA4 data');
    } finally {
      setIsLoading(false);
    }
  };

  const getDeviceIcon = (device: string) => {
    switch (device?.toLowerCase()) {
      case 'mobile': return <Smartphone className="h-4 w-4" />;
      case 'tablet': return <Tablet className="h-4 w-4" />;
      default: return <Monitor className="h-4 w-4" />;
    }
  };

  const formatEventName = (name: string) => {
    return name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const calculateChange = (today: number, yesterday: number) => {
    if (yesterday === 0) return { value: 0, isPositive: true };
    const change = ((today - yesterday) / yesterday) * 100;
    return { value: Math.abs(change).toFixed(1), isPositive: change >= 0 };
  };

  return (
    <Card className="col-span-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            GA4 Analytics
          </CardTitle>
          <CardDescription>
            Real-time and historical traffic data from Google Analytics 4
            {lastFetch && (
              <span className="ml-2 text-xs">
                (Last updated: {new Date(lastFetch).toLocaleString()})
              </span>
            )}
          </CardDescription>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => fetchGA4Data('realtime')}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
            Realtime
          </Button>
          <Button 
            variant="default" 
            size="sm" 
            onClick={() => fetchGA4Data('all')}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
            Fetch All
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="realtime">Real-time</TabsTrigger>
            <TabsTrigger value="sources">Sources</TabsTrigger>
            <TabsTrigger value="events">Events</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            {data?.daily ? (
              <>
                <div className="grid gap-4 md:grid-cols-4">
                  {[
                    { label: 'Active Users', today: data.daily.today.activeUsers, yesterday: data.daily.yesterday.activeUsers, icon: Users },
                    { label: 'Sessions', today: data.daily.today.sessions, yesterday: data.daily.yesterday.sessions, icon: Eye },
                    { label: 'Page Views', today: data.daily.today.pageViews, yesterday: data.daily.yesterday.pageViews, icon: Globe },
                    { label: 'New Users', today: data.daily.today.newUsers, yesterday: data.daily.yesterday.newUsers, icon: TrendingUp },
                  ].map((metric) => {
                    const change = calculateChange(metric.today, metric.yesterday);
                    return (
                      <Card key={metric.label}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <metric.icon className="h-4 w-4 text-muted-foreground" />
                            <Badge variant={change.isPositive ? "default" : "destructive"} className="text-xs">
                              {change.isPositive ? <ArrowUpRight className="h-3 w-3 mr-1" /> : <ArrowDownRight className="h-3 w-3 mr-1" />}
                              {change.value}%
                            </Badge>
                          </div>
                          <div className="mt-2">
                            <p className="text-2xl font-bold">{metric.today.toLocaleString()}</p>
                            <p className="text-xs text-muted-foreground">{metric.label}</p>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">Bounce Rate</p>
                      <p className="text-xl font-semibold">{data.daily.today.bounceRate}%</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">Avg Session Duration</p>
                      <p className="text-xl font-semibold">{Math.floor(parseInt(data.daily.today.avgSessionDuration) / 60)}m {parseInt(data.daily.today.avgSessionDuration) % 60}s</p>
                    </CardContent>
                  </Card>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No analytics data available. Click "Fetch All" to load data.</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="realtime" className="space-y-4">
            {data?.realtime ? (
              <>
                <Card className="bg-primary/5">
                  <CardContent className="p-6 text-center">
                    <Users className="h-8 w-8 mx-auto mb-2 text-primary" />
                    <p className="text-4xl font-bold text-primary">{data.realtime.activeUsers}</p>
                    <p className="text-sm text-muted-foreground">Active Users Right Now</p>
                  </CardContent>
                </Card>
                {data.realtime.byLocation.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <MapPin className="h-4 w-4" /> Active Users by Location
                    </h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {data.realtime.byLocation.slice(0, 10).map((loc, i) => (
                        <div key={i} className="flex justify-between items-center p-2 bg-muted/50 rounded">
                          <span className="text-sm">{loc.city}, {loc.country}</span>
                          <Badge variant="secondary">{loc.users}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Click "Realtime" to see current active users.</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="sources" className="space-y-4">
            {data?.weekly ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h4 className="font-medium mb-2">Traffic Sources</h4>
                  <div className="space-y-2">
                    {data.weekly.trafficSources.slice(0, 6).map((source, i) => (
                      <div key={i} className="flex justify-between items-center p-2 bg-muted/50 rounded">
                        <span className="text-sm">{source.source}</span>
                        <div className="flex gap-2">
                          <Badge variant="outline">{source.users} users</Badge>
                          <Badge variant="secondary">{source.sessions} sessions</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Devices</h4>
                  <div className="space-y-2">
                    {data.weekly.devices.map((device, i) => (
                      <div key={i} className="flex justify-between items-center p-2 bg-muted/50 rounded">
                        <span className="text-sm flex items-center gap-2">
                          {getDeviceIcon(device.device)}
                          {device.device}
                        </span>
                        <div className="flex gap-2">
                          <Badge variant="outline">{device.users} users</Badge>
                          <Badge variant="secondary">{device.sessions} sessions</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Globe className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Click "Fetch All" to load traffic sources data.</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="events" className="space-y-4">
            {data?.customEvents?.events && data.customEvents.events.length > 0 ? (
              <div className="grid gap-2">
                {data.customEvents.events.map((event, i) => (
                  <div key={i} className="flex justify-between items-center p-3 bg-muted/50 rounded">
                    <span className="font-medium">{formatEventName(event.eventName)}</span>
                    <div className="flex gap-3">
                      <div className="text-right">
                        <p className="text-lg font-bold">{event.count.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">Total Events</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold">{event.users.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">Users</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Eye className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Click "Fetch All" to load custom events data.</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default GA4AnalyticsWidget;
