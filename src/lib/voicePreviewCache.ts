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
  const { data, error } = await supabase.functions.invoke("unified-voice", {
    body: { action: "save_voice_preview", model, language, voice, audio: base64 },
  });
  if (error) throw error;
  if (!data?.ok || typeof data.url !== "string") throw new Error(data?.error || "Could not save preview to Cloudflare R2.");
  return data.url as string;
}
