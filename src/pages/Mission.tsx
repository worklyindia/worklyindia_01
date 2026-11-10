import { Link } from "react-router-dom";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Target,
  Sparkles,
  Users,
  Globe,
  HeartHandshake,
  ShieldCheck,
  GraduationCap,
  Briefcase,
} from "lucide-react";
import SEO from "@/components/SEO";
import { BRAND_CONFIG } from "@/config/brandConfig";

const Mission = () => {
  const brand = BRAND_CONFIG.name || "Workly India";

  const missionPoints = [
    {
      icon: Globe,
      title: "Pan-India Reach",
      desc: "Bring verified Workly India opportunities to every village, town and metro city — so location never becomes a barrier to a career.",
    },
    {
      icon: HeartHandshake,
      title: "Equal Opportunity for All",
      desc: "Student, homemaker, fresher or experienced — every talented Indian should get quality remote jobs without any discrimination.",
    },
    {
      icon: ShieldCheck,
      title: "Trust & Safety First",
      desc: "Manually verify every employer to fully protect job seekers from fraud, fake jobs and scams.",
    },
    {
      icon: Users,
      title: "Empower Communities",
      desc: "Build a digital employment ecosystem in tier-2, tier-3 cities and rural India — bringing income and dignity to every home.",
    },
    {
      icon: GraduationCap,
      title: "Skill Development",
      desc: "Make every job seeker industry-ready with a free resume builder, skill assessments and interview practice.",
    },
    {
      icon: Briefcase,
      title: "Affordable Hiring",
      desc: "Provide transparent, affordable hiring tools for small businesses and startups — with no hidden charges.",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={`Our Mission | ${brand} — Remote Jobs for Every Indian`}
        description={`${brand} 's mission: bringing verified Workly India opportunities to every corner of India. Equal opportunity, fraud-free hiring, free for job seekers.`}
        canonical="/mission"
      />
      <PageHeader title="Our Mission" />

      <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-10 max-w-5xl pb-24 md:pb-10">
        {/* Hero */}
        <section className="text-center mb-10 sm:mb-14">
          <Badge className="mb-3" variant="secondary">
            <Sparkles className="w-3 h-3 mr-1" />
            Our Mission
          </Badge>
          <h1 className="text-3xl sm:text-5xl font-bold text-foreground mb-3 leading-tight">
            The Right{" "}
            <span className="text-primary">Remote Job</span> for Every Indian
          </h1>
          <p className="text-muted-foreground text-base sm:text-lg max-w-2xl mx-auto">
            Finding a job should be as easy as sending a WhatsApp message — that is our dream.
          </p>
        </section>

        {/* Main Mission Statement */}
        <Card className="p-5 sm:p-8 mb-8 border-l-4 border-l-primary">
          <div className="flex items-start gap-4">
            <div className="shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Target className="w-6 h-6 sm:w-7 sm:h-7 text-primary" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-3">
                Mission Statement
              </h2>
              <p className="text-muted-foreground text-sm sm:text-base leading-relaxed mb-3">
                {brand}'s mission is to bring{" "}<strong>verified Workly India opportunities</strong> to people living in
                every corner of India — village, town or metro city. We want every talented Indian, whether a student,
                a homemaker or an experienced professional, to find quality remote jobs based on their skills, without
                any discrimination.
              </p>
              <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
                We are building a platform where <strong>trust, transparency and opportunity</strong> come together —
                so the future of hiring is in the hands of every Indian.
              </p>
            </div>
          </div>
        </Card>

        {/* What Our Mission Covers */}
        <section className="mb-10">
          <div className="text-center mb-6 sm:mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
              The 6 Pillars of Our Mission
            </h2>
            <p className="text-muted-foreground text-sm sm:text-base">
              These 6 principles guide every decision we make
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {missionPoints.map((item) => {
              const Icon = item.icon;
              return (
                <Card key={item.title} className="p-4 sm:p-5 hover:shadow-md transition-shadow">
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
        <Card className="p-6 sm:p-8 text-center bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <h3 className="text-xl sm:text-2xl font-bold text-foreground mb-2">
            Be part of our mission
          </h3>
          <p className="text-muted-foreground text-sm sm:text-base mb-4">
            Create your free account today and explore verified remote jobs.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/jobs"
              className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition"
            >
              Browse Jobs
            </Link>
            <Link
              to="/vision"
              className="inline-flex items-center justify-center px-6 py-3 rounded-lg border border-border bg-card text-foreground font-medium hover:bg-accent transition"
            >
              Read Our Vision
            </Link>
          </div>
        </Card>
      </main>

    </div>
  );
};

export default Mission;
