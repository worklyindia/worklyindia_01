import { supabase } from "@/integrations/supabase/client";

export const VOICE_PREVIEW_R2_BASE = "https://pub-d7e0943326ee4d9da8045f267a70faac.r2.dev/voice-previews";

export function voicePreviewUrl(model: string, language: string, voice: string) {
  return `${VOICE_PREVIEW_R2_BASE}/${encodeURIComponent(model)}/${encodeURIComponent(language)}/${encodeURIComponent(voice)}.wav`;
}

type PreviewUploadResponse = {
  ok?: boolean;
  error?: string;
  uploadUrl?: string;
  url?: string;
  contentType?: string;
  verified?: boolean;
};

export async function saveVoicePreviewToR2(model: string, language: string, voice: string, audio: Blob) {
  if (audio.size < 44) throw new Error("Invalid voice preview audio. Expected a WAV file of at least 44 bytes.");
  // R2 single PUT supports objects up to 5 GiB. Upload directly to R2 with a
  // short-lived, owner-authorized presigned URL instead of base64 through Edge
  // Functions, which would impose a much smaller JSON request-body limit.
  if (audio.size > 5 * 1024 * 1024 * 1024) throw new Error("Voice preview exceeds Cloudflare R2's 5 GiB single-upload limit.");
  const signature = new Uint8Array(await audio.slice(0, 12).arrayBuffer());
  const riff = String.fromCharCode(...signature.slice(0, 4));
  const wave = String.fromCharCode(...signature.slice(8, 12));
  if (riff !== "RIFF" || wave !== "WAVE") {
    throw new Error("The selected voice returned an invalid WAV audio file. Please test the voice again.");
  }

  const { data: signedData, error: signedError } = await supabase.functions.invoke("unified-voice", {
    body: { action: "create_voice_preview_upload", model, language, voice },
  });
  if (signedError) throw signedError;
  const signed = signedData as PreviewUploadResponse | null;
  if (!signed?.ok || !signed.uploadUrl || !signed.url) {
    throw new Error(signed?.error || "Cloudflare could not prepare the secure voice-preview upload.");
  }

  let uploadResponse: Response;
  try {
    uploadResponse = await fetch(signed.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "audio/wav" },
      body: audio,
    });
  } catch {
    throw new Error("Could not connect to Cloudflare R2. Check the bucket CORS policy and network connection.");
  }
  if (!uploadResponse.ok) {
    const details = (await uploadResponse.text()).slice(0, 240);
    throw new Error(`Cloudflare R2 upload failed (${uploadResponse.status}): ${details || uploadResponse.statusText}`);
  }

  const { data: verifyData, error: verifyError } = await supabase.functions.invoke("unified-voice", {
    body: { action: "verify_voice_preview_upload", model, language, voice, expectedBytes: audio.size },
  });
  if (verifyError) throw verifyError;
  const verified = verifyData as PreviewUploadResponse | null;
  if (!verified?.ok || verified.verified !== true || typeof verified.url !== "string") {
    throw new Error(verified?.error || "Cloudflare upload finished but could not be verified.");
  }
  return verified.url;
}
