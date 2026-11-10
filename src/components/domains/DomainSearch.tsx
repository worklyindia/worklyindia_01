import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, RefreshCw, ShoppingCart, Loader2, ArrowRight, Info, Check } from "lucide-react";
import { toast } from "sonner";
import {
  callDomainMarket,
  formatMoney,
  type DomainResult,
} from "@/hooks/useDomainMarket";
import DomainResultRow from "./DomainResultRow";
import { useDomainCart } from "./useDomainCart";
import { useProtectionPricePerYear } from "./useProtectionPrice";
import { supabase } from "@/integrations/supabase/client";

interface SearchResponse {
  results: DomainResult[];
  sales_enabled: boolean;
  currency: string;
}

// Keyword variants used to keep the endless scroll fed with fresh,
// server-priced results (each round is a real availability search).
const PREFIXES = ["get", "try", "my", "go", "join", "hire"];
const SUFFIXES = ["hq", "app", "hub", "now", "india", "online", "pro", "team"];
const MAX_ROUNDS = 6;

const TRUST_ITEMS = [
  "🧾 Live registrar pricing",
  "⚡ Instant registration",
  "🔒 Secure checkout",
  "↻ Easy renewal",
  "🛡️ Free WHOIS privacy",
  "💬 24×7 support",
];

const DomainSearch = () => {
  const cart = useDomainCart();
  const protectionPerYear = useProtectionPricePerYear();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [results, setResults] = useState<DomainResult[]>([]);
  const [searchedTerm, setSearchedTerm] = useState("");
  const [searched, setSearched] = useState(false);

  const variantsRef = useRef<string[]>([]);
  const seenRef = useRef<Set<string>>(new Set());
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const autoRan = useRef(false);

  const search = async (termOverride?: string) => {
    const term = (termOverride ?? query).trim().toLowerCase();
    if (!term) {
      toast.error("Please enter a domain or keyword to search.");
      return;
    }
    const root = (term.includes(".") ? term.split(".")[0] : term).replace(/[^a-z0-9-]/g, "");
    if (!root) {
      toast.error("Please enter a valid keyword.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setResults([]);
    seenRef.current = new Set();
    variantsRef.current = [];

    try {
      const res = await callDomainMarket<SearchResponse>("search", { query: term });
      const list = res.results ?? [];
      list.forEach((r) => r.domain && seenRef.current.add(r.domain));
      setResults(list);

      const variants: string[] = [];
      for (let i = 0; i < MAX_ROUNDS; i += 1) {
        variants.push(
          i % 2 === 0
            ? `${PREFIXES[i % PREFIXES.length]}${root}`
            : `${root}${SUFFIXES[i % SUFFIXES.length]}`,
        );
      }
      variantsRef.current = variants;
    } catch (e: any) {
      setErrorMsg(e?.message || "Domain search failed. Please try again.");
    } finally {
      setLoading(false);
      setSearched(true);
      setSearchedTerm(term);
    }
  };

  // Pre-fill results with the employer's saved company name, without ever
  // putting that name inside the visible search box.
  useEffect(() => {
    if (autoRan.current) return;
    autoRan.current = true;
    let cancelled = false;
    (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        if (!auth?.user) return;
        const { data } = await supabase
          .from("companies")
          .select("company_name")
          .eq("user_id", auth.user.id)
          .maybeSingle();
        const name = (data?.company_name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        if (!name || cancelled) return;
        await search(name);
      } catch {
        /* silent — auto suggestion is best effort */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const appendVariant = useCallback(
    async (variant: string) => {
      setLoadingMore(true);
      try {
        const res = await callDomainMarket<SearchResponse>("search", { query: variant });
        const fresh = (res.results ?? []).filter((r) => r.domain && !seenRef.current.has(r.domain));
        fresh.forEach((r) => seenRef.current.add(r.domain));
        if (fresh.length) setResults((prev) => prev.concat(fresh));
      } catch {
        variantsRef.current = [];
      } finally {
        setLoadingMore(false);
      }
    },
    [],
  );

  const loadMore = useCallback(async () => {
    if (loadingMore || loading) return;
    const variant = variantsRef.current.shift();
    if (!variant) return;
    await appendVariant(variant);
  }, [loading, loadingMore, appendVariant]);

  // Endless scroll — fetch the next priced batch as the sentinel appears.
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !results.length || loading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: "400px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [results.length, loading, loadMore]);

  // Exact match = the full domain the user typed (when it had a dot).
  const exact =
    searched && searchedTerm.includes(".") ? results.find((r) => r.domain === searchedTerm) : undefined;
  const exactTaken = !!exact && !exact.available;
  // When the exact name is taken, feature the best available alternative.
  const featured = exactTaken ? results.find((r) => r.available && r.price != null) : undefined;
  const listResults = featured ? results.filter((r) => r.domain !== featured.domain) : results;

  const addFeatured = () => {
    if (!featured) return;
    if (cart.purchaseLocked) {
      toast.info("Domain purchases are currently unavailable. Please check back soon.");
      return;
    }
    cart.add({
      domain: featured.domain,
      tld: featured.tld,
      price: featured.price,
      renewal_price: featured.renewal_price,
      currency: featured.currency,
    });
    if (!cart.affiliateMode) toast.success(`${featured.domain} added to cart`);
  };

  return (
    <div className="space-y-5">
      {/* Hero — headline + search */}
      <section className="space-y-4 pt-1 text-center">
        <h2 className="text-2xl font-extrabold tracking-tight sm:text-4xl">Find your domain name</h2>
        <div className="mx-auto flex h-14 w-full max-w-xl items-center gap-2 rounded-full border border-input bg-background pl-5 pr-2 shadow-sm focus-within:ring-2 focus-within:ring-ring">
          <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
            placeholder="Find a domain for your startup"
            className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            aria-label="Find a domain"
          />
          <Button
            onClick={() => search()}
            disabled={loading}
            size="icon"
            className="h-10 w-10 shrink-0 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
            aria-label="Search"
          >
            {loading ? <RefreshCw className="h-5 w-5 animate-spin" /> : <ArrowRight className="h-5 w-5" />}
          </Button>
        </div>

        {/* Continuously scrolling trust strip */}
        <div className="domain-trust-strip relative w-full overflow-hidden">
          <div className="domain-trust-track text-[11px] font-medium text-muted-foreground sm:text-xs">
            {[0, 1, 2].map((dup) => (
              <div key={dup} className="domain-trust-group" aria-hidden={dup !== 0}>
                {TRUST_ITEMS.map((t) => (
                  <span key={`${dup}-${t}`} className="domain-trust-item">
                    <span>{t}</span>
                    <span aria-hidden="true" className="px-3 text-border">•</span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {loading && (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      )}

      {!loading && errorMsg && !results.length && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-border p-6 text-center">
          <p className="text-sm text-muted-foreground">{errorMsg}</p>
          <Button variant="outline" onClick={() => search()}>
            <RefreshCw className="mr-2 h-4 w-4" /> Retry
          </Button>
        </div>
      )}

      {/* Exact domain taken → notice + featured alternative */}
      {!loading && exactTaken && (
        <div className="flex items-start gap-2 rounded-xl bg-muted p-4 text-sm">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <p>
            <span className="font-semibold">{searchedTerm}</span> is already taken.
            {featured ? " We found a great alternative just for you!" : " Try one of the options below."}
          </p>
        </div>
      )}

      {!loading && searched && featured && (
        <div className="space-y-3 rounded-2xl border-2 border-primary/15 bg-muted/40 p-5">
          <Badge className="bg-emerald-600 hover:bg-emerald-600">Great alternative</Badge>
          <p className="text-xl font-bold sm:text-2xl">{featured.domain}</p>
            <div className="space-y-0.5">
            <p className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-2xl font-extrabold">
                {formatMoney(featured.price ?? 0, featured.currency)}
                <span className="text-sm font-medium text-muted-foreground">
                  /{(featured.period_years ?? 1)}yr{(featured.period_years ?? 1) > 1 ? "s" : ""}
                </span>
              </span>
              {featured.renewal_price && featured.renewal_price > (featured.price ?? 0) ? (
                <>
                  <span className="text-sm text-muted-foreground line-through">
                    {formatMoney(featured.renewal_price, featured.currency)}
                  </span>
                  <span className="text-xs font-semibold text-emerald-600">
                    {Math.round(
                      ((featured.renewal_price - (featured.price ?? 0)) / featured.renewal_price) * 100,
                    )}
                    % off
                  </span>
                </>
              ) : null}
            </p>
            {featured.renewal_price ? (
              <p className="text-xs text-muted-foreground">
                Renews at {formatMoney(featured.renewal_price, featured.currency)}
                /{(featured.period_years ?? 1)}yr{(featured.period_years ?? 1) > 1 ? "s" : ""}
              </p>
            ) : null}
            {featured.renewal_price && featured.renewal_price > (featured.price ?? 0) ? (
              <p className="text-xs font-semibold text-emerald-600">
                You save {formatMoney(featured.renewal_price - (featured.price ?? 0), featured.currency)} · 🎉
                Enjoy!
              </p>
            ) : null}
            {protectionPerYear > 0 ? (
              <p className="text-xs text-muted-foreground">
                🛡️ Full Domain Protection {formatMoney(protectionPerYear, featured.currency)}/1yr
              </p>
            ) : null}
          </div>
          <Button className="h-11 w-full" onClick={addFeatured} disabled={cart.has(featured.domain)}>
            {cart.has(featured.domain) ? (
              <>
                <Check className="mr-2 h-4 w-4" /> In your cart
              </>
            ) : (
              <>
                <ShoppingCart className="mr-2 h-4 w-4" />
                Make it yours
              </>
            )}
          </Button>
        </div>
      )}

      {!loading && searched && results.length > 0 && (
        <section>
          <div className="space-y-3">
            {listResults.map((r) => (
              <DomainResultRow key={r.domain} item={r} />
            ))}

          </div>


          <div ref={sentinelRef} className="h-12" />
          {loadingMore && (
            <div className="flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading more domains…
            </div>
          )}
        </section>
      )}

      {!loading && !errorMsg && searched && results.length === 0 && (
        <div className="rounded-xl border border-border p-6 text-center text-sm text-muted-foreground">
          No domains matched that search. Try a different keyword.
        </div>
      )}
    </div>
  );
};

export default DomainSearch;
