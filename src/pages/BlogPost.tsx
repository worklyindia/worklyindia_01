import { useParams, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import Header from "@/components/Header";
import SEO from "@/components/SEO";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Calendar, 
  User, 
  ArrowLeft, 
  Clock,
  Share2
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeHtml } from "@/utils/sanitize";

interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content?: string;
  category: string;
  author: string;
  image_url: string;
  read_time: string;
  published_at: string;
}

const BlogPost = () => {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (slug) {
      fetchPost();
    }
  }, [slug]);

  const fetchPost = async () => {
    try {
      const { data, error } = await supabase
        .from('blog_posts')
        .select('*')
        .eq('slug', slug)
        .eq('is_published', true)
        .single();

      if (error) throw error;
      setPost(data);
    } catch (error) {
      console.error('Error fetching blog post:', error);
      setPost(null);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async (post: BlogPost) => {
    const shareUrl = `${window.location.origin}/blog/${post.slug}`;
    const shareData = {
      title: post.title,
      text: post.excerpt,
      url: shareUrl,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        toast.success("Article shared successfully!");
      } else {
        await navigator.clipboard.writeText(shareUrl);
        toast.success("Link copied to clipboard!");
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error("Error sharing:", error);
        toast.error("Failed to share article");
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header hideSearch={true} />
        <main className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="text-center">
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </main>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-background">
        <Header hideSearch={true} />
        <main className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground mb-4">Blog Post Not Found</h1>
            <p className="text-muted-foreground mb-6">The requested blog post could not be found.</p>
            <Link to="/blog">
              <Button>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Blog
              </Button>
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO 
        title={`${post.title} | Workly India Blog`}
        description={post.excerpt}
        keywords={`${post.category.toLowerCase()}, Workly India, remote jobs India`}
        canonical={`/blog/${post.slug}`}
        type="article"
      />
      <Header hideSearch={true} />
      
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Navigation */}
        <div className="mb-6">
          <Link to="/blog">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Blog
            </Button>
          </Link>
        </div>

        {/* Article Header */}
        <article className="mb-8">
          <header className="mb-8">
            <Badge variant="secondary" className="mb-4">
              {post.category}
            </Badge>
            
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4 leading-tight">
              {post.title}
            </h1>
            
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-6">
              <span className="flex items-center">
                <User className="w-4 h-4 mr-2" />
                {post.author}
              </span>
              <span className="flex items-center">
                <Calendar className="w-4 h-4 mr-2" />
                {new Date(post.published_at).toLocaleDateString('en-IN', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </span>
              <span className="flex items-center">
                <Clock className="w-4 h-4 mr-2" />
                {post.read_time}
              </span>
            </div>
          </header>

          {/* Article Content */}
          <Card>
            <CardContent className="p-8">
              <div 
                className="prose prose-lg max-w-none prose-headings:text-foreground prose-p:text-foreground prose-li:text-foreground prose-strong:text-foreground"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(post.content || post.excerpt) }}
              />
            </CardContent>
          </Card>

          {/* Share Section */}
          <div className="mt-8 p-6 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-foreground mb-2">Found this helpful?</h3>
                <p className="text-sm text-muted-foreground">Share this article with others who might benefit</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => handleShare(post)}>
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </Button>
            </div>
          </div>
        </article>
      </main>
      
    </div>
  );
};

export default BlogPost;
