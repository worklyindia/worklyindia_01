// Shared STT provider chain: AssemblyAI → Groq Whisper → Deepgram → Lovable gateway.
// All provider credentials are read server-side from Supabase Edge Function secrets.

export interface SttResult {
  text: string;
  detected_language: string;
  confidence: number;
  provider: 'assemblyai' | 'groq' | 'deepgram' | 'lovable';
}

async function transcribeWithAssemblyAI(audioBytes: Uint8Array<ArrayBuffer>, requestId: string): Promise<SttResult> {
  const key = Deno.env.get('ASSEMBLYAI_API_KEY');
  if (!key) throw new Error('ASSEMBLYAI_API_KEY not configured');
  const uploadRes = await fetch('https://api.assemblyai.com/v2/upload', {
    method: 'POST', headers: { authorization: key, 'content-type': 'application/octet-stream' }, body: audioBytes,
  });
  if (!uploadRes.ok) throw new Error(`AssemblyAI upload ${uploadRes.status}: ${(await uploadRes.text()).slice(0,300)}`);
  const { upload_url } = await uploadRes.json();
  const trRes = await fetch('https://api.assemblyai.com/v2/transcript', {
    method: 'POST', headers: { authorization: key, 'content-type': 'application/json' },
    body: JSON.stringify({ audio_url: upload_url, language_detection: true }),
  });
  if (!trRes.ok) throw new Error(`AssemblyAI request ${trRes.status}: ${(await trRes.text()).slice(0,300)}`);
  const { id } = await trRes.json();
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 1200));
    const poll = await fetch(`https://api.assemblyai.com/v2/transcript/${id}`, { headers: { authorization: key } });
    if (!poll.ok) throw new Error(`AssemblyAI poll ${poll.status}`);
    const data = await poll.json();
    if (data.status === 'completed') {
      if (!data.text?.trim()) throw new Error('AssemblyAI returned empty transcript');
      console.log(`[${requestId}] STT provider=assemblyai`);
      return { text: data.text, detected_language: data.language_code || 'unknown', confidence: data.confidence ?? 1, provider: 'assemblyai' };
    }
    if (data.status === 'error') throw new Error(data.error || 'AssemblyAI transcription failed');
  }
  throw new Error('AssemblyAI polling timeout');
}

async function transcribeWithGroq(audioBytes: Uint8Array<ArrayBuffer>, requestId: string): Promise<SttResult> {
  const key = Deno.env.get('GROQ_API_KEY');
  if (!key) throw new Error('GROQ_API_KEY not configured');
  const form = new FormData();
  form.append('file', new Blob([audioBytes], { type: 'audio/webm' }), 'recording.webm');
  form.append('model', 'whisper-large-v3-turbo');
  form.append('response_format', 'verbose_json');
  form.append('language', 'hi');
  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form,
  });
  if (!res.ok) throw new Error(`Groq STT ${res.status}: ${(await res.text()).slice(0,300)}`);
  const data = await res.json();
  if (!data.text?.trim()) throw new Error('Groq returned empty transcript');
  console.log(`[${requestId}] STT provider=groq`);
  return { text: data.text, detected_language: data.language || 'hi', confidence: 1, provider: 'groq' };
}

async function transcribeWithDeepgram(audioBytes: Uint8Array<ArrayBuffer>, requestId: string): Promise<SttResult> {
  const key = Deno.env.get('DEEPGRAM_API_KEY');
  if (!key) throw new Error('DEEPGRAM_API_KEY not configured');
  const res = await fetch('https://api.deepgram.com/v1/listen?model=nova-3&language=hi&smart_format=true', {
    method: 'POST', headers: { Authorization: `Token ${key}`, 'Content-Type': 'audio/webm' }, body: audioBytes,
  });
  if (!res.ok) throw new Error(`Deepgram STT ${res.status}: ${(await res.text()).slice(0,300)}`);
  const data = await res.json();
  const text = data.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
  if (!text.trim()) throw new Error('Deepgram returned empty transcript');
  const confidence = data.results?.channels?.[0]?.alternatives?.[0]?.confidence ?? 1;
  console.log(`[${requestId}] STT provider=deepgram`);
  return { text, detected_language: 'hi', confidence, provider: 'deepgram' };
}

async function transcribeWithLovable(audioBytes: Uint8Array<ArrayBuffer>, requestId: string): Promise<SttResult> {
  const key = Deno.env.get('LOVABLE_API_KEY');
  if (!key) throw new Error('LOVABLE_API_KEY not configured');
  const form = new FormData();
  form.append('file', new Blob([audioBytes], { type: 'audio/webm' }), 'recording.webm');
  form.append('model', 'openai/gpt-4o-mini-transcribe');
  const res = await fetch('https://ai.gateway.lovable.dev/v1/audio/transcriptions', { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form });
  if (!res.ok) throw new Error(`Lovable STT ${res.status}: ${(await res.text()).slice(0,300)}`);
  const data = await res.json();
  if (!data.text?.trim()) throw new Error('Lovable returned empty transcript');
  console.log(`[${requestId}] STT provider=lovable`);
  return { text: data.text, detected_language: data.language || 'unknown', confidence: 1, provider: 'lovable' };
}

export async function transcribeAudio(audioBytes: Uint8Array<ArrayBuffer>, requestId: string): Promise<SttResult> {
  const providers = [
    ['AssemblyAI', transcribeWithAssemblyAI],
    ['Groq Whisper', transcribeWithGroq],
    ['Deepgram', transcribeWithDeepgram],
    ['Lovable Gateway', transcribeWithLovable],
  ] as const;
  const errors: string[] = [];
  for (const [name, fn] of providers) {
    try {
      const result = await fn(audioBytes, requestId);
      if (!result.text.trim()) throw new Error('Empty transcript');
      console.log(`[${requestId}] STT selected provider=${result.provider}`);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${name}: ${message}`);
      console.warn(`[${requestId}] ${name} failed; trying next STT provider: ${message}`);
    }
  }
  throw new Error(`All speech-to-text providers failed. ${errors.join(' | ')}`);
}
