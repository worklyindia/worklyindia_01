import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Target,
  Eye,
  Sparkles,
  ShieldCheck,
  Users,
  Globe,
  Rocket,
  HeartHandshake,
  BadgeCheck,
  Zap,
  TrendingUp,
  Lock,
} from "lucide-react";
import SEO from "@/components/SEO";
import { BRAND_CONFIG } from "@/config/brandConfig";

const MissionVision = () => {
  const brand = BRAND_CONFIG.name || "Workly India";

  const whyChoose = [
    {
      icon: ShieldCheck,
      title: "Verified Companies Only",
      desc: "Every employer is manually verified — complete protection from fake jobs and scams.",
    },
    {
      icon: Zap,
      title: "Instant Quick Login",
      desc: "One-tap login with device recognition. No need to remember passwords.",
    },
    {
      icon: Globe,
      title: "Pan-India Remote Jobs",
      desc: "Village or metro city — Workly India opportunities from every location.",
    },
    {
      icon: HeartHandshake,
      title: "Free for Job Seekers",
      desc: "Applying, building a profile, getting alerts — everything is completely free.",
    },
    {
      icon: BadgeCheck,
      title: "Fraud Protection",
      desc: "AI-powered scam detection and duplicate account blocking.",
    },
    {
      icon: TrendingUp,
      title: "Career Growth Tools",
      desc: "Resume builder, skill assessments, interview practice — all in one place.",
    },
    {
      icon: Users,
      title: "75,000+ Active Users",
      desc: "India's fastest-growing remote jobs community.",
    },
    {
      icon: Lock,
      title: "Privacy First",
      desc: "Your data is yours alone. It is never shared without your permission.",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={`Mission, Vision & Why Choose ${brand} | Remote Jobs India`}
        description={`Discover ${brand}'s mission, vision and why lakhs of job seekers choose us. Verified remote jobs, fraud protection, free quick login.`}
        canonical="/mission-vision"
      />
      <PageHeader title="Mission & Vision" />

      <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-10 max-w-5xl pb-24 md:pb-10">
        {/* Hero */}
        <section className="text-center mb-10 sm:mb-14">
          <Badge className="mb-3" variant="secondary">
            <Sparkles className="w-3 h-3 mr-1" />
            About {brand}
          </Badge>
          <h1 className="text-3xl sm:text-5xl font-bold text-foreground mb-3 leading-tight">
            Building India's Most Trusted{" "}
            <span className="text-primary">Remote Jobs Platform</span>
          </h1>
          <p className="text-muted-foreground text-base sm:text-lg max-w-2xl mx-auto">
            The right job from home for every Indian — that is our dream.
          </p>
        </section>

        {/* Mission */}
        <Card className="p-5 sm:p-8 mb-5 border-l-4 border-l-primary">
          <div className="flex items-start gap-4">
            <div className="shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Target className="w-6 h-6 sm:w-7 sm:h-7 text-primary" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-2">
                Our Mission
              </h2>
              <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
                {brand}'s mission is to bring <strong>verified work from home
                opportunities</strong> to people in every corner of India —
                village, town or metro city. We want every talented Indian,
                whether a student, a homemaker or an experienced professional,
                to find quality remote jobs based on their skills, without
                any discrimination.
              </p>
            </div>
          </div>
        </Card>

        {/* Vision */}
        <Card className="p-5 sm:p-8 mb-5 border-l-4 border-l-blue-500">
          <div className="flex items-start gap-4">
            <div className="shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center">
              <Eye className="w-6 h-6 sm:w-7 sm:h-7 text-blue-500" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-2">
                Our Vision
              </h2>
              <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
                To make {brand} India's <strong>#1 remote jobs
                platform</strong> by 2030, where 1 crore+ job seekers and
                10 lakh+ verified employers connect in a transparent,
                fraud-free ecosystem. We want a world where finding a job
                is as easy as sending a WhatsApp message.
              </p>
            </div>
          </div>
        </Card>

        {/* Core Values */}
        <Card className="p-5 sm:p-8 mb-10 border-l-4 border-l-amber-500">
          <div className="flex items-start gap-4">
            <div className="shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center">
              <Rocket className="w-6 h-6 sm:w-7 sm:h-7 text-amber-500" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-2">
                Our Core Values
              </h2>
              <ul className="text-muted-foreground text-sm sm:text-base space-y-2 list-disc pl-5">
                <li><strong>Trust First</strong> — Every job and every company is verified.</li>
                <li><strong>User Privacy</strong> — Your data, your choice.</li>
                <li><strong>Equal Opportunity</strong> — Gender, location or background makes no difference.</li>
                <li><strong>Always Free for Seekers</strong> — You never pay to get a job.</li>
                <li><strong>Innovation</strong> — Making hiring simple with AI and technology.</li>
              </ul>
            </div>
          </div>
        </Card>

        {/* Why Choose */}
        <section>
          <div className="text-center mb-6 sm:mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
              Why Choose <span className="text-primary">{brand}</span>?
            </h2>
            <p className="text-muted-foreground text-sm sm:text-base">
              8 reasons that make us India's #1 remote jobs platform
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {whyChoose.map((item) => {
              const Icon = item.icon;
              return (
                <Card
                  key={item.title}
                  className="p-4 sm:p-5 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground text-sm sm:text-base mb-1">
                        {item.title}
                      </h3>
                      <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>

        {/* CTA */}
        <Card className="mt-10 p-6 sm:p-8 text-center bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <h3 className="text-xl sm:text-2xl font-bold text-foreground mb-2">
            Start your remote career today
          </h3>
          <p className="text-muted-foreground text-sm sm:text-base mb-4">
            Join lakhs of Indians who are already part of {brand}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="/jobs"
              className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition"
            >
              Browse Jobs
            </a>
            <a
              href="/auth"
              className="inline-flex items-center justify-center px-6 py-3 rounded-lg border border-border bg-card text-foreground font-medium hover:bg-accent transition"
            >
              Create Free Account
            </a>
          </div>
        </Card>
      </main>

    </div>
  );
};

export default MissionVision;
