import { useContactInfo as useSiteContactInfo, useMerchantInfo, useSocialLinks } from "@/hooks/useSiteSettings";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Target, Award, Heart, Globe, CheckCircle, Shield, Building, Phone, ArrowRight, BriefcaseBusiness, Sparkles } from "lucide-react";
import SEO from "@/components/SEO";
import { getUpdatedTimestamp } from "@/utils/timestampUtils";
import BrandSocialBar from "@/components/BrandSocialBar";
import FounderSection from "@/components/FounderSection";
import { ROUTE_SEO } from "@/lib/routeSeo";
import { Link } from "react-router-dom";

const AboutUs = () => {
  const { data: merchantInfo } = useMerchantInfo();
  const { data: socialLinks } = useSocialLinks();
  const { data: siteContact } = useSiteContactInfo();

  const supportPhone = siteContact?.phone?.trim() || merchantInfo?.contact_number || "+91 9904923067";
  const companyInfo = [
    { label: "Founded", value: merchantInfo?.founded_year || "2025" },
    { label: "Headquarters", value: merchantInfo?.registered_address || "Gujarat, India" },
    { label: "UDYAM Registration", value: merchantInfo?.udyam_registration || "UDYAM-GJ-18-0022888" },
    { label: "IEC Code", value: merchantInfo?.iec_code || "EBGPG4522J" },
    { label: "Business Type", value: merchantInfo?.business_type || "Remote Jobs Platform" },
    { label: "Support", value: supportPhone }
  ];

  const highlights = [
    { title: "Job seeker first", description: "Explore opportunities without paying registration or application fees.", icon: Award },
    { title: "Direct connections", description: "Connect with employers and discover opportunities without unnecessary middlemen.", icon: Users },
    { title: "Safety-minded", description: "We encourage careful job search and provide ways to report suspicious activity.", icon: Shield },
    { title: "Opportunity for all", description: "Discover roles and career resources from across India.", icon: Globe }
  ];

  const values = [
    { title: "Integrity", description: "Clear information, honest communication and responsible practices.", icon: CheckCircle },
    { title: "Innovation", description: "Useful tools that make finding work and hiring simpler.", icon: Sparkles },
    { title: "Accessibility", description: "Making career opportunities and resources easier to reach.", icon: Globe },
    { title: "Community", description: "Supporting job seekers and employers throughout their journey.", icon: Heart }
  ];

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={ROUTE_SEO['/about-us'].title}
        description={ROUTE_SEO['/about-us'].description}
        keywords={ROUTE_SEO['/about-us'].keywords}
        canonical="/about-us"
      />
      <PageHeader title="About Us" />

      <main className="mx-auto max-w-6xl px-4 pb-24 pt-5 md:pb-12">
        {/* Intro / hero */}
        <section className="relative isolate overflow-hidden rounded-3xl border border-primary/15 bg-gradient-to-br from-primary/15 via-card to-secondary/15 px-6 py-12 sm:px-10 md:py-16">
          <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-primary/15 blur-3xl" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 left-1/4 h-48 w-48 rounded-full bg-secondary/20 blur-3xl" />
          <div className="relative mx-auto max-w-3xl text-center">
            <Badge variant="secondary" className="mb-5 inline-flex items-center gap-2 rounded-full px-3 py-1">
              <Sparkles className="h-3.5 w-3.5" /> About Workly India
            </Badge>
            <h1 className="text-balance text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl md:text-5xl">
              Helping India move forward, <span className="text-primary">one opportunity at a time.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
              Workly India brings job seekers, employers and career tools together in one accessible platform—so discovering work and finding talent can feel simpler, clearer and more empowering.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg" className="rounded-full px-6">
                <Link to="/jobs">Explore jobs <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-full bg-background/70 px-6">
                <Link to="/post-job">Hire with Workly India</Link>
              </Button>
            </div>
            <p className="mt-5 text-xs text-muted-foreground">Updated {getUpdatedTimestamp('about-us')}</p>
          </div>
        </section>

        <FounderSection className="my-10" />

        {/* Platform pillars */}
        <section className="my-12">
          <div className="mb-6 text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">What matters to us</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">A platform built around people</h2>
            <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">Our focus is to make the job search and hiring journey more approachable, transparent and useful.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {highlights.map((item) => (
              <Card key={item.title} className="group h-full rounded-2xl border-border/70 bg-card/80 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <item.icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-foreground">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* Mission */}
        <section className="my-12 grid gap-5 md:grid-cols-2">
          <Card className="relative overflow-hidden rounded-2xl border-primary/20 bg-gradient-to-br from-primary/10 to-card p-7 sm:p-9">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary"><Target className="h-6 w-6" /></div>
            <h2 className="text-2xl font-bold text-foreground">Our mission</h2>
            <p className="mt-3 leading-7 text-muted-foreground">To make job discovery and hiring more accessible by bringing people, opportunities and practical career resources together in one trusted experience.</p>
          </Card>
          <Card className="rounded-2xl border-border/70 p-7 sm:p-9">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-secondary text-secondary-foreground"><Globe className="h-6 w-6" /></div>
            <h2 className="text-2xl font-bold text-foreground">Our vision</h2>
            <p className="mt-3 leading-7 text-muted-foreground">A future where every person can discover meaningful career possibilities, build confidence and connect with employers—wherever they are in India.</p>
          </Card>
        </section>

        {/* Values */}
        <section className="my-12">
          <div className="mb-6 text-center">
            <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">The values behind our work</h2>
            <p className="mt-2 text-muted-foreground">Principles that guide how we build and serve.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {values.map((value) => (
              <div key={value.title} className="flex gap-4 rounded-2xl border border-border/70 bg-card p-5 sm:p-6">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><value.icon className="h-5 w-5" /></div>
                <div><h3 className="font-semibold text-foreground">{value.title}</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">{value.description}</p></div>
              </div>
            ))}
          </div>
        </section>

        {/* Company facts */}
        <section className="my-12">
          <Card className="overflow-hidden rounded-2xl border-border/70">
            <div className="flex items-center gap-4 border-b border-border bg-muted/30 p-6 sm:p-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary"><Building className="h-6 w-6" /></div>
              <div><h2 className="text-xl font-bold text-foreground sm:text-2xl">Company information</h2><p className="mt-1 text-sm text-muted-foreground">Business details and support</p></div>
            </div>
            <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
              {companyInfo.map((info) => (
                <div key={info.label} className="bg-card p-5 sm:p-6">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{info.label}</p>
                  <p className="mt-2 break-words text-sm font-semibold text-foreground">{info.value}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-3 bg-primary/5 p-5 sm:p-6">
              <Shield className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <p className="text-sm leading-6 text-muted-foreground">We aim to maintain clear business information and responsible platform practices. Please review job details carefully and report suspicious listings or requests.</p>
            </div>
          </Card>
        </section>

        {/* Story */}
        <section className="my-12">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Heart className="h-5 w-5" /></div>
            <div><h2 className="text-2xl font-bold text-foreground">Our story</h2><p className="text-sm text-muted-foreground">Why Workly India exists</p></div>
          </div>
          <div className="space-y-4 text-muted-foreground leading-7">
            <p>Workly India was created with a simple belief: looking for a job should open doors, not create barriers. We want job seekers to be able to explore opportunities without being asked to pay to register or apply.</p>
            <p>We are building tools and experiences that support the whole journey—from discovering roles and connecting with employers to preparing resumes, improving skills and taking the next career step.</p>
            <p>Our platform continues to evolve with feedback from job seekers and employers. We encourage users to stay alert, verify opportunities and contact us whenever something does not feel right.</p>
          </div>
        </section>

        {/* CTA */}
        <section className="my-12 rounded-3xl bg-gradient-to-r from-primary to-primary/80 p-7 text-primary-foreground sm:p-10">
          <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-2xl font-bold">Let’s build your next chapter.</h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-primary-foreground/85">Whether you’re looking for work or looking for talent, start exploring Workly India.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild variant="secondary" className="rounded-full"><Link to="/jobs">Find opportunities <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
              <Button asChild variant="outline" className="rounded-full border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10"><Link to="/post-job">Post a job</Link></Button>
            </div>
          </div>
        </section>

        {/* Contact */}
        <Card className="mb-8 rounded-2xl border-border/70 p-6 sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div><h2 className="text-xl font-bold text-foreground">Need a hand?</h2><p className="mt-1 text-muted-foreground">Our support team can help with platform questions or concerns.</p><p className="mt-3 flex items-center gap-2 font-semibold text-foreground"><Phone className="h-4 w-4 text-primary" /> {supportPhone}</p></div>
            <Button asChild variant="outline" className="rounded-full"><a href={`https://wa.me/${supportPhone.replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener noreferrer">Chat on WhatsApp <ArrowRight className="ml-2 h-4 w-4" /></a></Button>
          </div>
        </Card>

        {/* Social */}
        <Card className="rounded-2xl border-border/70 p-6 sm:p-8">
          <div className="mb-6 text-center"><h2 className="text-2xl font-bold text-foreground">Connect with us</h2><p className="mt-2 text-muted-foreground">Follow Workly India for updates, career tips and platform news.</p></div>
          <BrandSocialBar size="md" />
        </Card>
      </main>
    </div>
  );
};

export default AboutUs;
