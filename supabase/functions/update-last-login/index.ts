import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-forwarded-for, x-real-ip',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // User client for auth
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Admin client for updates
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const clientIp =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      req.headers.get('cf-connecting-ip') ||
      req.headers.get('x-client-ip') ||
      'unknown';

    const now = new Date().toISOString();

    console.log(`📡 Updating last login for user ${user.id} | IP: ${clientIp} | Time: ${now}`);

    // Fetch current profile for IP history
    const { data: profile } = await adminClient
      .from('profiles')
      .select('first_ip, user_ip_history')
      .eq('user_id', user.id)
      .maybeSingle();

    const currentHistory: Array<{ ip: string; first_seen: string }> = 
      (profile?.user_ip_history as Array<{ ip: string; first_seen: string }>) || [];

    // Check if IP already exists in history
    const ipExists = currentHistory.some((entry) => entry.ip === clientIp);
    const updatedHistory = ipExists
      ? currentHistory
      : [...currentHistory, { ip: clientIp, first_seen: now }];

    // Count unique IPs
    const uniqueIps = new Set(updatedHistory.map((e) => e.ip)).size;

    // Build update payload
    const updateData: Record<string, unknown> = {
      last_login_at: now,
      last_login_ip: clientIp,
      last_ip: clientIp,
      total_unique_ips: uniqueIps,
      user_ip_history: updatedHistory,
    };

    // Set first_ip only if not set yet
    if (!profile?.first_ip) {
      updateData.first_ip = clientIp;
    }

    const { error: updateError } = await adminClient
      .from('profiles')
      .update(updateData)
      .eq('user_id', user.id);

    if (updateError) {
      console.error('❌ Error updating last login:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update last login', details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ Last login updated successfully for user ${user.id} | Unique IPs: ${uniqueIps}`);

    return new Response(
      JSON.stringify({
        success: true,
        last_login_at: now,
        last_login_ip: clientIp,
        total_unique_ips: uniqueIps,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
