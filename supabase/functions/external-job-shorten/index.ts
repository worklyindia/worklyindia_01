// Edge function: create short link for external partner jobs.
// POST body: { source, ext_id, payload }
// Response:  { short_id, short_url }
// Dedupes by (source, ext_id) so re-sharing the same job returns the same code.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789'; // no ambiguous 0/o/1/l
function genId(len = 7): string {
  let out = '';
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json().catch(() => null) as
      | { source?: string; ext_id?: string; payload?: Record<string, unknown> }
      | null;

    const source = (body?.source || '').toString().toLowerCase().replace(/[^a-z0-9]/g, '');
    const ext_id = (body?.ext_id || '').toString();
    const payload = body?.payload;

    if (!source || !ext_id || !payload || typeof payload !== 'object') {
      return new Response(
        JSON.stringify({ error: 'source, ext_id and payload are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Reuse existing short_id if already stored for this (source, ext_id).
    const { data: existing } = await supabase
      .from('external_job_shortlinks')
      .select('short_id')
      .eq('source', source)
      .eq('ext_id', ext_id)
      .maybeSingle();

    let short_id = existing?.short_id as string | undefined;

    if (!short_id) {
      // Try a few random IDs to avoid PK collision.
      for (let attempt = 0; attempt < 5; attempt++) {
        const candidate = genId(7);
        const { error } = await supabase
          .from('external_job_shortlinks')
          .insert({ short_id: candidate, source, ext_id, payload });

        if (!error) {
          short_id = candidate;
          break;
        }
        // If unique on (source,ext_id) collided (race), re-fetch and use it.
        if (error.code === '23505') {
          const { data: raced } = await supabase
            .from('external_job_shortlinks')
            .select('short_id')
            .eq('source', source)
            .eq('ext_id', ext_id)
            .maybeSingle();
          if (raced?.short_id) {
            short_id = raced.short_id;
            break;
          }
          // otherwise PK collision — try another candidate
        } else {
          console.error('shortlink insert error', error);
          return new Response(
            JSON.stringify({ error: 'Failed to create short link', details: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          );
        }
      }
    }

    if (!short_id) {
      return new Response(
        JSON.stringify({ error: 'Could not allocate short id' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(JSON.stringify({ short_id }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('external-job-shorten error', e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
