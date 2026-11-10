import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleGodaddyRequest } from "./godaddyHandler.ts";
import { handleDomainMarketRequest, isDomainMarketAction } from "./domainMarketHandler.ts";
import { WEBSITE_DOMAIN } from '../_shared/domain.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

type ProviderHealth = { configured: boolean; status: string; http_status?: number; latency_ms?: number; error_body?: string };

async function testAiProvider(name: string, url: string, apiKey: string | undefined, model: string, extraHeaders: Record<string, string> = {}): Promise<ProviderHealth> {
  if (!apiKey) return { configured: false, status: 'missing_key' };
  const start = Date.now();
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...extraHeaders,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'Reply with OK only.' }],
        max_tokens: 8,
        temperature: 0,
      }),
    });
    const latency = Date.now() - start;
    const text = response.ok ? '' : (await response.text().catch(() => '')).slice(0, 120);
    const rateLimited = response.status === 402 || response.status === 429 || /quota|limit|credits|exhaust/i.test(text);
    console.log(`AI provider check ${name}: ${response.status} in ${latency}ms${rateLimited ? ' (rate/credit limited)' : ''}`);
    return {
      configured: true,
      status: response.ok ? 'working' : rateLimited ? 'rate_or_credit_limited' : response.status === 401 || response.status === 403 ? 'auth_failed' : 'error',
      http_status: response.status,
      latency_ms: latency,
      error_body: response.ok ? undefined : text,
    };
  } catch (e) {
    console.log(`AI provider check ${name} failed:`, e);
    return { configured: true, status: 'unreachable', latency_ms: Date.now() - start };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // --- Merged GoDaddy domain API ---
  // Requests carrying an `action` are domain-management calls; everything else
  // falls through to the original health check below.
  if (req.method === 'POST') {
    let body: any = null;
    try {
      body = await req.clone().json();
    } catch {
      body = null;
    }
    if (body && typeof body.action === 'string' && body.action) {
      // Domain marketplace actions (search/offers/pricing/orders/admin) are
      // served by the merged domain-market handler; everything else goes to
      // the GoDaddy domain-management handler.
      if (isDomainMarketAction(body.action)) {
        return await handleDomainMarketRequest(req, body);
      }
      return await handleGodaddyRequest(req, body);
    }
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1Ynd6ZWx1cGJudGJldHBhanFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MDc3NjIsImV4cCI6MjA3MDQ4Mzc2Mn0.YsA13ya6S-ogDW59wVQ-n1JhVzDSwAuErfG0WZLTqI4';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // === Ping ai-career-chat to keep it warm ===
    let aiChatPingStatus = 'unknown';
    let aiChatPingTime = 0;
    try {
      const pingStart = Date.now();
      const pingResponse = await fetch(`${supabaseUrl}/functions/v1/ai-career-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({ message: "ping", isPing: true }),
      });
      aiChatPingTime = Date.now() - pingStart;
      aiChatPingStatus = pingResponse.ok ? 'warm' : `responded (${pingResponse.status})`;
      console.log(`🏓 AI chat ping: ${aiChatPingTime}ms - Status: ${aiChatPingStatus}`);
    } catch (e) {
      aiChatPingStatus = 'unreachable';
      console.log('🏓 AI chat ping failed:', e);
    }

    // === Test all configured AI platforms with a tiny chat completion ===
    const aiProviders = {
      vercel: await testAiProvider('Vercel', 'https://ai-gateway.vercel.sh/v1/chat/completions', Deno.env.get('VERCEL_AI_GATEWAY_API_KEY'), 'google/gemini-2.5-flash-lite'),
      lovable: await testAiProvider('Lovable', 'https://ai.gateway.lovable.dev/v1/chat/completions', Deno.env.get('LOVABLE_API_KEY'), 'google/gemini-2.5-flash-lite'),
      google_ai_studio: await testAiProvider('Google AI Studio', 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', Deno.env.get('GOOGLE_AI_STUDIO_API_KEY'), 'gemini-2.5-flash-lite'),
      openrouter: await testAiProvider('OpenRouter', 'https://openrouter.ai/api/v1/chat/completions', Deno.env.get('OPENROUTER_API_KEY'), 'meta-llama/llama-3.3-70b-instruct:free', { 'HTTP-Referer': WEBSITE_DOMAIN, 'X-Title': 'Workly India Health Check' }),
      together: await testAiProvider('Together AI', 'https://api.together.xyz/v1/chat/completions', Deno.env.get('TOGETHER_AI_API_KEY'), 'meta-llama/Llama-3.3-70B-Instruct-Turbo-Free'),
      groq: await testAiProvider('Groq', 'https://api.groq.com/openai/v1/chat/completions', Deno.env.get('GROQ_API_KEY'), 'llama-3.1-8b-instant'),
      cerebras: await testAiProvider('Cerebras', 'https://api.cerebras.ai/v1/chat/completions', Deno.env.get('CEREBRAS_API_KEY'), 'llama3.1-8b'),
      mistral: await testAiProvider('Mistral AI', 'https://api.mistral.ai/v1/chat/completions', Deno.env.get('MISTRAL_API_KEY'), 'mistral-small-latest'),
      huggingface: await testAiProvider('Hugging Face', 'https://router.huggingface.co/v1/chat/completions', Deno.env.get('HUGGINGFACE_API_KEY'), 'meta-llama/Llama-3.1-8B-Instruct'),
      cloudflare_workers_ai: Deno.env.get('CLOUDFLARE_ACCOUNT_ID')
        ? await testAiProvider(
            'Cloudflare Workers AI',
            `https://api.cloudflare.com/client/v4/accounts/${Deno.env.get('CLOUDFLARE_ACCOUNT_ID')}/ai/v1/chat/completions`,
            Deno.env.get('CLOUDFLARE_AI_API_TOKEN') || Deno.env.get('CLOUDFLARE_API_TOKEN'),
            '@cf/meta/llama-3.1-8b-instruct',
          )
        : { configured: false, status: 'missing_key' },
    };
    const vercelApiStatus = aiProviders.vercel.status;

    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const { data: recentRequests, error: requestsError } = await supabase
      .from('api_request_logs')
      .select('status_code, response_time_ms')
      .gte('created_at', oneHourAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(1000);

    if (requestsError) throw requestsError;

    const totalRequests = recentRequests?.length || 0;
    const successfulRequests = recentRequests?.filter(r => r.status_code === 200).length || 0;
    const failedRequests = totalRequests - successfulRequests;
    const avgResponseTime = totalRequests > 0
      ? Math.round(recentRequests.reduce((sum, r) => sum + (r.response_time_ms || 0), 0) / totalRequests)
      : 0;

    const { count: activeKeysCount } = await supabase
      .from('api_keys')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    const { error: dbError } = await supabase
      .from('jobs')
      .select('id')
      .limit(1);

    const health = {
      status: dbError ? 'degraded' : 'healthy',
      timestamp: now.toISOString(),
      uptime_percentage: totalRequests > 0 ? ((successfulRequests / totalRequests) * 100).toFixed(2) : '100.00',
      vercel_api: vercelApiStatus,
      ai_providers: aiProviders,
      checks: {
        database: dbError ? 'unhealthy' : 'healthy',
        api_endpoints: successfulRequests > 0 ? 'healthy' : 'unknown',
        edge_functions: 'healthy',
        vercel_ai_gateway: vercelApiStatus,
        ai_career_chat: aiChatPingStatus,
      },
      metrics: {
        last_hour: {
          total_requests: totalRequests,
          successful_requests: successfulRequests,
          failed_requests: failedRequests,
          success_rate: totalRequests > 0 ? `${((successfulRequests / totalRequests) * 100).toFixed(2)}%` : '0%',
          avg_response_time_ms: avgResponseTime,
        },
        active_api_keys: activeKeysCount || 0,
        ai_chat_ping_ms: aiChatPingTime,
      },
      endpoints: {
        'GET /api/jobs/search': `${supabaseUrl}/functions/v1/jobs-search`,
        'POST /api/jobs': `${supabaseUrl}/functions/v1/jobs-create`,
        'GET /api/companies': `${supabaseUrl}/functions/v1/companies-list`,
        'POST /api/applications': `${supabaseUrl}/functions/v1/applications-submit`,
      },
    };

    return new Response(JSON.stringify(health, null, 2), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error in check-api-health:', error);

    return new Response(JSON.stringify({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message || 'Health check failed',
      checks: {
        database: 'unknown',
        api_endpoints: 'unknown',
        edge_functions: 'degraded',
      },
    }, null, 2), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
