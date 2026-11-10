import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Shared owner-set Full Domain Protection price (per year, INR).
 * Fetched once per page load and shared by the search results, the cart and
 * checkout — so the ₹/yr shown before checkout always matches checkout.
 */
let cached: number | null = null;
let pending: Promise<number> | null = null;

export function getProtectionPricePerYear(): Promise<number> {
  if (cached != null) return Promise.resolve(cached);
  if (!pending) {
    pending = (async () => {
      try {
        const { data } = await supabase
          .from("domain_pricing_settings")
          .select("protection_price_per_year")
          .maybeSingle();
        cached = Math.max(0, Number(data?.protection_price_per_year ?? 0) || 0);
        return cached;
      } catch {
        return 0;
      } finally {
        pending = null;
      }
    })();
  }
  return pending;
}

export function useProtectionPricePerYear(): number {
  const [price, setPrice] = useState(cached ?? 0);
  useEffect(() => {
    let active = true;
    getProtectionPricePerYear().then((p) => {
      if (active) setPrice(p);
    });
    return () => {
      active = false;
    };
  }, []);
  return price;
}
