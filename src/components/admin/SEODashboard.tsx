import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { CANONICAL_URL } from '@/config/domainConfig';
import LottieSearchIcon from "@/components/LottieSearchIcon";
import { 
  Search, 
  Globe, 
  FileText, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle,
  ExternalLink,
  Send,
  Clock,
  TrendingUp,
  Loader2
} from 'lucide-react';

interface IndexingLog {
  id: string;
  created_at: string;
  function_name: string;
  status: string;
  request_data: {
    type?: string;
    action?: string;
    urlCount?: number;
  };
  response_data: {
    submitted?: number;
    failed?: number;
    errors?: string[];
  };
}

export const SEODashboard = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customUrl, setCustomUrl] = useState('');
  const [recentLogs, setRecentLogs] = useState<IndexingLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  const fetchRecentLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const { data, error } = await supabase
        .from('function_logs')
        .select('*')
        .eq('function_name', 'google-indexing-api')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setRecentLogs((data as IndexingLog[]) || []);
    } catch (error) {
      console.error('Error fetching logs:', error);
      toast.error('Failed to fetch indexing logs');
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const submitToIndexing = async (type: string) => {
    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('unified-google-api', {
        body: { service: 'indexing', type, action: 'URL_UPDATED' }
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(`Submitted ${data.submitted || 0} URLs to Google Indexing API`);
        if (data.failed > 0) {
          toast.warning(`${data.failed} URLs failed to submit`);
        }
      } else {
        toast.error(data?.message || 'Failed to submit URLs');
      }

      fetchRecentLogs();
    } catch (error: any) {
      console.error('Indexing error:', error);
      toast.error(error.message || 'Failed to submit to indexing API');
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitCustomUrl = async () => {
    if (!customUrl.trim()) {
      toast.error('Please enter a URL');
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('google-indexing-api', {
        body: { urls: [customUrl], action: 'URL_UPDATED' }
      });

      if (error) throw error;

      if (data?.success) {
        toast.success('URL submitted successfully!');
        setCustomUrl('');
      } else {
        toast.error(data?.message || 'Failed to submit URL');
      }

      fetchRecentLogs();
    } catch (error: any) {
      console.error('Indexing error:', error);
      toast.error(error.message || 'Failed to submit URL');
    } finally {
      setIsSubmitting(false);
    }
  };

  const quickActions = [
    {
      id: 'new-jobs',
      label: 'New Jobs (24h)',
      description: 'Submit jobs created in last 24 hours',
      icon: FileText
    },
    {
      id: 'updated-jobs',
      label: 'Updated Jobs',
      description: 'Submit recently updated jobs',
      icon: RefreshCw
    },
    {
      id: 'new-blogs',
      label: 'New Blog Posts',
      description: 'Submit new blog posts',
      icon: FileText
    },
    {
      id: 'all',
      label: 'All Active Jobs',
      description: 'Submit top 200 active jobs + main pages',
      icon: Globe
    }
  ];

  const externalLinks = [
    {
      label: 'Google Search Console',
      url: 'https://search.google.com/search-console',
      description: 'Monitor indexing status & performance'
    },
    {
      label: 'PageSpeed Insights',
      url: `https://pagespeed.web.dev/?url=${CANONICAL_URL}`,
      description: 'Check Core Web Vitals'
    },
    {
      label: 'Rich Results Test',
      url: `https://search.google.com/test/rich-results?url=${CANONICAL_URL}`,
      description: 'Validate structured data'
    },
    {
      label: 'Mobile-Friendly Test',
      url: `https://search.google.com/test/mobile-friendly?url=${CANONICAL_URL}`,
      description: 'Check mobile optimization'
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">SEO Dashboard</h2>
          <p className="text-muted-foreground">
            Manage Google Indexing API & monitor SEO performance
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={fetchRecentLogs}
          disabled={isLoadingLogs}
        >
          {isLoadingLogs ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Refresh Logs
        </Button>
      </div>

      <Tabs defaultValue="indexing" className="space-y-4">
        <TabsList>
          <TabsTrigger value="indexing">Google Indexing</TabsTrigger>
          <TabsTrigger value="tools">SEO Tools</TabsTrigger>
          <TabsTrigger value="logs">Indexing Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="indexing" className="space-y-4">
          {/* Quick Submit Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5" />
                Quick Submit to Google
              </CardTitle>
              <CardDescription>
                Submit URLs to Google Indexing API for faster crawling (200 URLs/day limit)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {quickActions.map((action) => (
                  <Button
                    key={action.id}
                    variant="outline"
                    className="h-auto flex flex-col items-start p-4 space-y-2"
                    onClick={() => submitToIndexing(action.id)}
                    disabled={isSubmitting}
                  >
                    <div className="flex items-center gap-2">
                      <action.icon className="h-4 w-4" />
                      <span className="font-medium">{action.label}</span>
                    </div>
                    <span className="text-xs text-muted-foreground text-left">
                      {action.description}
                    </span>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Custom URL Submit */}
          <Card>
            <CardHeader>
              <CardTitle>Submit Custom URL</CardTitle>
              <CardDescription>
                Manually submit any URL from your site for indexing
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label htmlFor="customUrl" className="sr-only">URL</Label>
                <Input
                    id="customUrl"
                    placeholder={`${CANONICAL_URL}/job/...`}
                    value={customUrl}
                    onChange={(e) => setCustomUrl(e.target.value)}
                  />
                </div>
                <Button 
                  onClick={submitCustomUrl}
                  disabled={isSubmitting || !customUrl.trim()}
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  <span className="ml-2">Submit</span>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Indexing Status Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Indexing Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                  <CheckCircle2 className="h-8 w-8 text-green-500" />
                  <div>
                    <p className="text-sm font-medium">API Configured</p>
                    <p className="text-xs text-muted-foreground">Service account active</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                  <Clock className="h-8 w-8 text-blue-500" />
                  <div>
                    <p className="text-sm font-medium">Daily Limit</p>
                    <p className="text-xs text-muted-foreground">200 URLs/day</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                  <Globe className="h-8 w-8 text-purple-500" />
                  <div>
                    <p className="text-sm font-medium">Site Verified</p>
                    <p className="text-xs text-muted-foreground">Google Search Console</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tools" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LottieSearchIcon size={20} />
                External SEO Tools
              </CardTitle>
              <CardDescription>
                Quick access to Google's SEO testing and monitoring tools
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {externalLinks.map((link) => (
                  <a
                    key={link.label}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted transition-colors"
                  >
                    <div>
                      <p className="font-medium">{link.label}</p>
                      <p className="text-sm text-muted-foreground">{link.description}</p>
                    </div>
                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                  </a>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Sitemap Links */}
          <Card>
            <CardHeader>
              <CardTitle>Sitemaps</CardTitle>
              <CardDescription>
                Your site's sitemaps for search engines
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[
                  '/sitemap-index.xml',
                  '/sitemap.xml',
                  '/jobs-sitemap.xml',
                  '/blog-sitemap.xml',
                  '/companies-sitemap.xml'
                ].map((sitemap) => (
                  <a
                    key={sitemap}
                    href={`${CANONICAL_URL}${sitemap}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm hover:underline"
                  >
                    <FileText className="h-4 w-4" />
                    {sitemap}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Recent Indexing Activity
              </CardTitle>
              <CardDescription>
                Last 10 indexing submissions
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recentLogs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No indexing logs found.</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-2"
                    onClick={fetchRecentLogs}
                  >
                    Load Logs
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentLogs.map((log) => (
                    <div 
                      key={log.id} 
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        {log.status === 'success' ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        ) : (
                          <AlertCircle className="h-5 w-5 text-yellow-500" />
                        )}
                        <div>
                          <p className="text-sm font-medium">
                            {log.request_data?.type || 'Manual'} - {log.request_data?.action || 'URL_UPDATED'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(log.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant={log.status === 'success' ? 'default' : 'secondary'}>
                          {log.response_data?.submitted || 0} submitted
                        </Badge>
                        {(log.response_data?.failed || 0) > 0 && (
                          <Badge variant="destructive" className="ml-2">
                            {log.response_data?.failed} failed
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SEODashboard;
