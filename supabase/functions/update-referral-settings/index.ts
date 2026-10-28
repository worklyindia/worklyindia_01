import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // Get the authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verify user is authenticated and is admin
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if user is admin
    const { data: adminCheck } = await supabaseAdmin
      .from('admin_users')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!adminCheck || !['admin', 'owner'].includes(adminCheck.role)) {
      return new Response(JSON.stringify({ error: 'Access denied. Admin role required.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json();
    const {
      commission_percentage,
      is_active,
      minimum_commission_amount,
      maximum_commission_amount,
      commission_calculation_method
    } = body;

    // Validate commission percentage
    if (commission_percentage !== undefined) {
      if (typeof commission_percentage !== 'number' || commission_percentage < 0 || commission_percentage > 100) {
        return new Response(JSON.stringify({ 
          error: 'Commission percentage must be between 0 and 100' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Get current settings
    const { data: currentSettings } = await supabaseAdmin
      .from('referral_settings')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    let result;

    if (currentSettings) {
      // Update existing settings
      const { data, error } = await supabaseAdmin
        .from('referral_settings')
        .update({
          commission_percentage: commission_percentage ?? currentSettings.commission_percentage,
          is_active: is_active ?? currentSettings.is_active,
          minimum_commission_amount: minimum_commission_amount ?? currentSettings.minimum_commission_amount,
          maximum_commission_amount: maximum_commission_amount ?? currentSettings.maximum_commission_amount,
          commission_calculation_method: commission_calculation_method ?? currentSettings.commission_calculation_method,
          updated_at: new Date().toISOString()
        })
        .eq('id', currentSettings.id)
        .select()
        .single();

      if (error) throw error;
      result = data;
    } else {
      // Create new settings
      const { data, error } = await supabaseAdmin
        .from('referral_settings')
        .insert({
          commission_percentage: commission_percentage ?? 50,
          is_active: is_active ?? true,
          minimum_commission_amount: minimum_commission_amount ?? 1,
          maximum_commission_amount: maximum_commission_amount ?? 1000,
          commission_calculation_method: commission_calculation_method ?? 'percentage',
          created_by: user.id
        })
        .select()
        .single();

      if (error) throw error;
      result = data;
    }

    return new Response(JSON.stringify({ 
      success: true,
      settings: result
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error updating referral settings:', error);
    
    return new Response(JSON.stringify({ 
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update referral settings'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});