// Safety tests for AI-created plans. No network, no database: a tiny in-memory
// stub stands in for Supabase so the creation guards can be verified exactly.

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createAiProposedPlans } from "./newPlans.ts";
import type { ModuleSettings } from "./engine.ts";

const settings = (over: Partial<ModuleSettings> = {}): ModuleSettings => ({
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
  max_change_percent: 20,
  price_floor_inr: 0,
  price_ceiling_inr: 2000,
  free_tier_enabled: false,
  free_tier_units: 0,
  free_tier_max_cost_inr: 0,
  ...over,
  // creation-specific flags live alongside ModuleSettings on the DB row
} as ModuleSettings);

/** Minimal supabase stub: one active points package, records inserts. */
function stub(existing: Array<Record<string, unknown>>) {
  const inserted: Array<Record<string, unknown>> = [];
  const api = {
    inserted,
    from(table: string) {
      return {
        select: () => ({ eq: () => Promise.resolve({ data: existing }) }),
        insert(row: Record<string, unknown>) {
          inserted.push({ table, ...row });
          return {
            select: () => ({
              single: () => Promise.resolve({ data: { id: `new-${inserted.length}` }, error: null }),
            }),
          };
        },
      };
    },
  };
  return api;
}

const existingPacks = [
  { id: "1", name: "Basic Pack", price_inr: 99, boost_days: 3, is_active: true },
  { id: "2", name: "Value Pack", price_inr: 199, boost_days: 7, is_active: true },
];

const opts = { rates: null, dryRun: false, dataQuality: "sufficient" as const, aiNote: null };

Deno.test("a sensible, profitable plan is created and published to the listing", async () => {
  const supabase = stub([...existingPacks]);
  const s = { ...settings(), allow_new_plans: true, max_new_plans_per_run: 1 } as ModuleSettings;
  const out = await createAiProposedPlans(supabase, s, [
    { name: "Mega Pack", price: 499, limits: { boost_days: 14 }, features: ["14 days boost"], reason: "gap above Value Pack" },
  ], opts);

  assertEquals(out.length, 1);
  assertEquals(out[0].status, "created");
  assertEquals(supabase.inserted.length, 1);
  assertEquals(supabase.inserted[0].table, "boost_packages");
  assertEquals(supabase.inserted[0].boost_days, 14);
  // Price is the safety-engine price, never below the loss floor.
  const price = Number(supabase.inserted[0].price_inr);
  assertEquals(price >= (out[0].floor_inr ?? 0), true);
  assertEquals((out[0].profit_inr ?? 0) >= 20 - 0.51, true);
});

Deno.test("loss-making proposal is rejected, nothing is inserted", async () => {
  const supabase = stub([...existingPacks]);
  const s = { ...settings(), allow_new_plans: true, price_ceiling_inr: 50 } as ModuleSettings;
  const out = await createAiProposedPlans(supabase, s, [
    { name: "Cheap Mega", price: 10, limits: { boost_days: 5000 } },
  ], opts);

  assertEquals(out[0].status, "rejected");
  assertEquals(supabase.inserted.length, 0);
});

Deno.test("duplicate / dominated / nonsense plans are rejected", async () => {
  const supabase = stub([...existingPacks]);
  const s = { ...settings(), allow_new_plans: true, max_new_plans_per_run: 3 } as ModuleSettings;
  const out = await createAiProposedPlans(supabase, s, [
    { name: "Basic Pack", price: 149, limits: { boost_days: 4 } }, // duplicate name
    { name: "!!", price: 149, limits: { boost_days: 4 } }, // nonsense name
    { name: "Tiny Pack", price: 999, limits: { boost_days: 1 } }, // dominated by Basic Pack
    { name: "Bad Units", price: 199, limits: { boost_days: -5 } }, // invalid quota
  ], opts);

  assertEquals(out.every((o) => o.status === "rejected"), true);
  assertEquals(supabase.inserted.length, 0);
});

Deno.test("creation is blocked on thin data, on dry runs and when the module forbids it", async () => {
  const proposal = [{ name: "Mega Pack", price: 499, limits: { boost_days: 14 } }];

  for (
    const [label, s, o] of [
      ["thin data", { ...settings(), allow_new_plans: true } as unknown as ModuleSettings, { ...opts, dataQuality: "insufficient" as const }],
      ["dry run", { ...settings(), allow_new_plans: true } as unknown as ModuleSettings, { ...opts, dryRun: true }],
      ["not allowed", { ...settings(), allow_new_plans: false } as unknown as ModuleSettings, opts],
    ] as Array<[string, ModuleSettings, typeof opts]>
  ) {
    const supabase = stub([...existingPacks]);
    const out = await createAiProposedPlans(supabase, s, proposal, o);
    assertEquals(out[0].status, "rejected", label);
    assertEquals(supabase.inserted.length, 0, label);
  }
});

Deno.test("the per-run creation limit is enforced", async () => {
  const supabase = stub([...existingPacks]);
  const s = { ...settings(), allow_new_plans: true, max_new_plans_per_run: 1 } as ModuleSettings;
  const out = await createAiProposedPlans(supabase, s, [
    { name: "Mega Pack", price: 499, limits: { boost_days: 14 } },
    { name: "Ultra Pack", price: 899, limits: { boost_days: 28 } },
  ], opts);

  assertEquals(out.filter((o) => o.status === "created").length, 1);
  assertEquals(supabase.inserted.length, 1);
});
