import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { notifyEvent } from "../_shared/eventNotify.ts";

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

    const { referral_code, referred_user_id } = await req.json();

    if (!referral_code || !referred_user_id) {
      throw new Error('Missing required fields: referral_code, referred_user_id');
    }

    // Validate referral code and get referrer
    const { data: codeData, error: codeError } = await supabaseAdmin
      .from('referral_codes')
      .select('user_id, referral_code')
      .eq('referral_code', referral_code)
      .eq('is_active', true)
      .single();

    if (codeError || !codeData) {
      throw new Error('Invalid or inactive referral code');
    }

    // Check if user is trying to refer themselves
    if (codeData.user_id === referred_user_id) {
      throw new Error('Cannot refer yourself');
    }

    // Check if user already has a referrer
    const { data: existingReferral } = await supabaseAdmin
      .from('user_referrals')
      .select('id')
      .eq('referred_user_id', referred_user_id)
      .eq('is_active', true)
      .single();

    if (existingReferral) {
      throw new Error('User already has a referrer');
    }

    // Create referral relationship
    const { error: insertError } = await supabaseAdmin
      .from('user_referrals')
      .insert({
        referrer_id: codeData.user_id,
        referred_user_id: referred_user_id,
        referral_code_used: referral_code,
        is_active: true
      });

    if (insertError) {
      throw insertError;
    }

    // Update referral code stats will be handled by database trigger
    // The trigger 'update_referral_counts' automatically updates total_referrals

    // Get referrer info for notification
    const { data: referrerProfile } = await supabaseAdmin
      .from('profiles')
      .select('full_name, telegram_chat_id')
      .eq('user_id', codeData.user_id)
      .maybeSingle();

    const { data: referrerCompany } = await supabaseAdmin
      .from('companies')
      .select('company_name, telegram_chat_id')
      .eq('user_id', codeData.user_id)
      .maybeSingle();

    // Get referred user info
    const { data: referredProfile } = await supabaseAdmin
      .from('profiles')
      .select('full_name')
      .eq('user_id', referred_user_id)
      .maybeSingle();

    const { data: referredCompany } = await supabaseAdmin
      .from('companies')
      .select('company_name')
      .eq('user_id', referred_user_id)
      .maybeSingle();

    // Route the notification by WHO REFERRED (the person receiving it):
    // an employer referrer gets the employer templates / Recruit bot,
    // a job seeker referrer gets the job seeker templates / Career bot.
    const referrerIsEmployer = !!referrerCompany;
    const referrerName =
      (referrerIsEmployer ? referrerCompany?.company_name : referrerProfile?.full_name) ||
      referrerProfile?.full_name ||
      referrerCompany?.company_name ||
      'User';
    const referredName =
      referredProfile?.full_name ||
      referredCompany?.company_name ||
      'New User';

    {
      const eventType = referrerIsEmployer ? 'employer_referral_invite' : 'user_referral_invite';
      try {
        await notifyEvent(supabaseAdmin, {
          eventType,
          userId: codeData.user_id,
          audience: referrerIsEmployer ? 'employer' : 'job_seeker',
          name: referrerName,
          variables: {
            referral_name: referredName,
            referred_name: referredName,
            user_name: referredName,
            referral_code,
          },
          fallbackTitle: '🎉 New Referral Joined',
          fallbackMessage: `${referredName} joined using your referral link.`,
        });
        console.log(`📱 Sent referral notification to ${referrerName}`);
      } catch (notifError) {
        console.error('Failed to send referral notification:', notifError);
      }
    }

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Referral relationship created successfully',
      referrer_id: codeData.user_id
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error creating referral relationship:', error);
    
    return new Response(JSON.stringify({ 
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create referral relationship'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});