import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { autoDisableIfFailing } from "../_shared/webhookHealth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Helper function to send webhook
async function sendWebhook(url: string, secret: string, payload: any) {
  try {
    // Create signature
    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify(payload));
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', key, data);
    const hexSignature = Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // Send webhook (15s timeout)
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': hexSignature,
        'User-Agent': 'WFH-India-Webhook/1.0'
      },
      body: JSON.stringify(payload),
      redirect: 'manual',
      signal: controller.signal,
    });
    clearTimeout(timer);

    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    const bodyText = (await response.text().catch(() => '')).slice(0, 500);
    const looksLikeHtml = contentType.includes('text/html') || /^\s*<(!doctype|html)/i.test(bodyText);

    let error: string | undefined;
    if (response.status >= 300 && response.status < 400) {
      error = `Endpoint redirected (HTTP ${response.status}). Use the final webhook receiver URL.`;
    } else if (!response.ok) {
      error = `Endpoint returned HTTP ${response.status} ${response.statusText}`.trim() + (bodyText ? ` — ${bodyText.slice(0, 200)}` : '');
    } else if (looksLikeHtml) {
      error = `Endpoint returned a web page (HTML), not a webhook receiver. Set a server URL that accepts POST JSON and responds 2xx.`;
    }

    return {
      success: !error,
      status: response.status,
      statusText: response.statusText,
      error,
    };
  } catch (error: any) {
    console.error('Webhook send error:', error);
    return {
      success: false,
      status: null,
      error: error?.name === 'AbortError' ? 'Endpoint timed out after 15 seconds' : `Could not reach endpoint: ${error.message}`
    };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (req.method !== 'POST') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Method not allowed'
      }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json();
    const { event, payload, user_id, webhook_id } = body;

    if (!event || !payload) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Event and payload are required'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // When a specific webhook is targeted (e.g. the Test button), send to it
    // directly so the test works even if its event list doesn't include this event.
    let relevantWebhooks: any[] = [];
    if (webhook_id) {
      const { data, error: byIdError } = await supabase
        .from('webhook_endpoints')
        .select('*')
        .eq('id', webhook_id)
        .eq('is_active', true)
        .maybeSingle();
      if (byIdError) throw byIdError;
      relevantWebhooks = data && (!user_id || data.user_id === user_id) ? [data] : [];
    } else {
      const { data: webhooks, error: webhookError } = await supabase
        .from('webhook_endpoints')
        .select('*')
        .eq('is_active', true)
        .contains('events', [event]);

      if (webhookError) throw webhookError;

      relevantWebhooks = user_id
        ? (webhooks || []).filter((w: any) => w.user_id === user_id)
        : (webhooks || []);
    }

    if (relevantWebhooks.length === 0) {
      console.log(`No active webhooks found for event: ${event}`);
      return new Response(JSON.stringify({
        success: true,
        message: 'No webhooks configured for this event',
        webhooks_sent: 0
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Send webhooks
    const results = await Promise.all(
      relevantWebhooks.map(async (webhook) => {
        const webhookPayload = {
          event,
          data: payload,
          timestamp: new Date().toISOString(),
          webhook_id: webhook.id
        };

        const result = await sendWebhook(webhook.url, webhook.secret, webhookPayload);
        
        // Log webhook delivery
        await supabase.from('webhook_deliveries').insert({
          webhook_id: webhook.id,
          event,
          payload: webhookPayload,
          status: result.success ? 'delivered' : 'failed',
          response_status: result.status,
          error_message: result.error
        });
        if (!result.success) await autoDisableIfFailing(supabase, webhook.id);

        return {
          webhook_id: webhook.id,
          url: webhook.url,
          ...result
        };
      })
    );

    const successCount = results.filter(r => r.success).length;
    const failedCount = results.length - successCount;

    return new Response(JSON.stringify({
      success: true,
      message: `Webhooks sent: ${successCount} successful, ${failedCount} failed`,
      webhooks_sent: results.length,
      results
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Error in trigger-webhook:', error);
    
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
