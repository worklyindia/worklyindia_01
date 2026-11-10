import { Link } from "react-router-dom";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Eye,
  Sparkles,
  TrendingUp,
  Users,
  Globe,
  Rocket,
  Building2,
  Heart,
} from "lucide-react";
import SEO from "@/components/SEO";
import { BRAND_CONFIG } from "@/config/brandConfig";

const Vision = () => {
  const brand = BRAND_CONFIG.name || "Workly India";

  const visionGoals = [
    {
      icon: TrendingUp,
      title: "1 Crore+ Job Seekers by 2030",
      desc: "Build India's largest verified remote jobs community — where every skilled Indian has a profile.",
    },
    {
      icon: Building2,
      title: "10 Lakh+ Verified Employers",
      desc: "From startups to enterprises — everyone connected in one transparent, fraud-free hiring ecosystem.",
    },
    {
      icon: Globe,
      title: "100% Pan-India Coverage",
      desc: "Bring Workly India opportunities to every district and tier-3 city — jobs from any corner of India.",
    },
    {
      icon: Rocket,
      title: "AI-Powered Hiring",
      desc: "Smart matching, automatic screening and instant offers — so hiring takes hours, not weeks.",
    },
    {
      icon: Heart,
      title: "Zero Fraud Platform",
      desc: "Become India's safest jobs platform with industry-leading scam detection and duplicate account blocking.",
    },
    {
      icon: Users,
      title: "Empowering Women & Rural India",
      desc: "Create dedicated opportunities for homemakers, rural youth and differently-abled candidates.",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={`Our Vision | ${brand} — India's #1 Remote Jobs Platform by 2030`}
        description={`${brand} 's vision: to become India's #1 remote jobs platform by 2030. 1 Cr+ job seekers, 10 lakh+ verified employers, 100% pan-India coverage.`}
        canonical="/vision"
      />
      <PageHeader title="Our Vision" />

      <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-10 max-w-5xl pb-24 md:pb-10">
        {/* Hero */}
        <section className="text-center mb-10 sm:mb-14">
          <Badge className="mb-3" variant="secondary">
            <Sparkles className="w-3 h-3 mr-1" />
            Our Vision
          </Badge>
          <h1 className="text-3xl sm:text-5xl font-bold text-foreground mb-3 leading-tight">
            India's{" "}
            <span className="text-blue-500">#1 Remote Jobs</span> Platform by 2030
          </h1>
          <p className="text-muted-foreground text-base sm:text-lg max-w-2xl mx-auto">
            A world where every Indian finds the right job from home — and every company finds the right talent.
          </p>
        </section>

        {/* Main Vision Statement */}
        <Card className="p-5 sm:p-8 mb-8 border-l-4 border-l-blue-500">
          <div className="flex items-start gap-4">
            <div className="shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center">
              <Eye className="w-6 h-6 sm:w-7 sm:h-7 text-blue-500" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-3">
                Vision Statement
              </h2>
              <p className="text-muted-foreground text-sm sm:text-base leading-relaxed mb-3">
                To make {brand} India's <strong>#1 remote jobs platform</strong> by 2030, where{" "}
                <strong>1 crore+ job seekers</strong> and <strong>10 lakh+ verified employers</strong> connect in a
                transparent, fraud-free ecosystem.
              </p>
              <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
                We want to build a world where finding a job is as easy as sending a WhatsApp message — and where
                every Indian, whatever their background, can take pride in their skills and earn a dignified income.
              </p>
            </div>
          </div>
        </Card>

        {/* 2030 Goals */}
        <section className="mb-10">
          <div className="text-center mb-6 sm:mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
              Our 2030 Vision Goals
            </h2>
            <p className="text-muted-foreground text-sm sm:text-base">
              6 milestones we are working towards today
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {visionGoals.map((item) => {
              const Icon = item.icon;
              return (
                <Card key={item.title} className="p-4 sm:p-5 hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-blue-500" />
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

        {/* Long-term outlook */}
        <Card className="p-5 sm:p-8 mb-8 border-l-4 border-l-amber-500">
          <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-3">
            The Bigger Picture
          </h2>
          <ul className="text-muted-foreground text-sm sm:text-base space-y-2 list-disc pl-5">
            <li>Make India the <strong>world's largest remote workforce hub</strong>.</li>
            <li>Help create <strong>1 crore+ digital jobs</strong> in rural India.</li>
            <li>Make hiring <strong>50% faster and 90% cheaper</strong>.</li>
            <li>Put a <strong>verified career assistant</strong> in every Indian's pocket.</li>
            <li>Bring global remote jobs to Indian talent.</li>
          </ul>
        </Card>

        {/* CTA */}
        <Card className="p-6 sm:p-8 text-center bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
          <h3 className="text-xl sm:text-2xl font-bold text-foreground mb-2">
            Be part of our vision
          </h3>
          <p className="text-muted-foreground text-sm sm:text-base mb-4">
            Start today — tomorrow's India begins with you.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/auth"
              className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition"
            >
              Create Free Account
            </Link>
            <Link
              to="/why-choose-us"
              className="inline-flex items-center justify-center px-6 py-3 rounded-lg border border-border bg-card text-foreground font-medium hover:bg-accent transition"
            >
              Why Choose {brand}
            </Link>
          </div>
        </Card>
      </main>

    </div>
  );
};

export default Vision;
