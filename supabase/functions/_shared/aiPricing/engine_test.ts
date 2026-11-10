// Loss-protection stress test for the generic AI auto-pricing engine.
//
// Combined shocks, all at once, for every module kind:
//   * our cost spikes         +0% / +10% / +20% / +50% / +120%
//   * gateway fee rises       2% -> 3% -> 5% -> 12%
//   * GST                     0% / 18% / 28%
//   * the AI suggests garbage / free / negative / absurd prices, or nothing
//
// Invariant: final selling price >= cost + GST + gateway fee + min profit.

import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  decideFreeAllowance,
  decideSafePrice,
  floorPriceInr,
  type ModuleSettings,
} from "./engine.ts";

const base: ModuleSettings = {
  module: "test",
  price_kind: "inr",
  ai_enabled: true,
  auto_apply: true,
  unit_cost_inr: 1,
  fixed_cost_inr: 0,
  points_value_inr: 1,
  tax_percent: 18,
  payment_fee_percent: 2.5,
  min_profit_inr: 25,
  min_margin_percent: 15,
  max_change_percent: 20,
  price_floor_inr: 0,
  price_ceiling_inr: 0,
  free_tier_enabled: true,
  free_tier_units: 20,
  free_tier_max_cost_inr: 10,
};

const COST_MULTIPLIERS = [1, 1.1, 1.2, 1.5, 2.2];
const FEES = [2, 3, 5, 12];
const TAXES = [0, 18, 28];
const POINT_VALUES = [1, 0.5, 2.5];
const AI_PRICES: Array<{ label: string; price: unknown; market?: unknown }> = [
  { label: "no AI answer", price: undefined },
  { label: "AI says free", price: 0 },
  { label: "AI says negative", price: -500 },
  { label: "AI says 1 rupee", price: 1 },
  { label: "AI returns garbage", price: "cheap" },
  { label: "AI returns NaN", price: NaN },
  { label: "AI says absurd market ref 9", price: 10, market: 9 },
  { label: "AI says 100000", price: 100000 },
];

/** Independent re-derivation of the floor, straight from the formula. */
function floorFormula(cost: number, tax: number, fee: number, minProfit: number, minMargin: number) {
  const a = ((cost + minProfit) * (1 + tax / 100)) / (1 - fee / 100);
  const b = minMargin > 0 ? ((cost / (1 - minMargin / 100)) * (1 + tax / 100)) / (1 - fee / 100) : 0;
  return Math.max(a, b);
}

Deno.test("no module can ever be priced below cost + GST + fee + min profit", () => {
  const failures: string[] = [];
  let cases = 0;

  for (const kind of ["inr", "points"] as const) {
    for (const pv of kind === "points" ? POINT_VALUES : [1]) {
      for (const mult of COST_MULTIPLIERS) {
        for (const fee of FEES) {
          for (const tax of TAXES) {
            for (const ai of AI_PRICES) {
              const settings: ModuleSettings = {
                ...base,
                price_kind: kind,
                points_value_inr: pv,
                tax_percent: tax,
                payment_fee_percent: fee,
              };
              const costInr = 120 * mult;
              const d = decideSafePrice({
                settings,
                costInr,
                currentPrice: kind === "points" ? Math.ceil(199 / pv) : 199,
                suggestedPrice: ai.price,
                marketReferencePrice: ai.market,
              });
              cases++;

              const label = `${kind}(pv ${pv}) cost x${mult} fee ${fee}% gst ${tax}% ${ai.label}`;
              const floor = floorFormula(costInr, tax, fee, base.min_profit_inr, base.min_margin_percent);

              if (d.priceInr < floor - 1) {
                failures.push(`${label}: price ₹${d.priceInr} < floor ₹${floor.toFixed(2)}`);
              }
              if (d.profitInr < base.min_profit_inr - 1) {
                failures.push(`${label}: profit ₹${d.profitInr} < min ₹${base.min_profit_inr}`);
              }
              if (!d.safe) failures.push(`${label}: engine reported unsafe`);
              if (d.price <= 0) failures.push(`${label}: non-positive price`);
            }
          }
        }
      }
    }
  }

  console.log(`stress-tested ${cases} pricing scenarios`);
  assertEquals(failures, [], `loss floor breached:\n${failures.join("\n")}`);
});

Deno.test("AI unavailable (no key / 429 / 402 / timeout) still yields a safe rule price", () => {
  const d = decideSafePrice({
    settings: { ...base, payment_fee_percent: 5, tax_percent: 18 },
    costInr: 400,
    currentPrice: 199,
    suggestedPrice: undefined,
  });
  assertEquals(d.source, "rule");
  assert(d.safe, "rule path produced an unsafe price");
  assert(d.priceInr >= d.floorInr - 1, "rule price below the floor");
  assert(d.profitInr >= base.min_profit_inr - 1);
});

Deno.test("AI pricing switched off leaves the rule engine in charge", () => {
  const d = decideSafePrice({
    settings: { ...base, ai_enabled: false },
    costInr: 100,
    currentPrice: 499,
    suggestedPrice: 49,
  });
  assertEquals(d.source, "rule");
  assert(d.priceInr >= d.floorInr - 1);
});

Deno.test("admin ceiling and market ceiling never push the price under the floor", () => {
  const d = decideSafePrice({
    settings: { ...base, price_ceiling_inr: 50 },
    costInr: 300,
    currentPrice: 199,
    suggestedPrice: 40,
    marketReferencePrice: 10,
  });
  assert(d.priceInr >= floorPriceInr(300, base) - 1, "ceiling beat the loss floor");
});

Deno.test("free allowance never exceeds the free-cost budget", () => {
  const a = decideFreeAllowance({ ...base, unit_cost_inr: 2, free_tier_max_cost_inr: 10, free_tier_units: 50 }, 999);
  assertEquals(a.units, 5);
  assert(a.costInr <= 10);

  const off = decideFreeAllowance({ ...base, free_tier_enabled: false }, 100);
  assertEquals(off.units, 0);

  const noBudget = decideFreeAllowance({ ...base, unit_cost_inr: 1, free_tier_max_cost_inr: 0 }, 10);
  assertEquals(noBudget.units, 0);
});
