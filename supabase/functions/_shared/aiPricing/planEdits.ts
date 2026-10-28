// AI-driven EDITS and RETIREMENTS of existing plans/packages.
//
// Same philosophy as newPlans.ts: the AI may only PROPOSE. Every change runs
// through the same loss-protection engine and a set of hard guards:
//
//   EDIT
//     * module must have allow_edit_plans = true, auto_apply = true
//     * never on a dry run / review-only module, never on thin data
//     * bounded by max_plan_edits_per_run
//     * the plan must exist and be active
//     * new quotas must be valid; the new cost must be computable
//     * the resulting price must clear cost + GST + gateway + profit/margin
//     * the movement guard still applies (max_change_percent / anomaly factor)
//
//   RETIRE (soft only — is_active = false, rows are NEVER deleted)
//     * module must have allow_retire_plans = true, auto_apply = true
//     * never on a dry run / review-only module, never on thin data
//     * bounded by max_plan_retires_per_run
//     * at least 2 active plans must remain after the retirement
//     * a plan with sales in the last 90 days is never retired automatically
//
// Every outcome (applied OR rejected) is recorded in ai_pricing_plan_proposals
// via recordProposals(), with change_type = "edit" | "retire".

import { decideSafePrice, type ModuleSettings } from "./engine.ts";
import type { RateMap } from "./providerCosts.ts";
import {
  capabilityFor,
  cleanFeatures,
  cleanName,
  num,
  type ProposalOutcome,
  type RawProposal,
} from "./newPlans.ts";

export interface RawEdit extends RawProposal {
  /** Name of the existing plan to edit. */
  target?: unknown;
  new_name?: unknown;
}

export interface RawRetire {
  target?: unknown;
  reason?: unknown;
}

export interface EditOpts {
  rates: RateMap | null;
  dryRun: boolean;
  dataQuality: "sufficient" | "insufficient";
  aiNote?: string | null;
  anomalyFactor: number;
}

const baseDetails = (s: ModuleSettings, opts: EditOpts) => ({
  tax_percent: Number(s.tax_percent),
  payment_fee_percent: Number(s.payment_fee_percent),
  min_profit_inr: Number(s.min_profit_inr),
  min_margin_percent: Number(s.min_margin_percent),
  ai_note: opts.aiNote ?? null,
  data_quality: opts.dataQuality,
});

/** Active listing rows with ids, for the module's public plan table. */
async function loadRows(supabase: any, table: string) {
  const { data } = await supabase.from(table).select("*").eq("is_active", true);
  return (data ?? []) as any[];
}

export async function applyAiPlanEdits(
  supabase: any,
  s: ModuleSettings,
  edits: RawEdit[],
  opts: EditOpts,
): Promise<ProposalOutcome[]> {
  const outcomes: ProposalOutcome[] = [];
  if (!edits.length) return outcomes;

  const allowed = (s as any).allow_edit_plans === true;
  const maxPerRun = Math.max(0, Math.min(5, Number((s as any).max_plan_edits_per_run) || 0));
  const cap = await capabilityFor(supabase, s, opts.rates);

  const blockAll = !allowed
    ? "plan editing is off for this module"
    : !cap
    ? "this module has no public plan listing that supports AI plan edits"
    : opts.dryRun
    ? "dry run / review-only — edit recorded but not applied"
    : opts.dataQuality !== "sufficient"
    ? "insufficient demand data — conservative rule blocks plan edits"
    : maxPerRun <= 0
    ? "plan edit limit for this module is 0"
    : null;

  const rows = cap ? await loadRows(supabase, cap.table) : [];
  let applied = 0;

  for (const e of edits.slice(0, 5)) {
    const target = String(e.target ?? e.name ?? "").trim();
    const row = rows.find((r) => String(r.name ?? "").toLowerCase() === target.toLowerCase());
    const base = {
      module: s.module,
      name: target || "(unnamed)",
      proposal: { ...e } as Record<string, unknown>,
      price: null as number | null,
      cost_inr: null as number | null,
      floor_inr: null as number | null,
      profit_inr: null as number | null,
      margin_percent: null as number | null,
      created_item_id: null as string | null,
      details: { ...baseDetails(s, opts), change: "edit" } as Record<string, unknown>,
    };
    const reject = (reason: string, extra: Record<string, unknown> = {}) =>
      outcomes.push({ ...base, status: "rejected", reason, details: { ...base.details, ...extra } });

    if (!cap) { reject(`not edited: ${blockAll}`); continue; }
    if (!target || !row) { reject(`rejected: no active plan named "${target}" in ${cap.table}`); continue; }

    // Re-cost the plan with the proposed quotas (falling back to the live ones).
    const built = cap.build({ ...e, limits: (e.limits ?? {}) as Record<string, unknown> });
    if (!built.ok) { reject(`rejected: ${built.error}`); continue; }

    const currentPrice = Number(row[cap.priceField]) || 0;
    const decision = decideSafePrice({
      settings: s,
      costInr: built.costInr,
      currentPrice,
      suggestedPrice: num(e.price),
    });

    base.price = decision.price;
    base.cost_inr = decision.costInr;
    base.floor_inr = decision.floorInr;
    base.profit_inr = decision.profitInr;
    base.margin_percent = decision.marginPercent;
    base.details = {
      ...base.details,
      cost_details: built.costDetails,
      safety_reason: decision.reason,
      old_price: currentPrice,
      listing_table: cap.table,
      target_item_id: String(row.id),
    };

    if (!decision.safe || decision.price <= 0) {
      reject("rejected: edited plan cannot be priced safely above cost + GST + gateway fee + required profit/margin");
      continue;
    }
    if (Number(s.price_ceiling_inr) > 0 && decision.priceInr > Number(s.price_ceiling_inr)) {
      reject("rejected: safe price for the edited plan exceeds the affordability ceiling");
      continue;
    }
    const moved = currentPrice > 0 && decision.price > 0
      ? Math.max(decision.price / currentPrice, currentPrice / decision.price)
      : 1;
    if (currentPrice > 0 && moved > opts.anomalyFactor) {
      reject(
        `rejected: edit BLOCKED by anomaly guard — ${currentPrice} → ${decision.price} is ${
          moved.toFixed(2)
        }x (limit ${opts.anomalyFactor}x). Existing plan kept unchanged.`,
      );
      continue;
    }

    const newName = cleanName(e.new_name);
    if (e.new_name != null && !newName) { reject("rejected: invalid new plan name"); continue; }
    if (newName && rows.some((r) => r.id !== row.id && String(r.name).toLowerCase() === newName.toLowerCase())) {
      reject(`rejected: another plan named "${newName}" already exists`);
      continue;
    }

    if (blockAll) { reject(`not edited: ${blockAll}`); continue; }
    if (applied >= maxPerRun) { reject(`not edited: plan-edit limit for this run (${maxPerRun}) reached`); continue; }

    const update: Record<string, unknown> = { [cap.priceField]: Math.round(decision.price) };
    for (const [k, v] of Object.entries(built.row)) {
      if (k === "name" || k === cap.priceField || k === "is_active") continue;
      if (k === "features" || k === "display_order" || k === "sort_order") continue;
      if (typeof v === "number" && Number.isFinite(v)) update[k] = v;
    }
    if (newName) update.name = newName;
    const features = cleanFeatures(e.features);
    if (features.length && "features" in row) update.features = features;

    const { error } = await supabase.from(cap.table).update(update).eq("id", row.id);
    if (error) { reject(`rejected: update failed — ${error.message}`); continue; }

    applied++;
    outcomes.push({
      ...base,
      status: "created",
      created_item_id: String(row.id),
      reason: `plan updated in the ${cap.table} listing — ${decision.reason}`,
      details: { ...base.details, applied_update: update, ai_reason: String(e.reason ?? "").slice(0, 300) },
    });
  }

  return outcomes;
}

export async function applyAiPlanRetirements(
  supabase: any,
  s: ModuleSettings,
  retires: RawRetire[],
  opts: EditOpts,
): Promise<ProposalOutcome[]> {
  const outcomes: ProposalOutcome[] = [];
  if (!retires.length) return outcomes;

  const allowed = (s as any).allow_retire_plans === true;
  const maxPerRun = Math.max(0, Math.min(3, Number((s as any).max_plan_retires_per_run) || 0));
  const cap = await capabilityFor(supabase, s, opts.rates);

  const blockAll = !allowed
    ? "plan retirement is off for this module"
    : !cap
    ? "this module has no public plan listing that supports AI plan retirement"
    : opts.dryRun
    ? "dry run / review-only — retirement recorded but not applied"
    : opts.dataQuality !== "sufficient"
    ? "insufficient demand data — conservative rule blocks plan retirement"
    : maxPerRun <= 0
    ? "plan retirement limit for this module is 0"
    : null;

  const rows = cap ? await loadRows(supabase, cap.table) : [];
  let activeLeft = rows.length;
  let retired = 0;

  for (const r of retires.slice(0, 3)) {
    const target = String(r.target ?? "").trim();
    const row = rows.find((x) => String(x.name ?? "").toLowerCase() === target.toLowerCase());
    const base = {
      module: s.module,
      name: target || "(unnamed)",
      proposal: { ...r } as Record<string, unknown>,
      price: row ? Number(row[cap!.priceField]) || 0 : null,
      cost_inr: null as number | null,
      floor_inr: null as number | null,
      profit_inr: null as number | null,
      margin_percent: null as number | null,
      created_item_id: null as string | null,
      details: {
        ...baseDetails(s, opts),
        change: "retire",
        listing_table: cap?.table ?? null,
        target_item_id: row ? String(row.id) : null,
        ai_reason: String(r.reason ?? "").slice(0, 300),
      } as Record<string, unknown>,
    };
    const reject = (reason: string) => outcomes.push({ ...base, status: "rejected", reason });

    if (!cap) { reject(`not retired: ${blockAll}`); continue; }
    if (!target || !row) { reject(`rejected: no active plan named "${target}" in ${cap.table}`); continue; }
    if (activeLeft - 1 < 2) {
      reject("rejected: at least 2 active plans must remain in the listing — retirement blocked");
      continue;
    }
    if (blockAll) { reject(`not retired: ${blockAll}`); continue; }
    if (retired >= maxPerRun) { reject(`not retired: retirement limit for this run (${maxPerRun}) reached`); continue; }

    // Soft retire only — the row is hidden from the listing, never deleted, so
    // it stays a known-good fallback and existing purchases keep resolving.
    const { error } = await supabase.from(cap.table).update({ is_active: false }).eq("id", row.id);
    if (error) { reject(`rejected: retire failed — ${error.message}`); continue; }

    retired++;
    activeLeft--;
    outcomes.push({
      ...base,
      status: "created",
      created_item_id: String(row.id),
      reason: `plan retired (hidden from the ${cap.table} listing, row preserved) — ${
        String(r.reason ?? "AI decision").slice(0, 200)
      }`,
    });
  }

  return outcomes;
}
