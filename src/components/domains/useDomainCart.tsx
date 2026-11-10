import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { callDomainMarket } from "@/hooks/useDomainMarket";
import { domainPurchaseMode, openAffiliate } from "./affiliate";

/** A domain the customer has added to the cart, with the price info shown when it was added. */
export interface CartItem {
  domain: string;
  tld?: string;
  price?: number;
  renewal_price?: number | null;
  currency?: string;
}

interface DomainCartContextValue {
  items: CartItem[];
  add: (item: CartItem) => void;
  remove: (domain: string) => void;
  clear: () => void;
  has: (domain: string) => boolean;
  /** True when selling is off and a GoDaddy affiliate link is configured. */
  affiliateMode: boolean;
  purchaseLocked: boolean;
  checkoutEnabled: boolean;
}

const DomainCartContext = createContext<DomainCartContextValue | null>(null);

export const DomainCartProvider = ({ children }: { children: ReactNode }) => {
  const [items, setItems] = useState<CartItem[]>([]);
  const [affiliateUrl, setAffiliateUrl] = useState<string>("");
  const [salesEnabled, setSalesEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    callDomainMarket<{ sales_enabled?: boolean; affiliate_url?: string | null }>("storefront")
      .then((res) => {
        if (!alive) return;
        // Selling on = normal cart. Selling off = affiliate fallback.
        setSalesEnabled(res.sales_enabled === true);
        setAffiliateUrl(String(res.affiliate_url ?? "").trim());
      })
      .catch(() => {
        /* Storefront unavailable: purchases remain locked. */
      });
    return () => {
      alive = false;
    };
  }, []);

  const mode = domainPurchaseMode(salesEnabled, affiliateUrl);
  const affiliateMode = mode === "affiliate";
  const purchaseLocked = mode === "locked";
  const checkoutEnabled = mode === "cart";

  const add = useCallback(
    (item: CartItem) => {
      if (purchaseLocked) return;
      if (affiliateMode) {
        const opened = openAffiliate(affiliateUrl, item.domain);
        if (opened) toast.success("Opening GoDaddy to complete your purchase…");
        return;
      }
      setItems((prev) => (prev.some((i) => i.domain === item.domain) ? prev : [...prev, item]));
    },
    [affiliateUrl, affiliateMode, purchaseLocked],
  );

  const remove = useCallback((domain: string) => {
    setItems((prev) => prev.filter((i) => i.domain !== domain));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const has = useCallback((domain: string) => items.some((i) => i.domain === domain), [items]);

  const value = useMemo(
    () => ({ items, add, remove, clear, has, affiliateMode, purchaseLocked, checkoutEnabled }),
    [items, add, remove, clear, has, affiliateMode, purchaseLocked, checkoutEnabled],
  );

  return <DomainCartContext.Provider value={value}>{children}</DomainCartContext.Provider>;
};

export const useDomainCart = (): DomainCartContextValue => {
  const ctx = useContext(DomainCartContext);
  if (!ctx) throw new Error("useDomainCart must be used inside <DomainCartProvider>");
  return ctx;
};
