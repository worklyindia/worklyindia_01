import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    switch (action) {
      case 'text-to-speech':
        return await handleTextToSpeech(supabase, params, req);
      
      case 'speech-to-text':
        return await handleSpeechToText(params);
      
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


async function generateTTS(text: string, preferred = 'cartesia', language = 'hi'): Promise<{audio: ArrayBuffer; provider: string}> {
  const order = [preferred, 'cartesia', 'minimax', 'elevenlabs'].filter((p, i, a) => ['cartesia','minimax','elevenlabs'].includes(p) && a.indexOf(p) === i);
  const errors: string[] = [];
  for (const p of order) {
    try {
      if (p === 'cartesia') {
        const key = Deno.env.get('CARTESIA_API_KEY');
        if (!key) throw new Error('CARTESIA_API_KEY missing');
        const r = await fetch('https://api.cartesia.ai/tts/bytes', {method:'POST', headers:{'X-API-Key':key,'Cartesia-Version':'2026-08-14','Content-Type':'application/json'}, body:JSON.stringify({model_id:'sonic-3.6',transcript:text,voice:{mode:'id',id:'56e35e2d-6eb6-4226-ab8b-9776515a7094'},language,output_format:{container:'mp3',bit_rate:128000,sample_rate:44100}})});
        if (!r.ok) throw new Error('HTTP '+r.status+' '+(await r.text()).slice(0,350));
        const audio=await r.arrayBuffer(); if (!audio.byteLength) throw new Error('Empty audio'); return {audio,provider:p};
      }
      if (p === 'minimax') {
        const key=Deno.env.get('MINIMAX_API_KEY'); if(!key) throw new Error('MINIMAX_API_KEY missing');
        const group=Deno.env.get('MINIMAX_GROUP_ID');
        const url='https://api.minimax.io/v1/t2a_v2'+(group?'?GroupId='+encodeURIComponent(group):'');
        const r=await fetch(url,{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({model:'speech-2.8-turbo',text,stream:false,voice_setting:{voice_id:'English_Trustworth_Man',speed:1,vol:1,pitch:0},audio_setting:{sample_rate:32000,bitrate:128000,format:'mp3',channel:1}})});
        if(!r.ok) throw new Error('HTTP '+r.status+' '+(await r.text()).slice(0,350));
        const j=await r.json(); if(j.base_resp?.status_code && j.base_resp.status_code!==0) throw new Error(j.base_resp.status_msg||'MiniMax error');
        const hex=j.data?.audio; if(!hex || hex.length%2) throw new Error('MiniMax returned invalid audio');
        const bytes=new Uint8Array(hex.length/2); for(let i=0;i<bytes.length;i++) bytes[i]=parseInt(hex.slice(i*2,i*2+2),16);
        return {audio:bytes.buffer,provider:p};
      }
      if (p === 'elevenlabs') {
        const key=Deno.env.get('ELEVENLABS_API_KEY'); if(!key) throw new Error('ELEVENLABS_API_KEY missing');
        const voice=Deno.env.get('ELEVENLABS_VOICE_ID')||'JBFqnCBsd6RMkjVDRZzb';
        const r=await fetch('https://api.elevenlabs.io/v1/text-to-speech/'+encodeURIComponent(voice)+'?output_format=mp3_44100_128',{method:'POST',headers:{'xi-api-key':key,'Content-Type':'application/json','Accept':'audio/mpeg'},body:JSON.stringify({text,model_id:'eleven_multilingual_v2'})});
        if(!r.ok) throw new Error('HTTP '+r.status+' '+(await r.text()).slice(0,350));
        const audio=await r.arrayBuffer(); if(!audio.byteLength) throw new Error('Empty audio'); return {audio,provider:p};
      }
    } catch(e) { const m=e instanceof Error?e.message:String(e); errors.push(p+': '+m); console.error('[unified-voice] '+p+' failed; fallback next: '+m); }
  }
  throw new Error('All TTS providers failed. '+errors.join(' | '));
}

// =============================================
// TEXT TO SPEECH (Cartesia → MiniMax → ElevenLabs)
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

    const generated = await generateTTS(text, params.provider || 'cartesia', params.language || 'hi');
    const arrayBuffer = generated.audio;
    const { error: uploadError } = await supabase.storage.from('cached-voice-audio').upload(fileName, arrayBuffer, { contentType: 'audio/mpeg', upsert: true });

    if (uploadError) {
      const base64Audio = base64Encode(arrayBuffer);
      return new Response(JSON.stringify({ audioContent: base64Audio, cached: false }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const audioUrl = `${supabaseUrl}/storage/v1/object/public/cached-voice-audio/${fileName}`;
    return new Response(JSON.stringify({ audioUrl, provider: generated.provider, cached: false }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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

  const generated = await generateTTS(text, provider, params.language || 'hi');
  const audioBuffer = generated.audio;
  console.log(`[unified-voice] generated with ${generated.provider}`);

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

  return new Response(JSON.stringify({ audioContent: base64Encode(audioBuffer), provider: generated.provider, cached: false }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

// =============================================
// SPEECH TO TEXT (AssemblyAI → Lovable fallback)
// =============================================

async function handleSpeechToText(params: any) {
  const { audio } = params;
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


