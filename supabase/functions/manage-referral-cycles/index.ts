import { istStampParts } from '../_shared/emailFormat.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('🔄 Starting referral cycle management...');

    // Get current date/time in IST
    const now = new Date();
    const istTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const currentDay = istTime.getDate();
    const currentHour = istTime.getHours();
    const currentMinute = istTime.getMinutes();

    console.log(`Current IST: ${istTime.toISOString()}, Day: ${currentDay}, Hour: ${currentHour}, Minute: ${currentMinute}`);

    // 🔄 Always refresh leaderboard on every run (hourly updates)
    console.log('🔄 Refreshing current leaderboard...');
    const { error: refreshError } = await supabase.rpc('refresh_current_leaderboard');
    
    if (refreshError) {
      console.error('⚠️ Warning: Leaderboard refresh failed:', refreshError);
    } else {
      console.log('✅ Leaderboard refreshed successfully');
      
      // Log leaderboard stats
      const { data: leaderboardStats } = await supabase
        .from('referral_leaderboard_entries')
        .select('user_id, rank, active_referrals_count', { count: 'exact' })
        .eq('cycle_id', (await supabase
          .from('referral_leaderboard_cycles')
          .select('id')
          .eq('status', 'active')
          .order('cycle_start', { ascending: false })
          .limit(1)
          .single()).data?.id || '')
        .order('rank', { ascending: true })
        .limit(3);

      if (leaderboardStats) {
        console.log('📊 Current Top 3:');
        leaderboardStats.forEach((entry) => {
          console.log(`  #${entry.rank}: User ${entry.user_id} - ${entry.active_referrals_count} active referrals`);
        });
      }
    }

    // Check if it's 1st of the month (00:00-00:05)
    if (currentDay === 1 && currentHour === 0 && currentMinute < 5) {
      console.log('📅 1st of month detected - Initializing new cycle...');
      
      const { data: cycleId, error: initError } = await supabase
        .rpc('initialize_monthly_cycle');

      if (initError) {
        console.error('❌ Error initializing cycle:', initError);
        throw initError;
      }

      console.log('✅ New cycle initialized:', cycleId);

      // Cycle start ka koi owner template nahi hai, isliye yahan broadcast nahi bhejte.

    }

    // Check if it's last day of month (23:55-23:59)
    const lastDayOfMonth = new Date(istTime.getFullYear(), istTime.getMonth() + 1, 0).getDate();
    
    if (currentDay === lastDayOfMonth && currentHour === 23 && currentMinute >= 55) {
      console.log('🏁 Last day of month detected - Finalizing cycle...');

      // Get active cycle
      const { data: activeCycle, error: cycleError } = await supabase
        .from('referral_leaderboard_cycles')
        .select('id, status')
        .eq('status', 'active')
        .order('cycle_start', { ascending: false })
        .limit(1)
        .single();

      if (cycleError) {
        console.error('❌ Error fetching active cycle:', cycleError);
        throw cycleError;
      }

      if (activeCycle) {
        console.log('🎯 Finalizing cycle:', activeCycle.id);

        // Finalize the cycle
        const { error: finalizeError } = await supabase
          .rpc('finalize_monthly_cycle', { p_cycle_id: activeCycle.id });

        if (finalizeError) {
          console.error('❌ Error finalizing cycle:', finalizeError);
          throw finalizeError;
        }

        console.log('✅ Cycle finalized successfully!');

        // Award competition prizes
        console.log('🏆 Calculating and awarding competition prizes...');
        const { data: prizeResult, error: prizeError } = await supabase
          .rpc('calculate_and_award_competition_prizes', { p_cycle_id: activeCycle.id });

        if (prizeError) {
          console.error('❌ Error awarding prizes:', prizeError);
          console.error('Prize error details:', JSON.stringify(prizeError, null, 2));
        } else {
          console.log('✅ Prizes awarded successfully!');
          console.log('Prize distribution details:', JSON.stringify(prizeResult, null, 2));
          
          // Winner notifications — owner-saved "referral_competition_win"
          // template par Push + Email + Telegram teeno channel se.
          const { data: winners } = await supabase
            .from('referral_leaderboard_history')
            .select('user_id, final_rank, reward_amount, company_name')
            .eq('cycle_id', activeCycle.id)
            .lte('final_rank', 3)
            .order('final_rank', { ascending: true });

          if (winners && winners.length > 0) {
            console.log('🎉 Sending notifications to winners...');
            const istNow = new Date();
            const { date: dateStr, time: timeStr } = istStampParts(istNow);

            for (const winner of winners) {
              const rankLabel = winner.final_rank === 1 ? '1st' : winner.final_rank === 2 ? '2nd' : '3rd';
              const amount = `₹${winner.reward_amount ?? 0}`;

              let name: string | null = winner.company_name ?? null;
              let audience: 'job_seeker' | 'employer' = winner.company_name ? 'employer' : 'job_seeker';

              const { data: company } = await supabase
                .from('companies')
                .select('company_name')
                .eq('user_id', winner.user_id)
                .maybeSingle();
              if (company?.company_name) {
                name = company.company_name;
                audience = 'employer';
              } else {
                const { data: profile } = await supabase
                  .from('profiles')
                  .select('full_name')
                  .eq('user_id', winner.user_id)
                  .maybeSingle();
                if (profile?.full_name) name = profile.full_name;
              }

              await notifyEvent(supabase, {
                eventType: 'referral_competition_win',
                userId: winner.user_id,
                audience,
                name,
                variables: {
                  rank: rankLabel,
                  prize: `${rankLabel} place`,
                  amount,
                  date: dateStr,
                  time: timeStr,
                },
                fallbackTitle: 'You won a prize 🏆',
                fallbackMessage: `Congratulations! You finished ${rankLabel} in the monthly referral competition and earned ${amount}.`,
              });
              console.log(`  ✅ Notification sent to #${winner.final_rank}: ${name ?? winner.user_id}`);
            }
          }
        }

      }
    }

    // Get final stats
    const { data: finalStats, count } = await supabase
      .from('referral_leaderboard_entries')
      .select('*', { count: 'exact' })
      .eq('cycle_id', (await supabase
        .from('referral_leaderboard_cycles')
        .select('id')
        .eq('status', 'active')
        .order('cycle_start', { ascending: false })
        .limit(1)
        .maybeSingle()).data?.id || '');

    console.log(`✅ Cycle management completed. Total participants: ${count || 0}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Referral cycle management completed',
        timestamp: istTime.toISOString(),
        stats: {
          total_participants: count || 0,
          leaderboard_refreshed: !refreshError,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error in manage-referral-cycles:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
