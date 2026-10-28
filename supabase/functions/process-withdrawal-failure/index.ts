import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { notifyEvent } from '../_shared/eventNotify.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      throw new Error('Not authenticated');
    }

    const { withdrawal_id, failure_reason } = await req.json();

    if (!withdrawal_id || !failure_reason) {
      throw new Error('Withdrawal ID and failure reason required');
    }

    // Call database function to process failure
    const { data, error } = await supabaseClient.rpc('process_withdrawal_failure', {
      p_withdrawal_id: withdrawal_id,
      p_admin_id: user.id,
      p_failure_reason: failure_reason,
    });

    if (error) {
      console.error('Database function error:', error);
      throw error;
    }

    console.log('Withdrawal marked as failed and refunded:', data);

    // Withdrawal failed → push + email + Telegram from the saved templates.
    try {
      const { data: withdrawal } = await supabaseClient
        .from('referral_withdrawal_requests')
        .select('user_id, amount')
        .eq('withdrawal_id', withdrawal_id)
        .single();

      if (withdrawal) {
        const { data: company } = await supabaseClient
          .from('companies')
          .select('company_name')
          .eq('user_id', withdrawal.user_id)
          .maybeSingle();
        const { data: profile } = await supabaseClient
          .from('profiles')
          .select('full_name')
          .eq('user_id', withdrawal.user_id)
          .maybeSingle();
        const isEmployer = !!company;

        await notifyEvent(supabaseClient, {
          eventType: isEmployer ? 'employer_withdrawal_failed' : 'user_withdrawal_failed',
          userId: withdrawal.user_id,
          audience: isEmployer ? 'employer' : 'job_seeker',
          name: company?.company_name || profile?.full_name || undefined,
          variables: { amount: withdrawal.amount, status: 'Failed', reason: failure_reason },
          fallbackTitle: '🏦 Withdrawal Failed',
          fallbackMessage: 'Your withdrawal could not be processed and the amount was refunded to your balance.',
        });
      }
    } catch (notifyError) {
      console.error('Error sending withdrawal failure notification:', notifyError);
    }


    return new Response(
      JSON.stringify({
        success: true,
        data,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in process-withdrawal-failure:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
