// Translation + AI language detection.
// Merged in from the standalone `translate-text` edge function so we keep a
// single AI edge function. Reached via `ai-career-chat/translate`.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

export const LANG_NAMES: Record<string, string> = {
  // India
  as: "Assamese", bn: "Bengali", brx: "Bodo", doi: "Dogri", gu: "Gujarati",
  hi: "Hindi", kn: "Kannada", ks: "Kashmiri", kok: "Konkani", mai: "Maithili",
  ml: "Malayalam", mni: "Manipuri (Meitei)", mr: "Marathi", ne: "Nepali",
  or: "Odia", pa: "Punjabi", sa: "Sanskrit", sat: "Santali", sd: "Sindhi",
  ta: "Tamil", te: "Telugu", ur: "Urdu",
  bho: "Bhojpuri", mag: "Magahi", raj: "Rajasthani", tcy: "Tulu",
  gom: "Goan Konkani", hne: "Chhattisgarhi", awa: "Awadhi", bgc: "Haryanvi",
  mwr: "Marwari", kha: "Khasi", lus: "Mizo", new: "Newari",
  // World
  en: "English", es: "Spanish", fr: "French", de: "German", it: "Italian",
  pt: "Portuguese", ru: "Russian", zh: "Chinese (Simplified)", ja: "Japanese",
  ko: "Korean", ar: "Arabic", fa: "Persian", he: "Hebrew", tr: "Turkish",
  nl: "Dutch", pl: "Polish", uk: "Ukrainian", th: "Thai", vi: "Vietnamese",
  id: "Indonesian", ms: "Malay", tl: "Tagalog", el: "Greek", sv: "Swedish",
  cs: "Czech", ro: "Romanian", hu: "Hungarian", fi: "Finnish", da: "Danish",
  sk: "Slovak", bg: "Bulgarian", sw: "Swahili", si: "Sinhala", my: "Burmese",
};

// Languages natively written in Latin script — romanized flag is meaningless
const LATIN_NATIVE = new Set([
  "en", "es", "fr", "de", "it", "pt", "nl", "pl", "tr", "id", "ms", "tl",
  "sv", "cs", "ro", "hu", "fi", "da", "sk", "vi", "sw", "kha", "lus",
]);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function callGateway(systemPrompt: string, text: string) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("Translation service not configured");

  const response = await fetch(
    "https://ai.gateway.lovable.dev/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text },
        ],
      }),
    },
  );

  if (response.status === 429) {
    return { rateLimited: true } as const;
  }
  if (response.status === 402) {
    return { noCredits: true } as const;
  }
  if (!response.ok) {
    const errText = await response.text();
    console.error("AI gateway error:", response.status, errText);
    throw new Error("Translation failed");
  }

  const data = await response.json();
  const raw = data?.choices?.[0]?.message?.content?.trim() ?? "";
  let parsed: Record<string, unknown> = {};
  try {
    const jsonText = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "")
      .trim();
    parsed = JSON.parse(jsonText);
  } catch (_) {
    parsed = { translation: raw };
  }
  return { parsed, raw } as const;
}

// Normalize ISO 639-2/3 codes the model may return to our 2-letter keys
const CODE_ALIASES: Record<string, string> = {
  guj: "gu", hin: "hi", mar: "mr", ben: "bn", tam: "ta", tel: "te",
  kan: "kn", mal: "ml", pan: "pa", pun: "pa", ori: "or", ory: "or",
  urd: "ur", eng: "en", spa: "es", fra: "fr", fre: "fr", deu: "de",
  ger: "de", por: "pt", rus: "ru", zho: "zh", chi: "zh", jpn: "ja",
  kor: "ko", ara: "ar", nep: "ne", snd: "sd", asm: "as", san: "sa",
  kok: "kok", mai: "mai", tur: "tr", ita: "it", nld: "nl", dut: "nl",
};

const normalizeCode = (code: string): string => {
  const c = (code || "").toLowerCase().split(/[-_]/)[0];
  return CODE_ALIASES[c] || c;
};

function labelFor(code: string, romanized: boolean): string {
  const name = LANG_NAMES[code] || code;
  return romanized && !LATIN_NATIVE.has(code) ? `${name} (Romanized)` : name;
}

export async function handleTranslate(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, sourceLang, targetLang, mode } = await req.json();

    if (!text || typeof text !== "string" || !text.trim()) {
      return json({ error: "text is required" }, 400);
    }

    // ── Detect-only mode: identify the actual language (incl. romanized) ──
    if (mode === "detect" || !targetLang) {
      const systemPrompt = [
        "You are an expert language identifier.",
        "Identify the ACTUAL language of the user's text, not the script it is written in.",
        'Text may be romanized: e.g. Gujarati written in Latin script ("Tame panchayat bau karo so"), Hinglish, romanized Tamil, Marathi, Punjabi etc.',
        "Distinguish carefully between similar romanized Indian languages (Hindi, Gujarati, Marathi, Bhojpuri, Rajasthani, Punjabi, Bengali, Tamil, Telugu...) using vocabulary and grammar cues.",
        "Also proofread the text: fix spelling/typing mistakes in the SAME language and SAME script, keeping meaning, names and style intact. If nothing needs fixing, return the text unchanged.",
        'Respond ONLY with strict JSON: {"detected":"<ISO 639-1/3 code>","romanized":true|false,"corrected":"<spelling-corrected text>"}',
      ].join("\n");

      const result = await callGateway(systemPrompt, text.slice(0, 2000));
      if ("rateLimited" in result) {
        return json({ error: "Rate limit exceeded, please try again shortly." }, 429);
      }
      if ("noCredits" in result) {
        return json({ error: "AI credits exhausted." }, 402);
      }
      const detected = normalizeCode(String(result.parsed?.detected || "en"));
      const romanized = Boolean(result.parsed?.romanized);
      const corrected = typeof result.parsed?.corrected === "string"
        ? (result.parsed.corrected as string)
        : "";
      return json({
        detectedLanguage: detected,
        romanized,
        languageLabel: labelFor(detected, romanized),
        correctedText: corrected,
        hasCorrection: Boolean(corrected) && corrected.trim() !== text.trim(),
      });
    }

    // ── Translate mode ──
    const targetName = LANG_NAMES[targetLang] || targetLang;
    const sourceName = sourceLang && sourceLang !== "auto"
      ? (LANG_NAMES[sourceLang] || sourceLang)
      : null;

    const systemPrompt = [
      `You are an expert translator and language detector. Translate the user's text into ${targetName}.`,
      sourceName
        ? `Hint: the source language may be ${sourceName}, but verify yourself.`
        : "Detect the source language yourself.",
      'IMPORTANT: text may be romanized (e.g. Gujarati written in Latin script like "Tame panchayat bau karo so", or Hinglish). Detect the ACTUAL language, not the script, and translate the WHOLE text — never leave romanized words untranslated.',
      "Rules:",
      "- Translate every word into the target language, in its natural native script.",
      "- First mentally proofread the source text: fix spelling/typing mistakes before translating, so the translation is accurate.",
      "- Preserve meaning, tone, emojis, line breaks, markdown, numbers, URLs, and code as-is.",
      "- Keep proper nouns and brand names untranslated.",
      'Respond ONLY with strict JSON: {"detected":"<ISO 639-1/3 code of source language>","romanized":true|false,"corrected":"<source text with spelling mistakes fixed, same language and script>","translation":"<translated text>"} and nothing else.',
    ].join("\n");

    const result = await callGateway(systemPrompt, text);
    if ("rateLimited" in result) {
      return json({ error: "Rate limit exceeded, please try again shortly." }, 429);
    }
    if ("noCredits" in result) {
      return json({ error: "AI credits exhausted. Please top up to continue translating." }, 402);
    }

    const translatedText = String(result.parsed?.translation || result.raw || "");
    if (!translatedText) return json({ error: "Empty translation" }, 500);

    const rawDetected = String(
      result.parsed?.detected || (sourceLang && sourceLang !== "auto" ? sourceLang : "auto"),
    );
    const detected = rawDetected.toLowerCase() === "auto" ? "auto" : normalizeCode(rawDetected);
    const romanized = Boolean(result.parsed?.romanized);
    const corrected = typeof result.parsed?.corrected === "string"
      ? (result.parsed.corrected as string)
      : "";

    return json({
      translatedText,
      detectedLanguage: detected,
      romanized,
      languageLabel: labelFor(detected, romanized),
      correctedText: corrected,
      hasCorrection: Boolean(corrected) && corrected.trim() !== text.trim(),
      provider: "lovable-ai",
    });
  } catch (error) {
    console.error("Translation error:", error);
    const msg = error instanceof Error ? error.message : "Translation failed";
    return json({ error: msg }, 500);
  }
}
