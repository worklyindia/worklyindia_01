import { Link } from "react-router-dom";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ShieldCheck,
  Zap,
  Globe,
  HeartHandshake,
  BadgeCheck,
  TrendingUp,
  Users,
  Lock,
  Sparkles,
  Smartphone,
  Headphones,
  Award,
} from "lucide-react";
import SEO from "@/components/SEO";
import { BRAND_CONFIG } from "@/config/brandConfig";

const WhyChooseUs = () => {
  const brand = BRAND_CONFIG.name || "Workly India";

  const reasons = [
    {
      icon: ShieldCheck,
      title: "100% Verified Companies",
      desc: "Every employer is manually verified. Job posting is allowed only after checking PAN, GST and company documents — complete protection from fake jobs and scams.",
      color: "text-green-600",
      bg: "bg-green-500/10",
    },
    {
      icon: Zap,
      title: "Instant Quick Login",
      desc: "One-tap login with device recognition. No need to remember passwords — you can also sign in with face or fingerprint.",
      color: "text-amber-500",
      bg: "bg-amber-500/10",
    },
    {
      icon: Globe,
      title: "Pan-India Remote Jobs",
      desc: "Village or metro city — Workly India opportunities 24/7 from every location. Jobs are available in Hindi, English and regional languages.",
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      icon: HeartHandshake,
      title: "Always Free for Job Seekers",
      desc: "Applying, building a profile, getting alerts, downloading your resume — everything is completely free. Never any hidden charges.",
      color: "text-pink-500",
      bg: "bg-pink-500/10",
    },
    {
      icon: BadgeCheck,
      title: "AI Fraud Protection",
      desc: "AI-powered scam detection, duplicate account blocking and suspicious activity monitoring — so both your data and your money stay safe.",
      color: "text-violet-500",
      bg: "bg-violet-500/10",
    },
    {
      icon: TrendingUp,
      title: "Career Growth Tools",
      desc: "Free resume builder, skill assessments, interview practice mode, certifications — every tool to grow your career in one place.",
      color: "text-orange-500",
      bg: "bg-orange-500/10",
    },
    {
      icon: Users,
      title: "75,000+ Active Users",
      desc: "India's fastest-growing remote jobs community. Real reviews, real success stories — fully transparent.",
      color: "text-cyan-500",
      bg: "bg-cyan-500/10",
    },
    {
      icon: Lock,
      title: "Privacy First Approach",
      desc: "Your data is yours alone. It is never shared without your permission. End-to-end encrypted chats and GDPR-grade privacy controls.",
      color: "text-indigo-500",
      bg: "bg-indigo-500/10",
    },
    {
      icon: Smartphone,
      title: "Mobile-First Experience",
      desc: "Fast app, offline support, low data usage. Runs smoothly even on 2G/3G — optimized for every Indian's phone.",
      color: "text-rose-500",
      bg: "bg-rose-500/10",
    },
    {
      icon: Headphones,
      title: "Real Human Support",
      desc: "24/7 support via WhatsApp, email and in-app chat. Not bots — real people who understand your language.",
      color: "text-teal-500",
      bg: "bg-teal-500/10",
    },
    {
      icon: Award,
      title: "Rewards & Referrals",
      desc: "Earn real cash rewards for completing your profile, referring friends and staying active.",
      color: "text-yellow-600",
      bg: "bg-yellow-500/10",
    },
    {
      icon: Sparkles,
      title: "AI Career Assistant",
      desc: "A personal AI career assistant that suggests jobs based on your skills, optimizes your resume and helps you prepare for interviews.",
      color: "text-fuchsia-500",
      bg: "bg-fuchsia-500/10",
    },
  ];

  const stats = [
    { value: "75K+", label: "Active Users" },
    { value: "5K+", label: "Verified Companies" },
    { value: "20K+", label: "Live Jobs" },
    { value: "4.7★", label: "User Rating" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={`Why Choose ${brand} | India's Most Trusted Remote Jobs Platform`}
        description={`12 reasons that make ${brand} India's #1 remote jobs platform — verified companies, free for seekers, AI fraud protection, instant quick login.`}
        canonical="/why-choose-us"
      />
      <PageHeader title="Why Choose Workly India" />

      <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-10 max-w-5xl pb-24 md:pb-10">
        {/* Hero */}
        <section className="text-center mb-8 sm:mb-12">
          <Badge className="mb-3" variant="secondary">
            <Sparkles className="w-3 h-3 mr-1" />
            Why {brand}
          </Badge>
          <h1 className="text-3xl sm:text-5xl font-bold text-foreground mb-3 leading-tight">
            Why do lakhs of Indians choose{" "}
            <span className="text-primary">{brand}</span>?
          </h1>
          <p className="text-muted-foreground text-base sm:text-lg max-w-2xl mx-auto">
            12 strong reasons that make us India's most trusted remote jobs platform.
          </p>
        </section>

        {/* Stats Bar */}
        <Card className="p-4 sm:p-6 mb-10 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-2xl sm:text-3xl font-bold text-primary">{s.value}</div>
                <div className="text-xs sm:text-sm text-muted-foreground mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </Card>

        {/* Reasons Grid */}
        <section className="mb-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {reasons.map((item) => {
              const Icon = item.icon;
              return (
                <Card key={item.title} className="p-4 sm:p-5 hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-3">
                    <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${item.bg}`}>
                      <Icon className={`w-5 h-5 ${item.color}`} />
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

        {/* Trust Reinforcement */}
        <Card className="p-5 sm:p-8 mb-8 border-l-4 border-l-primary">
          <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-3">
            Our Promise
          </h2>
          <ul className="text-muted-foreground text-sm sm:text-base space-y-2 list-disc pl-5">
            <li><strong>No fake jobs</strong> — Every posting is manually moderated.</li>
            <li><strong>No spam calls</strong> — Your number is never shared without your permission.</li>
            <li><strong>No hidden charges</strong> — Everything is free for job seekers, always.</li>
            <li><strong>No data selling</strong> — Your personal information is never sold.</li>
            <li><strong>Real support</strong> — Have a question? Talk to us directly.</li>
          </ul>
        </Card>

        {/* CTA */}
        <Card className="p-6 sm:p-8 text-center bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <h3 className="text-xl sm:text-2xl font-bold text-foreground mb-2">
            Get started today
          </h3>
          <p className="text-muted-foreground text-sm sm:text-base mb-4">
            Create a free account and explore India's best remote jobs.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/jobs"
              className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition"
            >
              Browse Jobs
            </Link>
            <Link
              to="/auth"
              className="inline-flex items-center justify-center px-6 py-3 rounded-lg border border-border bg-card text-foreground font-medium hover:bg-accent transition"
            >
              Create Free Account
            </Link>
          </div>
        </Card>
      </main>

    </div>
  );
};

export default WhyChooseUs;
