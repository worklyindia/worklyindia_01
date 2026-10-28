import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import {
  BadgeCheck,
  Check,
  Code2,
  Mail,
  MessageCircle,
  MessagesSquare,
  Smartphone,
  Briefcase,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import SEO from "@/components/SEO";
import PublicIntroductionHeader from "@/components/PublicIntroductionHeader";
import PublicIntroductionHero from "@/components/PublicIntroductionHero";
const developerPhoto = "https://pub-3225b45ecaf943b3b9061cd57d754bf2.r2.dev/developer-introduction.jpg";
const developerPromoVideo = "https://pub-58e90721f9fe42b38ecde13543c608fc.r2.dev/workly-developer-promo-v3.mp4";
import { supabase } from "@/integrations/supabase/client";
import { BRAND_CONFIG } from "@/config/brandConfig";

/**
 * Public, crawler-friendly landing page for the Workly India developer platform.
 * Prices are read from app_settings (api_subscription_price, api_free_calls,
 * api_call_price, api_trial_days) so they always match what buyers pay.
 */
const DeveloperLanding = () => {
  const [price, setPrice] = useState<number | null>(null);
  const [freeCalls, setFreeCalls] = useState<number | null>(null);
  const [callPrice, setCallPrice] = useState<number | null>(null);
  const [trialDays, setTrialDays] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("setting_key,setting_value")
        .in("setting_key", ["api_subscription_price", "api_free_calls", "api_call_price", "api_trial_days"]);
      if (cancelled || !data) return;
      for (const row of data as { setting_key: string; setting_value: string }[]) {
        const n = Number(row.setting_value);
        if (Number.isNaN(n)) continue;
        if (row.setting_key === "api_subscription_price") setPrice(n);
        if (row.setting_key === "api_free_calls") setFreeCalls(n);
        if (row.setting_key === "api_call_price") setCallPrice(n);
        if (row.setting_key === "api_trial_days") setTrialDays(n);
      }
    };
    load();
    const channel = supabase
      .channel("developer-landing-prices")
      .on("postgres_changes", { event: "*", schema: "public", table: "app_settings" }, () => load())
      .subscribe((status) => {
        if (status === "SUBSCRIBED") load();
      });
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  const features = [
    {
      icon: MessageCircle,
      title: "WhatsApp Cloud API",
      description: "Send and receive WhatsApp messages with templates, media and delivery webhooks — officially via Meta's Cloud API.",
      to: "/developers/whatsapp-docs",
    },
    {
      icon: Mail,
      title: "Email API",
      description: "Send transactional and bulk email from your app with a simple REST API and delivery tracking.",
      to: "/developers/email-docs",
    },
    {
      icon: MessagesSquare,
      title: "Instagram & Facebook Inbox",
      description: "One API for Instagram Direct and Facebook Messenger conversations, with webhooks for new messages.",
      to: "/developers/instagram-docs",
    },
    {
      icon: Smartphone,
      title: "Website Chat Widget",
      description: "Drop-in chat widget for any website, powered by the same inbox APIs. Configure it once, paste one script tag.",
      to: "/developers/widget-docs",
    },
    {
      icon: Briefcase,
      title: "Jobs API",
      description: "Read verified job listings for your own app or bot with public, documented endpoints.",
      to: "/developers/job-docs",
    },
    {
      icon: ShieldCheck,
      title: "OAuth 2.1 & Scoped Keys",
      description: "Standard OAuth authorization for partner apps, per-user API keys, and full API call logs you can audit any time.",
      to: "/developers/oauth",
    },
    {
      icon: BadgeCheck,
      title: "Partner Solutions",
      description: "Ready-made solutions and partnership options to bring Workly India messaging and jobs into your business.",
      to: "/developers/partner-solutions",
    },
  ];

  const faqs = [
    {
      q: "Is there a free plan for the Workly India API?",
      a: `Yes. Your first ${trialDays ?? 30} days cost ₹1 and include ${freeCalls ?? 5000} API calls, so you can test everything before paying the full subscription.`,
    },
    {
      q: "How much does the API cost after the trial?",
      a: `₹${price ?? 500} per month, which includes ${freeCalls ?? 5000} API calls every month. Extra calls cost ₹${callPrice ?? 0.25} each. Prices are in Indian rupees.`,
    },
    {
      q: "How do I pay?",
      a: "Payments are in INR through Razorpay (UPI, cards, netbanking) or PayPal for international payments. You can cancel auto-pay any time from your developer dashboard.",
    },
    {
      q: "Do I need approval to send WhatsApp messages?",
      a: "The WhatsApp channel uses Meta's official Cloud API, so your number must be registered with Meta. The docs walk you through the setup step by step.",
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground public-introduction">
      <SEO
        title="Developer API — WhatsApp, Email & Jobs APIs in India"
        description={`Build with Workly India's WhatsApp, Email, Instagram, Chat Widget and Jobs APIs. ₹${price ?? 500}/month with ${freeCalls ?? 5000} free API calls, ₹1 trial for the first ${trialDays ?? 30} days. Full REST docs and OAuth.`}
        keywords="WhatsApp API India, Email API India, jobs API, chat widget India, Workly India developer API, WhatsApp Cloud API pricing INR"
        canonical="/developers"
      />
      <Helmet>
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faqs.map((f) => ({
              "@type": "Question",
              name: f.q,
              acceptedAnswer: { "@type": "Answer", text: f.a },
            })),
          })}
        </script>
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: `${BRAND_CONFIG.name} Developer API`,
            applicationCategory: "DeveloperApplication",
            operatingSystem: "Web",
            offers: {
              "@type": "Offer",
              price: price ?? 500,
              priceCurrency: "INR",
              description: `Monthly subscription with ${freeCalls ?? 5000} API calls included; ₹1 trial for the first ${trialDays ?? 30} days.`,
            },
          })}
        </script>
      </Helmet>

      <PublicIntroductionHeader loginTo="/employer-auth?redirect=%2Fdevelopers" />
      <main>
        <PublicIntroductionHero image={developerPhoto} imageAlt="Software developers collaborating at their workstation" eyebrow="APIs & INTEGRATIONS" title="Workly Developer" subtitle="WhatsApp, Email and Jobs APIs built for India." description="Connect messaging, email, social inboxes and job listings to your application—with REST documentation, scoped access and pricing in rupees.">
          <Button asChild size="lg" className="flex-1 whitespace-nowrap px-2 sm:flex-none sm:px-8"><Link to="/employer-auth?redirect=%2Fdevelopers">Start for ₹1 <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
          <Button asChild size="lg" variant="outline" className="public-photo-secondary flex-1 whitespace-nowrap px-2 sm:flex-none sm:px-8"><a href="#developer-docs">Explore documentation</a></Button>
        </PublicIntroductionHero>
        <div className="mx-auto max-w-5xl px-4 pb-16">
        <section id="developer-docs" className="py-8">
          <h2 className="text-2xl font-bold">Build with the channels your customers use</h2>
          <p className="mt-3 max-w-2xl leading-7 text-muted-foreground">Choose an integration below, explore its documentation and connect it to your application from your developer account.</p>
        </section>

        {/* Features */}
        <section aria-label="What you get" className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <Card key={f.title} className="flex flex-col p-5">
              <f.icon className="h-6 w-6 text-primary" />
              <h2 className="mt-3 font-semibold text-foreground">{f.title}</h2>
              <p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">{f.description}</p>
              <Link
                to={f.to}
                className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                View docs <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Card>
          ))}
        </section>

        {/* Overview video */}
        <section aria-label="Platform overview video" className="mt-12">
          <div className="mx-auto max-w-2xl text-center">
            <Badge variant="secondary" className="mb-4">Watch the overview</Badge>
            <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Everything you need, in one short clip
            </h2>
            <p className="mt-3 text-muted-foreground">
              A quick look at the channels and how you get connected.
            </p>
          </div>
          <div className="mx-auto mt-6 max-w-3xl overflow-hidden rounded-2xl border border-border bg-card p-2 shadow-sm sm:p-3">
            <video
              src={developerPromoVideo}
              poster={developerPhoto}
              aria-label="Workly India developer platform overview"
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              controls={false}
              disablePictureInPicture
              controlsList="nodownload nofullscreen noremoteplayback"
              onContextMenu={(e) => e.preventDefault()}
              onPause={(e) => { void e.currentTarget.play().catch(() => {}); }}
              className="aspect-video w-full rounded-xl object-cover"
            />
          </div>
        </section>

        <section className="mt-12 border-y border-border py-10">
          <h2 className="text-2xl font-bold">From your first request to a connected app</h2>
          <div className="mt-7 grid gap-7 sm:grid-cols-3">{[
            ['01', 'Choose your integration', 'Read the channel documentation for setup requirements, request formats and available endpoints.'],
            ['02', 'Connect your account', 'Log in to manage your API key and connect the services your application needs.'],
            ['03', 'Test and monitor', 'Send your first request, configure event webhooks and review your API call history as you build.'],
          ].map(([number, title, text]) => <div key={number}><p className="text-sm font-bold text-primary">{number}</p><h3 className="mt-2 text-lg font-semibold">{title}</h3><p className="mt-2 leading-7 text-muted-foreground">{text}</p></div>)}</div>
        </section>

        {/* Pricing */}
        <section aria-label="Pricing" className="mt-14">
          <div className="mx-auto max-w-2xl text-center">
            <Badge variant="secondary" className="mb-4">Pricing in ₹</Badge>
            <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              One plan, everything included
            </h2>
            <p className="mt-3 text-muted-foreground">
              Start with a ₹1 trial, then pay monthly. No per-seat charges, no hidden gateway fees.
            </p>
          </div>

          <div className="mx-auto mt-8 grid max-w-4xl gap-5 md:grid-cols-2">
            <Card className="flex flex-col p-6">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground">Free trial</h3>
                <Badge variant="outline">No card needed</Badge>
              </div>
              <p className="mt-3 text-3xl font-bold text-foreground">₹1</p>
              <p className="mt-1 text-sm text-muted-foreground">
                for the first {trialDays ?? 30} days
              </p>
              <ul className="mt-5 flex-1 space-y-2 text-sm text-muted-foreground">
                {[`${freeCalls ?? 5000} API calls included`, "All channels: WhatsApp, Email, Social, Widget", "Full docs and API logs"].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <Button asChild className="mt-6">
                <Link to="/employer-auth?redirect=%2Fdevelopers">Create developer account</Link>
              </Button>
            </Card>

            <Card className="flex flex-col p-6">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground">Monthly</h3>
                <Badge>Most popular</Badge>
              </div>
              <p className="mt-3 text-3xl font-bold text-foreground">
                ₹{price ?? 500}
                <span className="text-sm font-normal text-muted-foreground"> / month</span>
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {freeCalls ?? 5000} API calls included every month
              </p>
              <ul className="mt-5 flex-1 space-y-2 text-sm text-muted-foreground">
                {[
                  `Extra calls at ₹${callPrice ?? 0.25} each`,
                  "Pay by Razorpay (UPI/cards) or PayPal",
                  "Cancel auto-pay any time",
                  "OAuth apps for your own customers",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <Button asChild className="mt-6" variant="outline">
                <Link to="/employer-auth?redirect=%2Fdevelopers">Get started</Link>
              </Button>
            </Card>
          </div>

          <p className="mx-auto mt-4 flex max-w-2xl items-start justify-center gap-2 text-center text-xs text-muted-foreground">
            <BadgeCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            Prices are loaded live from our billing settings, so what you see here is what you pay.
            API call purchases start at 1,000 calls.
          </p>
        </section>

        {/* FAQ */}
        <section id="questions" aria-label="Frequently asked questions" className="mt-14">
          <h2 className="text-center text-2xl font-bold tracking-tight text-foreground">
            Frequently asked questions
          </h2>
          <div className="mx-auto mt-6 max-w-3xl space-y-3">
            {faqs.map((f) => (
              <Card key={f.q} className="p-5">
                <h3 className="font-semibold text-foreground">{f.q}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{f.a}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="mt-14 border-t border-border py-10 text-center">
          <Code2 className="mx-auto h-8 w-8 text-primary" />
          <h2 className="mt-3 text-xl font-bold text-foreground">Ready to build?</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Create your developer account, grab your API key and make your first call in minutes.
          </p>
          <Button asChild className="mt-5 w-full sm:w-auto">
            <Link to="/employer-auth?redirect=%2Fdevelopers">Start building</Link>
          </Button>
        </section>
        </div>
      </main>

      <footer className="border-t border-border/60 py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} {BRAND_CONFIG.name} · <Link to="/" className="underline underline-offset-4">Home</Link> ·{" "}
        <Link to="/contact-us" className="underline underline-offset-4">Contact</Link>
      </footer>
    </div>
  );
};

export default DeveloperLanding;
