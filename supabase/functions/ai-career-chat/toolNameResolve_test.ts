import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

// Mirror of the logic in index.ts (resolveToolName / isToolExcuseReply) so the
// regression is covered without booting the whole edge function.
const TOOLS = [
  "generate_youtube_seopack",
  "audit_my_youtube_seo",
  "search_youtube",
  "web_search",
  "search_jobs",
];

function normalizeToolKey(name: string): string {
  return String(name || "")
    .toLowerCase()
    .replace(/^(?:the|a|an|tool|tools|default_api|functions?)[_\s.]+/g, "")
    .replace(/[_\s.-]+/g, "")
    .replace(/(?:tool|function)$/g, "");
}

function resolveToolName(name: string): string | null {
  if (TOOLS.includes(name)) return name;
  const key = normalizeToolKey(name);
  if (!key) return null;
  const exact = TOOLS.find((n) => normalizeToolKey(n) === key);
  if (exact) return exact;
  return TOOLS
    .filter((n) => {
      const k = normalizeToolKey(n);
      return k.includes(key) || key.includes(k);
    })
    .sort((a, b) => a.length - b.length)[0] ?? null;
}

function isToolExcuseReply(raw: string): boolean {
  if (!raw) return false;
  const t = raw.trim();
  if (t.length > 400) return false;
  return /\b(?:tool|function)s?\b[^.\n]{0,40}\b(?:is|are|not|isn'?t|aren'?t)\b[^.\n]{0,40}\b(?:not\s+available|unavailable|not\s+found|doesn'?t\s+exist|does\s+not\s+exist|available\s+nahi|maujood\s+nahi)\b/i
    .test(t) ||
    /\b(?:not\s+available|unavailable|unknown)\b[^.\n]{0,20}\b(?:tool|function)\b/i
      .test(t) ||
    /\b(?:tool|function)s?\b[^.\n]{0,40}\b(?:available|maujood|exist)\s+nahi\b/i
      .test(t);
}

Deno.test("maps the hallucinated screenshot name to the real seo tool", () => {
  assertEquals(resolveToolName("the_youtube_seo_pack"), "generate_youtube_seopack");
  assertEquals(resolveToolName("youtube seo pack"), "generate_youtube_seopack");
  assertEquals(resolveToolName("generate_youtube_seo_pack"), "generate_youtube_seopack");
});

Deno.test("keeps real names untouched and returns null for nonsense", () => {
  assertEquals(resolveToolName("search_jobs"), "search_jobs");
  assertEquals(resolveToolName("completely_made_up_xyz"), null);
});

Deno.test("detects tool-availability excuse replies", () => {
  assertEquals(isToolExcuseReply("the_youtube_seo_pack tool is not available."), true);
  assertEquals(isToolExcuseReply("Ye tool available nahi hai."), true);
  assertEquals(isToolExcuseReply("Tumhare channel ke 3 naye video mile."), false);
});
