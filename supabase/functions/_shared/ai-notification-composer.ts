// Notification composer — AI REWRITING REMOVED.
//
// Push, Telegram and Email notifications now always send the exact template
// text saved in the Owner Portal. This module is kept only so the existing
// callers (email-api, unified-telegram-api,
// email-trigger-handler) keep compiling: it returns the provided template
// verbatim, makes no AI calls and writes no variant cache.

type Channel = "push" | "telegram" | "email";
type Audience = "user" | "employer";

export interface AiComposeInput {
  eventType: string;
  channel: Channel;
  audience?: Audience;
  language?: string;
  variables?: Record<string, any>;
  fallbackTitle?: string;
  fallbackMessage: string;
  fallbackHtml?: string;
}

export interface AiComposed {
  title: string | null;
  message: string;
  html: string | null;
  source: "ai-fresh" | "ai-cached" | "fallback";
  variant_id?: string | null;
  selection_reason?: string;
}

/** Returns the saved template text unchanged. No AI, no caching. */
export async function composeNotification(input: AiComposeInput): Promise<AiComposed> {
  return {
    title: input.fallbackTitle ?? null,
    message: input.fallbackMessage,
    html: input.fallbackHtml ?? null,
    source: "fallback",
    variant_id: null,
    selection_reason: "ai-disabled",
  };
}
