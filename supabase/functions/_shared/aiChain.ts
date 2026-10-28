// Shared multi-provider / multi-model AI chain.
//
// Same idea as the AI Career Chat gateway router: try several providers in
// priority order, and inside each provider try several models. Any provider
// whose API key is missing is skipped, so the feature keeps working as long as
// ONE key is configured.
//
// Used by every auto-reply / content feature (Outlook, Gmail, custom email,
// Telegram, YouTube, social, job content) so they all behave like the chat.

const WEBSITE_TITLE = "Workly India";
const WEBSITE_REFERER = "https://worklyindia.devs.surf";

/** Canonical (internal) model ids, strongest → cheapest. */
export const AI_MODEL_CHAIN = [
  "google/gemini-2.5-flash",
  "google/gemini-2.5-flash-lite",
  "google/gemini-2.5-pro",
] as const;

export type AiGateway = {
  name: string;
  url: string;
  key: string;
  /** internal model id → provider model id. Missing entry = skip that model. */
  modelMap?: Record<string, string>;
  extraHeaders?: Record<string, string>;
  /** Lovable gateway authenticates with its own header. */
  useLovableHeader?: boolean;
};

// The Lovable gateway serves one model for this app; it is tried once and the
// remaining chain entries fall through to the other providers.
const LOVABLE_MAP: Record<string, string> = {
  "google/gemini-2.5-flash": "openai/gpt-6-astra",
};

const GOOGLE_AI_MAP: Record<string, string> = {
  "google/gemini-2.5-flash": "gemini-2.5-flash",
  "google/gemini-2.5-flash-lite": "gemini-2.5-flash-lite",
  "google/gemini-2.5-pro": "gemini-2.5-pro",
};

const OPENROUTER_MAP: Record<string, string> = {
  "google/gemini-2.5-flash": "meta-llama/llama-3.3-70b-instruct:free",
  "google/gemini-2.5-flash-lite": "meta-llama/llama-3.3-70b-instruct:free",
  "google/gemini-2.5-pro": "deepseek/deepseek-chat-v3.1:free",
};

const TOGETHER_MAP: Record<string, string> = {
  "google/gemini-2.5-flash": "meta-llama/Llama-3.3-70B-Instruct-Turbo-Free",
  "google/gemini-2.5-flash-lite": "meta-llama/Llama-3.3-70B-Instruct-Turbo-Free",
  "google/gemini-2.5-pro": "deepseek-ai/DeepSeek-V3",
};

const GROQ_MAP: Record<string, string> = {
  "google/gemini-2.5-flash": "llama-3.3-70b-versatile",
  "google/gemini-2.5-flash-lite": "llama-3.1-8b-instant",
  "google/gemini-2.5-pro": "llama-3.3-70b-versatile",
};

const CEREBRAS_MAP: Record<string, string> = {
  "google/gemini-2.5-flash": "llama3.1-8b",
  "google/gemini-2.5-flash-lite": "llama3.1-8b",
  "google/gemini-2.5-pro": "llama3.1-8b",
};

const MISTRAL_MAP: Record<string, string> = {
  "google/gemini-2.5-flash": "mistral-small-latest",
  "google/gemini-2.5-flash-lite": "mistral-small-latest",
  "google/gemini-2.5-pro": "mistral-large-latest",
};

const CLOUDFLARE_MAP: Record<string, string> = {
  "google/gemini-2.5-flash": "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  "google/gemini-2.5-flash-lite": "@cf/meta/llama-3.1-8b-instruct",
  "google/gemini-2.5-pro": "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
};

const HUGGINGFACE_MAP: Record<string, string> = {
  "google/gemini-2.5-flash": "meta-llama/Llama-3.3-70B-Instruct",
  "google/gemini-2.5-flash-lite": "meta-llama/Llama-3.1-8B-Instruct",
  "google/gemini-2.5-pro": "Qwen/Qwen2.5-72B-Instruct",
};

/** Build the provider chain from whatever API keys exist in this project. */
export function buildAiGateways(): AiGateway[] {
  const env = (k: string) => Deno.env.get(k) || "";
  const gws: AiGateway[] = [];

  const lovable = env("LOVABLE_API_KEY");
  if (lovable) {
    gws.push({
      name: "Lovable AI Gateway",
      url: "https://ai.gateway.lovable.dev/v1/chat/completions",
      key: lovable,
      modelMap: LOVABLE_MAP,
      useLovableHeader: true,
    });
  }

  const vercel = env("VERCEL_AI_GATEWAY_API_KEY");
  if (vercel) {
    gws.push({
      name: "Vercel AI Gateway",
      url: "https://ai-gateway.vercel.sh/v1/chat/completions",
      key: vercel,
    });
  }

  const google = env("GOOGLE_AI_STUDIO_API_KEY");
  if (google) {
    gws.push({
      name: "Google AI Studio",
      url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      key: google,
      modelMap: GOOGLE_AI_MAP,
    });
  }

  const openrouter = env("OPENROUTER_API_KEY");
  if (openrouter) {
    gws.push({
      name: "OpenRouter",
      url: "https://openrouter.ai/api/v1/chat/completions",
      key: openrouter,
      modelMap: OPENROUTER_MAP,
      extraHeaders: { "HTTP-Referer": WEBSITE_REFERER, "X-Title": WEBSITE_TITLE },
    });
  }

  const together = env("TOGETHER_AI_API_KEY");
  if (together) {
    gws.push({
      name: "Together AI",
      url: "https://api.together.xyz/v1/chat/completions",
      key: together,
      modelMap: TOGETHER_MAP,
    });
  }

  const groq = env("GROQ_API_KEY");
  if (groq) {
    gws.push({
      name: "Groq",
      url: "https://api.groq.com/openai/v1/chat/completions",
      key: groq,
      modelMap: GROQ_MAP,
    });
  }

  const cerebras = env("CEREBRAS_API_KEY");
  if (cerebras) {
    gws.push({
      name: "Cerebras",
      url: "https://api.cerebras.ai/v1/chat/completions",
      key: cerebras,
      modelMap: CEREBRAS_MAP,
    });
  }

  const mistral = env("MISTRAL_API_KEY");
  if (mistral) {
    gws.push({
      name: "Mistral AI",
      url: "https://api.mistral.ai/v1/chat/completions",
      key: mistral,
      modelMap: MISTRAL_MAP,
    });
  }

  const cfAccount = env("CLOUDFLARE_ACCOUNT_ID");
  const cfToken = env("CLOUDFLARE_AI_API_TOKEN") || env("CLOUDFLARE_API_TOKEN");
  if (cfAccount && cfToken) {
    gws.push({
      name: "Cloudflare Workers AI",
      url: `https://api.cloudflare.com/client/v4/accounts/${cfAccount}/ai/v1/chat/completions`,
      key: cfToken,
      modelMap: CLOUDFLARE_MAP,
    });
  }

  const hf = env("HUGGINGFACE_API_KEY");
  if (hf) {
    gws.push({
      name: "Hugging Face",
      url: "https://router.huggingface.co/v1/chat/completions",
      key: hf,
      modelMap: HUGGINGFACE_MAP,
    });
  }

  return gws;
}

function headersFor(gw: AiGateway): Record<string, string> {
  if (gw.useLovableHeader) {
    return {
      "Content-Type": "application/json",
      "Lovable-API-Key": gw.key,
      Authorization: `Bearer ${gw.key}`,
      ...(gw.extraHeaders || {}),
    };
  }
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${gw.key}`,
    ...(gw.extraHeaders || {}),
  };
}

export type AiChatMessage = { role: "system" | "user" | "assistant"; content: string };

export interface AiChainOptions {
  /** Preferred internal model id; the rest of the chain is used as fallback. */
  model?: string;
  maxTokens?: number;
  temperature?: number;
  /** Log prefix so each feature is identifiable in the function logs. */
  label?: string;
}

export interface AiChainResult {
  text: string;
  model: string;
  gateway: string;
}

/**
 * Try every configured provider × model until one returns text.
 * Returns null only when every provider/model combination failed.
 */
export async function runAiChain(
  messages: AiChatMessage[],
  options: AiChainOptions = {},
): Promise<AiChainResult | null> {
  const label = options.label || "ai-chain";
  const gateways = buildAiGateways();
  if (gateways.length === 0) {
    console.error(`[${label}] no AI provider key configured`);
    return null;
  }

  const preferred = options.model && options.model.trim() ? options.model.trim() : AI_MODEL_CHAIN[0];
  const models = [preferred, ...AI_MODEL_CHAIN.filter((m) => m !== preferred)];

  for (const model of models) {
    for (const gw of gateways) {
      const providerModel = gw.modelMap ? gw.modelMap[model] : model;
      if (!providerModel) continue;
      // The Lovable model rejects temperature / max_tokens, so the length limit
      // is stated in the prompt instead.
      const body = gw.useLovableHeader
        ? {
            model: providerModel,
            messages: [
              ...messages,
              {
                role: "system" as const,
                content: `Keep the answer within roughly ${Math.round((options.maxTokens ?? 600) * 0.7)} words.`,
              },
            ],
            reasoning_effort: "low",
          }
        : {
            model: providerModel,
            messages,
            temperature: options.temperature ?? 0.7,
            max_tokens: options.maxTokens ?? 600,
          };
      try {
        const res = await fetch(gw.url, {
          method: "POST",
          headers: headersFor(gw),
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const detail = (await res.text()).slice(0, 200);
          console.warn(`[${label}] ${gw.name} ${providerModel} -> ${res.status}: ${detail}`);
          continue;
        }
        const json = await res.json();
        const text = json?.choices?.[0]?.message?.content?.trim();
        if (text) {
          console.log(`[${label}] ✅ ${gw.name} / ${providerModel}`);
          return { text, model: providerModel, gateway: gw.name };
        }
        console.warn(`[${label}] ${gw.name} ${providerModel} returned empty text`);
      } catch (e) {
        console.warn(`[${label}] ${gw.name} ${providerModel} error:`, e);
      }
    }
  }
  console.error(`[${label}] ❌ all providers/models failed`);
  return null;
}

/** Convenience wrapper for the common system+user prompt shape. */
export async function askAiChain(
  system: string,
  user: string,
  options: AiChainOptions = {},
): Promise<string | null> {
  const result = await runAiChain(
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    options,
  );
  return result?.text ?? null;
}
