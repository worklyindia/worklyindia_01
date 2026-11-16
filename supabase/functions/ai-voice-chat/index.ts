import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { runAiChain } from "../_shared/aiChain.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://worklyindia.devs.surf",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: corsHeaders });
  }

  // Supabase verifies the caller JWT at the Edge Function gateway (verify_jwt=true).
  // This endpoint is deliberately stateless: no database, storage, chat history,
  // usage counters, transcript logging, or response caching.
  try {
    const body = await req.json();
    const transcript = typeof body?.text === "string" ? body.text.trim() : "";
    const language = typeof body?.language === "string" ? body.language : "Hindi";
    if (!transcript || transcript.length > 4000) {
      return new Response(JSON.stringify({ error: "Please provide speech text up to 4,000 characters." }), { status: 400, headers: corsHeaders });
    }
    const languageNames: Record<string, string> = {
      Hindi: "Hindi",
      English: "English",
      Gujarati: "Gujarati",
    };
    const responseLanguage = languageNames[language] || "Hindi";
    const result = await runAiChain(
      [
        {
          role: "system",
          content: `You are Workly India AI, a helpful conversational voice assistant. Reply naturally and concisely in ${responseLanguage}. The user is speaking in a live voice call. Do not claim to have performed actions you did not perform. Keep replies suitable for being spoken aloud, usually 1-4 short sentences.`,
        },
        { role: "user", content: transcript },
      ],
      { maxTokens: 220, temperature: 0.6, label: "stateless-ai-voice", silent: true },
    );
    if (!result?.text) {
      return new Response(JSON.stringify({ error: "AI service is temporarily unavailable. Please try again." }), { status: 503, headers: corsHeaders });
    }
    return new Response(JSON.stringify({ reply: result.text }), { status: 200, headers: corsHeaders });
  } catch {
    // Never log request content or transcript text.
    return new Response(JSON.stringify({ error: "Unable to process this voice request." }), { status: 400, headers: corsHeaders });
  }
});
