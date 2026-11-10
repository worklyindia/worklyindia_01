import { confirmDialog } from '@/lib/confirmDialog';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Bot,
  Plus,
  Eye,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  TrendingUp,
  BarChart3,
  Languages,
  Filter,
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

interface Trick {
  id: string;
  title: string;
  content: string;
  category: string;
  language: 'hi' | 'en';
  status: 'draft' | 'published' | 'archived';
  views_count: number;
  helpful_count: number;
  not_helpful_count: number;
  created_at: string;
  ai_system_users?: {
    name: string;
    email: string;
  };
}

interface Stats {
  total: number;
  published: number;
  draft: number;
  archived: number;
  total_views: number;
  total_helpful: number;
  total_not_helpful: number;
  by_language: {
    en: number;
    hi: number;
  };
}

export default function AITricksManagement() {
  const [tricks, setTricks] = useState<Trick[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTrick, setSelectedTrick] = useState<Trick | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterLanguage, setFilterLanguage] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [generating, setGenerating] = useState(false);
  const { toast } = useToast();

  const categories = [
    { value: 'resume_building', label: 'Resume Building' },
    { value: 'interview_preparation', label: 'Interview Preparation' },
    { value: 'remote_work_best_practices', label: 'Workly India Best Practices' },
    { value: 'job_search_strategies', label: 'Job Search Strategies' },
    { value: 'skill_development', label: 'Skill Development' },
  ];

  useEffect(() => {
    loadData();
  }, [filterStatus, filterLanguage, filterCategory]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load tricks
      const filters: any = {};
      if (filterStatus !== 'all') filters.status = filterStatus;
      if (filterLanguage !== 'all') filters.language = filterLanguage;
      if (filterCategory !== 'all') filters.category = filterCategory;

      const { data: tricksData } = await supabase.functions.invoke('ai-trick-manager', {
        body: { action: 'list', filters },
      });

      setTricks(tricksData?.tricks || []);

      // Load stats
      const { data: statsData } = await supabase.functions.invoke('ai-trick-manager', {
        body: { action: 'stats' },
      });

      setStats(statsData?.stats || null);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load AI tricks data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const generateTrick = async (category: string, language: 'hi' | 'en') => {
    try {
      setGenerating(true);
      const { data, error } = await supabase.functions.invoke('ai-trick-generator', {
        body: {
          category,
          language,
          trigger_type: 'manual',
        },
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'AI trick generated successfully!',
      });

      setGenerateOpen(false);
      loadData();
    } catch (error) {
      console.error('Error generating trick:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate trick',
        variant: 'destructive',
      });
    } finally {
      setGenerating(false);
    }
  };

  const updateTrickStatus = async (trickId: string, status: string) => {
    try {
      await supabase.functions.invoke('ai-trick-manager', {
        body: {
          action: 'update',
          trick_id: trickId,
          updates: { status },
        },
      });

      toast({
        title: 'Success',
        description: 'Trick status updated',
      });

      loadData();
    } catch (error) {
      console.error('Error updating trick:', error);
      toast({
        title: 'Error',
        description: 'Failed to update trick',
        variant: 'destructive',
      });
    }
  };

  const deleteTrick = async (trickId: string) => {
    if (!(await confirmDialog('Are you sure you want to delete this trick?'))) return;

    try {
      await supabase.functions.invoke('ai-trick-manager', {
        body: {
          action: 'delete',
          trick_id: trickId,
        },
      });

      toast({
        title: 'Success',
        description: 'Trick deleted successfully',
      });

      loadData();
    } catch (error) {
      console.error('Error deleting trick:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete trick',
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      published: 'default',
      draft: 'secondary',
      archived: 'outline',
    };
    return <Badge variant={variants[status]}>{status}</Badge>;
  };

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bot className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">AI Tricks Management</h1>
            <p className="text-muted-foreground">Manage AI-generated career tricks and tips</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline"
            onClick={async () => {
              try {
                setGenerating(true);
                const { data, error } = await supabase.functions.invoke('ai-trick-scheduler', {
                  body: { trigger: 'manual' },
                });
                
                if (error) throw error;
                
                toast({
                  title: 'Success',
                  description: 'AI trick scheduled for generation!',
                });
                
                setTimeout(() => loadData(), 2000);
              } catch (error) {
                console.error('Error:', error);
                toast({
                  title: 'Error',
                  description: 'Failed to trigger scheduler',
                  variant: 'destructive',
                });
              } finally {
                setGenerating(false);
              }
            }}
            disabled={generating}
          >
            <Bot className="mr-2 h-4 w-4" />
            {generating ? 'Generating...' : '🤖 Auto-Generate Trick'}
          </Button>
          <Button onClick={() => setGenerateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Manual Generate
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tricks</CardTitle>
              <Bot className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">
                {stats.published} published • {stats.draft} draft
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Views</CardTitle>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_views}</div>
              <p className="text-xs text-muted-foreground">Across all tricks</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Helpful Feedback</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_helpful}</div>
              <p className="text-xs text-muted-foreground">
                {Math.round(
                  (stats.total_helpful / (stats.total_helpful + stats.total_not_helpful || 1)) * 100
                )}
                % positive rate
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Languages</CardTitle>
              <Languages className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.by_language.en + stats.by_language.hi}
              </div>
              <p className="text-xs text-muted-foreground">
                EN: {stats.by_language.en} • HI: {stats.by_language.hi}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            <CardTitle>Filters</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterLanguage} onValueChange={setFilterLanguage}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Languages</SelectItem>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="hi">Hindi</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-[240px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tricks Table */}
      <Card>
        <CardHeader>
          <CardTitle>AI Generated Tricks</CardTitle>
          <CardDescription>View and manage all AI-generated career tricks</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : tricks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No tricks found. Generate your first one!
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Lang</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Views</TableHead>
                  <TableHead>Feedback</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tricks.map((trick) => (
                  <TableRow key={trick.id}>
                    <TableCell className="font-medium max-w-xs truncate">
                      {trick.title}
                    </TableCell>
                    <TableCell className="text-xs">
                      {trick.category.replace(/_/g, ' ')}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{trick.language.toUpperCase()}</Badge>
                    </TableCell>
                    <TableCell>{getStatusBadge(trick.status)}</TableCell>
                    <TableCell>{trick.views_count}</TableCell>
                    <TableCell>
                      <div className="flex gap-2 text-xs">
                        <span className="text-green-600">👍 {trick.helpful_count}</span>
                        <span className="text-red-600">👎 {trick.not_helpful_count}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      {new Date(trick.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedTrick(trick);
                            setDetailsOpen(true);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {trick.status === 'draft' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => updateTrickStatus(trick.id, 'published')}
                          >
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          </Button>
                        )}
                        {trick.status === 'published' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => updateTrickStatus(trick.id, 'archived')}
                          >
                            <XCircle className="h-4 w-4 text-orange-600" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteTrick(trick.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Generate Dialog */}
      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate New AI Trick</DialogTitle>
            <DialogDescription>
              Select category and language for the new career trick
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {categories.map((cat) => (
              <div key={cat.value} className="space-y-2">
                <h4 className="font-medium">{cat.label}</h4>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => generateTrick(cat.value, 'en')}
                    disabled={generating}
                  >
                    Generate in English
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => generateTrick(cat.value, 'hi')}
                    disabled={generating}
                  >
                    हिंदी में जनरेट करें
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedTrick?.title}</DialogTitle>
            <DialogDescription>
              {selectedTrick?.ai_system_users?.name} • {selectedTrick?.language.toUpperCase()} •{' '}
              {selectedTrick?.category.replace(/_/g, ' ')}
            </DialogDescription>
          </DialogHeader>
          {selectedTrick && (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold">{selectedTrick.views_count}</div>
                    <p className="text-xs text-muted-foreground">Views</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold text-green-600">
                      {selectedTrick.helpful_count}
                    </div>
                    <p className="text-xs text-muted-foreground">Helpful</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold text-red-600">
                      {selectedTrick.not_helpful_count}
                    </div>
                    <p className="text-xs text-muted-foreground">Not Helpful</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold">{selectedTrick.status}</div>
                    <p className="text-xs text-muted-foreground">Status</p>
                  </CardContent>
                </Card>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Content</h4>
                <div className="prose prose-sm max-w-none whitespace-pre-wrap border rounded-lg p-4">
                  {selectedTrick.content}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
