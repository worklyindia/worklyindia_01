// AI-created plans / packages.
//
// The AI may PROPOSE a new plan; this module decides whether it is allowed to
// exist. Every proposal goes through the same loss-protection engine as an
// existing price, plus creation-specific guards:
//
//   * module must have allow_new_plans = true and auto_apply = true
//   * never on a dry run / review-only module
//   * bounded: at most max_new_plans_per_run per module per run
//   * demand data must be sufficient (no plans invented from thin data)
//   * name sanity + no duplicate name
//   * quotas/units must be finite, positive and inside documented caps
//   * not a duplicate/dominated plan (an existing plan already gives >= value
//     for <= price)
//   * cost must be computable (provider pricing available) — otherwise rejected
//   * final price = safety engine price; a loss-making plan can never be created
//
// Every proposal (created OR rejected) is written to ai_pricing_plan_proposals
// with cost, price, floor, profit, margin, GST, gateway fee and the reason.

import { decideSafePrice, type ModuleSettings } from "./engine.ts";
import { computeAiPlanCost, type RateMap } from "./providerCosts.ts";

export interface RawProposal {
  name?: unknown;
  price?: unknown;
  features?: unknown;
  reason?: unknown;
  limits?: Record<string, unknown>;
  units?: unknown;
}

export interface ProposalOutcome {
  module: string;
  name: string;
  status: "created" | "rejected";
  reason: string;
  price: number | null;
  cost_inr: number | null;
  floor_inr: number | null;
  profit_inr: number | null;
  margin_percent: number | null;
  created_item_id: string | null;
  proposal: Record<string, unknown>;
  details: Record<string, unknown>;
}

export const num = (v: unknown, fallback = NaN): number => {
  const n = typeof v === "string" ? Number(v) : (v as number);
  return typeof n === "number" && Number.isFinite(n) ? n : fallback;
};

export const cleanName = (v: unknown): string | null => {
  const name = String(v ?? "").trim().replace(/\s+/g, " ");
  if (name.length < 3 || name.length > 40) return null;
  if (!/^[A-Za-z0-9][A-Za-z0-9 +&/.'-]*$/.test(name)) return null;
  return name;
};

export const cleanFeatures = (v: unknown): string[] =>
  (Array.isArray(v) ? v : [])
    .map((f) => String(f ?? "").trim().slice(0, 120))
    .filter((f) => f.length > 2)
    .slice(0, 8);

export interface Capability {
  /** Existing active listing rows: name, price (module unit), comparable value vector. */
  existing: Array<{ name: string; price: number; value: Record<string, number> }>;
  /** Normalise + validate the AI proposal; returns the value vector and cost. */
  build: (p: RawProposal) =>
    | { ok: true; value: Record<string, number>; costInr: number; costDetails: Record<string, unknown>; row: Record<string, unknown> }
    | { ok: false; error: string };
  table: string;
  priceField: string;
}

export async function capabilityFor(
  supabase: any,
  s: ModuleSettings,
  rates: RateMap | null,
): Promise<Capability | null> {
  const configuredCost = (units: number) => Number(s.unit_cost_inr) * units + Number(s.fixed_cost_inr);

  if (s.module === "ai_chat_plan") {
    const { data } = await supabase.from("ai_chat_plans").select("*").eq("is_active", true);
    const rows: any[] = data ?? [];
    return {
      table: "ai_chat_plans",
      priceField: "price_inr",
      existing: rows.map((p) => ({
        name: String(p.name),
        price: Number(p.price_inr) || 0,
        value: {
          messages: Number(p.messages_per_month) || 0,
          voice_input: Number(p.voice_input_per_month) || 0,
          voice_playback: Number(p.voice_playback_per_month) || 0,
          image_analysis: Number(p.image_analysis_per_month) || 0,
          image_generation: Number(p.ai_image_generation_per_month) || 0,
        },
      })),
      build: (p) => {
        if (!rates) return { ok: false, error: "provider pricing unavailable — cannot cost a new plan" };
        const L = p.limits ?? {};
        const q = {
          messages: num((L as any).messages ?? (L as any).messages_per_month),
          voice_input: num((L as any).voice_input ?? (L as any).voice_input_per_month),
          voice_playback: num((L as any).voice_playback ?? (L as any).voice_playback_per_month),
          image_analysis: num((L as any).image_analysis ?? (L as any).image_analysis_per_month),
          image_generation: num((L as any).image_generation ?? (L as any).ai_image_generation_per_month),
        };
        for (const [k, v] of Object.entries(q)) {
          if (!Number.isFinite(v) || v < 0 || v > 1_000_000) return { ok: false, error: `invalid quota for ${k}` };
        }
        if (q.messages < 1) return { ok: false, error: "a paid chat plan needs at least 1 message per month" };

        const planRow = {
          name: "",
          price_inr: 0,
          messages_per_month: Math.round(q.messages),
          voice_input_per_month: Math.round(q.voice_input),
          voice_playback_per_month: Math.round(q.voice_playback),
          image_analysis_per_month: Math.round(q.image_analysis),
          ai_image_generation_per_month: Math.round(q.image_generation),
          ai_model_tier: "basic",
          priority_support: false,
          is_active: true,
          features: [] as string[],
          display_order: 0,
        };
        const cost = computeAiPlanCost(
          planRow,
          rates,
          (s as any).usage_assumptions,
          (s as any).internal_usage_caps,
        );
        if (!cost.ok) return { ok: false, error: cost.error };
        const units = q.messages + q.voice_input + q.voice_playback + q.image_analysis + 5 * q.image_generation;
        const costInr = Math.max(cost.costInr, configuredCost(Math.min(units, 20000)));
        return {
          ok: true,
          value: q,
          costInr,
          costDetails: {
            cost_source: "provider_api",
            provider_cost_inr: cost.costInr,
            configured_cost_inr: configuredCost(Math.min(units, 20000)),
            cost_used_inr: Math.round(costInr * 100) / 100,
            breakdown: cost.breakdown,
            usage_assumptions: cost.assumptions,
            pricing_sources: cost.sources,
          },
          row: planRow,
        };
      },
    };
  }

  if (s.module === "job_boost") {
    const { data } = await supabase.from("boost_packages").select("*").eq("is_active", true);
    const rows: any[] = data ?? [];
    return {
      table: "boost_packages",
      priceField: "price_inr",
      existing: rows.map((p) => ({
        name: String(p.name),
        price: Number(p.price_inr) || 0,
        value: { days: Number(p.boost_days) || 0, level: Number(p.boost_level) || 1 },
      })),
      build: (p) => {
        const days = num((p.limits as any)?.boost_days ?? (p.limits as any)?.days ?? p.units);
        const level = num((p.limits as any)?.boost_level ?? (p.limits as any)?.level, 1);
        if (!Number.isFinite(days) || days < 1 || days > 365) return { ok: false, error: "invalid boost_days" };
        if (!Number.isFinite(level) || level < 1 || level > 5) return { ok: false, error: "invalid boost_level" };
        const costInr = configuredCost(days);
        return {
          ok: true,
          value: { days: Math.round(days), level: Math.round(level) },
          costInr,
          costDetails: { cost_source: "manual", cost_used_inr: costInr, units: Math.round(days) },
          row: {
            name: "",
            price_inr: 0,
            boost_days: Math.round(days),
            boost_level: Math.round(level),
            is_active: true,
            sort_order: 99,
          },
        };
      },
    };
  }

  return null;
}

/** True when an existing plan already gives at least as much for the same or lower price. */
function isDominated(
  value: Record<string, number>,
  price: number,
  existing: Capability["existing"],
): string | null {
  for (const e of existing) {
    const keys = Object.keys(value);
    const atLeastAsGood = keys.every((k) => (e.value[k] ?? 0) >= value[k]);
    if (atLeastAsGood && e.price <= price) {
      return `"${e.name}" already offers the same or more for ${e.price}`;
    }
    const samePrice = Math.abs(e.price - price) <= Math.max(1, price * 0.01);
    const sameValue = keys.every((k) => (e.value[k] ?? 0) === value[k]);
    if (samePrice && sameValue) return `duplicate of "${e.name}"`;
  }
  return null;
}

export async function createAiProposedPlans(
  supabase: any,
  s: ModuleSettings,
  proposals: RawProposal[],
  opts: {
    rates: RateMap | null;
    dryRun: boolean;
    dataQuality: "sufficient" | "insufficient";
    aiNote?: string | null;
  },
): Promise<ProposalOutcome[]> {
  const outcomes: ProposalOutcome[] = [];
  if (!proposals.length) return outcomes;

  const allowed = (s as any).allow_new_plans === true;
  const maxPerRun = Math.max(0, Math.min(3, Number((s as any).max_new_plans_per_run) || 1));
  const cap = await capabilityFor(supabase, s, opts.rates);

  const blockAll = !allowed
    ? "new-plan creation is off for this module"
    : !cap
    ? "this module has no public plan listing that supports AI-created plans"
    : opts.dryRun
    ? "dry run / review-only — proposal recorded but not created"
    : opts.dataQuality !== "sufficient"
    ? "insufficient demand data — conservative rule blocks new plan creation"
    : null;

  const seenNames = new Set((cap?.existing ?? []).map((e) => e.name.toLowerCase()));
  let created = 0;

  for (const p of proposals.slice(0, 5)) {
    const name = cleanName(p.name);
    const base = {
      module: s.module,
      name: name ?? (String(p.name ?? "").slice(0, 40) || "(unnamed)"),
      proposal: { ...p } as Record<string, unknown>,
      price: null as number | null,
      cost_inr: null as number | null,
      floor_inr: null as number | null,
      profit_inr: null as number | null,
      margin_percent: null as number | null,
      created_item_id: null as string | null,
      details: {
        tax_percent: Number(s.tax_percent),
        payment_fee_percent: Number(s.payment_fee_percent),
        min_profit_inr: Number(s.min_profit_inr),
        min_margin_percent: Number(s.min_margin_percent),
        ai_note: opts.aiNote ?? null,
        data_quality: opts.dataQuality,
      } as Record<string, unknown>,
    };

    const reject = (reason: string, extra: Record<string, unknown> = {}) =>
      outcomes.push({ ...base, status: "rejected", reason, details: { ...base.details, ...extra } });

    if (!name) { reject("rejected: invalid or unusable plan name"); continue; }
    if (seenNames.has(name.toLowerCase())) { reject(`rejected: a plan named "${name}" already exists`); continue; }
    if (!cap) { reject(`not created: ${blockAll}`); continue; }

    const built = cap.build(p);
    if (!built.ok) { reject(`rejected: ${built.error}`); continue; }

    // Same safety engine as every existing price. currentPrice = 0 so no
    // movement guard applies, but the loss floor and ceiling still do.
    const decision = decideSafePrice({
      settings: { ...s, max_change_percent: 500 },
      costInr: built.costInr,
      currentPrice: 0,
      suggestedPrice: num(p.price),
    });

    base.price = decision.price;
    base.cost_inr = decision.costInr;
    base.floor_inr = decision.floorInr;
    base.profit_inr = decision.profitInr;
    base.margin_percent = decision.marginPercent;
    base.details = { ...base.details, cost_details: built.costDetails, safety_reason: decision.reason };

    if (!decision.safe || decision.price <= 0) {
      reject("rejected: cannot be priced safely above cost + GST + gateway fee + required profit/margin", {
        safety_reason: decision.reason,
      });
      continue;
    }
    if (Number(s.price_ceiling_inr) > 0 && decision.priceInr > Number(s.price_ceiling_inr)) {
      reject("rejected: safe price exceeds the affordability ceiling — a profitable version is not sellable", {});
      continue;
    }
    const dominated = isDominated(built.value, decision.price, cap.existing);
    if (dominated) { reject(`rejected: ${dominated}`); continue; }

    if (blockAll) { reject(`not created: ${blockAll}`); continue; }
    if (created >= maxPerRun) { reject(`not created: new-plan limit for this run (${maxPerRun}) reached`); continue; }

    const row: Record<string, unknown> = {
      ...built.row,
      name,
      [cap.priceField]: Math.round(decision.price),
    };
    if ("features" in built.row) row.features = cleanFeatures(p.features);
    if ("display_order" in built.row) row.display_order = 99;

    const { data: inserted, error } = await supabase.from(cap.table).insert(row).select("id").single();
    if (error) { reject(`rejected: insert failed — ${error.message}`); continue; }

    created++;
    seenNames.add(name.toLowerCase());
    cap.existing.push({ name, price: decision.price, value: built.value });
    outcomes.push({
      ...base,
      status: "created",
      created_item_id: String(inserted?.id ?? ""),
      reason: `created and published to the ${cap.table} listing — ${decision.reason}`,
      details: { ...base.details, listing_table: cap.table, ai_reason: String(p.reason ?? "").slice(0, 300) },
    });
  }

  return outcomes;
}

export async function recordProposals(
  supabase: any,
  s: ModuleSettings,
  outcomes: ProposalOutcome[],
  changeType: "create" | "edit" | "retire" = "create",
): Promise<void> {
  if (!outcomes.length) return;
  await supabase.from("ai_pricing_plan_proposals").insert(
    outcomes.map((o) => ({
      module: o.module,
      name: o.name,
      proposal: o.proposal,
      price_kind: s.price_kind,
      price: o.price,
      cost_inr: o.cost_inr,
      floor_inr: o.floor_inr,
      profit_inr: o.profit_inr,
      margin_percent: o.margin_percent,
      tax_percent: Number(s.tax_percent),
      payment_fee_percent: Number(s.payment_fee_percent),
      status: o.status,
      reason: o.reason,
      created_item_id: o.created_item_id,
      change_type: changeType,
      target_item_id: (o.details as any)?.target_item_id ?? null,
      details: o.details,
    })),
  );
}
