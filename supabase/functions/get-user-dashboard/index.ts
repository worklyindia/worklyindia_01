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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Get user from auth
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    console.log(`📊 Fetching dashboard data for user: ${user.id}`);

    // Fetch all dashboard data in parallel
    const [
      profileResult,
      applicationsResult,
      favoritesResult,
      recentJobsResult,
    ] = await Promise.all([
      // User profile
      supabaseClient
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single(),
      
      // Recent applications (last 10)
      supabaseClient
        .from('Applications')
        .select(`
          *,
          Jobs (
            id,
            title,
            company_name,
            location,
            salary_range,
            status
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10),
      
      // Favorite jobs (last 20)
      supabaseClient
        .from('Favorites')
        .select(`
          *,
          Jobs (
            id,
            title,
            company_name,
            location,
            salary_range,
            status,
            created_at
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20),
      
      // Recent jobs matching user skills (last 20)
      supabaseClient
        .from('Jobs')
        .select('id, title, company_name, location, salary_range, status, created_at, skills_required')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

    // Calculate stats
    const stats = {
      total_applications: applicationsResult.data?.length || 0,
      pending_applications: applicationsResult.data?.filter(a => a.status === 'pending').length || 0,
      favorites_count: favoritesResult.data?.length || 0,
    };

    console.log(`✅ Dashboard data fetched successfully for ${user.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          profile: profileResult.data,
          applications: applicationsResult.data || [],
          favorites: favoritesResult.data || [],
          recent_jobs: recentJobsResult.data || [],
          stats,
        },
        timestamp: new Date().toISOString(),
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
        },
        status: 200,
      }
    );
  } catch (error) {
    console.error('❌ Dashboard fetch error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
