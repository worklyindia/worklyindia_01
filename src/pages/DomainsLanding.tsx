import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, Check, ChevronDown, Globe, Search, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import PublicIntroductionHeader from "../components/PublicIntroductionHeader";
import PublicIntroductionHero from "../components/PublicIntroductionHero";
import SEO from "../components/SEO";
import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";
import { useLiveTableRefresh } from "../hooks/useLiveTableRefresh";
import { loadPublicDomainCards, type PublicDomainQuote } from "../lib/publicDomainCatalog";
import { callDomainMarket, formatMoney } from "@/hooks/useDomainMarket";
import { supabase } from "@/integrations/supabase/client";
import domainIntro from "../assets/owner-domain-introduction.jpg.asset.json";

const LOGIN = "/auth?redirect=%2Fdomains";
const SIGNUP = `${LOGIN}&mode=signup`;

const INCLUDED = [
  [Search, "Live prices when you search", "The price you see is quoted at that moment, in rupees, for the name you typed."],
  [Globe, "DNS and forwarding control", "Nameservers, records and forwarding from your own dashboard."],
  [ShieldCheck, "Domain protection", "Whois privacy and registrar locks stay with the domain you hold."],
] as const;

const FAQS = [
  [
    "Do I need an account to check a price?",
    "No. Search a name on this page and the live price for it is quoted right there, before you sign in.",
  ],
  [
    "Where do the prices come from?",
    "Every quote is taken from the live registrar price at the moment you search, in Indian rupees. Nothing on this page is a guessed or fixed number.",
  ],
  [
    "Can I manage DNS after buying?",
    "Yes. Nameservers, DNS records and forwarding are all editable from your domain dashboard.",
  ],
  [
    "What are today's offers?",
    "Names the owner has put on a special price for the day. When a name is no longer on the list, it is no longer sold at that price."],
  [
    "Can I pay in rupees?",
    "Yes. Prices and payments are in Indian rupees, and you can use the payment methods available at checkout."],
  [
    "What happens after I buy?",
    "The domain moves into your dashboard where you can point it, renew it, and download the invoice."],
];

function Faq({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-border/70 bg-card">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="text-sm font-bold sm:text-base">{question}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <p className="px-4 pb-4 text-sm leading-relaxed text-muted-foreground">{answer}</p>
      ) : null}
    </div>
  );
}

export default function DomainsLanding() {
  const [arrivingOffers, setArrivingOffers] = useState<PublicDomainQuote[]>([]);
  const tldQuery = useQuery({
    queryKey: ["public-domain-tlds"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("domain_tld_pricing")
        .select("tld,is_popular,sort_order,active")
        .order("sort_order", { ascending: true })
        .order("tld", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Array<{ tld: string; is_popular?: boolean | null; sort_order?: number | null; active?: boolean | null }>;
    },
    staleTime: 0,
  });

  const offerQuery = useQuery({
    queryKey: ["public-popular-domain-cards", tldQuery.data],
    enabled: tldQuery.isSuccess,
    queryFn: async ({ signal }) => {
      return loadPublicDomainCards(tldQuery.data ?? [], [], (domain) =>
        callDomainMarket<PublicDomainQuote>("market_check_availability", { domain }),
        24,
        (cards) => { if (!signal.aborted) setArrivingOffers(cards); },
      );
    },
    staleTime: 0,
  });

  useLiveTableRefresh("domain_tld_pricing", () => {
    void tldQuery.refetch();
  });
  useLiveTableRefresh("domain_offers", () => {
    void offerQuery.refetch();
  });

  const offers = offerQuery.isFetching && arrivingOffers.length ? arrivingOffers : offerQuery.data ?? arrivingOffers;
  const waiting = !tldQuery.isError && (tldQuery.isLoading || offerQuery.isPending || offerQuery.isFetching);

  return (
    <div className="public-introduction min-h-screen bg-background">
      <SEO
        title="Buy a domain with live INR prices | Workly"
        description="Search a domain name and see the live price in rupees, manage DNS and forwarding from one dashboard, and see today's offers."
        keywords="buy domain india, domain search, live domain price, dns management, domain offers"
        canonical="/domains"
      />
      <PublicIntroductionHeader loginTo={LOGIN} />

      <PublicIntroductionHero
        image={domainIntro.url}
        imageFallback="https://pub-3225b45ecaf943b3b9061cd57d754bf2.r2.dev/refer-introduction.jpg"
        imageAlt="A person searching for a domain name on a laptop"
        eyebrow="DOMAINS"
        title="Find the name, see the real price."
        subtitle="Search any name and the live rupee price appears before you sign up."
        description="One place to search, buy, and run a domain — live pricing, DNS and forwarding control, and protection that comes with it."
      >
        <Button asChild className="h-11 flex-1 px-6 text-sm font-bold whitespace-nowrap sm:flex-none">
          <Link to={SIGNUP}>
            Create an account <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-11 flex-1 border-white/60 bg-white/10 text-white hover:bg-white/20 whitespace-nowrap sm:flex-none">
          <a href="#today-offers">See today's offers</a>
        </Button>
      </PublicIntroductionHero>

      <main className="mx-auto max-w-5xl px-4 py-12 sm:py-16">
        <section id="what-you-get" className="mb-14">
          <p className="text-xs font-black tracking-[0.18em] text-primary">WHAT YOU GET</p>
          <h2 className="mt-2 text-2xl font-black sm:text-3xl">Search, buy, and run it yourself.</h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {INCLUDED.map(([Icon, title, description]) => (
              <div key={title} className="rounded-xl border border-border/70 bg-card p-5">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <p className="mt-3 text-sm font-bold text-foreground">{title}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="today-offers" className="mb-14 scroll-mt-24">
          <p className="text-xs font-black tracking-[0.18em] text-primary">TODAY'S OFFERS</p>
          <h2 className="mt-2 text-2xl font-black sm:text-3xl">Names on a price for today.</h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            Live purchase and renewal prices for available names, in rupees. Prices can change until checkout.
          </p>
          {(tldQuery.isError || offerQuery.isError) && offers.length === 0 ? (
            <div className="mt-6 flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <span>Today's offers could not be loaded. Please try again after some time.</span>
            </div>
          ) : offers.length === 0 && !waiting ? (
            <div className="mt-6 rounded-xl border border-border/70 bg-card p-5 text-sm text-muted-foreground">
              There is no special offer right now. Search a name and its live price will still be quoted.
            </div>
          ) : (
            <div aria-busy={waiting} aria-label="Domain prices" className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {offers.map((offer) => (
                <div
                  key={offer.domain}
                  className="min-h-24 min-w-0 rounded-lg border border-border/70 bg-card p-4 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-500"
                >
                  <p className="break-words text-base font-black text-foreground">
                    {offer.domain}
                  </p>
                  <p className="mt-1 text-sm font-bold text-primary">
                    {formatMoney(offer.price ?? 0, offer.currency)}
                    <span className="ml-1 text-xs font-normal text-muted-foreground">/ {offer.period_years ?? 1} year{(offer.period_years ?? 1) > 1 ? "s" : ""}</span>
                  </p>
                  {offer.renewal_price != null ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Renews at {formatMoney(offer.renewal_price, offer.currency)}/year
                    </p>
                  ) : <p className="mt-0.5 text-xs text-muted-foreground">Renewal price not yet available</p>}
                </div>
              ))}
              {waiting && Array.from({ length: Math.max(0, 24 - offers.length) }, (_, index) => (
                <div key={`pending-${index}`} aria-hidden="true" className="min-h-24 rounded-lg border border-border/70 bg-card p-4">
                  <Skeleton className="h-5 w-3/4 motion-reduce:animate-none" />
                  <Skeleton className="mt-2 h-4 w-1/2 motion-reduce:animate-none" />
                  <Skeleton className="mt-2 h-3 w-2/3 motion-reduce:animate-none" />
                </div>
              ))}
            </div>
          )}
        </section>

        <section id="questions" className="mb-14 scroll-mt-24">
          <p className="text-xs font-black tracking-[0.18em] text-primary">QUESTIONS</p>
          <h2 className="mt-2 text-2xl font-black sm:text-3xl">Before you buy.</h2>
          <div className="mt-6 space-y-3">
            {FAQS.map(([question, answer]) => (
              <Faq key={question} question={question} answer={answer} />
            ))}
          </div>
          <ul className="mt-6 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
            {[
              "Live price before you sign up",
              "Rupee billing",
              "DNS and forwarding you control",
              "Invoice in your dashboard",
            ].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <Check className="h-4 w-4 shrink-0 text-primary" />
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-border/70 bg-primary/5 p-6 text-center sm:p-8">
          <h2 className="text-xl font-black sm:text-2xl">Ready to own the name?</h2>
          <p className="mx-auto mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            Make an account, search the name, and buy it with the live price shown at checkout.
          </p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button asChild className="h-11 whitespace-nowrap px-6 text-sm font-bold">
              <Link to={SIGNUP}>
                Create an account <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-11 whitespace-nowrap px-6 text-sm font-bold">
              <Link to={LOGIN}>Sign in</Link>
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
}
