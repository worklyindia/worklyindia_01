import { supabase } from '@/integrations/supabase/client';

type RelayJob = {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'expired';
  result?: { audio_url?: string; content_type?: string; error?: string } | null;
};

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

export async function requestOwnerPhoneVoiceAudio(text: string, language: string): Promise<string> {
  const { data: created, error: createError } = await supabase.functions.invoke('workly-ai-voice-relay', {
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

  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    await wait(1200);
    const { data, error } = await supabase.functions.invoke('workly-ai-voice-relay', {
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
