import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Convert base64 to binary for upload
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const cleanBase64 = base64.replace(/[^A-Za-z0-9+/=]/g, '');
  const binaryString = atob(cleanBase64);
  const bytes = new Uint8Array(binaryString.length);
  
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  return bytes.buffer as ArrayBuffer;
}

serve(async (req) => {
  const requestId = crypto.randomUUID();
  console.log(`[${requestId}] AI Chat Voice transcription request (TRACKED)`);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get authorization token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error(`[${requestId}] No Authorization header provided`);
      throw new Error('Authentication required');
    }

    // Extract JWT token from header
    const token = authHeader.replace('Bearer ', '');
    if (!token) {
      console.error(`[${requestId}] Invalid Authorization header format`);
      throw new Error('Invalid authentication token');
    }

    // Use service role key to verify user - more reliable than anon key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get user from JWT token
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !user) {
      console.error(`[${requestId}] Authentication failed:`, userError?.message || 'No user found');
      throw new Error('Authentication failed. Please login again.');
    }

    console.log(`[${requestId}] User authenticated: ${user.id}`);

    // Check voice_input usage before proceeding
    console.log(`[${requestId}] Checking voice_input usage...`);
    const { data: usageCheck, error: usageError } = await supabaseAdmin.rpc('check_ai_chat_usage_only', {
      p_user_id: user.id,
      p_usage_type: 'voice_input'
    });

    if (usageError) {
      console.error(`[${requestId}] Usage check error:`, usageError);
      throw new Error('Failed to check usage limits');
    }

    if (!usageCheck.allowed) {
      console.log(`[${requestId}] Voice input limit reached for user ${user.id}`);
      throw new Error('Voice input limit exhausted. Please upgrade your plan.');
    }

    console.log(`[${requestId}] Voice input allowed - Remaining: ${usageCheck.remaining}`);

    const { audio } = await req.json();

    if (!audio) {
      console.error(`[${requestId}] No audio data provided`);
      throw new Error('No audio data provided');
    }

    console.log(`[${requestId}] Processing audio data...`);
    const audioBuffer = base64ToArrayBuffer(audio);
    const audioBytes = new Uint8Array(audioBuffer);
    console.log(`[${requestId}] Audio buffer size: ${audioBytes.length} bytes`);

    const { transcribeAudio } = await import('../_shared/sttFallback.ts');
    const transcript = await transcribeAudio(audioBytes, requestId);
    console.log(`[${requestId}] Transcription completed (${transcript.provider}): ${transcript.text}`);

    // Increment voice_input usage after successful transcription
    console.log(`[${requestId}] Incrementing voice_input usage for user ${user.id}`);
    await supabaseAdmin.rpc('increment_ai_chat_usage', {
      p_user_id: user.id,
      p_usage_type: 'voice_input',
      p_tokens: 0
    });
    console.log(`[${requestId}] ✅ Voice input usage incremented successfully`);

    return new Response(
      JSON.stringify({
        text: transcript.text,
        detected_language: transcript.detected_language,
        confidence: transcript.confidence,
        provider: transcript.provider,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );


  } catch (error) {
    console.error(`[${requestId}] Error in ai-voice-transcribe:`, error);
    console.error(`[${requestId}] Error stack:`, error instanceof Error ? error.stack : 'No stack trace');
    
    const errorMessage = error instanceof Error ? error.message : 'Transcription failed';
    return new Response(
      JSON.stringify({
        error: errorMessage,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
