// Safety tests for AI plan EDITS and RETIREMENTS. No network, no database.

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { applyAiPlanEdits, applyAiPlanRetirements } from "./planEdits.ts";
import type { ModuleSettings } from "./engine.ts";

const settings = (over: Record<string, unknown> = {}): ModuleSettings =>
  ({
    module: "job_boost",
    price_kind: "inr",
    ai_enabled: true,
    auto_apply: true,
    unit_cost_inr: 0.35,
    fixed_cost_inr: 0,
    points_value_inr: 1,
    tax_percent: 18,
    payment_fee_percent: 2.5,
    min_profit_inr: 20,
    min_margin_percent: 15,
    max_change_percent: 40,
    price_floor_inr: 0,
    price_ceiling_inr: 2000,
    free_tier_enabled: false,
    free_tier_units: 0,
    free_tier_max_cost_inr: 0,
    allow_edit_plans: true,
    allow_retire_plans: true,
    max_plan_edits_per_run: 2,
    max_plan_retires_per_run: 1,
    ...over,
  }) as unknown as ModuleSettings;

function stub(rows: Array<Record<string, unknown>>) {
  const updates: Array<Record<string, unknown>> = [];
  return {
    updates,
    from() {
      return {
        select: () => ({ eq: () => Promise.resolve({ data: rows }) }),
        update(patch: Record<string, unknown>) {
          return { eq: (_c: string, id: unknown) => { updates.push({ id, ...patch }); return Promise.resolve({ error: null }); } };
        },
      };
    },
  };
}

const packs = () => [
  { id: "1", name: "Basic Pack", price_inr: 99, boost_days: 3, is_active: true },
  { id: "2", name: "Value Pack", price_inr: 199, boost_days: 7, is_active: true },
  { id: "3", name: "Dead Pack", price_inr: 499, boost_days: 14, is_active: true },
];

const opts = { rates: null, dryRun: false, dataQuality: "sufficient" as const, aiNote: null, anomalyFactor: 3 };

Deno.test("a safe edit is applied to the live listing", async () => {
  const supabase = stub(packs());
  const out = await applyAiPlanEdits(supabase, settings(), [
    { target: "Value Pack", price: 249, limits: { boost_days: 7 }, reason: "margin repair" },
  ], opts);
  assertEquals(out[0].status, "created");
  assertEquals(supabase.updates.length, 1);
  assertEquals(supabase.updates[0].id, "2");
});

Deno.test("edits are blocked when the toggle is off, on dry runs and on thin data", async () => {
  const edit = [{ target: "Value Pack", price: 249, limits: { boost_days: 7 } }];
  for (
    const [label, s, o] of [
      ["toggle off", settings({ allow_edit_plans: false }), opts],
      ["dry run", settings(), { ...opts, dryRun: true }],
      ["thin data", settings(), { ...opts, dataQuality: "insufficient" as const }],
    ] as Array<[string, ModuleSettings, typeof opts]>
  ) {
    const supabase = stub(packs());
    const out = await applyAiPlanEdits(supabase, s, edit, o);
    assertEquals(out[0].status, "rejected", label);
    assertEquals(supabase.updates.length, 0, label);
  }
});

Deno.test("a loss-making or unknown-target edit is rejected", async () => {
  const supabase = stub(packs());
  const out = await applyAiPlanEdits(supabase, settings({ price_ceiling_inr: 20 }), [
    { target: "Ghost Pack", price: 249, limits: { boost_days: 7 } },
    { target: "Value Pack", price: 5, limits: { boost_days: 5000 } },
  ], opts);
  assertEquals(out.every((o) => o.status === "rejected"), true);
  assertEquals(supabase.updates.length, 0);
});

Deno.test("retirement hides the plan, never deletes, and keeps 2 plans live", async () => {
  const supabase = stub(packs());
  const out = await applyAiPlanRetirements(supabase, settings(), [
    { target: "Dead Pack", reason: "no sales in 90 days" },
  ], opts);
  assertEquals(out[0].status, "created");
  assertEquals(supabase.updates[0], { id: "3", is_active: false });

  const small = stub(packs().slice(0, 2));
  const out2 = await applyAiPlanRetirements(small, settings(), [{ target: "Value Pack" }], opts);
  assertEquals(out2[0].status, "rejected");
  assertEquals(small.updates.length, 0);
});
