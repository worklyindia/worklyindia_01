import { supabase } from '@/integrations/supabase/client';

type RelayJob = {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'expired';
  result?: { audio_url?: string; content_type?: string; error?: string; reply?: string; text?: string; languageTag?: string } | null;
};

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

export async function requestOwnerPhoneVoiceAudio(text: string, language: string, voice = '', timeoutMs = 180_000): Promise<string> {
  const { data: created, error: createError } = await supabase.functions.invoke('unified-voice', {
    body: {
      action: 'create_job',
      job_type: 'tts',
      payload: { text: text.slice(0, 1000), language: language || 'hi-IN', ...(voice ? { voice } : {}) },
    },
  });
  if (createError) throw createError;
  const jobId = created?.job?.id;
  if (typeof jobId !== 'string') throw new Error(created?.error || 'Shared Workly Voice phone is unavailable.');

  window.dispatchEvent(new CustomEvent('workly-voice-status', {
    detail: { status: 'queued', queuePosition: created.queue_position ?? null },
  }));

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await wait(350);
    const { data, error } = await supabase.functions.invoke('unified-voice', {
      body: { action: 'get_job', job_id: jobId },
    });
    if (error) throw error;
    const job = data?.job as RelayJob | undefined;
    if (!job) throw new Error('Shared voice request could not be found.');
    if (job.status === 'failed' || job.status === 'expired') {
      throw new Error(job.result?.error || 'Shared voice request failed.');
    }
    if (job.status === 'completed') {
      const audioUrl = job.result?.audio_url;
      if (typeof audioUrl !== 'string' || !audioUrl) {
        throw new Error('The owner phone completed the request without returning audio.');
      }
      return audioUrl;
    }
    window.dispatchEvent(new CustomEvent('workly-voice-status', {
      detail: { status: job.status === 'running' ? 'generating' : 'queued' },
    }));
  }
  throw new Error('The shared voice request timed out. Please try again.');
}


export async function requestOwnerPhoneAIReply(text: string, languageTag = 'auto'): Promise<{ reply: string; languageTag: string }> {
  const { data: created, error: createError } = await supabase.functions.invoke('unified-voice', {
    body: { action: 'create_job', job_type: 'ai', payload: { text: text.slice(0, 4000), languageTag } },
  });
  if (createError) throw createError;
  const jobId = created?.job?.id;
  if (typeof jobId !== 'string') throw new Error(created?.error || 'Shared Workly Voice phone is unavailable.');
  window.dispatchEvent(new CustomEvent('workly-voice-ai-status', { detail: { status: 'queued' } }));
  // Android online AI requests may take up to 60 seconds; allow time for the phone to finish.
  const deadline = Date.now() + 75_000;
  while (Date.now() < deadline) {
    await wait(350);
    const { data, error } = await supabase.functions.invoke('unified-voice', {
      body: { action: 'get_job', job_id: jobId },
    });
    if (error) throw error;
    const job = data?.job as RelayJob | undefined;
    if (!job) throw new Error('Shared AI request could not be found.');
    if (job.status === 'failed' || job.status === 'expired') throw new Error(job.result?.error || 'Shared AI request failed.');
    if (job.status === 'completed') {
      const reply = typeof job.result?.reply === 'string' ? job.result.reply.trim() : '';
      if (!reply) throw new Error('The owner phone completed the AI request without a reply.');
      return { reply, languageTag: typeof job.result?.languageTag === 'string' ? job.result.languageTag : languageTag };
    }
    window.dispatchEvent(new CustomEvent('workly-voice-ai-status', { detail: { status: job.status } }));
  }
  throw new Error('The shared phone AI request timed out.');
}


export async function requestOwnerPhoneTranscription(audioBase64: string): Promise<{ text: string; languageTag: string }> {
  if (!audioBase64 || audioBase64.length > 1_800_000) throw new Error('Caller audio is empty or exceeds the upload limit.');
  const { data: created, error: createError } = await supabase.functions.invoke('unified-voice', {
    body: { action: 'create_stt_job', audio_base64: audioBase64 },
  });
  if (createError) throw createError;
  const jobId = created?.job?.id;
  if (typeof jobId !== 'string') throw new Error(created?.error || 'Workly Voice phone is offline.');
  window.dispatchEvent(new CustomEvent('workly-voice-stt-status', { detail: { status: 'queued' } }));
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    await wait(350);
    const { data, error } = await supabase.functions.invoke('unified-voice', { body: { action: 'get_job', job_id: jobId } });
    if (error) throw error;
    const job = data?.job as RelayJob | undefined;
    if (!job) throw new Error('Workly Voice transcription job could not be found.');
    if (job.status === 'failed' || job.status === 'expired') throw new Error(job.result?.error || 'Workly Voice transcription failed.');
    if (job.status === 'completed') {
      const text = typeof job.result?.text === 'string' ? job.result.text.trim() : '';
      if (!text) throw new Error('Workly Voice returned an empty transcript.');
      return { text, languageTag: typeof job.result?.languageTag === 'string' ? job.result.languageTag : 'auto' };
    }
    window.dispatchEvent(new CustomEvent('workly-voice-stt-status', { detail: { status: job.status } }));
  }
  throw new Error('Workly Voice speech recognition timed out.');
}


/** Fetches generated audio into browser memory, then removes its temporary relay object and job row. */
export async function requestOwnerPhoneVoiceAudioBlob(text: string, language: string, voice = '', timeoutMs = 180_000): Promise<Blob> {
  const audioUrl = await requestOwnerPhoneVoiceAudio(text, language, voice, timeoutMs);
  try {
    const response = await fetch(audioUrl);
    if (!response.ok) throw new Error("Could not download generated voice audio from the phone relay.");
    const blob = await response.blob();
    if (!blob.size) throw new Error("The phone returned an empty audio file.");
    return blob;
  } finally {
    // Best-effort cleanup; expiry cleanup remains the fallback if the browser disconnects.
    const marker = "/workly-ai-voice-audio/";
    const pathname = new URL(audioUrl).pathname;
    const markerIndex = pathname.indexOf(marker);
    if (markerIndex >= 0) {
      const audioPath = decodeURIComponent(pathname.slice(markerIndex + marker.length));
      await supabase.functions.invoke("unified-voice", {
        body: { action: "cleanup_completed_audio", audio_path: audioPath },
      });
    }
  }
}


/** Splits long text into short phone-sized requests to keep each WAV below the relay upload limit. */
export async function requestOwnerPhoneLongVoiceAudioBlob(text: string, language: string, voice = ''): Promise<Blob> {
  const chunks: string[] = [];
  let remaining = text.trim();
  const maxChunkChars = 180;
  while (remaining.length) {
    if (remaining.length <= maxChunkChars) { chunks.push(remaining); break; }

    // Prefer a complete sentence so Hindi, Gujarati and English prosody sounds natural.
    const windowText = remaining.slice(0, maxChunkChars);
    const sentenceCuts = ["।", ".", "!", "?", "।", "…"]
      .map((mark) => windowText.lastIndexOf(mark) + 1)
      .filter((position) => position >= 80);
    let cut = sentenceCuts.length ? Math.max(...sentenceCuts) : -1;

    // If there is no sentence boundary, split at a word boundary without dropping text.
    if (cut < 0) {
      cut = windowText.lastIndexOf(" ");
      if (cut < 80) cut = maxChunkChars;
    }

    const part = remaining.slice(0, cut).trim();
    if (part) chunks.push(part);
    remaining = remaining.slice(cut).trim();
  }
  if (!chunks.length) throw new Error("Enter text before converting.");
  const wavParts: Uint8Array[] = [];
  let formatHeader: Uint8Array | null = null;
  let dataOffset = 44;
  let totalDataBytes = 0;
  for (let index = 0; index < chunks.length; index++) {
    window.dispatchEvent(new CustomEvent("workly-voice-status", {
      detail: { status: "generating", part: index + 1, total: chunks.length },
    }));
    const blob = await requestOwnerPhoneVoiceAudioBlob(chunks[index], language, voice);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    if (bytes.length < 44 || String.fromCharCode(...bytes.slice(0, 4)) !== "RIFF") {
      throw new Error("The phone returned an unsupported WAV audio file.");
    }
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let offset = 12;
    let partDataOffset = -1;
    let partDataLength = 0;
    while (offset + 8 <= bytes.length) {
      const id = String.fromCharCode(...bytes.slice(offset, offset + 4));
      const size = view.getUint32(offset + 4, true);
      if (id === "data") { partDataOffset = offset + 8; partDataLength = size; break; }
      offset += 8 + size + (size % 2);
    }
    if (partDataOffset < 0 || partDataOffset + partDataLength > bytes.length) {
      throw new Error("The generated WAV file has an invalid audio data section.");
    }
    if (!formatHeader) {
      dataOffset = partDataOffset;
      formatHeader = bytes.slice(0, dataOffset);
    }
    wavParts.push(bytes.slice(partDataOffset, partDataOffset + partDataLength));
    totalDataBytes += partDataLength;
  }
  if (!formatHeader) throw new Error("No audio was generated.");
  const output = new Uint8Array(dataOffset + totalDataBytes);
  output.set(formatHeader, 0);
  let cursor = dataOffset;
  for (const part of wavParts) { output.set(part, cursor); cursor += part.length; }
  const resultView = new DataView(output.buffer);
  resultView.setUint32(4, output.length - 8, true);
  // Standard PCM WAV data chunk header follows the fmt chunk in the preserved header.
  let chunkOffset = 12;
  while (chunkOffset + 8 <= dataOffset) {
    const id = String.fromCharCode(...output.slice(chunkOffset, chunkOffset + 4));
    const size = resultView.getUint32(chunkOffset + 4, true);
    if (id === "data") { resultView.setUint32(chunkOffset + 4, totalDataBytes, true); break; }
    chunkOffset += 8 + size + (size % 2);
  }
  return new Blob([output], { type: "audio/wav" });
}
