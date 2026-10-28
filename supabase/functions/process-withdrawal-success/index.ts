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

    const { withdrawal_id } = await req.json();

    if (!withdrawal_id) {
      throw new Error('Withdrawal ID required');
    }

    // Call database function to process success
    const { data, error } = await supabaseClient.rpc('process_withdrawal_success', {
      p_withdrawal_id: withdrawal_id,
      p_admin_id: user.id,
    });

    if (error) {
      console.error('Database function error:', error);
      throw error;
    }

    console.log('Withdrawal processed successfully:', data);

    // Withdrawal approved → push + email + Telegram from the saved templates.
    try {
      const { data: withdrawal } = await supabaseClient
        .from('withdrawal_requests')
        .select('user_id, amount, user_type')
        .eq('id', withdrawal_id)
        .single();

      if (withdrawal) {
        const isEmployer = withdrawal.user_type === 'employer';
        const { data: owner } = isEmployer
          ? await supabaseClient.from('companies').select('company_name').eq('user_id', withdrawal.user_id).maybeSingle()
          : await supabaseClient.from('profiles').select('full_name').eq('user_id', withdrawal.user_id).maybeSingle();

        await notifyEvent(supabaseClient, {
          eventType: isEmployer ? 'employer_withdrawal_approved' : 'user_withdrawal_approved',
          userId: withdrawal.user_id,
          audience: isEmployer ? 'employer' : 'job_seeker',
          name: (owner as any)?.company_name || (owner as any)?.full_name || undefined,
          variables: { amount: withdrawal.amount, status: 'Approved' },
          fallbackTitle: '🏦 Withdrawal Approved',
          fallbackMessage: 'Your withdrawal request has been approved.',
        });
      }
    } catch (notifyError) {
      console.error('Error sending withdrawal notification:', notifyError);
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
    console.error('Error in process-withdrawal-success:', error);
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
