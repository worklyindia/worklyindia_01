// AI Auto Price Manager
//
// Runs (daily via cron, or on demand from the owner portal) across every
// monetized module — wallet points, job boost, verification badge, job
// posting, job renewal, interviews and AI chat plans — asks Lovable AI for a
// price/free-allowance recommendation, clamps it through the shared
// loss-protection engine, optionally applies it, and logs every decision.
//
// The AI is optional. If it is off, unreachable, rate limited, out of credits
// or returns garbage, the rule engine picks a safe price instead and the run
// still succeeds.

import {
  decideFreeAllowance,
  decideSafePrice,
  type ModuleSettings,
  type PriceDecision,
} from "./engine.ts";
import {
  computeAiPlanCost,
  computeInterviewFixedCost,
  computeInterviewMinuteCost,
  type CostResult,
  loadProviderRates,
  type RateMap,
} from "./providerCosts.ts";
import { economicsPromptBlock, loadModuleEconomics, type ModuleEconomics } from "./economics.ts";
import { createAiProposedPlans, type ProposalOutcome, type RawProposal, recordProposals } from "./newPlans.ts";
import {
  applyAiPlanEdits,
  applyAiPlanRetirements,
  type RawEdit,
  type RawRetire,
} from "./planEdits.ts";

const MODEL = "openai/gpt-5.6-sol";
const AI_MAX_ATTEMPTS = 3;

/**
 * Cost model per module.
 *  - "manual"        : cost = unit_cost_inr x units + fixed_cost_inr (admin numbers).
 *  - "provider_api"  : cost is computed from the official/current provider price
 *                      list stored in `ai_pricing_provider_rates`, and the admin
 *                      numbers are only used as a loss-safe lower bound
 *                      (cost = max(documented provider cost, configured cost)).
 * Enterprise/AI plans and interviews run on "provider_api".
 */
const isProviderCosted = (s: ModuleSettings) => (s as any).cost_model === "provider_api";

/** Cost/provider context per module, so each platform is priced on its own economics. */
const PROVIDER_NOTE: Record<string, string> = {
  interview:
    "Cost driver: third-party live interview APIs (100ms video room per participant-minute, cloud recording per minute, speech-to-text per minute) plus the AI question/scoring report and platform infrastructure. our_cost_inr below is already the combined documented provider bill.",
  ai_chat_plan:
    "Cost driver: platform AI APIs consumed by the plan's monthly quota (LLM input/output tokens, speech-to-text, text-to-speech, image generation) plus amortised platform infrastructure. our_cost_inr below is already the documented API bill for that plan's costed quota; 'unlimited' quotas are costed at our documented internal usage cap, never at infinite usage.",
  job_boost: "Cost driver: extra impressions/promotion delivery per boost day.",
  job_posting: "Cost driver: moderation + indexing cost per job post.",
  job_renewal: "Cost driver: re-indexing cost per renewal.",
  verification_badge: "Cost driver: manual/KYC verification effort per company.",
};


interface Item {
  id: string;
  name: string;
  units: number; // cost driver (points, days, months, minutes, messages…)
  /** Explicit cost override in INR when units x unit_cost does not apply. */
  costInr?: number;
  /** Per-item minimum profit override in INR (e.g. per-minute charges). */
  minProfitInr?: number;
  currentPrice: number; // in the module unit (INR or points)
  /** Provider-cost audit trail: breakdown, usage assumptions and source docs. */
  costDetails?: Record<string, unknown>;
  /** Set when the documented provider cost could not be computed for this item. */
  costError?: string;
  meta?: Record<string, unknown>;
}

interface ItemDecision extends PriceDecision {
  itemId: string;
  itemName: string;
  units: number;
  oldPrice: number;
  costDetails?: Record<string, unknown>;
  costError?: string | null;
}

function costFor(s: ModuleSettings, units: number) {
  return Number(s.unit_cost_inr) * units + Number(s.fixed_cost_inr);
}

/**
 * Turn a provider cost result into item cost fields. The configured admin cost
 * is kept as a lower bound so a stale rate row can never price us below the
 * numbers the owner typed in.
 */
function applyProviderCost(
  result: CostResult,
  configuredCost: number,
  extra: Record<string, unknown> = {},
): Pick<Item, "costInr" | "costDetails" | "costError"> {
  if (!result.ok) {
    return { costError: result.error, costDetails: { cost_source: "provider_api", error: result.error, ...extra } };
  }
  const costInr = Math.max(result.costInr, Number(configuredCost) || 0);
  return {
    costInr,
    costDetails: {
      cost_source: "provider_api",
      provider_cost_inr: result.costInr,
      configured_cost_inr: Number(configuredCost) || 0,
      cost_used_inr: Math.round(costInr * 100) / 100,
      cost_basis: costInr > result.costInr ? "configured floor (higher than provider cost)" : "documented provider pricing",
      breakdown: result.breakdown,
      usage_assumptions: result.assumptions,
      pricing_sources: result.sources,
      ...extra,
    },
  };
}


/** Ask Lovable AI for suggestions. Never throws — returns {} on any failure. */
async function askAi(
  s: ModuleSettings,
  items: Item[],
  economicsBlock: string,
  canProposePlans: boolean,
  canEditPlans = false,
  canRetirePlans = false,
): Promise<{
  prices: Record<string, number>;
  freeUnits?: number;
  freeReason?: string;
  newPlans: RawProposal[];
  planEdits: RawEdit[];
  planRetires: RawRetire[];
  note?: string;
  error?: string;
}> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  const empty = { prices: {}, newPlans: [], planEdits: [], planRetires: [] };
  if (!s.ai_enabled) return { ...empty, note: "AI disabled for this module" };
  if (!key) return { ...empty, error: "LOVABLE_API_KEY missing" };

  const affordCeil = Number(s.price_ceiling_inr) > 0 ? Number(s.price_ceiling_inr) : 0;
  const prompt = [
    `You are the pricing manager for Workly India, an Indian jobs marketplace.`,
    `Module: ${s.module} (prices are in ${s.price_kind === "points" ? "wallet points" : "INR"}).`,
    PROVIDER_NOTE[s.module] ?? "",
    `Our internal cost per item is already computed for you. GST is ${s.tax_percent}% and the payment`,
    `gateway takes ${s.payment_fee_percent}%. We must keep at least ₹${s.min_profit_inr} profit and`,
    `${s.min_margin_percent}% margin per sale, and the platform must never make a loss.`,
    affordCeil ? `Affordability cap: never price above ${affordCeil} (module unit).` : "",
    `Recommend a price for each item that is attractive for Indian users (psychological pricing like`,
    `99/149/299 is good) while staying profitable, plus a fair free allowance (${s.free_tier_enabled ? "free tier is ON" : "free tier is OFF"}).`,
    ``,
    economicsBlock,
    `Use this business data to find loss-making / low-margin items and profitable ones. Never assume`,
    `anything the data does not show: when data quality is "insufficient", keep prices as they are,`,
    `propose no new plans and propose no free allowance.`,
    ``,
    `Items:`,
    ...items.map((i) =>
      `- id=${i.id} name="${i.name}" units=${i.units} current_price=${i.currentPrice} our_cost_inr=${
        (i.costInr ?? costFor(s, i.units)).toFixed(2)
      }`
    ),
    ``,
    canProposePlans
      ? `You may also propose at most 2 genuinely new plans for this module when demand, usage and cost data justify a gap in the line-up. Never duplicate or undercut an existing plan and never propose a plan that cannot be profitable. Each proposal needs: name, price, limits (quota numbers), features (short strings) and reason.`
      : `Do NOT propose new plans for this module.`,
    canEditPlans
      ? `You may also propose edits to existing plans (rename, change quotas/limits, features, price) when the data shows a plan is loss-making, under-valued or badly positioned. Each edit needs: target (exact existing plan name), optional new_name, price, limits, features and reason.`
      : `Do NOT propose plan edits for this module.`,
    canRetirePlans
      ? `You may also propose retiring at most 1 existing plan that has no demand or cannot be made profitable. Each retirement needs: target (exact existing plan name) and reason. Never retire a plan that still sells well.`
      : `Do NOT propose plan retirements for this module.`,
    ``,
    `Reply with JSON only: {"prices":[{"id":"...","price":123}],"free_units":10,`,
    `"free_reason":"why this free allowance is affordable","new_plans":[{"name":"...","price":199,`,
    `"limits":{"...":100},"features":["..."],"reason":"..."}],`,
    `"plan_edits":[{"target":"Existing Plan","new_name":"...","price":249,"limits":{"...":100},"features":["..."],"reason":"..."}],`,
    `"plan_retirements":[{"target":"Existing Plan","reason":"..."}],"note":"short reason"}`,
  ].filter(Boolean).join("\n");


  let lastError = "AI call failed";

  for (let attempt = 1; attempt <= AI_MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: "system", content: "You are a precise pricing analyst. Reply with JSON only." },
            { role: "user", content: prompt },
          ],
          response_format: { type: "json_object" },
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        lastError = `AI gateway ${res.status}: ${text.slice(0, 300)}`;
        // 429 / 5xx are transient — back off and retry. Everything else is terminal.
        if ((res.status === 429 || res.status >= 500) && attempt < AI_MAX_ATTEMPTS) {
          const retryAfter = Number(res.headers.get("retry-after"));
          const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
            ? Math.min(retryAfter * 1000, 20_000)
            : attempt * 1500 + Math.floor(Math.random() * 500);
          await new Promise((r) => setTimeout(r, waitMs));
          continue;
        }
        return { ...empty, error: lastError };
      }

      const data = await res.json();
      const raw = data?.choices?.[0]?.message?.content ?? "{}";
      const parsed = JSON.parse(String(raw).replace(/^```json|```$/g, "").trim());
      const prices: Record<string, number> = {};
      for (const p of Array.isArray(parsed?.prices) ? parsed.prices : []) {
        if (p?.id != null) prices[String(p.id)] = Number(p.price);
      }
      const newPlans: RawProposal[] = canProposePlans && Array.isArray(parsed?.new_plans)
        ? parsed.new_plans.slice(0, 5).filter((p: unknown) => p && typeof p === "object")
        : [];
      const planEdits: RawEdit[] = canEditPlans && Array.isArray(parsed?.plan_edits)
        ? parsed.plan_edits.slice(0, 5).filter((p: unknown) => p && typeof p === "object")
        : [];
      const planRetires: RawRetire[] = canRetirePlans && Array.isArray(parsed?.plan_retirements)
        ? parsed.plan_retirements.slice(0, 3).filter((p: unknown) => p && typeof p === "object")
        : [];
      return {
        prices,
        freeUnits: Number(parsed?.free_units),
        freeReason: String(parsed?.free_reason ?? "").slice(0, 300) || undefined,
        newPlans,
        planEdits,
        planRetires,
        note: String(parsed?.note ?? "").slice(0, 300),
      };
    } catch (e) {
      lastError = `AI call failed: ${(e as Error).message}`;
      if (attempt < AI_MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, attempt * 1500));
        continue;
      }
    }
  }

  // Never throws: the rule engine takes over and prices stay safe/unchanged.
  return { ...empty, error: lastError };
}

export async function runAIPricing(
  supabase: any,
  body: { modules?: string[]; dry_run?: boolean } = {},
): Promise<{ ok: boolean; ran_at: string; results: Record<string, unknown> } | { error: string }> {

  const { data: allModules, error: modErr } = await supabase
    .from("ai_pricing_modules")
    .select("*")
    .order("module");

  if (modErr) return { error: modErr.message };

  const wanted = Array.isArray(body.modules) && body.modules.length
    ? allModules!.filter((m: any) => body.modules!.includes(m.module))
    : allModules!;

  const results: Record<string, unknown> = {};

  for (const raw of wanted) {
    const s = raw as unknown as ModuleSettings;
    // review_only modules are frozen: they are always evaluated as a dry run.
    const reviewOnly = (s as any).review_only === true;
    const dryRun = body.dry_run === true || !s.auto_apply || reviewOnly;
    let decisions: ItemDecision[] = [];
    let aiError: string | null = null;
    let costError: string | null = null;
    let note: string | null = null;
    let applied = 0;

    let economics: ModuleEconomics | null = null;
    let proposals: ProposalOutcome[] = [];
    let editOutcomes: ProposalOutcome[] = [];
    let retireOutcomes: ProposalOutcome[] = [];
    let freeApplied = false;

    try {
      let rates: RateMap | null = null;
      if (isProviderCosted(s)) {
        const loaded = await loadProviderRates(supabase, s.module);
        if (loaded.ok) rates = loaded.rates;
        else costError = loaded.error;
      }

      const { items, apply } = await loadModule(supabase, s, rates);
      economics = await loadModuleEconomics(supabase, s.module);
      const dataOk = economics.data_quality === "sufficient";
      const canProposePlans = (s as any).allow_new_plans === true && dataOk && !dryRun;
      const canEditPlans = (s as any).allow_edit_plans === true && dataOk && !dryRun;
      const canRetirePlans = (s as any).allow_retire_plans === true && dataOk && !dryRun;
      const ai = await askAi(
        s,
        items,
        economicsPromptBlock(economics),
        canProposePlans,
        canEditPlans,
        canRetirePlans,
      );
      aiError = ai.error ?? null;
      note = ai.note ?? null;

      // Anomaly guard: an unexpected huge movement or an abnormal cost blocks the
      // change and keeps the last known-good price.
      const anomalyFactor = Math.max(1.2, Number((s as any).anomaly_max_factor) || 3);

      decisions = items.map((item) => {
        const perItemSettings: ModuleSettings = item.minProfitInr != null
          ? { ...s, min_profit_inr: item.minProfitInr, price_floor_inr: 0 }
          : s;
        const rawCost = item.costInr ?? costFor(s, item.units);
        const costLooksWrong = !Number.isFinite(rawCost) || rawCost < 0 || rawCost > 10_000_000;
        const itemCostError = item.costError ?? costError ??
          (costLooksWrong ? `abnormal computed cost (${rawCost})` : null);
        if (itemCostError) {
          // Cost data unavailable/failed -> never price from an unsafe estimate.
          // Retain the last known-good price and record the error for audit.
          return {
            price: item.currentPrice,
            priceInr: item.currentPrice,
            costInr: Number.isFinite(rawCost) ? rawCost : 0,
            floorInr: 0,
            profitInr: 0,
            marginPercent: 0,
            safe: false,
            source: "rule" as const,
            reason: `Price retained (last known-good): documented API cost unavailable — ${itemCostError}`,
            itemId: item.id,
            itemName: item.name,
            units: item.units,
            oldPrice: item.currentPrice,
            costDetails: item.costDetails,
            costError: itemCostError,
          };
        }
        const d = decideSafePrice({
          settings: perItemSettings,
          costInr: rawCost,
          currentPrice: item.currentPrice,
          suggestedPrice: ai.prices[item.id],
        });

        // Extreme movement in a single run -> block and keep the current price.
        const old = Number(item.currentPrice) || 0;
        const moved = old > 0 && d.price > 0 ? Math.max(d.price / old, old / d.price) : 1;
        if (old > 0 && moved > anomalyFactor && d.price >= old) {
          return {
            ...d,
            price: old,
            safe: false,
            reason:
              `Change BLOCKED by anomaly guard: ${old} → ${d.price} is ${moved.toFixed(2)}x (limit ${anomalyFactor}x). Last known-good price retained.`,
            itemId: item.id,
            itemName: item.name,
            units: item.units,
            oldPrice: old,
            costDetails: item.costDetails,
            costError: null,
          };
        }
        if (old > 0 && moved > anomalyFactor) {
          return {
            ...d,
            price: old,
            safe: false,
            reason:
              `Change BLOCKED by anomaly guard: ${old} → ${d.price} is a ${moved.toFixed(2)}x drop (limit ${anomalyFactor}x). Last known-good price retained.`,
            itemId: item.id,
            itemName: item.name,
            units: item.units,
            oldPrice: old,
            costDetails: item.costDetails,
            costError: null,
          };
        }
        return {
          ...d,
          itemId: item.id,
          itemName: item.name,
          units: item.units,
          oldPrice: item.currentPrice,
          costDetails: item.costDetails,
          costError: null,
        };
      });

      // ---- Free offer / free allowance, bounded by its own cost budget ----
      const conservativeFree = economics.data_quality !== "sufficient";
      const free = decideFreeAllowance(s, conservativeFree ? undefined : ai.freeUnits);
      const freeBudget = Math.max(0, Number(s.free_tier_max_cost_inr) || 0);
      const alreadySpent = Math.max(0, Number((s as any).applied_free_cost_inr) || 0);
      const budgetExceeded = s.free_tier_enabled && freeBudget > 0 &&
        alreadySpent + free.costInr > freeBudget;
      const freeUnits = budgetExceeded ? 0 : free.units;
      const freeReason = !s.free_tier_enabled
        ? free.reason
        : budgetExceeded
        ? `Free offer STOPPED: free budget ₹${freeBudget} would be exceeded (already committed ₹${alreadySpent}, proposed ₹${free.costInr})`
        : conservativeFree
        ? `${free.reason}; AI suggestion ignored — insufficient demand data (conservative rule)`
        : (ai.freeReason ? `${free.reason} — ${ai.freeReason}` : free.reason);
      const freeCost = budgetExceeded ? 0 : free.costInr;

      const safeChanged = decisions.filter((d) => d.safe && !d.costError && d.price !== d.oldPrice);
      // If the AI call failed while AI pricing is ON, never write prices this run —
      // keep the last known-good prices and let the next run retry.
      const blockedByAiError = s.ai_enabled && !!aiError;
      if (!dryRun && !blockedByAiError && safeChanged.length) {
        await apply(safeChanged);
        applied = safeChanged.length;
      }

      // ---- AI-created plans (same safety engine, extra creation guards) ----
      if (ai.newPlans.length) {
        proposals = await createAiProposedPlans(supabase, s, ai.newPlans, {
          rates,
          dryRun: dryRun || blockedByAiError,
          dataQuality: economics.data_quality,
          aiNote: note,
        });
        await recordProposals(supabase, s, proposals);
      }
      const createdPlans = proposals.filter((p) => p.status === "created").length;

      // ---- AI plan edits + retirements (same safety engine + owner toggles) ----
      const editOpts = {
        rates,
        dryRun: dryRun || blockedByAiError,
        dataQuality: economics.data_quality,
        aiNote: note,
        anomalyFactor,
      };
      if (ai.planEdits.length) {
        editOutcomes = await applyAiPlanEdits(supabase, s, ai.planEdits, editOpts);
        await recordProposals(supabase, s, editOutcomes, "edit");
      }
      if (ai.planRetires.length) {
        retireOutcomes = await applyAiPlanRetirements(supabase, s, ai.planRetires, editOpts);
        await recordProposals(supabase, s, retireOutcomes, "retire");
      }
      const editedPlans = editOutcomes.filter((p) => p.status === "created").length;
      const retiredPlans = retireOutcomes.filter((p) => p.status === "created").length;

      if (decisions.length) {
        await supabase.from("ai_pricing_audit_log").insert(
          decisions.map((d) => ({
            module: s.module,
            item_id: d.itemId,
            item_name: d.itemName,
            price_kind: s.price_kind,
            old_price: d.oldPrice,
            new_price: d.price,
            cost_inr: d.costInr,
            profit_inr: d.profitInr,
            margin_percent: d.marginPercent,
            source: d.source,
            applied: !dryRun && !blockedByAiError && d.safe && !d.costError && d.price !== d.oldPrice,
            safe: d.safe,
            reason: d.reason + (aiError ? ` (${aiError})` : ""),
            details: {
              units: d.units,
              floor_inr: d.floorInr,
              free_units: freeUnits,
              free_cost_inr: freeCost,
              free_reason: freeReason,
              free_budget_inr: freeBudget,
              free_budget_exceeded: budgetExceeded,
              dry_run: dryRun,
              review_only: reviewOnly,
              ai_note: note,
              anomaly_max_factor: anomalyFactor,
              cost_model: (s as any).cost_model ?? "manual",
              cost_error: d.costError ?? null,
              // provider -> usage -> cost -> GST -> gateway -> min profit/margin -> final price
              cost_details: d.costDetails ?? null,
              tax_percent: Number(s.tax_percent),
              payment_fee_percent: Number(s.payment_fee_percent),
              min_profit_inr: Number(s.min_profit_inr),
              min_margin_percent: Number(s.min_margin_percent),
              price_ceiling_inr: Number(s.price_ceiling_inr),
              economics: {
                sales_30d: economics!.sales_30d,
                sales_90d: economics!.sales_90d,
                revenue_30d: economics!.revenue_30d,
                revenue_90d: economics!.revenue_90d,
                data_quality: economics!.data_quality,
                profitability: economics!.profitability,
              },
              new_plans: proposals.map((p) => ({ name: p.name, status: p.status, reason: p.reason, price: p.price })),
              plan_edits: editOutcomes.map((p) => ({ name: p.name, status: p.status, reason: p.reason, price: p.price })),
              plan_retirements: retireOutcomes.map((p) => ({ name: p.name, status: p.status, reason: p.reason })),
            },
          })),
        );
      }


      const anyCostError = decisions.find((d) => d.costError)?.costError ?? costError;

      // Persist the free allowance that is actually in force (auto-stopped at budget).
      const freeUpdate = !dryRun && !blockedByAiError
        ? {
          applied_free_units: freeUnits,
          applied_free_cost_inr: freeCost,
          free_offer_reason: freeReason,
        }
        : {};
      freeApplied = Object.keys(freeUpdate).length > 0;

      await supabase.from("ai_pricing_modules").update({
        last_run_at: new Date().toISOString(),
        last_status: reviewOnly
          ? `review-only: evaluated ${decisions.length} items (frozen, nothing applied)`
          : dryRun
          ? `reviewed ${decisions.length} items (not applied)`
          : `applied ${applied}/${decisions.length}${createdPlans ? `, ${createdPlans} new plan(s)` : ""}${
            editedPlans ? `, ${editedPlans} plan edit(s)` : ""
          }${retiredPlans ? `, ${retiredPlans} retired` : ""}`,
        last_source: decisions.some((d) => d.source === "ai") ? "ai" : "rule",
        last_error: [aiError, anyCostError].filter(Boolean).join(" | ") || null,
        last_cost_source: isProviderCosted(s)
          ? (anyCostError ? "provider_api (unavailable)" : "provider_api (official price lists)")
          : "manual",
        ...freeUpdate,
      }).eq("id", raw.id);

      results[s.module] = {
        items: decisions.length,
        applied,
        dry_run: dryRun,
        review_only: reviewOnly,
        cost_model: (s as any).cost_model ?? "manual",
        ai_error: aiError,
        cost_error: anyCostError,
        free_units: freeUnits,
        free_cost_inr: freeCost,
        free_budget_inr: freeBudget,
        free_budget_exceeded: budgetExceeded,
        free_reason: freeReason,
        free_applied: freeApplied,
        economics: economics
          ? {
            sales_30d: economics.sales_30d,
            sales_90d: economics.sales_90d,
            revenue_30d: economics.revenue_30d,
            revenue_90d: economics.revenue_90d,
            data_quality: economics.data_quality,
            profitability: economics.profitability,
            notes: economics.notes,
          }
          : null,
        new_plans: proposals.map((p) => ({
          name: p.name,
          status: p.status,
          price: p.price,
          cost_inr: p.cost_inr,
          margin_percent: p.margin_percent,
          reason: p.reason,
          created_item_id: p.created_item_id,
        })),
        plan_edits: editOutcomes.map((p) => ({
          name: p.name,
          status: p.status,
          price: p.price,
          margin_percent: p.margin_percent,
          reason: p.reason,
        })),
        plan_retirements: retireOutcomes.map((p) => ({
          name: p.name,
          status: p.status,
          reason: p.reason,
        })),
        decisions: decisions.map((d) => ({
          item: d.itemName,
          old: d.oldPrice,
          new: d.price,
          cost_inr: d.costInr,
          floor_inr: d.floorInr,
          profit_inr: d.profitInr,
          margin: d.marginPercent,
          source: d.source,
          safe: d.safe,
          reason: d.reason,
          cost_error: d.costError ?? null,
          cost_details: d.costDetails ?? null,
        })),
      };


    } catch (e) {
      const message = (e as Error).message;
      await supabase.from("ai_pricing_modules").update({
        last_run_at: new Date().toISOString(),
        last_status: "failed",
        last_error: message,
      }).eq("id", raw.id);
      results[s.module] = { error: message };
    }
  }

  return { ok: true, ran_at: new Date().toISOString(), results };
}

/** Per-module item loading + write-back. */
async function loadModule(
  supabase: any,
  s: ModuleSettings,
  rates: RateMap | null = null,
): Promise<{ items: Item[]; apply: (d: ItemDecision[]) => Promise<void> }> {

  const noop = async () => {};

  switch (s.module) {
    case "job_boost": {
      const { data } = await supabase.from("boost_packages").select("id,name,boost_days,price_inr").eq("is_active", true);
      return {
        items: (data ?? []).map((p: any) => ({
          id: p.id,
          name: p.name,
          units: Number(p.boost_days) || 0,
          currentPrice: Number(p.price_inr) || 0,
        })),
        apply: async (ds) => {
          for (const d of ds) {
            await supabase.from("boost_packages").update({ price_inr: Math.round(d.price) }).eq("id", d.itemId);
          }
        },
      };
    }

    case "verification_badge": {
      const { data } = await supabase.from("verification_packages").select("id,name,validity_days,price_inr").eq("is_active", true);
      return {
        items: (data ?? []).map((p: any) => ({
          id: p.id,
          name: p.name,
          units: Number(p.validity_days) || 0,
          currentPrice: Number(p.price_inr) || 0,
        })),
        apply: async (ds) => {
          for (const d of ds) {
            await supabase.from("verification_packages").update({ price_inr: Math.round(d.price) }).eq("id", d.itemId);
          }
        },
      };
    }

    case "ai_chat_plan": {
      const { data } = await supabase.from("ai_chat_plans").select("*").eq("is_active", true);
      const units = (p: any) =>
        (Number(p.messages_per_month) || 0) +
        (Number(p.voice_playback_per_month) || 0) +
        (Number(p.voice_input_per_month) || 0) +
        (Number(p.image_analysis_per_month) || 0) +
        5 * (Number(p.ai_image_generation_per_month) || 0);
      return {
        // Free plans (price 0) are governed by the free-allowance rule, not repricing.
        items: (data ?? []).filter((p: any) => Number(p.price_inr) > 0).map((p: any) => {
          const base = {
            id: p.id,
            name: p.name,
            units: Math.min(units(p), 20000),
            currentPrice: Number(p.price_inr) || 0,
          };
          if (!rates) return base;
          const configured = costFor(s, base.units);
          return {
            ...base,
            ...applyProviderCost(
              computeAiPlanCost(p, rates, (s as any).usage_assumptions, (s as any).internal_usage_caps),
              configured,
              { plan: p.name, quota_source_table: "ai_chat_plans" },
            ),
          };
        }),
        apply: async (ds) => {
          for (const d of ds) {
            await supabase.from("ai_chat_plans").update({ price_inr: Math.round(d.price) }).eq("id", d.itemId);
          }
        },
      };
    }


    case "job_posting": {
      const { data } = await supabase.from("job_posting_settings").select("*").eq("is_active", true)
        .order("updated_at", { ascending: false }).limit(1);
      const row: any = data?.[0];
      if (!row) return { items: [], apply: noop };
      return {
        items: [{
          id: row.id,
          name: "Points required per job post",
          units: 1,
          currentPrice: Number(row.points_required_per_job) || 0,
        }],
        apply: async (ds) => {
          const d = ds[0];
          if (d) {
            await supabase.from("job_posting_settings").update({ points_required_per_job: Math.round(d.price) }).eq("id", row.id);
          }
        },
      };
    }

    case "job_renewal": {
      const { data } = await supabase.from("job_posting_settings").select("*").eq("is_active", true)
        .order("updated_at", { ascending: false }).limit(1);
      const row: any = data?.[0];
      const packs: any[] = Array.isArray(row?.duration_packages) ? row.duration_packages : [];
      if (!row || !packs.length) return { items: [], apply: noop };
      return {
        items: packs.map((p, i) => ({
          id: `${row.id}:${i}`,
          name: `${p.months} month renewal`,
          units: Number(p.months) || 1,
          currentPrice: Number(p.points) || 0,
        })),
        apply: async (ds) => {
          const next = [...packs];
          for (const d of ds) {
            const idx = Number(d.itemId.split(":")[1]);
            if (Number.isInteger(idx) && next[idx]) next[idx] = { ...next[idx], points: Math.round(d.price), price: Math.round(d.price) };
          }
          await supabase.from("job_posting_settings").update({ duration_packages: next }).eq("id", row.id);
        },
      };
    }

    case "interview": {
      const { data } = await supabase.from("interview_pricing_settings").select("*").eq("is_active", true).limit(1);
      const row: any = data?.[0];
      if (!row) return { items: [], apply: noop };
      const fixed = rates ? computeInterviewFixedCost(rates, (s as any).usage_assumptions) : null;
      const perMin = rates ? computeInterviewMinuteCost(rates, (s as any).usage_assumptions) : null;
      return {
        items: [
          {
            id: `${row.id}:per_interview`,
            name: "Points per interview",
            units: 1,
            costInr: Number(s.fixed_cost_inr),
            currentPrice: Number(row.points_per_interview) || 0,
            ...(fixed ? applyProviderCost(fixed, Number(s.fixed_cost_inr)) : {}),
          },
          {
            id: `${row.id}:per_minute`,
            name: "Points per interview minute",
            units: 1,
            costInr: Number(s.unit_cost_inr),
            minProfitInr: Number(s.min_profit_inr) / 30,
            currentPrice: Number(row.points_per_minute) || 0,
            ...(perMin ? applyProviderCost(perMin, Number(s.unit_cost_inr)) : {}),
          },
        ],

        apply: async (ds) => {
          const patch: Record<string, number> = {};
          for (const d of ds) {
            if (d.itemId.endsWith("per_interview")) patch.points_per_interview = Math.round(d.price);
            if (d.itemId.endsWith("per_minute")) patch.points_per_minute = Math.round(d.price);
          }
          if (Object.keys(patch).length) {
            await supabase.from("interview_pricing_settings").update(patch).eq("id", row.id);
          }
        },
      };
    }

    default:
      return { items: [], apply: noop };
  }
}
