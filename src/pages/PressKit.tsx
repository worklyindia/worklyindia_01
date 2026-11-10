import PageHeader from "@/components/PageHeader";
import SocialShare from "@/components/SocialShare";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import {
  Download,
  FileText,
  ImageIcon,
  Users,
  TrendingUp,
  Building2,
  MapPin,
  Calendar,
  Award,
  Mail,
  Phone,
  ExternalLink,
  MessageCircle,
} from "lucide-react";
import { BRAND_CONFIG } from "@/config/brandConfig";
import { usePlatformStats, formatStatNumber, getDisplayStats } from "@/hooks/usePlatformStats";
import { useBrandAssets } from "@/hooks/useBrandAssets";

interface RecentPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  published_at: string | null;
  category: string | null;
}

const useRecentBlogPosts = () =>
  useQuery({
    queryKey: ["press-kit-recent-posts"],
    queryFn: async (): Promise<RecentPost[]> => {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("id, title, slug, excerpt, published_at, category")
        .eq("is_published", true)
        .order("published_at", { ascending: false })
        .limit(3);
      if (error) throw error;
      return (data ?? []) as RecentPost[];
    },
    staleTime: 1000 * 60 * 10,
  });

const PressKit = () => {
  const { data: rawStats, isLoading: statsLoading } = usePlatformStats();
  const stats = getDisplayStats(rawStats);
  const { data: posts, isLoading: postsLoading } = useRecentBlogPosts();
  const brandAssets = useBrandAssets();

  const companyStats = [
    { label: "Registered job seekers", value: stats.users, icon: Users },
    { label: "Companies on platform", value: stats.companies, icon: Building2 },
    { label: "Active remote jobs", value: stats.activeJobs, icon: TrendingUp },
    { label: "Cities represented", value: stats.locations, icon: MapPin },
  ];

  const keyMessages = [
    `${BRAND_CONFIG.name} is a remote-work job platform focused on India, verifying employers so job seekers avoid the fraud that plagues remote hiring.`,
    "We serve professionals across tier-1, tier-2 and tier-3 cities, making genuine remote opportunities accessible beyond metros.",
    "Our platform is 100% free for job seekers. Employers pay only for premium visibility and verified badges.",
  ];

  const mailtoPress = `mailto:${BRAND_CONFIG.email}?subject=${encodeURIComponent(
    `Press inquiry — ${BRAND_CONFIG.name}`,
  )}`;
  const telLink = `tel:${BRAND_CONFIG.phone.replace(/[^+\d]/g, "")}`;
  const waLink = `https://wa.me/${BRAND_CONFIG.whatsappNumber}?text=${encodeURIComponent(
    "Hi, I have a press inquiry for Workly India.",
  )}`;

  // Logo comes from Owner → Brand Management so Press Kit stays in sync
  // whenever the owner uploads a new logo. Falls back to shipped default.
  const logoUrl = brandAssets.logo_url || "/workly-india-logo.png";

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Press / Media Kit" />

      {/* Hero Section */}
      <section className="bg-gradient-hero py-16 md:py-24">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center text-white">
            <h1 className="text-4xl md:text-6xl font-bold mb-6">Press Kit</h1>
            <p className="text-xl md:text-2xl mb-8 max-w-3xl mx-auto opacity-90">
              Media resources, company information, and latest news about {BRAND_CONFIG.name}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" variant="secondary">
                <a href={logoUrl} download={`${BRAND_CONFIG.shortName}-logo.png`}>
                  <Download className="w-5 h-5 mr-2" />
                  Download Logo
                </a>
              </Button>
              <SocialShare
                title={`${BRAND_CONFIG.name} Press Kit`}
                description={`Media resources and company information for ${BRAND_CONFIG.name}`}
                variant="small"
                className="bg-white/20 hover:bg-white/30 text-white border-white/30"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Company Overview */}
      <section className="py-16">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold mb-6">About {BRAND_CONFIG.name}</h2>
              <p className="text-lg text-muted-foreground mb-6 leading-relaxed">
                {BRAND_CONFIG.name} is a remote-work job platform for India. We verify employers and
                surface genuine remote opportunities so job seekers can apply with confidence — free of
                the fraud and spam that dominate general job boards.
              </p>
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <Calendar className="w-5 h-5 text-primary shrink-0" />
                  <span>
                    <strong>Founded:</strong> 2023
                  </span>
                </div>
                <div className="flex items-center space-x-3">
                  <MapPin className="w-5 h-5 text-primary shrink-0" />
                  <span>
                    <strong>Headquarters:</strong> {BRAND_CONFIG.location}
                  </span>
                </div>
                <div className="flex items-center space-x-3">
                  <Award className="w-5 h-5 text-primary shrink-0" />
                  <span>
                    <strong>Registration:</strong> {BRAND_CONFIG.udyamNumber}
                  </span>
                </div>
                <div className="flex items-center space-x-3">
                  <ExternalLink className="w-5 h-5 text-primary shrink-0" />
                  <span>
                    <strong>Website:</strong>{" "}
                    <a
                      href={`https://${BRAND_CONFIG.canonicalDomain}`}
                      className="text-primary underline"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {BRAND_CONFIG.canonicalDomain}
                    </a>
                  </span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {companyStats.map((stat) => (
                <Card key={stat.label} className="text-center p-6">
                  <CardContent className="p-0">
                    <stat.icon className="w-8 h-8 text-primary mx-auto mb-3" />
                    <div className="text-2xl font-bold text-primary mb-1">
                      {formatStatNumber(stat.value)}
                    </div>
                    <div className="text-sm text-muted-foreground">{stat.label}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Key Messages */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4 max-w-6xl">
          <h2 className="text-3xl font-bold text-center mb-12">Key Messages</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {keyMessages.map((message, index) => (
              <Card key={index} className="p-6">
                <CardContent className="p-0">
                  <div className="text-4xl font-bold text-primary mb-4">0{index + 1}</div>
                  <p className="text-muted-foreground leading-relaxed">{message}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Latest from the blog (real posts from DB) */}
      <section className="py-16">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="flex items-baseline justify-between mb-8 flex-wrap gap-2">
            <h2 className="text-3xl font-bold">Latest from our blog</h2>
            <Button asChild variant="ghost" size="sm">
              <Link to="/blog">
                See all posts
                <ExternalLink className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          </div>
          {postsLoading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : !posts || posts.length === 0 ? (
            <Card className="p-8 text-center">
              <FileText className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">
                No published posts yet. Check back soon or follow us on social for updates.
              </p>
            </Card>
          ) : (
            <div className="space-y-4">
              {posts.map((post) => (
                <Card key={post.id} className="p-6">
                  <CardHeader className="p-0 mb-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1">
                      <CardTitle className="text-xl">{post.title}</CardTitle>
                      {post.category && <Badge variant="secondary">{post.category}</Badge>}
                    </div>
                    {post.published_at && (
                      <div className="text-sm text-muted-foreground">
                        {new Date(post.published_at).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </div>
                    )}
                  </CardHeader>
                  <CardContent className="p-0">
                    {post.excerpt && (
                      <p className="text-muted-foreground mb-4 line-clamp-2">{post.excerpt}</p>
                    )}
                    <Button asChild variant="outline" size="sm">
                      <Link to={`/blog/${post.slug}`}>
                        <FileText className="w-4 h-4 mr-2" />
                        Read full post
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Downloadable brand assets — only real files */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4 max-w-6xl">
          <h2 className="text-3xl font-bold mb-8">Brand assets</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="p-6">
              <CardHeader className="p-0 mb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Logo (PNG)</CardTitle>
                  <ImageIcon className="w-6 h-6 text-primary" />
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <p className="text-muted-foreground mb-4">
                  Full-color {BRAND_CONFIG.name} logo for editorial and partner use.
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">PNG • Transparent</span>
                  <Button asChild variant="outline" size="sm">
                    <a href={logoUrl} download={`${BRAND_CONFIG.shortName}-logo.png`}>
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="p-6">
              <CardHeader className="p-0 mb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Favicon</CardTitle>
                  <ImageIcon className="w-6 h-6 text-primary" />
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <p className="text-muted-foreground mb-4">
                  App icon used in browser tabs and OS launchers.
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">ICO / PNG</span>
                  <Button asChild variant="outline" size="sm">
                    <a href={brandAssets.favicon_url || "/favicon.png"} download="workly-india-favicon.png">
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Need vector (SVG) files, mock-ups, or founder photos? Email{" "}
            <a href={mailtoPress} className="text-primary underline">
              {BRAND_CONFIG.email}
            </a>{" "}
            and we'll send them over.
          </p>
        </div>
      </section>

      {/* Contact */}
      <section className="py-16">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Media Contact</h2>
            <p className="text-lg text-muted-foreground">
              For press inquiries, interviews, and media partnerships
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <Card className="p-6 text-center">
              <CardContent className="p-0">
                <Mail className="w-10 h-10 text-primary mx-auto mb-3" />
                <h3 className="text-lg font-semibold mb-2">Email</h3>
                <p className="text-muted-foreground text-sm mb-4">General press inquiries</p>
                <Button asChild variant="outline" className="w-full">
                  <a href={mailtoPress}>
                    <span className="truncate">{BRAND_CONFIG.email}</span>
                  </a>
                </Button>
              </CardContent>
            </Card>

            <Card className="p-6 text-center">
              <CardContent className="p-0">
                <Phone className="w-10 h-10 text-primary mx-auto mb-3" />
                <h3 className="text-lg font-semibold mb-2">Phone</h3>
                <p className="text-muted-foreground text-sm mb-4">Urgent media requests</p>
                <Button asChild variant="outline" className="w-full">
                  <a href={telLink}>{BRAND_CONFIG.phone}</a>
                </Button>
              </CardContent>
            </Card>

            <Card className="p-6 text-center">
              <CardContent className="p-0">
                <MessageCircle className="w-10 h-10 text-primary mx-auto mb-3" />
                <h3 className="text-lg font-semibold mb-2">WhatsApp</h3>
                <p className="text-muted-foreground text-sm mb-4">Fastest response</p>
                <Button asChild variant="outline" className="w-full">
                  <a href={waLink} target="_blank" rel="noopener noreferrer">
                    Chat on WhatsApp
                  </a>
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="text-center mt-12">
            <p className="text-muted-foreground mb-6">
              Follow us on social for the latest announcements
            </p>
            <SocialShare
              title={`Follow ${BRAND_CONFIG.name}`}
              description={`Stay updated with the latest from ${BRAND_CONFIG.name}`}
            />
          </div>
        </div>
      </section>
    </div>
  );
};

export default PressKit;
