import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    console.log('🔐 Authorization header received:', authHeader ? 'Present' : 'Missing');

    if (!authHeader) {
      console.error('❌ No Authorization header in request');
      throw new Error('Authorization header is missing');
    }

    // Create admin client with service role key to verify JWT
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Extract token from Authorization header
    const token = authHeader.replace('Bearer ', '');
    
    console.log('🔍 Verifying JWT token...');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    console.log('👤 User authentication result:', {
      hasUser: !!user,
      userId: user?.id,
      userEmail: user?.email,
      error: userError?.message
    });

    if (userError) {
      console.error('❌ User authentication error:', userError);
      throw new Error(`Authentication failed: ${userError.message}`);
    }

    if (!user) {
      console.error('❌ No user found in token');
      throw new Error('Not authenticated - user not found');
    }

    console.log('✅ User authenticated successfully:', user.id);

    // Use admin client for all database operations
    const supabaseClient = supabaseAdmin;

    const { amount } = await req.json();

    if (!amount || amount <= 0) {
      throw new Error('Invalid withdrawal amount');
    }

    // Check if user has payment settings
    const { data: paymentSettings, error: settingsError } = await supabaseClient
      .from('referral_payment_settings')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (settingsError || !paymentSettings) {
      throw new Error('Payment settings not found. Please set up your payment details first.');
    }

    // Check wallet balance
    const { data: wallet, error: walletError } = await supabaseClient
      .from('referral_wallets')
      .select('balance_amount, total_withdrawn')
      .eq('user_id', user.id)
      .single();

    if (walletError || !wallet) {
      throw new Error('Wallet not found');
    }

    if (wallet.balance_amount < amount) {
      throw new Error('Insufficient balance');
    }

    // Generate withdrawal ID
    const { data: withdrawalId, error: idError } = await supabaseClient
      .rpc('generate_withdrawal_id');

    if (idError || !withdrawalId) {
      throw new Error('Failed to generate withdrawal ID');
    }

    // Deduct balance from wallet
    const { error: updateWalletError } = await supabaseClient
      .from('referral_wallets')
      .update({
        balance_amount: wallet.balance_amount - amount,
        total_withdrawn: (wallet.total_withdrawn || 0) + amount,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    if (updateWalletError) {
      throw new Error('Failed to update wallet balance');
    }

    // Create withdrawal request
    const { data: withdrawalRequest, error: requestError } = await supabaseClient
      .from('referral_withdrawal_requests')
      .insert({
        withdrawal_id: withdrawalId,
        user_id: user.id,
        amount: amount,
        status: 'pending',
        payment_settings: paymentSettings,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (requestError) {
      // Rollback wallet update
      await supabaseClient
        .from('referral_wallets')
        .update({
          balance_amount: wallet.balance_amount,
          total_withdrawn: wallet.total_withdrawn || 0,
        })
        .eq('user_id', user.id);

      throw new Error('Failed to create withdrawal request');
    }

    console.log('Withdrawal request created:', withdrawalRequest);

    return new Response(
      JSON.stringify({
        success: true,
        withdrawal_id: withdrawalId,
        amount: amount,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in create-withdrawal-request:', error);
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
