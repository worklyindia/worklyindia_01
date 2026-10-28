import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Search, ThumbsUp, ThumbsDown, Share2, Bot, MessageCircle, Eye } from 'lucide-react';
import LottieSearchIcon from "@/components/LottieSearchIcon";
import PageHeader from "@/components/PageHeader";

interface Trick {
  id: string;
  title: string;
  content: string;
  category: string;
  language: 'hi' | 'en';
  status: string;
  views_count: number;
  helpful_count: number;
  not_helpful_count: number;
  created_at: string;
  ai_system_users?: {
    name: string;
  };
}

export default function CareerTricks() {
  const [tricks, setTricks] = useState<Trick[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState<'hi' | 'en'>('en');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const { toast } = useToast();
  const navigate = useNavigate();

  const categories = [
    { value: 'all', label: 'All Tricks', labelHi: 'सभी ट्रिक्स' },
    { value: 'resume_building', label: 'Resume Building', labelHi: 'रेज़्यूमे बनाना' },
    { value: 'interview_preparation', label: 'Interview Prep', labelHi: 'इंटरव्यू तैयारी' },
    { value: 'remote_work_best_practices', label: 'Workly India', labelHi: 'रिमोट वर्क' },
    { value: 'job_search_strategies', label: 'Job Search', labelHi: 'जॉब सर्च' },
    { value: 'skill_development', label: 'Skill Development', labelHi: 'स्किल विकास' },
  ];

  useEffect(() => {
    loadTricks();
  }, [selectedLanguage, selectedCategory]);

  const loadTricks = async () => {
    try {
      let query = supabase
        .from('ai_generated_tricks')
        .select(`
          *,
          ai_system_users!ai_generated_tricks_generated_by_fkey(name)
        `)
        .eq('status', 'published')
        .eq('language', selectedLanguage)
        .order('created_at', { ascending: false });

      if (selectedCategory !== 'all') {
        query = query.eq('category', selectedCategory);
      }

      const { data, error } = await query;
      if (error) throw error;

      setTricks((data as Trick[]) || []);
    } catch (error) {
      console.error('Error loading tricks:', error);
      toast({
        title: 'Error',
        description: 'Failed to load career tricks',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFeedback = async (trickId: string, isHelpful: boolean) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: 'Login Required',
          description: 'Please login to provide feedback',
          variant: 'destructive',
        });
        return;
      }

      const response = await supabase.functions.invoke('ai-trick-manager', {
        body: {
          action: 'feedback',
          trick_id: trickId,
          updates: {
            user_id: user.id,
            is_helpful: isHelpful,
          },
        },
      });

      if (response.error) throw response.error;

      toast({
        title: 'Thanks for your feedback!',
        description: 'Your feedback helps us improve our content',
      });

      loadTricks();
    } catch (error) {
      console.error('Error submitting feedback:', error);
    }
  };

  const shareOnWhatsApp = (trick: Trick) => {
    const text = `${trick.title}\n\n${trick.content.substring(0, 200)}...\n\nRead more on Workly India`;
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const filteredTricks = tricks.filter(trick =>
    trick.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    trick.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title={selectedLanguage === 'hi' ? 'AI करियर ट्रिक्स' : 'AI Career Tricks'} />
      {/* Header */}
      <div className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground py-12">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-3 mb-4">
            <Bot className="h-10 w-10" />
            <h1 className="text-4xl font-bold">
              {selectedLanguage === 'hi' ? 'AI करियर ट्रिक्स' : 'AI Career Tricks'}
            </h1>
          </div>
          <p className="text-lg text-primary-foreground/90 max-w-2xl">
            {selectedLanguage === 'hi'
              ? 'AI द्वारा तैयार किए गए करियर टिप्स और ट्रिक्स जो आपको अपने रिमोट करियर में सफल होने में मदद करेंगे'
              : 'AI-generated career tips and tricks to help you succeed in your remote career'}
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Controls */}
        <div className="mb-8 space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"><LottieSearchIcon size={16} /></div>
              <Input
                placeholder={selectedLanguage === 'hi' ? 'ट्रिक्स खोजें...' : 'Search tricks...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Tabs value={selectedLanguage} onValueChange={(v) => setSelectedLanguage(v as 'hi' | 'en')}>
              <TabsList>
                <TabsTrigger value="en">English</TabsTrigger>
                <TabsTrigger value="hi">हिंदी</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Category Filter */}
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <Button
                key={cat.value}
                variant={selectedCategory === cat.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory(cat.value)}
              >
                {selectedLanguage === 'hi' ? cat.labelHi : cat.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Tricks Grid */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
          </div>
        ) : filteredTricks.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <Bot className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">
                {selectedLanguage === 'hi' ? 'कोई ट्रिक्स नहीं मिलीं' : 'No tricks found'}
              </h3>
              <p className="text-muted-foreground mb-4">
                {selectedLanguage === 'hi'
                  ? 'इस श्रेणी में अभी तक कोई ट्रिक्स नहीं हैं'
                  : 'No tricks available in this category yet'}
              </p>
              <Button onClick={() => navigate('/ai-assistant')}>
                <MessageCircle className="mr-2 h-4 w-4" />
                {selectedLanguage === 'hi' ? 'AI से पूछें' : 'Ask AI'}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredTricks.map((trick) => (
              <Card key={trick.id} className="flex flex-col">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <Badge variant="secondary">{trick.category.replace(/_/g, ' ')}</Badge>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Eye className="h-3 w-3" />
                      {trick.views_count}
                    </div>
                  </div>
                  <CardTitle className="text-xl">{trick.title}</CardTitle>
                  <CardDescription className="flex items-center gap-2">
                    <Bot className="h-4 w-4" />
                    {selectedLanguage === 'hi' ? 'AI द्वारा उत्पन्न' : 'AI Generated'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <div className="prose prose-sm max-w-none mb-4 flex-1">
                    <div className="whitespace-pre-wrap line-clamp-6">{trick.content}</div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-4 border-t">
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleFeedback(trick.id, true)}
                      >
                        <ThumbsUp className="h-4 w-4 mr-1" />
                        {trick.helpful_count}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleFeedback(trick.id, false)}
                      >
                        <ThumbsDown className="h-4 w-4 mr-1" />
                        {trick.not_helpful_count}
                      </Button>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => shareOnWhatsApp(trick)}
                    >
                      <Share2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* CTA */}
        <Card className="mt-12 bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="py-8 text-center">
            <h3 className="text-2xl font-bold mb-2">
              {selectedLanguage === 'hi' ? 'व्यक्तिगत करियर सलाह चाहिए?' : 'Need Personalized Career Advice?'}
            </h3>
            <p className="text-muted-foreground mb-4">
              {selectedLanguage === 'hi'
                ? 'हमारे AI करियर असिस्टेंट से चैट करें और अपने सवालों के जवाब पाएं'
                : 'Chat with our AI Career Assistant and get answers to your questions'}
            </p>
            <Button onClick={() => navigate('/ai-assistant')} size="lg">
              <MessageCircle className="mr-2 h-5 w-5" />
              {selectedLanguage === 'hi' ? 'AI से चैट करें' : 'Chat with AI'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
