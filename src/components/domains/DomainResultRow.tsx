import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatMoney, type DomainResult } from "@/hooks/useDomainMarket";
import {
  Check,
  ShoppingCart,
  Lock,
  RefreshCw,
  Sparkles,
  Globe,
} from "lucide-react";



import { toast } from "sonner";
import { useDomainCart } from "./useDomainCart";

interface DomainResultRowProps {
  item: DomainResult;
  /** True when this exact domain is one of today's curated offers. */
  promoted?: boolean;
}


const prettyStatus = (s: string) =>
  s.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\s+/g, " ").toLowerCase();

const formatWhoisDate = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(date);
};

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  clienttransferprohibited: "Transfer locked",
  clientupdateprohibited: "Update locked",
  clientrenewprohibited: "Renewal locked",
  clientdeleteprohibited: "Delete locked",
};

/** Fixed display order for lock-type statuses. */
const LOCK_ORDER = ["Delete locked", "Transfer locked", "Update locked", "Renewal locked"];

const friendlyStatus = (s: string) => {
  const key = s.replace(/\s+/g, "").toLowerCase();
  return STATUS_LABELS[key] ?? prettyStatus(s);
};

/**
 * Renders statuses compactly. With more than two lock statuses,
 * they collapse to "Delete, Transfer, Update - Locked" in fixed order
 * so it stays one line. Only statuses that actually exist are shown.
 */
const formatStatusList = (statuses: string[]) => {
  const labels = statuses.map(friendlyStatus);
  const lockedSet = new Set(labels.filter((l) => l.endsWith(" locked")));
  const others = labels.filter((l) => !l.endsWith(" locked"));

  if (lockedSet.size > 2) {
    const ordered = LOCK_ORDER.filter((l) => lockedSet.has(l)).map((l) => l.replace(" locked", ""));
    const grouped = `${ordered.join(", ")} - Locked`;
    return [...others, grouped].join(" · ");
  }

  // For one or two locks, keep them readable but still in fixed order.
  const orderedLocks = LOCK_ORDER.filter((l) => lockedSet.has(l));
  const display = others.length
    ? [...orderedLocks, ...others]
    : orderedLocks;
  return display.join(" · ");
};


/**
 * One GoDaddy-style search result card.
 *
 * Available domains show the discounted first-year price, renewal price and an
 * add-to-cart button. Taken domains are NOT hidden — they keep the same rich
 * card with a "Taken" badge, public
 * WHOIS/RDAP facts (registrar, registered/expiry dates, nameservers) and
 * ready-to-buy alternatives, so the list never looks empty or broken.
 */
const DomainResultRow = ({ item, promoted }: DomainResultRowProps) => {
  const cart = useDomainCart();
  const inCart = cart.has(item.domain);
  const currency = item.currency || "INR";
  const price = item.price ?? 0;
  const savings =
    item.available && item.renewal_price && item.renewal_price > price
      ? item.renewal_price - price
      : 0;
  const tld = item.tld || item.domain.slice(item.domain.indexOf("."));
  const years = item.period_years ?? 1;
  const periodLabel = `${years} ${years > 1 ? "years" : "year"}`;

  const whois = item.whois;
  const registeredDate = formatWhoisDate(whois?.created_at);
  const expiryDate = formatWhoisDate(whois?.expires_at);

  const addToCart = (target: DomainResult = item) => {

    if (!target.available) return;
    if (cart.purchaseLocked) {
      toast.info("Domain purchases are currently unavailable. Please check back soon.");
      return;
    }
    cart.add({
      domain: target.domain,
      tld: target.tld,
      price: target.price,
      renewal_price: target.renewal_price,
      currency: target.currency || currency,
    });
    if (!cart.affiliateMode) toast.success(`${target.domain} added to cart`);
  };

  return (
    <div
      className={`overflow-hidden rounded-xl border transition-colors ${
        item.available ? "bg-card p-4 hover:border-primary/40" : "border-dashed bg-muted/40"
      }`}
    >
      <div className={`flex items-start justify-between gap-3 ${item.available ? "" : "p-4"}`}>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="gap-1 text-[10px] font-medium uppercase">
              <Globe className="h-3 w-3" />
              {tld}
            </Badge>
            {promoted && (
              <Badge className="gap-1 text-[10px] uppercase">
                <Sparkles className="h-3 w-3" />
                Promoted
              </Badge>
            )}
            {item.available ? (
              <Badge variant="secondary" className="text-[10px] uppercase">
                Available
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1 text-[10px] uppercase text-muted-foreground">
                <Lock className="h-3 w-3" />
                Taken
              </Badge>
            )}
            {item.available && item.renewal_price && item.renewal_price > price ? (
              <Badge className="bg-emerald-600 text-[10px] uppercase hover:bg-emerald-600">
                {Math.round(((item.renewal_price - price) / item.renewal_price) * 100)}% off
              </Badge>
            ) : null}

            {!item.available && whois?.age_years ? (
              <Badge variant="outline" className="text-[10px] uppercase text-muted-foreground">
                {whois.age_years}+ yrs old
              </Badge>
            ) : null}
          </div>

          <p
            className={`break-all text-lg font-bold leading-tight sm:text-xl ${
              item.available ? "" : "text-muted-foreground line-through decoration-2"
            }`}
          >
            {item.domain}
          </p>

          {price > 0 ? (
            <div className="mt-1.5">
              <p className="flex flex-wrap items-baseline gap-x-2">
                <span
                  className={`text-xl font-bold sm:text-2xl ${item.available ? "" : "text-muted-foreground"}`}
                >
                  {formatMoney(price, currency)}
                  <span className="text-sm font-medium text-muted-foreground">
                    /{periodLabel}
                  </span>
                </span>
                {item.available && item.renewal_price && item.renewal_price > price ? (
                  <span className="text-sm text-muted-foreground line-through">
                    {formatMoney(item.renewal_price, currency)}
                  </span>
                ) : null}
              </p>


              {item.renewal_price ? (
                <p className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <RefreshCw className="h-3 w-3" />
                  Renews at {formatMoney(item.renewal_price, currency)}
                  /{periodLabel}
                </p>
              ) : null}



              {!item.available ? (
                <p className="mt-1.5 text-[10px] text-muted-foreground">🛡️ Live GoDaddy price</p>
              ) : null}
            </div>
          ) : null}



          {/* Public WHOIS details for taken domains */}
          {!item.available && whois &&
          (registeredDate || expiryDate || whois.registrar || whois.status?.length) ? (
            <div className="mt-1 space-y-0 text-left text-xs leading-5 text-muted-foreground">
              {registeredDate || expiryDate ? (
                <p>
                  {registeredDate ? (
                    <>Registered: <span className="font-medium text-foreground">{registeredDate}</span></>
                  ) : null}
                  {registeredDate && expiryDate ? <span className="mx-1.5">•</span> : null}
                  {expiryDate ? (
                    <>Expires: <span className="font-medium text-foreground">{expiryDate}</span></>
                  ) : null}
                </p>
              ) : null}
              {whois.registrar ? (
                <p>Registrar: <span className="font-medium text-foreground">{whois.registrar}</span></p>
              ) : null}
              {whois.status?.length ? (
                <p>
                  Status: <span className="font-medium text-foreground">{formatStatusList(whois.status)}</span>
                </p>
              ) : null}
            </div>
          ) : null}



        </div>


        {item.available && (
          <Button
            variant={inCart ? "default" : "outline"}
            size="icon"
            className="h-11 w-11 shrink-0 rounded-lg"
            onClick={() => addToCart()}
            disabled={inCart}
            aria-label={inCart ? `${item.domain} is in your cart` : `Add ${item.domain} to cart`}
          >
            {inCart ? <Check className="h-5 w-5" /> : <ShoppingCart className="h-5 w-5" />}
          </Button>
        )}
      </div>

      {!item.available && (
        <div className="border-t bg-muted/60 px-4 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <p className="min-w-0 text-xs font-medium text-muted-foreground">Already registered by someone else.</p>
            <Badge className="shrink-0 bg-rose-600 text-[10px] uppercase hover:bg-rose-600">Sold</Badge>
          </div>
        </div>
      )}

      {item.available && price > 0 ? (
        <div className="mt-1.5 w-full">
          {savings > 0 ? (
            <p className="text-xs font-semibold text-emerald-600 whitespace-nowrap">
              🎉 You save {formatMoney(savings, currency)}
            </p>
          ) : (
            <p className="text-[10px] text-muted-foreground">⚡ Instant registration</p>
          )}
        </div>
      ) : null}
    </div>
  );
};

export default DomainResultRow;
