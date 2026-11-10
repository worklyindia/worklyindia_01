import { useEffect, useState } from "react";
import { callDomainApi } from "@/hooks/useGoDaddy";

const STORAGE_KEY = "usd_inr_rate_v1";
const FALLBACK_RATE = 88;
/** Google's currency card moves intraday, so a cached rate is short-lived. */
const CACHE_TTL_MS = 15 * 60 * 1000;

const today = () => new Date().toISOString().slice(0, 10);

type Cached = { rate?: number; day?: string; at?: number };

const readCache = (): Cached | null => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
  } catch {
    return null;
  }
};

/**
 * USD -> INR conversion rate. The rate is fetched server-side (edge function,
 * Google-anchored) and cached in localStorage for a few minutes only, so the
 * price list never blocks on the network yet never shows a stale rate that
 * disagrees with Google.
 */
export function useUsdInrRate() {
  const [rate, setRate] = useState<number>(() => {
    const cached = readCache();
    return cached?.rate ? Number(cached.rate) : FALLBACK_RATE;
  });

  useEffect(() => {
    let cancelled = false;
    const cached = readCache();
    const freshEnough =
      cached?.rate && cached.day === today() && !!cached.at && Date.now() - cached.at < CACHE_TTL_MS;
    if (freshEnough) return;

    (async () => {
      try {
        const res = await callDomainApi<{ rate: number; day: string }>("usd_inr_rate");
        if (!cancelled && res?.rate) {
          setRate(res.rate);
          localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ rate: res.rate, day: res.day || today(), at: Date.now() }),
          );
        }
      } catch {
        /* keep cached / fallback rate */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return rate;
}

/** Formats an amount in INR the Indian way: ₹2,000 / ₹1,00,000 */
export const formatInr = (amount: number): string =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
