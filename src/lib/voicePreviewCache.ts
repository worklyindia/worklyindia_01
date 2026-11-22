import { supabase } from "@/integrations/supabase/client";

export const VOICE_PREVIEW_R2_BASE = "https://pub-d7e0943326ee4d9da8045f267a70faac.r2.dev/voice-previews";

export function voicePreviewUrl(model: string, language: string, voice: string) {
  return `${VOICE_PREVIEW_R2_BASE}/${encodeURIComponent(model)}/${encodeURIComponent(language)}/${encodeURIComponent(voice)}.wav`;
}

export async function saveVoicePreviewToR2(model: string, language: string, voice: string, audio: Blob) {
  if (audio.type !== "audio/wav" && audio.size < 44) throw new Error("Invalid voice preview audio.");
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not prepare voice preview upload."));
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.readAsDataURL(audio);
  });
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await supabase.functions.invoke("unified-voice", {
      body: { action: "save_voice_preview", model, language, voice, audio: base64 },
    });
    if (!error && data?.ok && typeof data.url === "string" && data.verified === true) return data.url as string;
    lastError = error ?? new Error(data?.error || "Cloudflare did not verify the saved preview.");
    const status = error && typeof error === "object" && "context" in error && error.context instanceof Response
      ? error.context.status
      : null;
    if (status !== null && status >= 400 && status < 500) break;
    if (attempt < 2) await new Promise((resolve) => window.setTimeout(resolve, 700 * (attempt + 1)));
  }
  throw lastError instanceof Error ? lastError : new Error("Could not save voice preview to Cloudflare R2 after 3 attempts.");
}
