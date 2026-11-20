import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { runAiChain } from '../_shared/aiChain.ts';
import { handleWorklyVoiceRelay } from '../workly-ai-voice-relay/index.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-device-token',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Common AI phrases for caching
const COMMON_PHRASES = [
  'नमस्ते', 'धन्यवाद', 'मैं आपकी कैसे मदद कर सकता हूं',
  'क्या आपको और कोई मदद चाहिए', 'आपका स्वागत है', 'शुभ प्रभात',
  'शुभ संध्या', 'आपकी सहायता के लिए यहां हूं', 'कृपया बताएं',
  'समझ गया', 'बिल्कुल', 'अच्छा सवाल', 'मुझे खुशी है कि मैं मदद कर सका',
];

function isCommonPhrase(text: string): boolean {
  const lowerText = text.toLowerCase().trim();
  return COMMON_PHRASES.some(phrase => 
    lowerText.includes(phrase.toLowerCase()) || lowerText === phrase.toLowerCase()
  );
}

async function createTextHash(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function processBase64Chunks(base64String: string): Uint8Array<ArrayBuffer> {
  const cleanBase64 = base64String.replace(/[^A-Za-z0-9+/=]/g, '');
  const binaryString = atob(cleanBase64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { action, ...params } = await req.json();

    console.log(`[unified-voice] Action: ${action}`);

    // Shared owner-phone relay actions are handled by the isolated relay module.
    if (['register_device', 'create_job', 'create_stt_job', 'get_job', 'poll', 'fail_job', 'upload_audio', 'complete_job', 'list_devices', 'revoke_device'].includes(action)) {
      return await handleWorklyVoiceRelay(new Request(req.url, { method: req.method, headers: req.headers, body: JSON.stringify({ action, ...params }) }));
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    switch (action) {
      case 'text-to-speech':
        return await handleTextToSpeech(supabase, params, req);
      
      case 'speech-to-text':
        return await handleSpeechToText(params, req, supabase);

      // Stateless AI voice reply: no database, storage, cache, usage counters or transcript logs.
      case 'ai-voice-chat':
        return await handleAiVoiceChat(supabase, params, req);
      
      default:
        return new Response(
          JSON.stringify({ error: `Invalid action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

  } catch (error) {
    console.error('[unified-voice] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// =============================================
// TEXT TO SPEECH (Cartesia or MiniMax)
// =============================================

async function handleTextToSpeech(supabase: any, params: any, req: Request) {
  const { text, provider = 'cartesia', cacheKey, skipAuth } = params;

  // Handle job application voice with fixed cache
  if (cacheKey && skipAuth) {
    console.log(`🎤 Job application voice with cacheKey: ${cacheKey}`);
    
    const fileName = `${cacheKey}.mp3`;
    const { data: existingFiles } = await supabase.storage.from('cached-voice-audio').list('', { search: fileName });
    
    if (existingFiles && existingFiles.length > 0) {
      const audioUrl = `${supabaseUrl}/storage/v1/object/public/cached-voice-audio/${fileName}`;
      return new Response(JSON.stringify({ audioUrl, cached: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Generate audio with Cartesia
    const apiKey = Deno.env.get('CARTESIA_API_KEY');
    if (!apiKey) throw new Error('CARTESIA_API_KEY not configured');

    const response = await fetch('https://api.cartesia.ai/tts/bytes', {
      method: 'POST',
      headers: { 'X-API-Key': apiKey, 'Cartesia-Version': '2024-11-13', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model_id: 'sonic-latest',
        transcript: text,
        voice: { mode: 'id', id: '56e35e2d-6eb6-4226-ab8b-9776515a7094' },
        language: 'hi',
        output_format: { container: 'mp3', bit_rate: 128000, sample_rate: 44100 },
      }),
    });

    if (!response.ok) throw new Error(`Cartesia API error: ${await response.text()}`);

    const arrayBuffer = await response.arrayBuffer();
    const { error: uploadError } = await supabase.storage.from('cached-voice-audio').upload(fileName, arrayBuffer, { contentType: 'audio/mpeg', upsert: true });

    if (uploadError) {
      const base64Audio = base64Encode(arrayBuffer);
      return new Response(JSON.stringify({ audioContent: base64Audio, cached: false }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const audioUrl = `${supabaseUrl}/storage/v1/object/public/cached-voice-audio/${fileName}`;
    return new Response(JSON.stringify({ audioUrl, cached: false }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  // Regular authenticated voice playback
  const authHeader = req.headers.get('authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Session expired' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  // Check usage
  const { data: usageCheck } = await supabase.rpc('check_ai_chat_usage_only', { p_user_id: user.id, p_usage_type: 'voice_playback' });
  if (!usageCheck?.allowed) {
    return new Response(JSON.stringify({ error: usageCheck?.error || 'Voice playback limit reached' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  if (!text) throw new Error('Text is required');

  // Check cache
  const textHash = await createTextHash(text);
  const { data: cachedData } = await supabase.from('cached_audio').select('audio_url, id').eq('text_hash', textHash).single();

  if (cachedData) {
    const fileName = cachedData.audio_url.split('/').pop();
    const { data: audioData } = await supabase.storage.from('cached-voice-audio').download(fileName!);

    if (audioData) {
      const arrayBuffer = await audioData.arrayBuffer();
      await supabase.rpc('increment_ai_chat_usage', { p_user_id: user.id, p_usage_type: 'voice_playback', p_tokens: 0 });
      return new Response(JSON.stringify({ audioContent: base64Encode(arrayBuffer), cached: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  }

  // Generate based on provider
  let audioBuffer: ArrayBuffer;

  if (provider === 'minimax') {
    const apiKey = Deno.env.get('MINIMAX_API_KEY');
    if (!apiKey) throw new Error('MINIMAX_API_KEY not configured');

    const response = await fetch('https://api.minimax.chat/v1/t2a_v2', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'speech-2.6-turbo',
        text: text,
        stream: false,
        voice_setting: { voice_id: 'English_Trustworth_Man', speed: 1.0, vol: 1.0, pitch: 0, emotion: 'happy' },
        audio_setting: { sample_rate: 32000, bitrate: 128000, format: 'mp3' },
      }),
    });

    if (!response.ok) throw new Error(`MiniMax API error: ${await response.text()}`);
    const result = await response.json();
    if (!result.data?.audio) throw new Error('No audio data');

    // MiniMax returns base64 audio
    await supabase.rpc('increment_ai_chat_usage', { p_user_id: user.id, p_usage_type: 'voice_playback', p_tokens: 0 });
    return new Response(JSON.stringify({ audioContent: result.data.audio, cached: false }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } else {
    // Cartesia (default)
    const apiKey = Deno.env.get('CARTESIA_API_KEY');
    if (!apiKey) throw new Error('CARTESIA_API_KEY not configured');

    const response = await fetch('https://api.cartesia.ai/tts/bytes', {
      method: 'POST',
      headers: { 'X-API-Key': apiKey, 'Cartesia-Version': '2024-11-13', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model_id: 'sonic-latest',
        transcript: text,
        voice: { mode: 'id', id: '56e35e2d-6eb6-4226-ab8b-9776515a7094' },
        language: 'hi',
        output_format: { container: 'mp3', bit_rate: 128000, sample_rate: 44100 },
      }),
    });

    if (!response.ok) throw new Error(`Cartesia API error: ${await response.text()}`);
    audioBuffer = await response.arrayBuffer();
  }

  await supabase.rpc('increment_ai_chat_usage', { p_user_id: user.id, p_usage_type: 'voice_playback', p_tokens: 0 });

  // Cache common phrases
  if (isCommonPhrase(text)) {
    const fileName = `${textHash}.mp3`;
    const { error: uploadError } = await supabase.storage.from('cached-voice-audio').upload(fileName, audioBuffer, { contentType: 'audio/mpeg', upsert: true });
    if (!uploadError) {
      const audioUrl = `${supabaseUrl}/storage/v1/object/public/cached-voice-audio/${fileName}`;
      await supabase.from('cached_audio').insert({ text_hash: textHash, original_text: text, audio_url: audioUrl });
    }
  }

  return new Response(JSON.stringify({ audioContent: base64Encode(audioBuffer), cached: false }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

// =============================================
// SPEECH TO TEXT (AssemblyAI → Lovable fallback)
// =============================================

async function handleSpeechToText(params: any, req: Request, supabase: any) {
  const deviceToken = req.headers.get('x-device-token') || '';
  if (deviceToken.length < 40 || deviceToken.length > 200) throw new Error('Workly Voice device authentication required.');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(deviceToken));
  const tokenHash = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  const { data: device, error: deviceError } = await supabase.from('workly_ai_voice_devices')
    .select('id,user_id').eq('token_hash', tokenHash).is('revoked_at', null).maybeSingle();
  if (deviceError || !device || device.user_id !== Deno.env.get('WORKLY_AI_VOICE_OWNER_USER_ID')) {
    throw new Error('Workly Voice device authentication failed.');
  }
  const { audio } = params;
  if (typeof audio !== 'string' || audio.length > 1_800_000) throw new Error('Audio payload is missing or too large.');
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  console.log(`[${requestId}] Voice-to-text request (AssemblyAI → Lovable fallback)`);

  if (!audio) throw new Error('No audio data provided');

  const binaryAudio = processBase64Chunks(audio);
  console.log(`[${requestId}] Audio size: ${binaryAudio.length} bytes`);

  const { transcribeAudio } = await import('../_shared/sttFallback.ts');
  const result = await transcribeAudio(binaryAudio, requestId);
  console.log(`[${requestId}] Completed in ${Date.now() - startTime}ms via ${result.provider}`);

  return new Response(
    JSON.stringify({
      text: result.text,
      detected_language: result.detected_language,
      confidence: result.confidence,
      provider: result.provider,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}




// =============================================
// STATELESS AI VOICE CHAT (no Workly retention)
// =============================================
async function handleAiVoiceChat(supabase: any, params: any, req: Request) {
  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const { data: { user }, error: authError } = token
    ? await supabase.auth.getUser(token)
    : { data: { user: null }, error: new Error('No user token') };
  // The registered owner phone may request an AI answer for a queued website
  // turn. Its device token is verified against the active owner device row.
  if (!user) {
    const deviceToken = req.headers.get('x-device-token') ?? '';
    const ownerUserId = Deno.env.get('WORKLY_AI_VOICE_OWNER_USER_ID') ?? '';
    if (deviceToken.length < 40 || !ownerUserId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(deviceToken));
    const tokenHash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
    const { data: device, error: deviceError } = await supabase.from('workly_ai_voice_devices')
      .select('id,user_id,revoked_at')
      .eq('token_hash', tokenHash)
      .eq('user_id', ownerUserId)
      .is('revoked_at', null)
      .maybeSingle();
    if (deviceError || !device) {
      return new Response(JSON.stringify({ error: 'Owner phone authentication failed' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  }
  const text = typeof params.text === 'string' ? params.text.trim().slice(0, 4000) : '';
  const languageTag = typeof params.languageTag === 'string' ? params.languageTag.trim().slice(0, 24) : 'und';
  if (!text) {
    return new Response(JSON.stringify({ error: 'Text is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  // Detect a simple greeting even when the relay sends a conversation transcript
  // such as "User: Hello ChatWork." rather than the raw utterance.
  const latestUserUtterance = text.split(/\r?\n/).reverse()
    .find((line: string) => /^(?:user|caller)\s*:/i.test(line))
    ?.replace(/^(?:user|caller)\s*:\s*/i, '').trim() ?? text;
  const isSimpleGreeting = /^(?:hi|hello|hey|good morning|good afternoon|good evening)(?:\s+chatwork)?[.!?,\s]*$/i.test(latestUserUtterance);
  if (isSimpleGreeting) {
    return new Response(JSON.stringify({
      reply: 'Hello! How can I help you today?',
      languageTag: languageTag.startsWith('und') || languageTag === 'auto' ? 'en-IN' : languageTag,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  }
  const scriptDetected =
    /[\u0A80-\u0AFF]/.test(text) ? 'Gujarati' :
    /[\u0B80-\u0BFF]/.test(text) ? 'Tamil' :
    /[\u0C00-\u0C7F]/.test(text) ? 'Telugu' :
    /[\u0C80-\u0CFF]/.test(text) ? 'Kannada' :
    /[\u0D00-\u0D7F]/.test(text) ? 'Malayalam' :
    /[\u0980-\u09FF]/.test(text) ? 'Bengali' :
    /[\u0A00-\u0A7F]/.test(text) ? 'Punjabi' :
    /[\u0900-\u097F]/.test(text) ? 'the detected Devanagari language' :
    'the language used by the caller';
  // The speech-recognition locale is only a hint: browser settings can be English
  // even when the caller speaks Gujarati, Hindi, or another language.
  const languageInstruction = 'Identify the language from the actual words and writing system, not from the device/browser locale. The locale hint is ' + languageTag + '. The text script suggests ' + scriptDetected + ' where applicable. Reply naturally in the caller’s actual language, mirror code-switching, and never switch to English solely because the device locale is English. Do not translate unless asked. For Indian languages, use the normal native script unless the caller clearly requests Roman transliteration.';
  const detectLanguageTag = (value: string, fallback: string): string => {
    if (/[\u0A80-\u0AFF]/.test(value)) return 'gu-IN';
    if (/[\u0B80-\u0BFF]/.test(value)) return 'ta-IN';
    if (/[\u0C00-\u0C7F]/.test(value)) return 'te-IN';
    if (/[\u0C80-\u0CFF]/.test(value)) return 'kn-IN';
    if (/[\u0D00-\u0D7F]/.test(value)) return 'ml-IN';
    if (/[\u0980-\u09FF]/.test(value)) return 'bn-IN';
    if (/[\u0A00-\u0A7F]/.test(value)) return 'pa-IN';
    if (/[\u0B00-\u0B7F]/.test(value)) return 'or-IN';
    if (/[\u0900-\u097F]/.test(value)) return fallback.startsWith('mr') ? 'mr-IN' : fallback.startsWith('ne') ? 'ne-NP' : 'hi-IN';
    if (/[\u0600-\u06FF]/.test(value)) return 'ur-IN';
    return fallback !== 'und' && fallback !== 'auto' ? fallback : 'en-IN';
  };
  const voiceSystemPrompt = [
    'You are Workly India Voice, the helpful voice assistant for the Workly India job-search and hiring platform in India.',
    'Your main purpose is to help job seekers find suitable jobs and help employers understand hiring and job-posting features on Workly India.',
    'Answer the actual question directly. For job-search questions, explain practical steps such as choosing a role and location, using filters, checking job details and applying through the job listing. For resume questions, give the requested complete points. For safety questions, clearly warn users not to pay recruiters or employers to obtain a job and advise reporting suspicious listings.',
    'Do not describe Workly India as an employee HR/payroll/leave-policy service. Do not invent specific vacancies, salaries, fees, policies, links, or features. If a detail is not known, say so briefly and guide the user to check the relevant page or listing.',
    'Reply in the language actually used by the caller. Understand Gujarati, Hindi, English, Roman Hindi, Roman Gujarati, and mixed/code-switched speech. Mirror the caller’s language mix and script. A locale hint is not an instruction to translate or switch languages. If the caller speaks clear English, answer in English; if they speak Roman Hindi or Roman Gujarati, answer in the same Roman script unless they use the native script.',
    'For a simple hello or greeting, answer with one brief friendly greeting and ask how you can help. Do not add unrelated apologies, memory disclaimers, meta-commentary, or statements about previous answers unless the caller specifically asks.',
    'Keep normal voice-call answers concise: 1–3 short spoken sentences, usually under 220 characters, so the phone can synthesize and return audio quickly. If the caller explicitly asks for detailed steps or multiple points, give the necessary complete points but keep each sentence short. Never stop mid-sentence, mid-word, or mid-list. Avoid markdown symbols that sound awkward when spoken.',
    languageInstruction,
  ].join(' ');
  const result = await runAiChain([
    { role: 'system', content: voiceSystemPrompt },
    { role: 'user', content: text },
  ], { maxTokens: 420, temperature: 0.3, label: 'ai-voice-call', silent: true, freeOnly: true });
  if (!result?.text) {
    return new Response(JSON.stringify({ error: 'Free AI providers are temporarily unavailable. Please try again.' }), { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  // Some free-tier models occasionally stop mid-list or mid-sentence even
  // when the requested token budget is available. Ask the same free model
  // chain to continue only when the first answer has no natural ending.
  // Free-tier models sometimes append incomplete meta-commentary after a valid
  // answer (for example, "The previous answer was complete..."). Remove that
  // accidental tail before deciding whether a continuation is actually needed.
  let reply = result.text.trim().replace(
    /\s+(?:The previous answer was|There is nothing further to|There is nothing else to add|The answer is complete)[\s\S]*$/i,
    '',
  ).trim();
  if (isSimpleGreeting) {
    // Greeting turns should stay short and must not grow an unrelated model disclaimer.
    const questionEnd = reply.indexOf('?');
    if (questionEnd >= 0) {
      reply = reply.slice(0, questionEnd + 1).trim();
    } else {
      const sentenceEnd = reply.search(/[.!?।॥]/);
      if (sentenceEnd >= 0) reply = reply.slice(0, sentenceEnd + 1).trim();
    }
  }
  const hasNaturalEnding = /[.!?।॥…]["'”’)]*\\s*$/.test(reply);
  if (!hasNaturalEnding && reply.length > 0) {
    const continuation = await runAiChain([
      { role: 'system', content: voiceSystemPrompt + ' Continue the existing answer only. Do not repeat its opening or any completed point. Finish the current sentence or list naturally, then end with a complete final sentence. Keep the same language and script.' },
      { role: 'assistant', content: reply },
      { role: 'user', content: 'Continue exactly from where the previous answer stopped and finish the answer.' },
    ], { maxTokens: 350, temperature: 0.25, label: 'ai-voice-call-continuation', silent: true, freeOnly: true });
    if (continuation?.text) {
      const nextPart = continuation.text.trim();
      if (nextPart) reply = `${reply.replace(/[\\s,;:—-]+$/, '')} ${nextPart}`.trim();
    }
  }

  // Remove exact consecutive sentence duplicates sometimes emitted by small free models.
  const sentenceParts = reply.match(/[^.!?।॥]+[.!?।॥]?/gu) ?? [reply];
  const uniqueSentences: string[] = [];
  for (const part of sentenceParts) {
    const normalized = part.trim().replace(/[.!?।॥]+$/u, '').toLocaleLowerCase();
    const previous = uniqueSentences.at(-1)?.replace(/[.!?।॥]+$/u, '').toLocaleLowerCase();
    if (normalized && normalized === previous) continue;
    if (part.trim()) uniqueSentences.push(part.trim());
  }
  reply = uniqueSentences.join(' ').replace(/\s+/g, ' ').trim();

  const replyLanguageTag = detectLanguageTag(reply, detectLanguageTag(text, languageTag));
  return new Response(JSON.stringify({ reply, languageTag: replyLanguageTag }), { headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}
