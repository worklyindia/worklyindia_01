import { Link } from "react-router-dom";
import PageHeader from "@/components/PageHeader";
import SEO from "@/components/SEO";
import LottieSearchIcon from "@/components/LottieSearchIcon";
import { 
  Home, Briefcase, Award, User, Settings, 
  Building2, TrendingUp, FileText, Shield, 
  HelpCircle, Mail, Users, MapPin, BookOpen,
  Star, Bell, Heart, Search, UserCheck, Calendar, Code2, GraduationCap
} from "lucide-react";

const Sitemap = () => {
  const sitemapSections = [
    {
      title: "Main Pages",
      icon: Home,
      gradient: "from-primary via-primary/80 to-primary/60",
      links: [
        { path: "/", label: "Home", icon: Home },
        { path: "/jobs", label: "Browse Jobs", icon: Briefcase },
        { path: "/pricing", label: "Website Pricing", icon: FileText },
        { path: "/how-it-works", label: "How It Works", icon: HelpCircle },
        { path: "/about-us", label: "About Us", icon: Users },
        { path: "/contact-us", label: "Contact Us", icon: Mail },
      ]
    },
    {
      title: "Job Seeker",
      icon: UserCheck,
      gradient: "from-success via-success/80 to-success/60",
      links: [
        { path: "/profile", label: "My Profile", icon: User },
        { path: "/activity", label: "My Activity", icon: Calendar },
        { path: "/favorites", label: "Saved Jobs", icon: Heart },
        { path: "/rewards", label: "Rewards & Referrals", icon: Award },
        { path: "/notifications", label: "Notifications", icon: Bell },
      ]
    },
    {
      title: "Employers",
      icon: Building2,
      gradient: "from-secondary via-secondary/80 to-secondary/60",
      links: [
        { path: "/employer-portal", label: "Employer Portal", icon: Building2 },
        { path: "/post-job", label: "Post a Job", icon: Briefcase },
        { path: "/recruitment-solutions", label: "Recruitment Solutions", icon: TrendingUp },
        { path: "/hiring-companies", label: "Hiring Companies", icon: Building2 },
        { path: "/hire-interns", label: "Hire Interns", icon: GraduationCap },
        { path: "/college-tpo", label: "College TPO", icon: GraduationCap },
      ]
    },
    {
      title: "Developers",
      icon: Code2,
      gradient: "from-primary via-primary/80 to-primary/60",
      links: [
        { path: "/developers", label: "Developer Portal", icon: Code2 },
        { path: "/developers/whatsapp-docs", label: "WhatsApp API Docs", icon: FileText },
        { path: "/developers/email-docs", label: "Email API Docs", icon: Mail },
        { path: "/developers/job-docs", label: "Jobs API Docs", icon: Briefcase },
        { path: "/api-docs/quick-start", label: "API Quick Start", icon: BookOpen },
        { path: "/developers/faq", label: "Developer FAQ", icon: HelpCircle },
      ]
    },
    {
      title: "Resources",
      icon: BookOpen,
      gradient: "from-purple-500 via-purple-500/80 to-purple-500/60",
      links: [
        { path: "/career-guidance", label: "Career Guidance", icon: BookOpen },
        { path: "/interview-tips", label: "Interview Tips", icon: Star },
        { path: "/blog", label: "Blog & Articles", icon: FileText },
        { path: "/jobs-for-women", label: "Jobs for Women", icon: Users },
        { path: "/free-job-alerts", label: "Free Job Alerts", icon: Bell },
      ]
    },
    {
      title: "Legal & Support",
      icon: Shield,
      gradient: "from-slate-700 via-slate-700/80 to-slate-700/60",
      links: [
        { path: "/help-center", label: "Help Center", icon: HelpCircle },
        { path: "/faq", label: "FAQ", icon: HelpCircle },
        { path: "/terms-conditions", label: "Terms & Conditions", icon: FileText },
        { path: "/privacy", label: "Privacy Policy", icon: Shield },
        { path: "/refund-policy", label: "Refund Policy", icon: Shield },
        { path: "/disclaimer", label: "Disclaimer", icon: FileText },
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <SEO
        title="Sitemap"
        description="Complete sitemap of Workly India - Find all pages including jobs, resources, employer portal, career guidance, and support pages."
        keywords="sitemap, workly india, Workly India, job portal sitemap, website map"
        canonical="/sitemap"
      />

      <PageHeader title="Sitemap" />

      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-primary via-primary/90 to-primary/70 text-primary-foreground py-16 px-4">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: 'radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)',
            backgroundSize: '32px 32px'
          }} />
        </div>
        
        <div className="container mx-auto max-w-6xl relative z-10">
          <div className="flex items-center justify-center mb-6">
            <div className="p-4 bg-white/20 backdrop-blur-sm rounded-2xl shadow-lg">
              <MapPin className="w-12 h-12" />
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-center mb-4">
            Website Sitemap
          </h1>
          <p className="text-lg md:text-xl text-center text-primary-foreground/90 max-w-2xl mx-auto">
            Navigate through all sections of Workly India - Your complete guide to finding Workly India opportunities
          </p>
        </div>
      </div>

      {/* Sitemap Content */}
      <div className="container mx-auto max-w-6xl px-4 py-12">
        <div className="grid md:grid-cols-2 gap-8">
          {sitemapSections.map((section, idx) => {
            const IconComponent = section.icon;
            return (
              <div
                key={idx}
                className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
              >
                {/* Gradient Header */}
                <div className={`bg-gradient-to-r ${section.gradient} p-6 relative overflow-hidden`}>
                  <div className="absolute inset-0 opacity-20">
                    <div className="absolute inset-0" style={{
                      backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
                      backgroundSize: '24px 24px'
                    }} />
                  </div>
                  <div className="relative z-10 flex items-center gap-3">
                    <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
                      <IconComponent className="w-6 h-6 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-white">
                      {section.title}
                    </h2>
                  </div>
                </div>

                {/* Links */}
                <div className="p-6 space-y-2">
                  {section.links.map((link, linkIdx) => {
                    const LinkIcon = link.icon;
                    return (
                      <Link
                        key={linkIdx}
                        to={link.path}
                        className="group/link flex items-center gap-3 p-3 rounded-lg hover:bg-accent/50 transition-all duration-200 hover:translate-x-2"
                      >
                        <div className="p-2 rounded-lg bg-primary/10 group-hover/link:bg-primary/20 transition-colors">
                          <LinkIcon className="w-4 h-4 text-primary" />
                        </div>
                        <span className="text-foreground group-hover/link:text-primary font-medium transition-colors">
                          {link.label}
                        </span>
                        <div className="ml-auto opacity-0 group-hover/link:opacity-100 transition-opacity">
                          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Additional Info */}
        <div className="mt-12 text-center">
          <div className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary/10 via-success/10 to-accent/10 rounded-full border border-primary/20">
            <LottieSearchIcon size={20} />
            <p className="text-sm font-medium text-muted-foreground">
              Can't find what you're looking for?{" "}
              <Link to="/contact-us" className="text-primary hover:underline font-semibold">
                Contact our support team
              </Link>
            </p>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Pages", value: "30+", gradient: "from-primary to-primary/60" },
            { label: "Job Categories", value: "50+", gradient: "from-success to-success/60" },
            { label: "Active Jobs", value: "1000+", gradient: "from-secondary to-secondary/60" },
            { label: "Resources", value: "100+", gradient: "from-purple-500 to-purple-500/60" },
          ].map((stat, idx) => (
            <div
              key={idx}
              className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${stat.gradient} p-6 text-white shadow-lg hover:shadow-xl transition-shadow`}
            >
              <div className="absolute inset-0 opacity-20">
                <div className="absolute inset-0" style={{
                  backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
                  backgroundSize: '16px 16px'
                }} />
              </div>
              <div className="relative z-10">
                <div className="text-3xl font-bold mb-1">{stat.value}</div>
                <div className="text-sm text-white/90">{stat.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Sitemap;
