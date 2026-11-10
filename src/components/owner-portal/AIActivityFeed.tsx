import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { Bot, ThumbsUp, ThumbsDown, Eye, TrendingUp } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Activity {
  id: string;
  type: 'generation' | 'view' | 'feedback';
  title: string;
  description: string;
  timestamp: string;
  metadata?: any;
}

export default function AIActivityFeed() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadActivities();
    
    // Set up real-time subscription
    const channel = supabase
      .channel('ai-activities')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ai_generated_tricks'
        },
        () => {
          loadActivities();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadActivities = async () => {
    try {
      // Get recent tricks
      const { data: tricks } = await supabase
        .from('ai_generated_tricks')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (tricks) {
        const newActivities: Activity[] = tricks.map(trick => ({
          id: trick.id,
          type: 'generation',
          title: `New trick generated`,
          description: trick.title,
          timestamp: trick.created_at,
          metadata: {
            category: trick.category,
            language: trick.language,
            views: trick.views_count,
            helpful: trick.helpful_count
          }
        }));

        setActivities(newActivities);
      }
    } catch (error) {
      console.error('Error loading activities:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'generation': return <Bot className="h-4 w-4" />;
      case 'view': return <Eye className="h-4 w-4" />;
      case 'feedback': return <TrendingUp className="h-4 w-4" />;
      default: return <Bot className="h-4 w-4" />;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'generation': return 'text-primary';
      case 'view': return 'text-blue-500';
      case 'feedback': return 'text-green-500';
      default: return 'text-muted-foreground';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            AI Activity Feed
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading activities...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5" />
          AI Activity Feed
          <Badge variant="secondary" className="ml-auto">Live</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-4">
            {activities.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No recent AI activity
              </p>
            ) : (
              activities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className={`mt-1 ${getActivityColor(activity.type)}`}>
                    {getActivityIcon(activity.type)}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{activity.title}</p>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {activity.description}
                    </p>
                    {activity.metadata && (
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline" className="text-xs">
                          {activity.metadata.category?.replace('_', ' ')}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {activity.metadata.language === 'hi' ? '🇮🇳 Hindi' : '🇬🇧 English'}
                        </Badge>
                        {activity.metadata.views > 0 && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Eye className="h-3 w-3" />
                            {activity.metadata.views}
                          </span>
                        )}
                        {activity.metadata.helpful > 0 && (
                          <span className="text-xs text-green-600 flex items-center gap-1">
                            <ThumbsUp className="h-3 w-3" />
                            {activity.metadata.helpful}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
