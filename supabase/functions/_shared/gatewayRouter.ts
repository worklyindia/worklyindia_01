// ============================================================================
// Smart Gateway Router
// ----------------------------------------------------------------------------
// Decides the BEST order of AI gateways to try for each request based on:
//  1) Task type   (greeting/chat → fast first; complex/vision → quality first)
//  2) Health      (gateways that recently 429'd are skipped until reset)
//  3) Capability  (gateways that don't support the requested feature skip)
//
// Free-tier strengths (as of 2025) — used for the per-task ordering below:
//   • Vercel AI Gateway   — primary, native model IDs, best tool calls
//   • Lovable AI Gateway  — managed fallback, native model IDs
//   • Google AI Studio    — Gemini fallback for free-tier overflow
//   • OpenRouter          — free community-model fallback, slower
//   • Groq                — fast final fallback for small text-only requests
//
// Free-limit reset cadence (used by recordRateLimit):
//   • Groq                — per-minute & per-day. Day resets 00:00 UTC.
//   • Google AI Studio    — per-minute & per-day. Day resets 00:00 PT (~07:00 UTC).
//   • OpenRouter          — per-day. Day resets 00:00 UTC.
//   • Together AI         — per-month. Skip until 1st of next month.
//   • Vercel / Lovable    — paid (credits). 60s soft cooldown only.
// ============================================================================

export type GatewayName =
  | 'Vercel AI Gateway'
  | 'Lovable AI Gateway'
  | 'Google AI Studio'
  | 'OpenRouter'
  | 'Together AI'
  | 'Groq'
  | 'Cloudflare Workers AI'
  | 'Hugging Face';

// Standard fallback tail shared by every text task: free/cheap providers last.
const TAIL: GatewayName[] = [
  'Groq', 'Together AI', 'Cloudflare Workers AI', 'Hugging Face',
];

// Per-task gateway priority. First entry = preferred, rest = fallbacks.
// Filtered against actually-configured gateways at request time.
const PRIORITY_BY_TASK: Record<string, GatewayName[]> = {
  // ---------- STANDARD CHAIN ----------
  // User-required order: Vercel → Lovable → Google AI Studio → OpenRouter → Groq
  // → Together AI → Cloudflare Workers AI → Hugging Face.
  greeting:        ['Vercel AI Gateway', 'Lovable AI Gateway', 'Google AI Studio', 'OpenRouter', ...TAIL],
  general_chat:    ['Vercel AI Gateway', 'Lovable AI Gateway', 'Google AI Studio', 'OpenRouter', ...TAIL],
  personal_lookup: ['Vercel AI Gateway', 'Lovable AI Gateway', 'Google AI Studio', 'OpenRouter', ...TAIL],
  profile_audit:   ['Vercel AI Gateway', 'Lovable AI Gateway', 'Google AI Studio', 'OpenRouter', ...TAIL],

  // ---------- QUALITY-FIRST ----------
  // Tool-heavy / structured / long-form — quality matters more than latency.
  job_search:          ['Vercel AI Gateway', 'Lovable AI Gateway', 'Google AI Studio', 'OpenRouter', ...TAIL],
  web_search:          ['Vercel AI Gateway', 'Lovable AI Gateway', 'Google AI Studio', 'OpenRouter', ...TAIL],
  document_generation: ['Vercel AI Gateway', 'Lovable AI Gateway', 'Google AI Studio', 'OpenRouter', ...TAIL],
  delivery:            ['Vercel AI Gateway', 'Lovable AI Gateway', 'Google AI Studio', 'OpenRouter', ...TAIL],
  profile_update:      ['Vercel AI Gateway', 'Lovable AI Gateway', 'Google AI Studio', 'OpenRouter', ...TAIL],

  // ---------- VISION ----------
  // Only Google/Vercel/Lovable serve vision well. Skip text-only providers.
  vision_analysis:  ['Google AI Studio', 'Vercel AI Gateway', 'Lovable AI Gateway'],
  image_generation: ['Vercel AI Gateway', 'Lovable AI Gateway', 'Google AI Studio'],
};

const DEFAULT_PRIORITY: GatewayName[] = [
  'Vercel AI Gateway', 'Lovable AI Gateway', 'Google AI Studio', 'OpenRouter', ...TAIL,
];


// ----------------------------------------------------------------------------
// Cooldown registry — module-level, so it survives across requests within the
// same edge-function instance. Each gateway has an optional `until` timestamp
// (ms epoch). If `Date.now() < until`, we skip the gateway entirely.
// ----------------------------------------------------------------------------
const cooldowns = new Map<GatewayName, { until: number; reason: string }>();

/** Returns true if the gateway is currently in cooldown. */
export function isOnCooldown(name: GatewayName): boolean {
  const c = cooldowns.get(name);
  if (!c) return false;
  if (Date.now() >= c.until) {
    cooldowns.delete(name);
    return false;
  }
  return true;
}

/** Snapshot of all active cooldowns — useful for /health endpoints & logs. */
export function getCooldownSnapshot(): Array<{ gateway: GatewayName; until: string; reason: string }> {
  const now = Date.now();
  const out: Array<{ gateway: GatewayName; until: string; reason: string }> = [];
  for (const [name, c] of cooldowns.entries()) {
    if (c.until > now) out.push({ gateway: name, until: new Date(c.until).toISOString(), reason: c.reason });
  }
  return out;
}

/**
 * Mark a gateway as rate-limited. We compute the cooldown duration based on
 * the provider's known free-tier reset window so we don't keep retrying a
 * provider that's exhausted for the day/month.
 */
export function recordRateLimit(name: GatewayName, status: number, errBody = ''): void {
  // Only treat 429 / 402 (and explicit quota/rate-limit wording on 4xx) as
  // exhausted. Bad credentials (401/403), bad payload (400/413), and 5xx
  // should not create long free-tier cooldowns.
  const looksExhausted =
    status === 429 ||
    status === 402 ||
    ((status === 400 || status === 403) && /quota|rate.?limit|daily|exhaust|insufficient credits/i.test(errBody));

  if (!looksExhausted) return;

  const now = Date.now();
  let until = now + 60_000; // default: 60s soft cooldown
  let reason = `HTTP ${status}`;

  switch (name) {
    case 'Groq': {
      // Groq returns "rate limit" with retry-after seconds for per-minute,
      // and a longer "tokens per day" for daily exhaustion. Heuristic:
      // if the body mentions "day" → cool until UTC midnight, else 60s.
      if (/day|daily|tpd|rpd/i.test(errBody)) {
        until = nextUtcMidnight();
        reason = 'Groq daily limit — resets 00:00 UTC';
      } else {
        until = now + 60_000;
        reason = 'Groq per-minute limit — 60s cooldown';
      }
      break;
    }
    case 'Google AI Studio': {
      // Free tier resets at midnight Pacific (~07:00 UTC). Use that for
      // "day"/"quota" errors; per-minute errors get 60s.
      if (/day|daily|quota|exhaust/i.test(errBody)) {
        until = nextPacificMidnightUtc();
        reason = 'Google AI Studio daily quota — resets ~07:00 UTC';
      } else {
        until = now + 60_000;
        reason = 'Google AI Studio per-minute limit — 60s cooldown';
      }
      break;
    }
    case 'OpenRouter': {
      // OpenRouter uses a ROLLING 24-hour window (not calendar midnight) for
      // free-model daily limits. Per-minute throttling = ~20 RPM. Heuristic:
      // body mentions "day" → 24h cooldown, otherwise 60s.
      if (/day|daily|free|limit/i.test(errBody)) {
        until = now + 24 * 60 * 60 * 1000;
        reason = 'OpenRouter daily free limit — 24h rolling cooldown';
      } else {
        until = now + 60_000;
        reason = 'OpenRouter per-minute limit — 60s cooldown';
      }
      break;
    }
    case 'Together AI': {
      // Together AI no longer has a free tier (since July 2025) — requires
      // a $5 min credit purchase. A 429/402 means paid credits are exhausted
      // OR the dynamic per-model rate cap was hit. Use a short cooldown so we
      // recover quickly once the user tops up or the per-minute window passes.
      until = now + 5 * 60_000;
      reason = 'Together AI rate/credits — 5min cooldown';
      break;
    }
    case 'Cloudflare Workers AI': {
      // Workers AI free allocation is a DAILY neuron budget (resets 00:00 UTC).
      // Per-model bursts get throttled per minute.
      if (/day|daily|neuron|quota|exhaust/i.test(errBody)) {
        until = nextUtcMidnight();
        reason = 'Cloudflare Workers AI daily neuron limit — resets 00:00 UTC';
      } else {
        until = now + 60_000;
        reason = 'Cloudflare Workers AI per-minute limit — 60s cooldown';
      }
      break;
    }
    case 'Hugging Face': {
      // HF Inference Router free tier = monthly credit budget; 429 usually
      // means the hourly/monthly credit cap. Use a 10min cooldown for rate
      // errors and skip until next month when credits are exhausted.
      if (/credit|month|quota|exceeded your/i.test(errBody)) {
        until = nextMonthStart();
        reason = 'Hugging Face monthly credits exhausted — resets next month';
      } else {
        until = now + 10 * 60_000;
        reason = 'Hugging Face rate limit — 10min cooldown';
      }
      break;
    }
    case 'Vercel AI Gateway':
    case 'Lovable AI Gateway': {
      // Paid credits — short cooldown only (the user may top up at any time).
      until = now + 60_000;
      reason = `${name} credits/rate exhausted — 60s cooldown`;
      break;
    }
  }

  cooldowns.set(name, { until, reason });
  console.warn(`🧊 Cooldown set: ${name} → until ${new Date(until).toISOString()} (${reason})`);
}

/** Manually clear a cooldown (e.g. after a user tops up credits). */
export function clearCooldown(name: GatewayName): void {
  cooldowns.delete(name);
}

// ----------------------------------------------------------------------------
// Ordering
// ----------------------------------------------------------------------------

export interface OrderOptions {
  /** Task type from the task router (or undefined for default ordering). */
  taskType?: string;
  /** Set true if the request requires vision capability. */
  needsVision?: boolean;
  /** Set true if the request requires image generation. */
  needsImageGen?: boolean;
}

/**
 * Reorder the configured gateways for THIS request. Cooldown'd gateways are
 * pushed to the END of the list (not removed) so they remain a last-resort
 * if all healthy ones fail — the cooldown check itself is handled by the
 * caller via `isOnCooldown`.
 */
export function orderGatewaysForRequest<G extends { name: string }>(
  configured: G[],
  opts: OrderOptions = {},
): G[] {
  const taskKey = opts.needsVision
    ? 'vision_analysis'
    : opts.needsImageGen
      ? 'image_generation'
      : (opts.taskType || 'general_chat');

  const priority = PRIORITY_BY_TASK[taskKey] || DEFAULT_PRIORITY;
  const byName = new Map(configured.map(g => [g.name as GatewayName, g]));

  // 1) Pull in priority order (skipping ones not configured).
  const ordered: G[] = [];
  for (const name of priority) {
    const g = byName.get(name);
    if (g) ordered.push(g);
  }
  // 2) Append any configured gateways not in the priority list (safety net).
  for (const g of configured) {
    if (!ordered.includes(g)) ordered.push(g);
  }

  // 3) Push cooldown'd gateways to the back (still tried as last resort).
  const healthy: G[] = [];
  const cool: G[] = [];
  for (const g of ordered) {
    if (isOnCooldown(g.name as GatewayName)) cool.push(g);
    else healthy.push(g);
  }

  return [...healthy, ...cool];
}

// ----------------------------------------------------------------------------
// Reset-time helpers
// ----------------------------------------------------------------------------

function nextUtcMidnight(): number {
  const d = new Date();
  d.setUTCHours(24, 0, 0, 0);
  return d.getTime();
}

function nextPacificMidnightUtc(): number {
  // Pacific = UTC-8 (PST) or UTC-7 (PDT). Approximate as 07:00 UTC next day.
  const d = new Date();
  d.setUTCHours(24 + 7, 0, 0, 0);
  return d.getTime();
}

function nextMonthStart(): number {
  const d = new Date();
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1, 0, 0, 0, 0);
}
