import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Thin client for the domain API, served by the `check-api-health` edge function
 * (the GoDaddy handler is merged into that already-deployed function).
 * The browser never talks to GoDaddy directly and never sees the access token.
 */
export async function callDomainApi<T = any>(
  action: string,
  payload: Record<string, unknown> = {},
): Promise<T> {
  const { data, error } = await supabase.functions.invoke("check-api-health", {
    body: { action, ...payload },
  });

  if (error) {
    // Prefer the friendly message returned by the function body when present.
    const fallback = "We couldn't reach the domain service. Please try again.";
    let message = fallback;
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

export function useDomainApi() {
  const [loading, setLoading] = useState(false);

  const run = useCallback(
    async <T,>(action: string, payload: Record<string, unknown> = {}): Promise<T> => {
      setLoading(true);
      try {
        return await callDomainApi<T>(action, payload);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return { run, loading };
}
