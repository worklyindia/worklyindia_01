import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { postWebhook } from "../_shared/webhookHealth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get API key from header
    const apiKey = req.headers.get('x-api-key');
    
    if (!apiKey) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Unauthorized',
        message: 'API key is required'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validate API key
    const { data: keyData, error: keyError } = await supabase
      .from('api_keys')
      .select('id, user_id')
      .eq('api_key', apiKey)
      .eq('is_active', true)
      .single();

    if (keyError || !keyData) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Unauthorized',
        message: 'Invalid or inactive API key'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const userId = keyData.user_id;

    // GET - List all webhooks for user
    if (req.method === 'GET') {
      const { data: webhooks, error } = await supabase
        .from('webhook_endpoints')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return new Response(JSON.stringify({
        success: true,
        data: webhooks || [],
        message: 'Webhooks fetched successfully'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // POST - Register new webhook
    if (req.method === 'POST') {
      const body = await req.json();
      const { url, events, description } = body;

      if (!url) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Bad Request',
          message: 'Webhook URL is required'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (!events || !Array.isArray(events) || events.length === 0) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Bad Request',
          message: 'At least one event type is required'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Validate URL format
      try {
        new URL(url);
      } catch {
        return new Response(JSON.stringify({
          success: false,
          error: 'Bad Request',
          message: 'Invalid webhook URL format'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Generate webhook secret
      const secret = `whsec_${Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')}`;

      // Verify the endpoint works before saving it
      const probe = await postWebhook(url, secret, {
        event: 'test.webhook', data: { message: 'Webhook URL verification', test: true }, timestamp: new Date().toISOString(),
      });
      if (!probe.success) {
        return new Response(JSON.stringify({
          success: false, error: 'Endpoint Test Failed',
          message: `Webhook not created. ${probe.error}`,
        }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Create webhook endpoint
      const { data: webhook, error: webhookError } = await supabase
        .from('webhook_endpoints')
        .insert({
          user_id: userId,
          url,
          events,
          description,
          secret,
          is_active: true
        })
        .select()
        .single();

      if (webhookError) throw webhookError;

      return new Response(JSON.stringify({
        success: true,
        data: webhook,
        message: 'Webhook registered successfully. Save your webhook secret securely - you won\'t see it again!'
      }), {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // PATCH - Update webhook (toggle active, edit url/events/description)
    if (req.method === 'PATCH') {
      const body = await req.json().catch(() => ({}));
      const { id, is_active, url, events, description } = body || {};
      const json = (d: unknown, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      if (typeof id !== 'string') return json({ success: false, message: 'Webhook ID is required' }, 400);
      const { data: existing } = await supabase.from('webhook_endpoints').select('id,url,secret').eq('id', id).eq('user_id', userId).maybeSingle();
      if (!existing) return json({ success: false, message: 'Webhook not found' }, 404);
      const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (typeof is_active === 'boolean') update.is_active = is_active;
      if (typeof description === 'string') update.description = description;
      if (events !== undefined) {
        if (!Array.isArray(events) || events.length === 0) return json({ success: false, message: 'At least one event type is required' });
        update.events = events;
      }
      if (typeof url === 'string' && url !== existing.url) {
        try { if (new URL(url).protocol !== 'https:') throw 0; } catch { return json({ success: false, message: 'Enter a valid HTTPS webhook URL' }); }
        const probe = await postWebhook(url, existing.secret || '', { event: 'test.webhook', data: { message: 'Webhook URL verification', test: true }, timestamp: new Date().toISOString() });
        if (!probe.success) return json({ success: false, message: `Webhook not updated. ${probe.error}` });
        update.url = url;
      }
      const { data: saved, error } = await supabase.from('webhook_endpoints').update(update).eq('id', id).eq('user_id', userId).select().single();
      if (error) throw error;
      return json({ success: true, data: saved });
    }

    // DELETE - Remove webhook
    if (req.method === 'DELETE') {
      const url = new URL(req.url);
      const webhookId = url.searchParams.get('id');

      if (!webhookId) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Bad Request',
          message: 'Webhook ID is required'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Delete webhook (ensure it belongs to the user)
      const { error: deleteError } = await supabase
        .from('webhook_endpoints')
        .delete()
        .eq('id', webhookId)
        .eq('user_id', userId);

      if (deleteError) throw deleteError;

      return new Response(JSON.stringify({
        success: true,
        message: 'Webhook deleted successfully'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: false,
      error: 'Method Not Allowed',
      message: 'Only GET, POST, and DELETE methods are supported'
    }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Error in webhook-register:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Internal Server Error',
      message: error.message || 'An unexpected error occurred'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
