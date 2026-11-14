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
  type Provider = { name: string; url: string; key: string; model: string; headers?: Record<string,string> };
  const providers: Provider[] = [];
  const add = (name: string, env: string, url: string, model: string, headers: Record<string,string> = {}) => {
    const key = Deno.env.get(env);
    if (key) providers.push({ name, url, key, model, headers });
  };
  // Only gateways with text/chat-completion APIs are included. Cartesia,
  // MiniMax and ElevenLabs credentials in this project are speech APIs.
  add("Vercel AI Gateway", "VERCEL_AI_GATEWAY_API_KEY", "https://ai-gateway.vercel.sh/v1/chat/completions", "google/gemini-2.5-flash");
  add("Lovable AI Gateway", "LOVABLE_API_KEY", "https://ai.gateway.lovable.dev/v1/chat/completions", "google/gemini-2.5-flash");
  add("Google AI Studio", "GOOGLE_AI_STUDIO_API_KEY", "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", "gemini-2.5-flash");
  add("OpenRouter", "OPENROUTER_API_KEY", "https://openrouter.ai/api/v1/chat/completions", "meta-llama/llama-3.3-70b-instruct:free", {"HTTP-Referer":"https://worklyindia.devs.surf","X-Title":"Workly India"});
  add("Together AI", "TOGETHER_AI_API_KEY", "https://api.together.xyz/v1/chat/completions", "meta-llama/Llama-3.3-70B-Instruct-Turbo-Free");
  add("Groq", "GROQ_API_KEY", "https://api.groq.com/openai/v1/chat/completions", "llama-3.1-8b-instant");
  add("Cerebras", "CEREBRAS_API_KEY", "https://api.cerebras.ai/v1/chat/completions", "llama3.1-8b");
  add("Mistral AI", "MISTRAL_API_KEY", "https://api.mistral.ai/v1/chat/completions", "mistral-small-latest");
  add("Hugging Face", "HUGGINGFACE_API_KEY", "https://router.huggingface.co/v1/chat/completions", "meta-llama/Llama-3.3-70B-Instruct");
  const cfAccount = Deno.env.get("CLOUDFLARE_ACCOUNT_ID");
  const cfToken = Deno.env.get("CLOUDFLARE_AI_API_TOKEN") || Deno.env.get("CLOUDFLARE_API_TOKEN");
  if (cfAccount && cfToken) providers.push({ name: "Cloudflare Workers AI", url: "https://api.cloudflare.com/client/v4/accounts/" + cfAccount + "/ai/v1/chat/completions", key: cfToken, model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast" });
  if (!providers.length) throw new Error("No translation-capable AI gateway is configured");
  const failures: string[] = [];
  for (const provider of providers) {
    try {
      const response = await fetch(provider.url, {
        method: "POST",
        headers: { Authorization: "Bearer " + provider.key, "Content-Type": "application/json", ...provider.headers },
        body: JSON.stringify({
          model: provider.model, temperature: 0.2, max_tokens: 3000,
          response_format: { type: "json_object" },
          messages: [{ role: "system", content: systemPrompt }, { role: "user", content: text }],
        }),
        signal: AbortSignal.timeout(25000),
      });
      if (!response.ok) {
        const detail = (await response.text()).slice(0, 240);
        failures.push(provider.name + " HTTP " + response.status + ": " + detail);
        console.warn("[Translation] " + provider.name + " failed (" + response.status + "); falling back");
        continue;
      }
      const data = await response.json();
      const raw = String(data?.choices?.[0]?.message?.content ?? "").trim();
      if (!raw) { failures.push(provider.name + ": empty response"); continue; }
      let parsed: Record<string, unknown> = {};
      try {
        const jsonText = raw.replace(/^\x60{3}(?:json)?/i, "").replace(/\x60{3}$/, "").trim();
        parsed = JSON.parse(jsonText);
      } catch {
        parsed = { translation: raw };
      }
      console.log("[Translation] provider=" + provider.name + " succeeded");
      return { parsed, raw, provider: provider.name, rateLimited: false as const, noCredits: false as const };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(provider.name + ": " + message.slice(0, 180));
      console.warn("[Translation] " + provider.name + " request failed; falling back: " + message);
    }
  }
  console.error("[Translation] all configured providers failed:", failures.join(" | "));
  throw new Error("All configured translation AI providers are temporarily unavailable. Please retry in a moment.");
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
      provider: result.provider,
    });
  } catch (error) {
    console.error("Translation error:", error);
    const msg = error instanceof Error ? error.message : "Translation failed";
    return json({ error: msg }, 500);
  }
}
