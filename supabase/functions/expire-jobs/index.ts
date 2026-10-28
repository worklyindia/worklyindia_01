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

    console.log("🔄 Starting job deletion process...");

    // Delete all expired jobs immediately
    const { data: deletedCount, error } = await supabaseService
      .rpc('delete_expired_jobs_immediately');

    if (error) {
      console.error("Error deleting expired jobs:", error);
      throw error;
    }

    console.log(`✅ Successfully deleted ${deletedCount} expired jobs`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Deleted ${deletedCount} expired jobs`,
        deletedCount,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    console.error("❌ Error in expire-jobs:", error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Job expiry failed',
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});