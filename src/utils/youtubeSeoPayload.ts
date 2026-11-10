// Client-side mirror of supabase/functions/_shared/youtubeSeoPayload.ts.
// Keep both files in sync — the server copy is the last line of defense.

export const YT_PAYLOAD_LIMITS = {
  titleMax: 100,
  descriptionMax: 5000,
  tagMaxChars: 40,
  tagsTotalChars: 500,
  tagsMaxCount: 60,
  hashtagsMax: 15,
};

/** Field labels the AI writes in chat — never allowed inside a YouTube field. */
const LABEL_WORDS = [
  "youtube tags",
  "seo tags",
  "tags",
  "hashtags",
  "title",
  "naya title",
  "description",
  "detail",
  "category",
  "seo",
  "keywords",
  "summary",
  "changes",
  "note",
  "score",
  "issues",
];

const LABEL_LINE_RE = new RegExp(
  `^\\s*[*_\`#>\\-\\s]*(?:${LABEL_WORDS.map((w) => w.replace(/ /g, "\\s+")).join("|")})\\s*[:：]\\s*`,
  "i",
);

/** Sentences the AI uses to talk TO the user — must never be published. */
const AI_META_PATTERNS: RegExp[] = [
  /यह\s+नया\s+seo[^\n]*/gi,
  /ये\s+नया\s+seo[^\n]*/gi,
  /क्या\s+आप\s+इसे\s+अपडेट[^\n]*/gi,
  /क्या\s+आप\s+इसे\s+अप्लाई[^\n]*/gi,
  /youtube\s*(?:par|pe|पर)\s*update\s*ho\s*gaya[^\n]*/gi,
  /youtube\s*पर\s*update\s*हो\s*गया[^\n]*/gi,
  /update\s*ho\s*gaya[^\n]*/gi,
  /पुराना\s*(?:title|टाइटल|description)[^\n]*/gi,
  /purana\s*(?:title|description)[^\n]*/gi,
  /bolo\s*apply\s*kar\s*du[^\n]*/gi,
  /apply\s*kar\s*du\s*\??/gi,
  /(?:इस|ये|यह)\s+(?:वीडियो|short)\s+(?:ज़्यादा|ज्यादा)\s+लोगों\s+तक[^\n]*/gi,
  /\bseo\s*(?:pack|score|analysis|suggestion)s?\b[^\n]*/gi,
  /\bdry[_\s]?run\b[^\n]*/gi,
  /आज\s*के\s*किसान\s*ब्लॉग\s*में[^\n।]*[।\n]?/gi,
  /ताज़ा\s*जानकारी\s*दे\s*रहे\s*हैं[^\n।]*[।]?/gi,
  /जानिए\s*आज\s*(?:खेत\s*में\s*)?क्या\s*चल\s*रहा\s*है[^\n।]*[।]?/gi,
  /(?:और\s*)?कैसे\s*प्रकृति\s*का\s*आनंद\s*लें[^\n।]*[।]?/gi,
  /प्रकृति\s*का\s*आनंद\s*लें[^\n।]*[।]?/gi,
  /यह\s*वीडियो\s*(?:ज़्यादा|ज्यादा)\s*लोगों\s*तक[^\n]*/gi,
  /ये\s*बदलाव[^\n]*/gi,
  /क्या\s*तुम[^\n]*(?:apply|अप्लाई|update)[^\n]*/gi,
  /लोगों\s*तक\s*(?:पहुँचाने|पहुंचाने)[^\n]*/gi,
  /\bmaine\s+(?:isko|inhe|inhein|ise|is[e]?\s)[^\n]*/gi,
  /\b(?:mene|maine)\b[^\n]*\b(?:badla|badle|hataya|jod[ai]|rakhe|kiya)\b[^\n]*/gi,
];

const stripAngle = (s: string) => String(s ?? "").replace(/[<>]/g, "");

/**
 * AI models sometimes emit the ESCAPE SEQUENCE "\\n" as literal text instead of a
 * real line break. Publishing that puts a visible "\\n" inside the YouTube
 * description, so turn every literal escape back into a real break.
 */
const unescapeLiteralBreaks = (s: string) =>
  String(s ?? "")
    .replace(/\\r\\n|\\n|\\r/g, "\n")
    .replace(/\\t/g, " ")
    .replace(/\\\\/g, "");

/** Comment CTA must use the speech-bubble emoji, never a pointing hand. */
const normalizeCtaEmoji = (s: string) =>
  String(s ?? "").replace(/[\u{1F447}\u{1F449}\u{1F446}\u{261D}]\u{FE0F}?/gu, "\u{1F4AC}");

const stripMarkdown = (s: string) =>
  String(s ?? "")
    .replace(/```[a-z-]*\n?/gi, "")
    .replace(/```/g, "")
    .replace(/[`*_]{1,3}/g, "")
    .replace(/^\s*#{1,6}\s*/gm, "")
    .replace(/^\s*>\s*/gm, "");

const isSeparatorLine = (line: string) => /^\s*[-–—_=*·•~]{2,}\s*$/.test(line);

const isPunctuationOnly = (s: string) => !/[\p{L}\p{N}]/u.test(s);

const looksLikeJson = (line: string) =>
  /^\s*[{[]/.test(line) || /^\s*"[^"]+"\s*:/.test(line) || /^\s*[}\]],?\s*$/.test(line);

/* -------------- before/after comparison + counter/meta noise -------------- */

const COUNTER_RE =
  /\(\s*\d+\s*\/\s*\d+\s*(?:characters?|chars?|अक्षर)?(?:\s*,\s*\d+\s*(?:tags?|टैग)\s*)?\)/gi;
const COUNT_ONLY_RE = /\(\s*\d+\s*(?:tags?|hashtags?|characters?|chars?|टैग)\s*\)/gi;

const BEFORE_MARK = "(?:pehle|pahle|purana|purani|old|before|पहले|पुराना|पुरानी)";
const AFTER_MARK = "(?:ab|naya|nayi|new|after|अब|नया|नयी|नई)";
const MARK_RE = new RegExp(
  `[^\\S\\n]*(?:[🔵🟢🟡🔴⚪⚫•*\\-–—]\\s*)*\\b(${BEFORE_MARK}|${AFTER_MARK})\\b\\s*[:：]`,
  "gi",
);
const IS_AFTER_RE = new RegExp(`^${AFTER_MARK}$`, "i");

/** Parenthetical AI commentary ("(maine isliye badla...)", "(28 tags thay...)"). */
const COMMENT_PAREN_RE =
  /\((?=[^)]{18,})[^)]*(?:maine|mene|मैंने|इसलिए|isliye|nahi badla|nahi badle|नहीं बदला|नहीं बदले|मौजूदा|characters|chars|tags|सीमा|limit|recommend|suggest|जोड़ा|हटाया)[^)]*\)/gi;


/* --------------------------- spam / repetition ---------------------------- */

/**
 * Kills AI repetition loops ("#youtubeviral #youtubeviral #youtubeviral …"):
 * collapses consecutively repeated words/hashtags and allows every hashtag
 * to appear only once in the whole text.
 */
export function collapseSpam(raw: unknown): string {
  let text = String(raw ?? "");
  // consecutive repeats of the same word / hashtag
  text = text.replace(/(^|[\s,])((?:#)?[\p{L}\p{N}\p{M}_]{2,40})(?:[\s,]+\2\b)+/giu, "$1$2");
  // a hashtag may appear at most once overall
  const seenHash = new Set<string>();
  text = text.replace(/#[\p{L}\p{N}\p{M}_]{2,}/gu, (m) => {
    const key = m.toLowerCase();
    if (seenHash.has(key)) return "";
    seenHash.add(key);
    return m;
  });
  return text
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Removes everything that belongs to the CHAT, not to YouTube:
 * "Pehle:"/"Ab:" before-vs-after comparison (only the "Ab"/new side survives),
 * "(350/500 characters, 28 tags)" counters, status dots and AI commentary in
 * brackets. The final SEO card/payload must never show any of it.
 */
export function stripComparisonNoise(raw: unknown): string {
  let text = collapseSpam(raw)
    .replace(COUNTER_RE, " ")
    .replace(COUNT_ONLY_RE, " ")
    .replace(COMMENT_PAREN_RE, " ")
    .replace(/[🔵🟢🟡🔴⚪⚫]/gu, " ");

  const marks = [...text.matchAll(MARK_RE)];
  if (marks.length) {
    const segs = marks.map((m, i) => ({
      after: IS_AFTER_RE.test(String(m[1] || "").trim()),
      body: text.slice(
        (m.index ?? 0) + m[0].length,
        i + 1 < marks.length ? (marks[i + 1].index ?? text.length) : text.length,
      ),
    }));
    const head = text.slice(0, marks[0].index ?? 0);
    const newSide = segs.filter((s) => s.after).map((s) => s.body.trim()).filter(Boolean);
    text = newSide.length
      ? newSide.join("\n")
      : [head, ...segs.map((s) => s.body)].join("\n");
  }

  return text
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}


/* -------------------------------- title ---------------------------------- */

/* --------------------- AI commentary instead of a title ------------------- */

/**
 * The AI sometimes answers with an EXPLANATION of what it changed
 * ("Changed to be more engaging and descriptive in Hindi, keeping the core
 * elements.") instead of the actual title. Such text must never be published
 * as a title — we detect it and fall back to the real/current title.
 */
const COMMENTARY_TITLE_RE: RegExp[] = [
  /^(?:changed|updated|modified|rewrote|rewritten|revised|improved|made|kept|keeping|added|removed|optimized|optimised|created|generated|adjusted|shortened|expanded|new title|suggested title)\b/i,
  /\b(?:keeping|kept)\s+the\s+(?:core|main|original|same)\b/i,
  /\bmore\s+(?:engaging|descriptive|clickable|seo[- ]friendly)\b/i,
  /\b(?:for|to)\s+(?:better|improved?)\s+(?:seo|ctr|reach|visibility)\b/i,
  /\b(?:as|jaisa)\s+(?:requested|aapne bola|aapne kaha)\b/i,
  /\b(?:title|description)\s+(?:ko\s+)?(?:badal|badla|change kar)\w*\b/i,
  /^(?:yeh|ye|is)\s+(?:naya|new)\s+(?:title|seo)\b/i,
  // Hinglish commentary: "Short video ke hisaab se title ko chhota aur catchy banaya gaya hai."
  /\b(?:banaya|banayi|banaye|likha|likhi|rakha|rakhi|kiya|kiye)\s+gay[ai]\s+ha[iy]\b/i,
  /\b(?:ke\s+hisaab\s+se|ke\s+liye\s+optimize|catchy\s+banay|chhota\s+(?:aur|kar)|short\s+kiya)\b/i,
  /\b(?:title|description|tags?|hashtags?)\s+(?:ko|me|mein)\b[^\n]*\b(?:banaya|badla|badle|update|improve|optimize)\w*\b/i,
  // ---- Hindi / Devanagari commentary (AI apni baat title ki jagah likh deti hai) ----
  /^(?:मैंने|मैने|हमने|यहाँ|यहां|इसमें|इसे|अब)\b/u,
  /(?:टाइटल|शीर्षक|डिस्क्रिप्शन|विवरण|टैग|हैशटैग)\s*(?:को|में|मे)\b/u,
  /\b(?:बनाया|बनायी|बनाई|बदला|बदल|जोड़ा|हटाया|किया|रखा)\s*(?:गया|गयी|गई)?\s*(?:है|हैं)\b/u,
  /(?:जिससे|ताकि|इसलिए)\s+(?:लोग|दर्शक|व्यूअर|यूजर)/u,
  /(?:ज़्यादा|ज्यादा|अधिक)\s+(?:आकर्षक|क्लिक|लोगों तक|बेहतर)/u,
  // ---- Gujarati commentary ----
  /^(?:મેં|અમે|આમાં|હવે)\b/u,
  /\b(?:બનાવ્યું|બદલ્યું|કર્યું)\s*(?:છે)?\b/u,
];

/** true when the "title" is really the AI talking about the title. */
export function looksLikeAiCommentary(raw: unknown): boolean {
  const t = String(raw ?? "").trim();
  if (!t) return false;
  return COMMENTARY_TITLE_RE.some((re) => re.test(t));
}

export function sanitizeTitle(raw: unknown): string {
  let t = stripComparisonNoise(stripMarkdown(stripAngle(String(raw ?? ""))));
  t = t.replace(LABEL_LINE_RE, "");
  for (const p of AI_META_PATTERNS) t = t.replace(p, "");
  t = (t.split(/\n/).map((l) => l.trim()).find(Boolean)) || "";
  t = t.replace(/\s+/g, " ").replace(/\((?:\d+\s*\/\s*\d+)\)\s*$/, "").trim();
  // "Title (63/100)" style counters and stray quotes around the whole value
  t = t.replace(/^["'“”‘’]+|["'“”‘’]+$/g, "").trim();
  // AI explanation ("Changed to be more engaging…") is NOT a title.
  if (looksLikeAiCommentary(t)) return "";
  return t.slice(0, YT_PAYLOAD_LIMITS.titleMax);
}

/* ----------------------------- description ------------------------------- */

/**
 * Keeps ONLY viewer-facing prose (plus trailing hashtags). Removes labels,
 * AI meta talk, markdown, JSON, separators and bare tag dumps.
 */
export function sanitizeDescription(raw: unknown): string {
  let text = normalizeCtaEmoji(
    stripComparisonNoise(stripMarkdown(stripAngle(unescapeLiteralBreaks(String(raw ?? ""))))),
  );
  for (const p of AI_META_PATTERNS) text = text.replace(p, "");

  const lines = text.split(/\r?\n/);
  const kept: string[] = [];
  let labelCut = false;

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/g, "");

    // A "YouTube Tags:" / "Tags:" / "SEO Tags:" / "Keywords:" label ends the
    // viewer-facing part: everything after it is a tag/meta dump.
    if (/^\s*[*_`#>\-\s]*(?:youtube\s*tags|seo\s*tags|tags|keywords|category|score|issues|summary|changes)\s*[:：]/i.test(line)) {
      labelCut = true;
      continue;
    }
    if (labelCut) {
      // Allow the description to resume only on a real hashtag line.
      if (/^\s*#[\p{L}\p{N}\p{M}_]/u.test(line)) labelCut = false;
      else continue;
    }

    if (LABEL_LINE_RE.test(line)) {
      // "Description: text" → keep the text, drop the label.
      const stripped = line.replace(LABEL_LINE_RE, "").trim();
      if (stripped) kept.push(stripped);
      continue;
    }
    if (isSeparatorLine(line)) continue;
    if (looksLikeJson(line)) continue;
    if (line.trim() && isPunctuationOnly(line)) continue;

    kept.push(line);
  }

  let out = kept.join("\n");
  out = out
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // Cut-off leftovers from a chopped label/counter — e.g. a description that
  // starts with "s):" or "characters):" because the "(404/5000 characters)"
  // part was removed above. Those fragments must never reach YouTube.
  out = out
    .replace(/^\s*[^\n]{0,25}?[)\]]\s*[:：]\s*\n?/u, (m) => (/[\p{L}\p{N}]{6,}/u.test(m) ? m : ""))
    .replace(/^\s*[)\]:：,.;-]+\s*/u, "")
    .trim();

  return out.slice(0, YT_PAYLOAD_LIMITS.descriptionMax);
}

/* --------------------------------- tags ---------------------------------- */

const LABEL_TAG_RE = new RegExp(`^(?:${LABEL_WORDS.map((w) => w.replace(/ /g, "\\s+")).join("|")})$`, "i");

/** Sentence punctuation never appears in a real YouTube tag. */
const SENTENCE_PUNCT_RE = /[।?!;:"“”…]|\.\s|\.$/;
/** Chat phrases the AI writes ("maine ye badla", "kya update karu") — not tags. */
const CHAT_WORDS_RE =
  /\b(?:maine|mene|mai|main|hum|aap|aapke|apne|tum|tumhe|tumhare|kya|karu|karun|karo|karna|kardo|kar\s+do|update|apply|badla|badle|badal|hataya|jod[ai]|isliye|please|suggest|suggestion|recommend|note|yeh|ye|wo|woh)\b/i;

/**
 * Chat filler the AI writes around a tag list ("Bolo", "jaise animal tracks").
 * A tag that IS one of these, or that starts/ends with one, is chat text.
 */
const FILLER_WORDS = new Set([
  "bolo","batao","bataye","dekho","dekhe","suno","chalo","aisa","aise","aisi","jaise","jaisa","jaisi",
  "kuch","koi","phir","matlab","waise","agar","kyunki","lekin","magar","toh","tho","ya","or","aur",
  "example","examples","etc","vagaira","vagera","comment","like","share","subscribe","hello","hi",
  "ok","okay","thik","theek","haan","nahi","na","yes","no","done","next","more","also","plus",
  "karo","kar","karna","kya","kaise","kese","please","pls","thanks","thank","sir","bhai",
  "tag","tags","hashtag","hashtags","yaha","yahan","idhar",
  "boliye","kaho","kahiye","samjho","abhi","fir","bhi",
]);

function hasFillerEdge(t: string): boolean {
  const words = t.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return false;
  if (words.length === 1) return FILLER_WORDS.has(words[0]);
  return FILLER_WORDS.has(words[0]) || FILLER_WORDS.has(words[words.length - 1]);
}

/**
 * "jaise animal tracks" → "animal tracks". Chat filler glued to the front/back
 * of a real tag is trimmed away instead of poisoning the published tag list.
 */
function trimFillerEdges(t: string): string {
  let words = t.split(/\s+/).filter(Boolean);
  while (words.length > 1 && FILLER_WORDS.has(words[0].toLowerCase())) words = words.slice(1);
  while (words.length > 1 && FILLER_WORDS.has(words[words.length - 1].toLowerCase())) words = words.slice(0, -1);
  return words.join(" ");
}

/** Emoji / symbols never belong in a YouTube tag. */
const EMOJI_RE = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u;

/** true when a "tag" is really a chat sentence / AI message text. */
function looksLikeSentence(t: string): boolean {
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length > 6) return true;
  if (SENTENCE_PUNCT_RE.test(t)) return true;
  if (/https?:\/\//i.test(t)) return true;
  if (words.length >= 2 && CHAT_WORDS_RE.test(t)) return true;
  return false;
}

function normalizeTag(raw: unknown): string {
  let t = stripMarkdown(String(raw ?? ""));
  t = t
    .replace(/[<>"#]/g, "")
    .replace(/^\s*[-•–—*]\s*/, "")
    .replace(/^\s*\d+[.)]\s*/, "")
    .replace(EMOJI_RE, " ")
    .replace(/\s+/g, " ")
    .trim();
  t = t.replace(/^["'“”‘’]+|["'“”‘’]+$/g, "").trim();
  t = t.replace(/[:：]\s*$/, "").trim();
  return trimFillerEdges(t);
}

/**
 * Trim → drop empty / punctuation-only / "--" / labels → dedupe (case
 * insensitive, and drop a tag that is fully contained in a kept one) → cap.
 */
export function sanitizeTags(raw: unknown): { tags: string[]; removed: string[] } {
  const input: unknown[] = Array.isArray(raw)
    ? raw.map((t) => stripComparisonNoise(t))
    : stripComparisonNoise(raw).split(/[\n,]/);

  const tags: string[] = [];
  const removed: string[] = [];
  const seen = new Set<string>();
  let chars = 0;

  for (const item of input) {
    const original = String(item ?? "").trim();
    const t = normalizeTag(item);
    const reject = (why: string) => {
      if (original) removed.push(`${original} (${why})`);
    };

    if (!t) { reject("empty"); continue; }
    if (isPunctuationOnly(t)) { reject("invalid"); continue; }
    if (LABEL_TAG_RE.test(t)) { reject("label"); continue; }
    if (t.length < 2) { reject("too short"); continue; }
    if (t.length > YT_PAYLOAD_LIMITS.tagMaxChars) { reject("too long"); continue; }
    if (looksLikeJson(t)) { reject("not a tag"); continue; }
    // AI chat sentences ("maine ye tag add kiya", "Kya update karu?") are never tags.
    if (looksLikeSentence(t)) { reject("chat text, not a tag"); continue; }
    // "Bolo" / "jaise animal tracks" — filler word glued to the tag list.
    if (hasFillerEdge(t)) { reject("chat filler, not a tag"); continue; }
    // Numbers-only or bracketed/parenthetical chat remnants are never tags.
    if (/^\d+$/.test(t)) { reject("not a tag"); continue; }
    if (/[()\[\]{}]/.test(t)) { reject("not a tag"); continue; }

    const key = t.toLowerCase();
    if (seen.has(key)) { reject("duplicate"); continue; }
    if (tags.some((k) => k.toLowerCase() === key)) { reject("duplicate"); continue; }

    if (tags.length >= YT_PAYLOAD_LIMITS.tagsMaxCount) { reject("over tag limit"); continue; }
    const cost = t.length + (t.includes(" ") ? 2 : 0) + (tags.length ? 1 : 0);
    if (chars + cost > YT_PAYLOAD_LIMITS.tagsTotalChars) { reject("over 500 characters"); continue; }

    seen.add(key);
    chars += cost;
    tags.push(t);
  }

  return { tags, removed };
}

/* ------------------------------- hashtags -------------------------------- */

export function sanitizeHashtags(raw: unknown): string[] {
  const input: unknown[] = Array.isArray(raw) ? raw : String(raw ?? "").split(/[\s,]+/);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of input) {
    const body = stripMarkdown(String(item ?? ""))
      .replace(/^#+/, "")
      .replace(/[^\p{L}\p{N}\p{M}_]+/gu, "");
    if (body.length < 2 || LABEL_TAG_RE.test(body)) continue;
    const h = `#${body.slice(0, 40)}`;
    const key = h.toLowerCase();
    if (seen.has(key) || out.length >= YT_PAYLOAD_LIMITS.hashtagsMax) continue;
    seen.add(key);
    out.push(h);
  }
  return out;
}


/* ------------------------- keyword fallbacks ------------------------------ */

const TAG_STOPWORDS = new Set([
  "the","and","for","with","this","that","your","you","are","was","kya","kaise","kaisa","kaun",
  "mein","main","mera","meri","mere","hai","hain","gaya","gayi","raha","rahi","bada","badi",
  "aur","par","ka","ki","ke","ko","se","na","nahi","bhi","ye","yeh","wo","woh","ab","to",
]);

const wordsOf = (s: unknown) =>
  String(s ?? "")
    .replace(/[^\p{L}\p{N}\p{M}\s]/gu, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3 && !TAG_STOPWORDS.has(w.toLowerCase()));

/**
 * Last-resort tags when the AI returned none: real words from the title
 * (plus any hashtags/extra keywords) turned into phrase + single-word tags,
 * so a video is never published with an empty tag list.
 */
export function deriveTags(title: unknown, extra: unknown[] = []): string[] {
  const words = wordsOf(title);
  const out: string[] = [];
  const phrase = words.join(" ").slice(0, YT_PAYLOAD_LIMITS.tagMaxChars).trim();
  if (phrase.split(" ").length >= 2) out.push(phrase);
  for (let i = 0; i + 1 < words.length; i++) out.push(`${words[i]} ${words[i + 1]}`);
  out.push(...words);
  for (const e of extra) {
    const v = String(e ?? "").replace(/^#/, "").trim();
    if (v) out.push(v);
  }
  return sanitizeTags(out).tags;
}

/** Last-resort hashtags built from the title / tags when the AI returned none. */
export function deriveHashtags(title: unknown, tags: unknown[] = []): string[] {
  const words = [...wordsOf(title), ...tags.flatMap((t) => wordsOf(t))].filter(
    (w) => w.length >= 4,
  );
  return sanitizeHashtags(words.slice(0, 8));
}

/* ------------------- hashtag noise inside description --------------------- */

const hashKey = (s: string) =>
  String(s ?? "")
    .replace(/^#/, "")
    .replace(/[^\p{L}\p{N}\p{M}_]/gu, "")
    .toLowerCase();

/**
 * Removes hashtag clutter from the description body:
 *  - lines made only of hashtags (they get re-added once at the end)
 *  - "bare keyword" lines like `shorts GohilKhedut KhetVlog Farming VillageLife`
 *    (the same hashtag words written without `#`)
 * so the published description never shows the keyword dump twice.
 */
export function stripHashtagNoise(
  description: string,
  hashtags: string[],
  tags: string[] = [],
): string {
  const known = new Set(
    [
      ...hashtags,
      ...tags,
      // multi-word tags also contribute their single words ("khet mein gaddha")
      ...tags.flatMap((t) => String(t ?? "").split(/\s+/)),
    ]
      .map(hashKey)
      .filter(Boolean),
  );
  const lines = String(description ?? "").split(/\r?\n/).filter((line) => {
    const t = line.trim();
    if (!t) return true;
    const tokens = t.split(/\s+/);
    if (tokens.length > 12) return true;
    if (tokens.every((tok) => tok.startsWith("#"))) return false;
    if (tokens.length < 2) return true;
    // Comma separated keyword/hashtag dump ("shorts, KhetVlog, GohilKhedut") is
    // NOT a sentence — a real sentence ends with . ! ? or ।
    const sentenceEnd = /[.!?।]/.test(t);
    const bare = tokens.map((tok) => tok.replace(/[,;·|]+$/g, "")).filter(Boolean);
    // Hashtag words with the "#" stripped ("shorts GujaratHeat KhetVlog ...")
    if (!sentenceEnd && bare.length >= 3) {
      const camel = bare.filter((tok) => /^[A-Za-z][a-z0-9]+(?:[A-Z][a-z0-9]+)+$/.test(tok)).length;
      if (camel / bare.length >= 0.5) return false;
      const bareKeys = bare.map(hashKey).filter(Boolean);
      if (bareKeys.length === bare.length) {
        const bareHits = bareKeys.filter((k) => known.has(k)).length;
        if (bareHits / bareKeys.length >= 0.6) return false;
      }
    }
    // A real sentence has punctuation / sentence structure — a keyword dump does not.
    if (/[.,!?;:।"()]/.test(t)) return true;

    const keys = tokens.map(hashKey);
    if (keys.some((k) => !k)) return true;
    // Most words of the line are our own keywords → it is a keyword dump line
    const hits = keys.filter((k) => known.has(k)).length;
    return hits / keys.length < 0.6;
  });
  return lines.join("\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

/* ------------------------------- category -------------------------------- */


/** Accepts only a real assignable category ID; never a category *name*. */
export function resolveCategoryId(
  requested: unknown,
  opts: {
    allowed?: Array<{ id: string; title: string }>;
    currentCategoryId?: string;
    primaryCategoryId?: string | null;
  } = {},
): { categoryId: string; corrected: boolean } {
  const allowed = opts.allowed || [];
  const ids = new Set(allowed.map((c) => String(c.id)));
  const asked = String(requested ?? "").trim();

  const ok = (id: string) => !!id && (!ids.size || ids.has(id));

  if (/^\d+$/.test(asked) && ok(asked)) return { categoryId: asked, corrected: false };

  // A name was sent instead of an id → map it, never forward the name.
  if (asked && !/^\d+$/.test(asked)) {
    const key = asked.toLowerCase().replace(/&/g, "and").replace(/\s+/g, " ").trim();
    const hit = allowed.find(
      (c) => c.title.toLowerCase().replace(/&/g, "and").replace(/\s+/g, " ").trim() === key,
    );
    if (hit) return { categoryId: String(hit.id), corrected: true };
  }

  const current = String(opts.currentCategoryId || "").trim();
  if (ok(current)) return { categoryId: current, corrected: true };
  const primary = String(opts.primaryCategoryId || "").trim();
  if (ok(primary)) return { categoryId: primary, corrected: true };
  return { categoryId: "22", corrected: true }; // People & Blogs
}

/* ---------------------------- final payload ------------------------------ */

export interface YouTubeSeoInput {
  title?: unknown;
  description?: unknown;
  tags?: unknown;
  hashtags?: unknown;
  categoryId?: unknown;
}

export interface CurrentVideoMeta {
  title?: string;
  description?: string;
  tags?: string[];
  categoryId?: string;
}

export interface BuiltPayload {
  ok: boolean;
  errors: string[];
  removed: string[];
  categoryCorrected: boolean;
  payload: {
    title: string;
    description: string;
    tags: string[];
    hashtags: string[];
    categoryId: string;
  };
}

/**
 * Structured SEO input → validated, field-separated, YouTube-ready payload.
 * Refuses (ok:false) instead of overwriting good existing data with nothing.
 */
export function buildYouTubePayload(
  input: YouTubeSeoInput,
  opts: {
    current?: CurrentVideoMeta;
    allowedCategories?: Array<{ id: string; title: string }>;
    primaryCategoryId?: string | null;
  } = {},
): BuiltPayload {
  const current = opts.current || {};
  const errors: string[] = [];

  // If the AI returned commentary instead of a title, keep the live title.
  const title = sanitizeTitle(input.title) || sanitizeTitle(current.title);
  let hashtags = sanitizeHashtags(input.hashtags);
  let { tags, removed } = sanitizeTags(input.tags);
  // Never publish an empty tag/hashtag list because the AI spammed or skipped
  // them — rebuild from the real title keywords instead.
  if (!tags.length) tags = deriveTags(title, hashtags);
  if (!hashtags.length) hashtags = deriveHashtags(title, tags);

  let description = sanitizeDescription(input.description);
  // Hashtags live at the end of the description (YouTube shows the first 3 there),
  // and only there — never inside the tags array.
  description = stripHashtagNoise(description, hashtags, tags);
  if (hashtags.length) {
    description = `${description}\n\n${hashtags.join(" ")}`.trim();
  }
  description = description.slice(0, YT_PAYLOAD_LIMITS.descriptionMax);

  const { categoryId, corrected } = resolveCategoryId(input.categoryId, {
    allowed: opts.allowedCategories,
    currentCategoryId: current.categoryId,
    primaryCategoryId: opts.primaryCategoryId ?? null,
  });

  if (!title) errors.push("Title is empty after validation — nothing was published.");
  if (!description.trim() && String(current.description || "").trim()) {
    errors.push("Generated description was empty/invalid — existing description kept, update refused.");
  }
  if (!tags.length && (current.tags || []).length) {
    errors.push("Generated tags were empty/invalid — existing tags kept, update refused.");
  }

  return {
    ok: errors.length === 0,
    errors,
    removed,
    categoryCorrected: corrected,
    payload: { title, description, tags, hashtags, categoryId },
  };
}

/** Which fields actually differ from what is live on YouTube. */
export function changedFields(
  next: { title: string; description: string; tags: string[]; categoryId: string },
  current: CurrentVideoMeta,
): string[] {
  const changed: string[] = [];
  if (next.title !== (current.title || "")) changed.push("title");
  if (next.description.trim() !== String(current.description || "").trim()) changed.push("description");
  const a = next.tags.join("|").toLowerCase();
  const b = (current.tags || []).join("|").toLowerCase();
  if (a !== b) changed.push("tags");
  if (next.categoryId !== String(current.categoryId || "")) changed.push("categoryId");
  return changed;
}
