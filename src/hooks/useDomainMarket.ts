import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Thin client for the domain marketplace API. The marketplace is merged into
 * the already-deployed `check-api-health` edge function (no separate
 * `domain-market` deployment). The browser never sees GoDaddy credentials,
 * supplier cost or profit — the function returns selling prices only.
 *
 * Note: the priced availability check is `market_check_availability` — the
 * bare `check_availability` action belongs to the domain-management API.
 */
export async function callDomainMarket<T = any>(
  action: string,
  payload: Record<string, unknown> = {},
): Promise<T> {
  const { data, error } = await supabase.functions.invoke("check-api-health", {
    body: { action, ...payload },
  });

  if (error) {
    let message = "We couldn't reach the domain service. Please try again.";
    try {
      const ctx: any = (error as any).context;
      if (ctx && typeof ctx.json === "function") {
        const body = await ctx.json();
        if (body?.error) message = body.error;
      }
    } catch {
      /* keep fallback */
    }
    throw new Error(message);
  }

  if (data && (data as any).error) throw new Error((data as any).error);
  return data as T;
}

export interface Storefront {
  sales_enabled: boolean;
  currency: string;
  offer_badge_text: string;
  popular_tlds: string[];
  tlds: string[];
}

let storefrontPromise: Promise<Storefront> | null = null;

/** Storefront config is fetched once per page load and shared by every section. */
export function getStorefront(): Promise<Storefront> {
  if (!storefrontPromise) {
    storefrontPromise = callDomainMarket<Storefront>("storefront").catch((e) => {
      storefrontPromise = null;
      throw e;
    });
  }
  return storefrontPromise;
}

export function useDomainMarket() {
  const [loading, setLoading] = useState(false);

  const run = useCallback(async <T,>(action: string, payload: Record<string, unknown> = {}): Promise<T> => {
    setLoading(true);
    try {
      return await callDomainMarket<T>(action, payload);
    } finally {
      setLoading(false);
    }
  }, []);

  return { run, loading };
}

/** Formats a selling price the Indian way: ₹2,000 / ₹1,00,000 */
export const formatMoney = (amount: number, currency = "INR"): string =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(
    Math.round(Number(amount) || 0),
  );

/** Public WHOIS/RDAP facts, returned only for domains that are already taken. */
export interface DomainWhois {
  registrar?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  expires_at?: string | null;
  age_years?: number | null;
  status?: string[];
  nameservers?: string[];
}

/** Owner-configured "₹X first year on an N-year term" offer. */
export interface TermOffer {
  min_years: number;
  /** How many years of the term are sold at the promo price. */
  discount_years?: number;
  first_year_price: number;
  /** True when the term currently priced actually received the offer price. */
  applied: boolean;
  /** Regular selling price of one discounted year, before the offer. */
  regular_first_year_price?: number | null;
  /** Total for the term under the offer (only when applied). */
  term_total: number | null;
  /** True when the offer had to be raised to stay within the loss limit. */
  limited_by_cost: boolean;
}

export interface DomainResult {
  domain: string;
  available: boolean;
  tld?: string;
  /** Years the quoted first payment covers (GoDaddy's own minimum term). */
  period_years?: number;
  price?: number;
  renewal_price?: number | null;
  currency?: string;
  whois?: DomainWhois | null;
  term_offer?: TermOffer | null;
}

export interface DomainOffer {
  domain: string;
  tld: string;
  price: number;
  renewal_price: number | null;
  is_promo: boolean;
  currency: string;
}
