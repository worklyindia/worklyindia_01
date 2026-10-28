import { useNavigate } from "react-router-dom";
import { Globe, Search, ShieldCheck, Zap, Settings2, ArrowRight } from "lucide-react";
import { useAnimatedPlaceholder } from "@/hooks/useAnimatedPlaceholder";

const TLDS = [
  ".com", ".in", ".co.in", ".online", ".store", ".tech", ".net", ".org",
  ".xyz", ".shop", ".site", ".info", ".app", ".io", ".co", ".biz",
  ".website", ".space", ".live", ".digital", ".cloud", ".dev",
];

const domainPlaceholders = [
  "Search yourname.com...",
  "Find mybusiness.in...",
  "Try mybrand.online...",
  "Get mystore.shop...",
  "Search portfolio.tech...",
];

const HomeDomainSection = () => {
  const navigate = useNavigate();
  const placeholder = useAnimatedPlaceholder(domainPlaceholders);
  const openDomains = () => navigate("/domains");
  const loop = [...TLDS, ...TLDS];

  return (
    <section
      className="relative overflow-x-clip py-8 px-5 sm:px-7"
      aria-label="Buy a domain"
    >

      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-2 text-primary">
          <Globe className="h-5 w-5" />
          <span className="text-xs font-semibold uppercase tracking-wider">Domains</span>
        </div>
        <button
          onClick={openDomains}
          className="flex items-center gap-1 text-xs font-semibold text-primary"
        >
          View all <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
      <h2 className="relative mt-2 text-lg sm:text-2xl font-bold">Get your own website domain</h2>
      <p className="relative mt-1 truncate text-sm text-muted-foreground">
        Find and buy the perfect domain for your brand.
      </p>

      <button
        type="button"
        onClick={openDomains}
        aria-label="Search domain name"
        className="relative mt-4 flex h-[46px] w-full items-center gap-3 rounded-2xl border border-border/50 bg-muted/40 px-4 text-left shadow-sm transition hover:border-primary/40"
      >
        <Search className="h-5 w-5 shrink-0 text-primary" />
        <span className="truncate text-base text-muted-foreground">{placeholder}</span>
      </button>

      <div
        className="relative mt-3 left-1/2 w-screen -translate-x-1/2 overflow-hidden"
      >
        <div className="flex w-max animate-marquee-x [animation-duration:20s] hover:[animation-play-state:paused]">
          {loop.map((t, i) => (
            <button
              key={`${t}-${i}`}
              onClick={() => navigate(`/domains?q=${encodeURIComponent("myname" + t)}`)}
              className="mr-2 shrink-0 whitespace-nowrap rounded-full border bg-background/70 px-3 py-1 text-xs font-medium hover:border-primary hover:text-primary transition"
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="relative mt-4 grid grid-cols-3 gap-2 text-center">
        {[
          { icon: Zap, label: "Instant setup" },
          { icon: ShieldCheck, label: "Free SSL" },
          { icon: Settings2, label: "Easy DNS" },
        ].map(({ icon: Icon, label }) => (
          <div key={label} className="rounded-xl border border-border/40 bg-background/60 p-2.5">
            <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
              <Icon className="h-4 w-4 text-primary" />
            </div>
            <p className="mt-1.5 text-[11px] font-medium">{label}</p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default HomeDomainSection;
