// Provider-API cost model for the cost-aware modules (Enterprise/AI Plans and
// Interviews).
//
// Rule: the *official / current* provider pricing document is the source of
// truth for our cost, not a hand-typed number. Rates live in
// `ai_pricing_provider_rates` (provider, service, unit, unit price, source URL,
// document date) so that when a provider changes its price list, the very next
// pricing audit computes with the new cost.
//
// Every cost result is either
//   { ok: true,  costInr, breakdown, assumptions, sources }
// or
//   { ok: false, error }  -> the caller MUST NOT reprice from an unsafe
//                            estimate; it keeps the last known-good price and
//                            writes the error into the audit log.

export interface ProviderRate {
  module: string;
  rate_key: string;
  provider: string;
  service: string;
  unit: string;
  unit_price_usd: number | null;
  unit_price_inr: number | null;
  usd_inr: number;
  source_url: string;
  source_doc_date: string;
  is_active: boolean;
  notes: string | null;
}

export interface CostLine {
  provider: string;
  service: string;
  rate_key: string;
  unit: string;
  unit_price_inr: number;
  units: number;
  cost_inr: number;
  source_url: string;
  source_doc_date: string;
}

export type CostResult =
  | {
    ok: true;
    costInr: number;
    breakdown: CostLine[];
    assumptions: Record<string, unknown>;
    sources: Array<{ provider: string; source_url: string; source_doc_date: string }>;
  }
  | { ok: false; error: string };

export type RateMap = Map<string, ProviderRate>;

const num = (v: unknown, fallback = NaN): number => {
  const n = typeof v === "string" ? Number(v) : (v as number);
  return typeof n === "number" && Number.isFinite(n) ? n : fallback;
};

const r2 = (n: number) => Math.round(n * 10000) / 10000;

/** Provider price documents older than this are refused as a cost basis. */
const MAX_RATE_AGE_DAYS = 400;

/** Load the active provider rate catalog for a module (+ shared rates). */
export async function loadProviderRates(
  supabase: any,
  module: string,
): Promise<{ ok: true; rates: RateMap } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from("ai_pricing_provider_rates")
    .select("*")
    .eq("is_active", true)
    .in("module", [module, "shared"])
    .lte("effective_from", new Date().toISOString().slice(0, 10));

  if (error) return { ok: false, error: `Provider rate lookup failed: ${error.message}` };
  if (!data || !data.length) return { ok: false, error: "No active provider rates configured" };

  const rates: RateMap = new Map();
  for (const row of data as ProviderRate[]) {
    // Module-specific rate always wins over a shared rate with the same key.
    const existing = rates.get(row.rate_key);
    if (!existing || existing.module === "shared") rates.set(row.rate_key, row);
  }

  // Periodic cost refresh guard: a rate whose source document is older than
  // MAX_RATE_AGE_DAYS is treated as unusable, so the run keeps the last
  // known-good price instead of pricing from stale provider costs.
  const stale: string[] = [];
  const cutoff = Date.now() - MAX_RATE_AGE_DAYS * 86400_000;
  for (const [key, rate] of rates) {
    const docDate = Date.parse(String(rate.source_doc_date ?? ""));
    if (!Number.isFinite(docDate) || docDate < cutoff) stale.push(key);
  }
  if (stale.length) {
    return {
      ok: false,
      error: `Provider price list is stale (older than ${MAX_RATE_AGE_DAYS} days) for: ${
        stale.slice(0, 8).join(", ")
      } — refresh ai_pricing_provider_rates before repricing`,
    };
  }

  return { ok: true, rates };
}

/** INR price of one unit of a rate, or null when the rate is unusable. */
function rateInr(rates: RateMap, key: string): { rate: ProviderRate; inr: number } | null {
  const rate = rates.get(key);
  if (!rate) return null;
  const fx = num(rate.usd_inr, NaN);
  const usd = num(rate.unit_price_usd, NaN);
  const inrDirect = num(rate.unit_price_inr, NaN);
  if (Number.isFinite(inrDirect) && inrDirect >= 0) return { rate, inr: inrDirect };
  if (Number.isFinite(usd) && usd >= 0 && Number.isFinite(fx) && fx > 0) {
    return { rate, inr: usd * fx };
  }
  return null;
}

class CostBuilder {
  lines: CostLine[] = [];
  missing: string[] = [];
  constructor(private rates: RateMap) {}

  add(key: string, units: number) {
    if (!Number.isFinite(units) || units < 0) {
      this.missing.push(`${key} (invalid usage units)`);
      return;
    }
    const r = rateInr(this.rates, key);
    if (!r) {
      this.missing.push(`${key} (missing/invalid provider rate)`);
      return;
    }
    this.lines.push({
      provider: r.rate.provider,
      service: r.rate.service,
      rate_key: key,
      unit: r.rate.unit,
      unit_price_inr: r2(r.inr),
      units: r2(units),
      cost_inr: r2(r.inr * units),
      source_url: r.rate.source_url,
      source_doc_date: String(r.rate.source_doc_date).slice(0, 10),
    });
  }

  finish(assumptions: Record<string, unknown>, overheadPercent: number): CostResult {
    if (this.missing.length) {
      return { ok: false, error: `Provider cost unavailable: ${this.missing.join("; ")}` };
    }
    const base = this.lines.reduce((s, l) => s + l.cost_inr, 0);
    const overhead = base * (Math.max(0, overheadPercent) / 100);
    if (overhead > 0) {
      this.lines.push({
        provider: "Workly India",
        service: `Operational overhead (${overheadPercent}% of API cost: retries, failures, wastage)`,
        rate_key: "overhead",
        unit: "% of API cost",
        unit_price_inr: r2(overhead),
        units: 1,
        cost_inr: r2(overhead),
        source_url: "internal",
        source_doc_date: new Date().toISOString().slice(0, 10),
      });
    }
    const seen = new Set<string>();
    const sources: Array<{ provider: string; source_url: string; source_doc_date: string }> = [];
    for (const l of this.lines) {
      const k = `${l.provider}|${l.source_url}`;
      if (l.source_url === "internal" || seen.has(k)) continue;
      seen.add(k);
      sources.push({ provider: l.provider, source_url: l.source_url, source_doc_date: l.source_doc_date });
    }
    return {
      ok: true,
      costInr: Math.round((base + overhead) * 100) / 100,
      breakdown: this.lines,
      assumptions,
      sources,
    };
  }
}

const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};

/**
 * Resolve a plan quota into the number of units we will actually pay for.
 * "Unlimited" (the 999999 sentinel, or anything at/above it) is NEVER treated
 * as unlimited cost: it collapses to the documented internal usage cap.
 */
export function resolveQuota(
  quota: unknown,
  capKey: string,
  caps: Record<string, unknown>,
): { units: number; unlimited: boolean; cap: number } {
  const sentinel = num(caps.unlimited_sentinel, 999999);
  const cap = num(caps[capKey], NaN);
  const q = num(quota, 0);
  const unlimited = q >= sentinel;
  if (unlimited) {
    return { units: Number.isFinite(cap) ? cap : NaN, unlimited: true, cap: Number.isFinite(cap) ? cap : NaN };
  }
  // A finite quota is still capped by the internal cap when one is defined, so
  // a mis-typed quota can never explode the cost model.
  const units = Number.isFinite(cap) ? Math.min(q, cap) : q;
  return { units, unlimited: false, cap: Number.isFinite(cap) ? cap : NaN };
}

/** Documented monthly provider cost of one AI chat / Enterprise plan quota. */
export function computeAiPlanCost(
  plan: Record<string, unknown>,
  rates: RateMap,
  usageAssumptions: unknown,
  internalCaps: unknown,
): CostResult {
  const a = obj(usageAssumptions);
  const caps = obj(internalCaps);
  const b = new CostBuilder(rates);

  const msg = obj(a.chat_message);
  const analysis = obj(a.image_analysis);
  const voiceIn = obj(a.voice_input);
  const voiceOut = obj(a.voice_playback);

  const msgIn = num(msg.input_tokens, NaN);
  const msgOut = num(msg.output_tokens, NaN);
  const anIn = num(analysis.input_tokens, NaN) + num(analysis.image_tokens, 0);
  const anOut = num(analysis.output_tokens, NaN);
  const sttSeconds = num(voiceIn.audio_seconds, NaN);
  const ttsChars = num(voiceOut.characters, NaN);

  const messages = resolveQuota(plan.messages_per_month, "messages_per_month", caps);
  const analyses = resolveQuota(plan.image_analysis_per_month, "image_analysis_per_month", caps);
  const vIn = resolveQuota(plan.voice_input_per_month, "voice_input_per_month", caps);
  const vOut = resolveQuota(plan.voice_playback_per_month, "voice_playback_per_month", caps);
  const images = resolveQuota(plan.ai_image_generation_per_month, "ai_image_generation_per_month", caps);

  const unresolved = [
    ["messages_per_month", messages],
    ["image_analysis_per_month", analyses],
    ["voice_input_per_month", vIn],
    ["voice_playback_per_month", vOut],
    ["ai_image_generation_per_month", images],
  ].filter(([, q]) => !Number.isFinite((q as { units: number }).units)).map(([k]) => k as string);

  if (unresolved.length) {
    return {
      ok: false,
      error: `Unlimited quota without a documented internal usage cap: ${unresolved.join(", ")}`,
    };
  }
  if (![msgIn, msgOut, anIn, anOut, sttSeconds, ttsChars].every((v) => Number.isFinite(v))) {
    return { ok: false, error: "Usage assumptions incomplete for the AI plan cost model" };
  }

  // LLM text tokens (chat messages + image-analysis prompts)
  b.add("llm_chat_input_per_1k_tokens", (messages.units * msgIn + analyses.units * anIn) / 1000);
  b.add("llm_chat_output_per_1k_tokens", (messages.units * msgOut + analyses.units * anOut) / 1000);
  // Voice input (speech to text), voice playback (text to speech), image generation
  b.add("stt_per_minute", (vIn.units * sttSeconds) / 60);
  b.add("tts_per_1k_chars", (vOut.units * ttsChars) / 1000);
  b.add("image_gen_per_image", images.units);
  // Fixed platform/infra cost per paid subscriber-month
  b.add("platform_infra_per_plan_month", 1);

  return b.finish({
    billing_period: "1 month per subscriber",
    quota_used_for_costing: {
      messages: messages.units,
      image_analysis: analyses.units,
      voice_input: vIn.units,
      voice_playback: vOut.units,
      image_generation: images.units,
    },
    unlimited_quotas_capped: {
      messages: messages.unlimited,
      image_analysis: analyses.unlimited,
      voice_input: vIn.unlimited,
      voice_playback: vOut.unlimited,
      image_generation: images.unlimited,
    },
    internal_usage_caps: caps,
    per_unit_assumptions: a,
  }, num(a.overhead_percent, 0));
}

/** Documented provider cost of one interview minute (all live APIs combined). */
export function computeInterviewMinuteCost(rates: RateMap, usageAssumptions: unknown): CostResult {
  const a = obj(usageAssumptions);
  const participants = num(a.participants_per_interview, NaN);
  if (!Number.isFinite(participants) || participants <= 0) {
    return { ok: false, error: "participants_per_interview assumption missing" };
  }
  const b = new CostBuilder(rates);
  b.add("video_room_per_participant_minute", participants);
  if (a.recording_enabled !== false) b.add("video_recording_per_minute", 1);
  if (a.transcription_enabled !== false) b.add("stt_per_minute", 1);
  return b.finish({
    unit: "1 interview minute",
    participants_per_interview: participants,
    recording_enabled: a.recording_enabled !== false,
    transcription_enabled: a.transcription_enabled !== false,
  }, num(a.overhead_percent, 0));
}

/** Documented fixed provider cost per interview (AI report + platform infra). */
export function computeInterviewFixedCost(rates: RateMap, usageAssumptions: unknown): CostResult {
  const a = obj(usageAssumptions);
  const report = obj(a.ai_report);
  const inTok = num(report.input_tokens, NaN);
  const outTok = num(report.output_tokens, NaN);
  if (!Number.isFinite(inTok) || !Number.isFinite(outTok)) {
    return { ok: false, error: "ai_report token assumptions missing" };
  }
  const b = new CostBuilder(rates);
  b.add("llm_chat_input_per_1k_tokens", inTok / 1000);
  b.add("llm_chat_output_per_1k_tokens", outTok / 1000);
  b.add("platform_infra_per_interview", 1);
  return b.finish({
    unit: "1 interview (fixed, duration independent)",
    ai_report: report,
  }, num(a.overhead_percent, 0));
}
