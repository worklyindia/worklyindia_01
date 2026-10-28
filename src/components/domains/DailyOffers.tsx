import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ShoppingCart, Tag } from "lucide-react";
import { callDomainMarket, formatMoney, getStorefront, type DomainOffer } from "@/hooks/useDomainMarket";

/**
 * "Today's Domain Offers" — reads the server-cached daily offers table.
 * Prices come straight from GoDaddy's live rates plus the owner's flat charge.
 * reported a genuine promotion; nothing is fabricated client-side.
 */
const DailyOffers = ({ onBuy }: { onBuy: (domain: string) => void }) => {
  const [offers, setOffers] = useState<DomainOffer[]>([]);
  const [badgeText, setBadgeText] = useState("Daily Deal");
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const [o, s] = await Promise.all([
        callDomainMarket<{ offers: DomainOffer[] }>("offers"),
        getStorefront(),
      ]);
      setOffers(o.offers ?? []);
      setBadgeText(s.offer_badge_text || "Daily Deal");
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <section className="space-y-2" aria-label="Loading today's domain offers">
        <Skeleton className="h-5 w-48" />
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-64 shrink-0 rounded-lg" />
          ))}
        </div>
      </section>
    );
  }

  // Keep the page clean when offers are unavailable — search still works.
  if (failed || offers.length === 0) return null;

  // Buying always stays inside Workly India — cart + Razorpay checkout.
  const choose = (domain: string) => onBuy(domain);

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <Tag className="h-4 w-4 text-primary" />
        <h2 className="text-base font-semibold sm:text-lg">Today's Domain Offers</h2>
      </div>

      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 sm:grid sm:grid-cols-2 sm:overflow-visible lg:grid-cols-3">
        {offers.map((o) => (
          <Card key={o.domain} className="w-64 shrink-0 snap-start sm:w-auto">
            <CardContent className="flex h-full flex-col gap-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <span className="truncate font-semibold">{o.domain}</span>
                {o.is_promo && (
                  <Badge className="shrink-0 bg-emerald-600 hover:bg-emerald-600">{badgeText}</Badge>
                )}
              </div>

              <div className="space-y-0.5">
                <p className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-lg font-bold">{formatMoney(o.price, o.currency)}</span>
                  <span className="text-xs font-normal text-muted-foreground">first year</span>
                </p>
                {o.renewal_price ? (
                  <p className="text-xs text-muted-foreground">
                    Renews at 
                    {formatMoney(o.renewal_price, o.currency)}/yr
                  </p>
                ) : null}
              </div>

              <Button className="mt-auto h-10 w-full" onClick={() => choose(o.domain)}>
                <ShoppingCart className="mr-2 h-4 w-4" />
                Buy now
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
};

export default DailyOffers;
