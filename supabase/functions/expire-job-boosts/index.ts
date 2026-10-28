import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Use service role key for database operations
    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    console.log("🔄 Starting job boost expiry process...");

    // Call the expire_job_boosts function
    const { data: expiredCount, error } = await supabaseService
      .rpc('expire_job_boosts');

    if (error) {
      console.error("Error expiring job boosts:", error);
      throw error;
    }

    console.log(`✅ Successfully expired ${expiredCount} job boosts`);

    // Remove boost bonus from expired jobs
    if (expiredCount && expiredCount > 0) {
      console.log("♻️ Removing boost bonus from expired jobs...");
      
      // Get all jobs that just had their boost expired
      const { data: expiredJobs, error: jobsError } = await supabaseService
        .from('jobs')
        .select('id, trending_score, boost_bonus_applied, views_count, applications_count')
        .eq('is_boosted', false)
        .not('boost_end_date', 'is', null)
        .gte('boost_end_date', new Date(Date.now() - 60000).toISOString()) // Last minute
        .lte('boost_end_date', new Date().toISOString());

      if (jobsError) {
        console.error("Error fetching expired jobs:", jobsError);
      } else if (expiredJobs && expiredJobs.length > 0) {
        // Remove boost bonus from each expired job
        for (const job of expiredJobs) {
          // Calculate new score by subtracting the boost bonus that was applied
          // Boost bonus formula: boost_level * 100 (1x = +100, 2x = +200, etc.)
          const currentScore = job.trending_score || 0;
          const boostLevel = job.boost_bonus_applied || 0;
          const boostBonus = boostLevel * 100;
          const newScore = Math.max(0, currentScore - boostBonus);
          
          const { error: updateError } = await supabaseService
            .from('jobs')
            .update({ 
              trending_score: newScore,
              boost_bonus_applied: 0
            })
            .eq('id', job.id);

          if (updateError) {
            console.error(`Error updating score for job ${job.id}:`, updateError);
          } else {
            console.log(`✅ Removed boost bonus for job ${job.id}: ${currentScore} - ${boostBonus} = ${newScore}`);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Expired ${expiredCount} job boosts`,
        expiredCount,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    console.error("❌ Error in expire-job-boosts:", error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Job boost expiry failed',
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
