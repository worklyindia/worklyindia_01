import { supabase } from '@/integrations/supabase/client';

type RelayJob = {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'expired';
  result?: { audio_url?: string; content_type?: string; error?: string; reply?: string; text?: string; languageTag?: string } | null;
};

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

export async function requestOwnerPhoneVoiceAudio(text: string, language: string, timeoutMs = 180_000): Promise<string> {
  const { data: created, error: createError } = await supabase.functions.invoke('unified-voice', {
    body: {
      action: 'create_job',
      job_type: 'tts',
      payload: { text: text.slice(0, 1000), language: language || 'hi-IN' },
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
