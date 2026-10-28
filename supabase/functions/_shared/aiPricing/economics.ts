// Business economics context for the AI Auto Price Manager.
//
// Gives the AI a factual picture of the business — demand, revenue, usage and
// how past pricing decisions performed — WITHOUT ever letting that data relax a
// safety rule. Every number here is advisory only: the loss-protection engine
// still decides the final price.
//
// Missing / thin data is never extrapolated. When a signal cannot be read or is
// statistically thin, it is reported as `data_quality: "insufficient"` and the
// prompt instructs the AI to stay conservative (no price cuts, no new plans,
// no free offers) for that module.

const MIN_SAMPLE = 10;

export interface ModuleEconomics {
  module: string;
  window_days: number;
  /** Paid transactions in the window (null = unavailable). */
  sales_30d: number | null;
  sales_90d: number | null;
  /** Gross revenue in INR (or points, for points-priced modules). */
  revenue_30d: number | null;
  revenue_90d: number | null;
  /** Extra module-specific usage facts (avg interview minutes, plan mix…). */
  usage: Record<string, unknown>;
  /** Applied price history from our own audit log, newest first. */
  price_history: Array<{
    item: string | null;
    old_price: number | null;
    new_price: number | null;
    cost_inr: number | null;
    margin_percent: number | null;
    at: string;
  }>;
  /** Loss / low-margin findings from the last 90 days of audit rows. */
  profitability: {
    items_evaluated: number;
    unsafe_items: number;
    low_margin_items: number;
    avg_margin_percent: number | null;
    loss_making_items: string[];
  };
  data_quality: "sufficient" | "insufficient";
  notes: string[];
}

const safe = async <T>(fn: () => Promise<T>, fallback: T): Promise<T> => {
  try {
    return await fn();
  } catch {
    return fallback;
  }
};

const sum = (rows: any[], field: string) =>
  rows.reduce((t: any, r: any) => t + (Number(r?.[field]) || 0), 0);

const sinceIso = (days: number) => new Date(Date.now() - days * 86400_000).toISOString();

/** Demand + revenue per module, read from the real transaction tables. */
async function loadDemand(
  supabase: any,
  module: string,
): Promise<{
  sales30: number | null;
  sales90: number | null;
  rev30: number | null;
  rev90: number | null;
  usage: Record<string, unknown>;
  notes: string[];
}> {
  const notes: string[] = [];
  const d30 = sinceIso(30);
  const d90 = sinceIso(90);
  const empty = { sales30: null, sales90: null, rev30: null, rev90: null, usage: {}, notes };

  switch (module) {
    case "job_boost": {
      const rows = await safe(async () => {
        const { data } = await supabase
          .from("job_boosts")
          .select("amount_paid,created_at,status")
          .gte("created_at", d90)
          .limit(5000);
        return data ?? null;
      }, null as any[] | null);
      if (!rows) return { ...empty, notes: [...notes, "job_boosts unavailable"] };
      const paid = rows.filter((r: any) => ["completed", "active", "success", "paid"].includes(String(r.status)));
      const p30 = paid.filter((r: any) => r.created_at >= d30);
      return {
        sales30: p30.length,
        sales90: paid.length,
        rev30: sum(p30, "amount_paid"),
        rev90: sum(paid, "amount_paid"),
        usage: {},
        notes,
      };
    }

    case "job_posting":
    case "job_renewal": {
      const rows = await safe(async () => {
        const { data } = await supabase
          .from("job_payments")
          .select("points_spent,payment_type,created_at")
          .gte("created_at", d90)
          .limit(5000);
        return data ?? null;
      }, null as any[] | null);
      if (!rows) return { ...empty, notes: [...notes, "job_payments unavailable"] };
      const match = module === "job_renewal"
        ? rows.filter((r: any) => /renew|extend/i.test(String(r.payment_type ?? "")))
        : rows.filter((r: any) => !/renew|extend/i.test(String(r.payment_type ?? "")));
      const m30 = match.filter((r: any) => r.created_at >= d30);
      return {
        sales30: m30.length,
        sales90: match.length,
        rev30: sum(m30, "points_spent"),
        rev90: sum(match, "points_spent"),
        usage: { unit: "points" },
        notes,
      };
    }

    case "ai_chat_plan": {
      const rows = await safe(async () => {
        const { data } = await supabase
          .from("ai_chat_subscriptions")
          .select("plan_id,status,created_at")
          .gte("created_at", d90)
          .limit(5000);
        return data ?? null;
      }, null as any[] | null);
      if (!rows) return { ...empty, notes: [...notes, "ai_chat_subscriptions unavailable"] };
      const r30 = rows.filter((r: any) => r.created_at >= d30);
      const mix: Record<string, number> = {};
      for (const r of rows) mix[String(r.plan_id)] = (mix[String(r.plan_id)] ?? 0) + 1;
      const active = rows.filter((r: any) => String(r.status) === "active").length;
      return {
        sales30: r30.length,
        sales90: rows.length,
        rev30: null,
        rev90: null,
        usage: { active_subscriptions: active, subscriptions_by_plan_id: mix },
        notes,
      };
    }

    case "interview": {
      const rows = await safe(async () => {
        const { data } = await supabase
          .from("interviews")
          .select("points_spent,meeting_duration_seconds,total_participants,recording_enabled,created_at")
          .gte("created_at", d90)
          .limit(5000);
        return data ?? null;
      }, null as any[] | null);
      if (!rows) return { ...empty, notes: [...notes, "interviews unavailable"] };
      const r30 = rows.filter((r: any) => r.created_at >= d30);
      const withDuration = rows.filter((r: any) => Number(r.meeting_duration_seconds) > 0);
      const avgMinutes = withDuration.length
        ? Math.round((sum(withDuration, "meeting_duration_seconds") / withDuration.length / 60) * 10) / 10
        : null;
      if (avgMinutes == null) notes.push("no completed interview durations yet — using documented usage assumption");
      return {
        sales30: r30.length,
        sales90: rows.length,
        rev30: sum(r30, "points_spent"),
        rev90: sum(rows, "points_spent"),
        usage: {
          avg_actual_minutes: avgMinutes,
          measured_interviews: withDuration.length,
          recording_share: rows.length
            ? Math.round((rows.filter((r: any) => r.recording_enabled).length / rows.length) * 100)
            : null,
        },
        notes,
      };
    }

    default:
      return { ...empty, notes: [...notes, "no transaction source mapped for this module"] };
  }
}

/** Our own audit log = the ground truth for how earlier decisions performed. */
async function loadPricingHistory(supabase: any, module: string) {
  const rows = await safe(async () => {
    const { data } = await supabase
      .from("ai_pricing_audit_log")
      .select("item_name,old_price,new_price,cost_inr,margin_percent,applied,safe,created_at")
      .eq("module", module)
      .gte("created_at", sinceIso(90))
      .order("created_at", { ascending: false })
      .limit(400);
    return data ?? [];
  }, [] as any[]);

  const applied = rows.filter((r: any) => r.applied === true).slice(0, 10).map((r: any) => ({
    item: r.item_name ?? null,
    old_price: r.old_price == null ? null : Number(r.old_price),
    new_price: r.new_price == null ? null : Number(r.new_price),
    cost_inr: r.cost_inr == null ? null : Number(r.cost_inr),
    margin_percent: r.margin_percent == null ? null : Number(r.margin_percent),
    at: String(r.created_at),
  }));

  const margins = rows.map((r: any) => Number(r.margin_percent)).filter((n: any) => Number.isFinite(n));
  const unsafe = rows.filter((r: any) => r.safe === false);
  const lossMaking = [
    ...new Set<string>(
      rows
        .filter((r: any) => Number.isFinite(Number(r.margin_percent)) && Number(r.margin_percent) <= 0)
        .map((r: any) => String(r.item_name ?? "unnamed")),
    ),
  ].slice(0, 10);

  return {
    price_history: applied,
    profitability: {
      items_evaluated: rows.length,
      unsafe_items: unsafe.length,
      low_margin_items: margins.filter((m: any) => m > 0 && m < 10).length,
      avg_margin_percent: margins.length
        ? Math.round((margins.reduce((a: any, b: any) => a + b, 0) / margins.length) * 10) / 10
        : null,
      loss_making_items: lossMaking,
    },
  };
}

export async function loadModuleEconomics(supabase: any, module: string): Promise<ModuleEconomics> {
  const [demand, history] = await Promise.all([
    loadDemand(supabase, module),
    loadPricingHistory(supabase, module),
  ]);

  const sufficient = (demand.sales90 ?? 0) >= MIN_SAMPLE;
  const notes = [...demand.notes];
  if (!sufficient) {
    notes.push(
      "Thin/absent demand data — treat every demand-based conclusion as unknown and stay conservative (no price cuts, no new plans, no free offers).",
    );
  }

  return {
    module,
    window_days: 90,
    sales_30d: demand.sales30,
    sales_90d: demand.sales90,
    revenue_30d: demand.rev30,
    revenue_90d: demand.rev90,
    usage: demand.usage,
    ...history,
    data_quality: sufficient ? "sufficient" : "insufficient",
    notes,
  };
}

/** Compact, prompt-friendly rendering of the economics block. */
export function economicsPromptBlock(e: ModuleEconomics): string {
  const lines = [
    `Business economics (last ${e.window_days} days, advisory only — safety rules still win):`,
    `- paid transactions: 30d=${e.sales_30d ?? "unknown"}, 90d=${e.sales_90d ?? "unknown"}`,
    `- gross revenue: 30d=${e.revenue_30d ?? "unknown"}, 90d=${e.revenue_90d ?? "unknown"}`,
    `- usage facts: ${JSON.stringify(e.usage)}`,
    `- past applied price changes: ${
      e.price_history.length
        ? e.price_history
          .map((h: any) => `${h.item ?? "item"} ${h.old_price}→${h.new_price} (margin ${h.margin_percent ?? "?"}%)`)
          .join("; ")
        : "none"
    }`,
    `- profitability: evaluated=${e.profitability.items_evaluated}, unsafe=${e.profitability.unsafe_items}, low-margin=${e.profitability.low_margin_items}, avg margin=${
      e.profitability.avg_margin_percent ?? "unknown"
    }%${
      e.profitability.loss_making_items.length ? `, loss-making: ${e.profitability.loss_making_items.join(", ")}` : ""
    }`,
    `- data quality: ${e.data_quality}`,
    ...e.notes.map((n: any) => `- note: ${n}`),
  ];
  return lines.join("\n");
}
