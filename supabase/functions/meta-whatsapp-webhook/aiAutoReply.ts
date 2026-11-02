// AI auto reply for employer WhatsApp numbers (connected from AI Connect or the employer WhatsApp page).
import { createOpenAI } from "npm:@ai-sdk/openai@2";
import { streamText, type ModelMessage } from "npm:ai@5";
import { runAiChain } from "../_shared/aiChain.ts";

const MODEL = "openai/gpt-6-astra";

export interface WhatsAppAISettings {
  ai_tone?: string;
  ai_language?: string;
  ai_business_info?: string;
  ai_custom_instructions?: string;
  ai_signature?: string;
  ai_reply_length?: string;
}

const TONE_LINES: Record<string, string> = {
  professional: "Use a polite, professional tone.",
  friendly: "Use a warm, friendly tone.",
  concise: "Be very concise and to the point.",
  supportive: "Be supportive and encouraging.",
};

const LENGTH_LINES: Record<string, string> = {
  short: "Keep replies under 60 words.",
  medium: "Keep replies under 120 words.",
  long: "Replies may be up to 200 words when detail is needed.",
};

function languageLine(lang?: string): string {
  switch (lang) {
    case "Hindi":
      return "Always reply in Hindi (Devanagari).";
    case "Hinglish":
      return "Always reply in Hinglish (Hindi written in Roman script).";
    case "English":
      return "Always reply in English.";
    default:
      return "Reply in the same language the candidate uses (Hindi, Hinglish or English).";
  }
}

export async function generateEmployerReply(opts: {
  companyName: string;
  history: { direction: string; content: string }[];
  settings?: WhatsAppAISettings;
  businessContext?: string;
  accountContext?: string;
}): Promise<string | null> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) { console.warn("[wa-ai] LOVABLE_API_KEY missing"); return null; }
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
  });
  const messages: ModelMessage[] = opts.history
    .filter((m) => m.content?.trim())
    .map((m) => ({ role: m.direction === "inbound" ? "user" : "assistant", content: m.content.slice(0, 2000) }));
  if (!messages.length || messages[messages.length - 1].role !== "user") return null;

  const s = opts.settings || {};
  const parts = [
    `You are the WhatsApp assistant for ${opts.companyName}. You work for this business only — help its customers with their questions.`,
    TONE_LINES[s.ai_tone || ""] || TONE_LINES.friendly,
    languageLine(s.ai_language),
    LENGTH_LINES[s.ai_reply_length || ""] || LENGTH_LINES.short,
    "Answer using the business information provided. Never invent prices, dates or promises; if unsure, say the team will get back soon. Plain text only, no markdown.",
    "Understand the customer before answering fully: if their message is vague or you lack details, ask one short, friendly follow-up question (e.g. what they need, their budget, location or timeline). Remember what they share in the conversation and use it to personalise later replies.",
  ];
  if (s.ai_business_info?.trim()) {
    parts.push(`Business info from the employer (use it to answer accurately):\n${s.ai_business_info.trim().slice(0, 3000)}`);
  }
  if (s.ai_custom_instructions?.trim()) {
    parts.push(`Extra instructions from the employer:\n${s.ai_custom_instructions.trim().slice(0, 1500)}`);
  }
  if (opts.businessContext) {
    parts[0] = `You are the WhatsApp assistant replying on behalf of the business described below.`;
    parts[4] = "Answer customer questions using only the business profile. Never invent prices, dates or promises; if unsure, say you'll get back soon. Plain text only, no markdown.";
    parts.push(opts.businessContext);
  }
  if (opts.accountContext) parts.push(opts.accountContext);
  if (s.ai_signature?.trim()) {
    parts.push(`End every reply with this signature on a new line: ${s.ai_signature.trim().slice(0, 200)}`);
  }

  const result = streamText({
    model: provider.responses(MODEL),
    system: parts.join("\n"),
    messages,
    providerOptions: {
      openai: {
        forceReasoning: true,
        reasoningEffort: "low",
        reasoningSummary: "auto",
        store: false,
        include: ["reasoning.encrypted_content"],
      },
    },
  });
  let text = "";
  try {
    for await (const chunk of result.textStream) text += chunk;
  } catch (e) {
    console.error("[wa-ai] generation failed", e instanceof Error ? e.message : e);
  }
  if (text.trim()) return text.trim();
  // Fallback: try every configured provider so a single model failure never drops a reply.
  const fallback = await runAiChain(
    [{ role: "system", content: parts.join("\n") }, ...messages.map((m) => ({ role: m.role as "user" | "assistant", content: String(m.content) }))],
    { label: "wa-ai", maxTokens: 400 },
  );
  return fallback?.text?.trim() || null;
}
