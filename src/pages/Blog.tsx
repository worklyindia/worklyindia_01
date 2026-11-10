import { Link } from "react-router-dom";
import SEO from "@/components/SEO";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, User, ArrowRight, Briefcase, TrendingUp, Users, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import blogHeroImage from "@/assets/blog-hero-new.webp";

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

const Blog = () => {
  const [email, setEmail] = useState("");
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBlogPosts();
  }, []);

  const fetchBlogPosts = async () => {
    try {
      const { data, error } = await supabase
        .from('blog_posts')
        .select('*')
        .eq('is_published', true)
        .order('published_at', { ascending: false });

      if (error) throw error;
      setBlogPosts(data || []);
    } catch (error) {
      console.error('Error fetching blog posts:', error);
      toast.error('Failed to load blog posts');
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email && email.includes("@")) {
      toast.success("Successfully subscribed! You'll receive our latest updates.");
      setEmail("");
    } else {
      toast.error("Please enter a valid email address.");
    }
  };

  const categories = [
    { name: "All Posts", icon: BookOpen, count: 24 },
    { name: "Career Advice", icon: Briefcase, count: 8 },
    { name: "Productivity", icon: TrendingUp, count: 6 },
    { name: "Career Growth", icon: Users, count: 10 }
  ];

  return (
    <div className="min-h-screen bg-background">
      <SEO 
        title="Workly India Blog - Workly India Tips & Career Advice"
        description="Expert insights on remote jobs, career development, productivity tips, and Workly India strategies. Stay updated with the latest trends in India's Workly India landscape."
        keywords="Workly India blog, remote jobs India, career advice, productivity tips, Workly India tips"
        canonical="/blog"
      />
      
      <PageHeader title="Blog" />
      
      <main className="container mx-auto px-4 py-8 pb-24 md:pb-8 max-w-7xl">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <Badge variant="secondary" className="mb-4">Insights & Updates</Badge>
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            Workly India Blog
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Expert insights on Workly India, career development, and productivity tips to help you succeed in your remote-work journey.
          </p>
        </div>

        {/* Categories */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          {categories.map((category) => {
            const Icon = category.icon;
            return (
              <Card key={category.name} className="p-4 hover:shadow-lg transition-all cursor-pointer group">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm text-foreground">{category.name}</p>
                    <p className="text-xs text-muted-foreground">{category.count} posts</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Featured Post */}
        {loading ? (
          <Card className="mb-12 p-8">
            <div className="text-center text-muted-foreground">Loading posts...</div>
          </Card>
        ) : blogPosts[0] ? (
          <Link to={`/blog/${blogPosts[0].slug}`}>
            <Card className="mb-12 overflow-hidden hover:shadow-xl transition-all duration-300 group">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="aspect-video md:aspect-auto bg-gradient-to-br from-primary/20 to-secondary/20">
                  {blogPosts[0].image_url && (
                    <img loading="lazy" decoding="async" 
                      src={blogPosts[0].image_url} 
                      alt={blogPosts[0].title}
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                <div className="p-6 md:p-8 flex flex-col justify-center">
                  <Badge variant="secondary" className="w-fit mb-4">
                    Featured Post
                  </Badge>
                  <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4 group-hover:text-primary transition-colors">
                    {blogPosts[0].title}
                  </h2>
                  <p className="text-muted-foreground mb-6">
                    {blogPosts[0].excerpt}
                  </p>
                  <div className="flex items-center space-x-4 text-sm text-muted-foreground mb-6">
                    <div className="flex items-center space-x-1">
                      <Calendar className="w-4 h-4" />
                      <span>{new Date(blogPosts[0].published_at).toLocaleDateString('en-IN', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Clock className="w-4 h-4" />
                      <span>{blogPosts[0].read_time}</span>
                    </div>
                  </div>
                  <Button className="w-fit group-hover:shadow-lg transition-all">
                    Read Article
                    <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </div>
              </div>
            </Card>
          </Link>
        ) : null}

        {/* Blog Posts Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {!loading && blogPosts.slice(1).map((post) => (
            <Link key={post.id} to={`/blog/${post.slug}`}>
              <Card className="h-full p-6 hover:shadow-lg transition-all duration-300 group cursor-pointer">
                <Badge variant="outline" className="mb-3">
                  {post.category}
                </Badge>
                <h3 className="text-xl font-bold text-foreground mb-3 group-hover:text-primary transition-colors">
                  {post.title}
                </h3>
                <p className="text-muted-foreground mb-4 line-clamp-2">
                  {post.excerpt}
                </p>
                <div className="flex items-center justify-between text-sm text-muted-foreground pt-4 border-t">
                  <div className="flex items-center space-x-1">
                    <User className="w-4 h-4" />
                    <span>{post.author}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Clock className="w-4 h-4" />
                    <span>{post.read_time}</span>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>

        {/* Newsletter Section */}
        <Card className="p-8 bg-gradient-to-r from-primary/5 to-secondary/5 border-border/50">
          <div className="text-center max-w-xl mx-auto">
            <h2 className="text-2xl font-bold text-foreground mb-4">
              Stay Updated
            </h2>
            <p className="text-muted-foreground mb-6">
              Subscribe to our newsletter for the latest Workly India insights, job opportunities, and career tips delivered to your inbox.
            </p>
            <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row gap-4">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="flex-1 px-4 py-3 border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
              <Button type="submit" size="lg">
                Subscribe
              </Button>
            </form>
          </div>
        </Card>
      </main>

    </div>
  );
};

export default Blog;
