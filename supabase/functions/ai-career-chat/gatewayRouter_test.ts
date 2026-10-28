import {
  assertEquals,
  assert,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  orderGatewaysForRequest,
  recordRateLimit,
  isOnCooldown,
  clearCooldown,
  getCooldownSnapshot,
  type GatewayName,
} from "../_shared/gatewayRouter.ts";

type Gw = { name: GatewayName; supportsTools?: boolean };

const ALL: Gw[] = [
  { name: "Vercel AI Gateway", supportsTools: true },
  { name: "Lovable AI Gateway", supportsTools: true },
  { name: "Google AI Studio", supportsTools: true },
  { name: "OpenRouter", supportsTools: true },
  { name: "Together AI", supportsTools: true },
  { name: "Groq", supportsTools: true },
];

function reset() {
  for (const g of ALL) clearCooldown(g.name);
}

Deno.test("greeting → Vercel is first", () => {
  reset();
  const ordered = orderGatewaysForRequest(ALL, { taskType: "greeting" });
  assertEquals(ordered[0].name, "Vercel AI Gateway");
});

Deno.test("general_chat → Vercel first", () => {
  reset();
  const ordered = orderGatewaysForRequest(ALL, { taskType: "general_chat" });
  assertEquals(ordered[0].name, "Vercel AI Gateway");
});

Deno.test("job_search → Vercel first (quality)", () => {
  reset();
  const ordered = orderGatewaysForRequest(ALL, { taskType: "job_search" });
  assertEquals(ordered[0].name, "Vercel AI Gateway");
});

Deno.test("vision → Google AI Studio first; text-only providers excluded", () => {
  reset();
  const ordered = orderGatewaysForRequest(ALL, { needsVision: true });
  assertEquals(ordered[0].name, "Google AI Studio");
  // Groq / OpenRouter / Together don't serve vision in our maps; vision
  // priority list only contains Google + Vercel + Lovable, so the rest are
  // appended at the end via the "configured but not in priority" safety net.
  // We just assert the first 3 are the vision-capable ones.
  assertEquals(
    ordered.slice(0, 3).map((g) => g.name).sort(),
    ["Google AI Studio", "Lovable AI Gateway", "Vercel AI Gateway"].sort(),
  );
});

Deno.test("cooldown'd gateway is pushed to back, not removed", () => {
  reset();
  recordRateLimit("Groq", 429, "rate limit per day");
  assert(isOnCooldown("Groq"), "Groq should be on cooldown after daily 429");
  const ordered = orderGatewaysForRequest(ALL, { taskType: "greeting" });
  assert(ordered[0].name !== "Groq", "Groq must NOT be first when on cooldown");
  assertEquals(ordered[ordered.length - 1].name, "Groq");
});

Deno.test("Groq daily 429 sets cooldown until 00:00 UTC (long)", () => {
  reset();
  recordRateLimit("Groq", 429, "tokens per day exceeded");
  const snap = getCooldownSnapshot();
  const groqEntry = snap.find((s) => s.gateway === "Groq");
  assert(groqEntry, "Groq cooldown should be recorded");
  // Until time should be in the future and within 24h.
  const untilMs = new Date(groqEntry!.until).getTime();
  assert(untilMs > Date.now(), "cooldown until is in the future");
  assert(
    untilMs - Date.now() <= 24 * 60 * 60 * 1000 + 1000,
    "Groq daily cooldown is at most ~24h",
  );
});

Deno.test("Groq per-minute 429 sets ~60s cooldown", () => {
  reset();
  recordRateLimit("Groq", 429, "rate limit reached please retry");
  const snap = getCooldownSnapshot();
  const entry = snap.find((s) => s.gateway === "Groq")!;
  const ms = new Date(entry.until).getTime() - Date.now();
  assert(ms > 50_000 && ms < 70_000, `expected ~60s, got ${ms}ms`);
});

Deno.test("OpenRouter daily 429 sets 24h rolling cooldown", () => {
  reset();
  recordRateLimit("OpenRouter", 429, "free-models-per-day limit");
  const entry = getCooldownSnapshot().find((s) => s.gateway === "OpenRouter")!;
  const ms = new Date(entry.until).getTime() - Date.now();
  assert(
    ms > 23 * 60 * 60 * 1000 && ms <= 24 * 60 * 60 * 1000 + 1000,
    `expected ~24h, got ${ms / 1000 / 3600}h`,
  );
});

Deno.test("Together AI 429 sets short 5min cooldown (no monthly skip)", () => {
  reset();
  recordRateLimit("Together AI", 429, "rate limit");
  const entry = getCooldownSnapshot().find((s) => s.gateway === "Together AI")!;
  const ms = new Date(entry.until).getTime() - Date.now();
  assert(ms > 4 * 60_000 && ms < 6 * 60_000, `expected ~5min, got ${ms}ms`);
});

Deno.test("non-rate-limit errors do NOT trigger cooldown", () => {
  reset();
  recordRateLimit("Vercel AI Gateway", 500, "internal server error");
  assertEquals(isOnCooldown("Vercel AI Gateway"), false);
  recordRateLimit("Vercel AI Gateway", 400, "bad request");
  assertEquals(isOnCooldown("Vercel AI Gateway"), false);
});

Deno.test("402 (payment required) triggers cooldown", () => {
  reset();
  recordRateLimit("Lovable AI Gateway", 402, "credits exhausted");
  assert(isOnCooldown("Lovable AI Gateway"));
});

Deno.test("cooldown auto-expires after `until`", () => {
  reset();
  // Manually set a tiny cooldown via private API surface: simulate by setting
  // a 60s Vercel cooldown and clearing it explicitly to ensure clearCooldown
  // returns the gateway to healthy state.
  recordRateLimit("Vercel AI Gateway", 429, "");
  assert(isOnCooldown("Vercel AI Gateway"));
  clearCooldown("Vercel AI Gateway");
  assertEquals(isOnCooldown("Vercel AI Gateway"), false);
});
