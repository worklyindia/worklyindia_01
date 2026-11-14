// Shared STT helper: try AssemblyAI first, fall back to Lovable AI Gateway
// if AssemblyAI fails (missing key, rate limit, quota exhausted, or any error).

export interface SttResult {
  text: string;
  detected_language: string;
  confidence: number;
  provider: 'assemblyai' | 'lovable';
}

async function transcribeWithAssemblyAI(
  audioBytes: Uint8Array<ArrayBuffer>,
  requestId: string
): Promise<SttResult> {
  const key = Deno.env.get('ASSEMBLYAI_API_KEY');
  if (!key) throw new Error('ASSEMBLYAI_API_KEY not configured');

  // 1) Upload raw audio bytes
  const uploadRes = await fetch('https://api.assemblyai.com/v2/upload', {
    method: 'POST',
    headers: { authorization: key, 'content-type': 'application/octet-stream' },
    body: audioBytes,
  });
  if (!uploadRes.ok) {
    const t = await uploadRes.text().catch(() => '');
    throw new Error(`AssemblyAI upload failed ${uploadRes.status}: ${t}`);
  }
  const { upload_url } = await uploadRes.json();

  // 2) Request transcript
  const trRes = await fetch('https://api.assemblyai.com/v2/transcript', {
    method: 'POST',
    headers: { authorization: key, 'content-type': 'application/json' },
    body: JSON.stringify({ audio_url: upload_url, language_detection: true }),
  });
  if (!trRes.ok) {
    const t = await trRes.text().catch(() => '');
    throw new Error(`AssemblyAI transcript request failed ${trRes.status}: ${t}`);
  }
  const { id } = await trRes.json();

  // 3) Poll
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1200));
    const pollRes = await fetch(`https://api.assemblyai.com/v2/transcript/${id}`, {
      headers: { authorization: key },
    });
    if (!pollRes.ok) {
      const t = await pollRes.text().catch(() => '');
      throw new Error(`AssemblyAI poll failed ${pollRes.status}: ${t}`);
    }
    const data = await pollRes.json();
    if (data.status === 'completed') {
      console.log(`[${requestId}] AssemblyAI ✅ transcribed`);
      return {
        text: data.text || '',
        detected_language: data.language_code || 'unknown',
        confidence: data.confidence ?? 1,
        provider: 'assemblyai',
      };
    }
    if (data.status === 'error') {
      throw new Error(`AssemblyAI error: ${data.error || 'unknown'}`);
    }
  }
  throw new Error('AssemblyAI polling timeout');
}

async function transcribeWithLovable(
  audioBytes: Uint8Array<ArrayBuffer>,
  requestId: string
): Promise<SttResult> {
  const lovableKey = Deno.env.get('LOVABLE_API_KEY');
  if (!lovableKey) throw new Error('LOVABLE_API_KEY not configured');

  const audioBlob = new Blob([audioBytes], { type: 'audio/webm' });
  const formData = new FormData();
  formData.append('file', audioBlob, 'recording.webm');
  formData.append('model', 'openai/gpt-4o-mini-transcribe');

  const res = await fetch('https://ai.gateway.lovable.dev/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${lovableKey}` },
    body: formData,
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    if (res.status === 429) throw new Error('Rate limit reached. Please try again shortly.');
    if (res.status === 402) throw new Error('AI credits exhausted. Please add credits.');
    throw new Error(`Lovable STT failed ${res.status}: ${t}`);
  }
  const j = await res.json();
  console.log(`[${requestId}] Lovable ✅ transcribed`);
  return {
    text: j.text || '',
    detected_language: j.language || 'unknown',
    confidence: 1,
    provider: 'lovable',
  };
}

/**
 * Try AssemblyAI first. On ANY failure (missing key, quota, rate limit,
 * network, timeout, error status), fall back to Lovable AI Gateway.
 */
export async function transcribeAudio(
  audioBytes: Uint8Array<ArrayBuffer>,
  requestId: string
): Promise<SttResult> {
  try {
    return await transcribeWithAssemblyAI(audioBytes, requestId);
  } catch (err: any) {
    console.warn(
      `[${requestId}] AssemblyAI failed, falling back to Lovable: ${err?.message || err}`
    );
    return await transcribeWithLovable(audioBytes, requestId);
  }
}
