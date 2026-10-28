// Generic loss-protection pricing engine shared by every monetized module
// (wallet points, job boost, verification badge, job posting, job renewal,
// interviews, AI chat plans).
//
// Hard invariant enforced here, for every module and every AI suggestion:
//
//   selling price  >=  (cost + minimum profit) * (1 + GST%) / (1 - gateway fee%)
//   and             >=  cost / (1 - minMargin%)  (margin floor)
//
// The AI can only ever move the price *inside* the safe band. If the AI is
// missing, rate limited, out of credits or returns garbage, the rule engine
// picks the price and the module keeps selling at a safe value.

export interface ModuleSettings {
  module: string;
  price_kind: "inr" | "points" | string;
  ai_enabled: boolean;
  auto_apply: boolean;
  unit_cost_inr: number;
  fixed_cost_inr: number;
  points_value_inr: number;
  tax_percent: number;
  payment_fee_percent: number;
  min_profit_inr: number;
  min_margin_percent: number;
  max_change_percent: number;
  price_floor_inr: number;
  price_ceiling_inr: number;
  free_tier_enabled: boolean;
  free_tier_units: number;
  free_tier_max_cost_inr: number;
}

export interface PriceDecision {
  price: number; // final price in the module's unit (INR or points)
  priceInr: number; // always the INR equivalent
  costInr: number;
  profitInr: number;
  marginPercent: number;
  floorInr: number;
  source: "ai" | "rule";
  safe: boolean;
  reason: string;
}

const num = (v: unknown, fallback = 0): number => {
  const n = typeof v === "string" ? Number(v) : (v as number);
  return typeof n === "number" && Number.isFinite(n) ? n : fallback;
};

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

/** cost + min profit, grossed up for GST and the payment gateway fee. */
export function floorPriceInr(costInr: number, s: ModuleSettings): number {
  const tax = clamp(num(s.tax_percent), 0, 90);
  const fee = clamp(num(s.payment_fee_percent), 0, 90);
  const minProfit = Math.max(0, num(s.min_profit_inr));
  const minMargin = clamp(num(s.min_margin_percent), 0, 90);

  const profitFloor = ((costInr + minProfit) * (1 + tax / 100)) / (1 - fee / 100);
  // Margin floor: net revenue after GST + fee must keep minMargin% margin.
  const marginFloor = minMargin > 0
    ? ((costInr / (1 - minMargin / 100)) * (1 + tax / 100)) / (1 - fee / 100)
    : 0;

  return Math.max(profitFloor, marginFloor);
}

/** Net profit at a given selling price, after GST and gateway fee. */
export function profitAtInr(priceInr: number, costInr: number, s: ModuleSettings): number {
  const tax = clamp(num(s.tax_percent), 0, 90);
  const fee = clamp(num(s.payment_fee_percent), 0, 90);
  const afterFee = priceInr * (1 - fee / 100);
  const net = afterFee / (1 + tax / 100);
  return net - costInr;
}

export interface DecideInput {
  settings: ModuleSettings;
  /** Our real cost for this item, in INR. */
  costInr: number;
  /** Current price in the module unit (INR or points). */
  currentPrice: number;
  /** Optional AI suggestion, in the module unit. Anything invalid is ignored. */
  suggestedPrice?: unknown;
  /** Optional AI market reference price (module unit) used as a soft ceiling. */
  marketReferencePrice?: unknown;
}

export function decideSafePrice(input: DecideInput): PriceDecision {
  const s = input.settings;
  const points = s.price_kind === "points";
  const pv = Math.max(0.01, num(s.points_value_inr, 1));
  const toInr = (p: number) => (points ? p * pv : p);
  const fromInr = (inr: number) => (points ? Math.ceil(inr / pv) : Math.ceil(inr));

  const costInr = Math.max(0, num(input.costInr));
  const floor = floorPriceInr(costInr, s);
  const currentInr = toInr(Math.max(0, num(input.currentPrice)));

  const ceilingSetting = num(s.price_ceiling_inr);
  const marketRef = num(input.marketReferencePrice, 0);
  const marketCeilInr = marketRef > 0 ? toInr(marketRef) * 1.15 : 0;
  let ceiling = Math.max(floor, ceilingSetting > 0 ? ceilingSetting : Number.POSITIVE_INFINITY);
  if (marketCeilInr > 0) ceiling = Math.min(ceiling, Math.max(floor, marketCeilInr));

  // Gradual movement guard: never jump more than max_change_percent from the
  // live price — unless the floor forces a bigger rise (loss protection wins).
  const maxChange = clamp(num(s.max_change_percent, 20), 1, 500);
  const changeCap = currentInr > 0 ? currentInr * (1 + maxChange / 100) : Number.POSITIVE_INFINITY;
  const changeFloor = currentInr > 0 ? currentInr * (1 - maxChange / 100) : 0;

  const rawSuggestion = num(input.suggestedPrice, NaN);
  const hasAi = s.ai_enabled && Number.isFinite(rawSuggestion) && rawSuggestion > 0;

  let targetInr: number;
  let source: "ai" | "rule";
  let reason: string;

  if (hasAi) {
    source = "ai";
    targetInr = toInr(rawSuggestion);
    reason = "AI suggestion clamped into the safe band";
  } else {
    source = "rule";
    // Rule baseline: keep the current price when it already clears the floor,
    // otherwise lift it just above the floor.
    targetInr = currentInr > 0 ? currentInr : floor;
    reason = s.ai_enabled
      ? "AI unavailable or invalid suggestion — rule-based safe price"
      : "AI pricing off — rule-based safe price";
  }

  // Apply the movement guard, then the hard floor / ceiling. Floor is last so
  // it can never be violated.
  targetInr = clamp(targetInr, Math.min(changeFloor, changeCap), Math.max(changeFloor, changeCap));
  targetInr = Math.min(targetInr, ceiling);
  if (targetInr < floor) {
    targetInr = floor;
    reason += "; raised to the loss floor";
  }
  if (s.price_floor_inr > 0 && targetInr < s.price_floor_inr) {
    targetInr = s.price_floor_inr;
    reason += "; raised to the admin minimum price";
  }

  const price = Math.max(points ? 1 : 1, fromInr(targetInr));
  const priceInr = toInr(price);
  const profitInr = profitAtInr(priceInr, costInr, s);
  const marginPercent = priceInr > 0 ? (profitInr / priceInr) * 100 : 0;

  return {
    price,
    priceInr: Math.round(priceInr * 100) / 100,
    costInr: Math.round(costInr * 100) / 100,
    profitInr: Math.round(profitInr * 100) / 100,
    marginPercent: Math.round(marginPercent * 10) / 10,
    floorInr: Math.round(floor * 100) / 100,
    source,
    safe: profitInr >= Math.max(0, num(s.min_profit_inr)) - 0.51 && priceInr >= floor - 1,
    reason,
  };
}

/**
 * How much we may give away for free without losing money: the free allowance
 * is capped both by the admin unit count and by the monthly free-cost budget.
 */
export function decideFreeAllowance(
  s: ModuleSettings,
  suggestedUnits?: unknown,
): { units: number; costInr: number; reason: string } {
  if (!s.free_tier_enabled) return { units: 0, costInr: 0, reason: "Free tier off" };

  const unitCost = Math.max(0, num(s.unit_cost_inr));
  const adminUnits = Math.max(0, Math.floor(num(s.free_tier_units)));
  const budget = Math.max(0, num(s.free_tier_max_cost_inr));

  const ai = num(suggestedUnits, NaN);
  let units = s.ai_enabled && Number.isFinite(ai) && ai >= 0 ? Math.floor(ai) : adminUnits;
  let reason = s.ai_enabled && Number.isFinite(ai) && ai >= 0
    ? "AI free allowance capped by admin units and budget"
    : "Admin free allowance";

  units = Math.min(units, adminUnits);

  if (unitCost > 0 && budget > 0) {
    const affordable = Math.floor(budget / unitCost);
    if (units > affordable) {
      units = affordable;
      reason += "; trimmed to the free-cost budget";
    }
  } else if (unitCost > 0 && budget <= 0) {
    units = 0;
    reason = "No free budget configured — free allowance set to 0";
  }

  return { units: Math.max(0, units), costInr: Math.round(units * unitCost * 100) / 100, reason };
}
