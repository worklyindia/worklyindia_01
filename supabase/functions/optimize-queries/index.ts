import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BatchQueryRequest {
  queries: Array<{
    table: string;
    select?: string;
    filters?: Record<string, any>;
    limit?: number;
    offset?: number;
    order?: { column: string; ascending: boolean };
  }>;
  enableCompression?: boolean;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
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

    const { queries, enableCompression = true }: BatchQueryRequest = await req.json();

    console.log(`🔄 Processing ${queries.length} batched queries with compression: ${enableCompression}`);

    // Execute all queries in parallel
    const results = await Promise.all(
      queries.map(async (query) => {
        let supabaseQuery = supabaseClient
          .from(query.table)
          .select(query.select || '*');

        // Apply filters
        if (query.filters) {
          Object.entries(query.filters).forEach(([key, value]) => {
            if (typeof value === 'object' && value !== null) {
              // Handle complex filters
              const [operator, filterValue] = Object.entries(value)[0];
              switch (operator) {
                case 'eq':
                  supabaseQuery = supabaseQuery.eq(key, filterValue);
                  break;
                case 'neq':
                  supabaseQuery = supabaseQuery.neq(key, filterValue);
                  break;
                case 'gt':
                  supabaseQuery = supabaseQuery.gt(key, filterValue);
                  break;
                case 'gte':
                  supabaseQuery = supabaseQuery.gte(key, filterValue);
                  break;
                case 'lt':
                  supabaseQuery = supabaseQuery.lt(key, filterValue);
                  break;
                case 'lte':
                  supabaseQuery = supabaseQuery.lte(key, filterValue);
                  break;
                case 'like':
                  supabaseQuery = supabaseQuery.like(key, String(filterValue));
                  break;
                case 'ilike':
                  supabaseQuery = supabaseQuery.ilike(key, String(filterValue));
                  break;
                case 'in':
                  supabaseQuery = supabaseQuery.in(key, filterValue as any[]);
                  break;
              }
            } else {
              // Simple equality filter
              supabaseQuery = supabaseQuery.eq(key, value);
            }
          });
        }

        // Apply ordering
        if (query.order) {
          supabaseQuery = supabaseQuery.order(query.order.column, {
            ascending: query.order.ascending,
          });
        }

        // Apply limit
        if (query.limit) {
          supabaseQuery = supabaseQuery.limit(query.limit);
        }

        // Apply offset for pagination
        if (query.offset) {
          supabaseQuery = supabaseQuery.range(query.offset, query.offset + (query.limit || 10) - 1);
        }

        const { data, error } = await supabaseQuery;

        if (error) {
          console.error(`❌ Query error for ${query.table}:`, error);
          return { table: query.table, data: null, error: error.message };
        }

        console.log(`✅ Fetched ${data?.length || 0} rows from ${query.table}`);
        return { table: query.table, data, error: null };
      })
    );

    // Return batched results with caching headers
    const responseHeaders = {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=60, s-maxage=120, stale-while-revalidate=300',
      'CDN-Cache-Control': 'max-age=120',
    };

    return new Response(
      JSON.stringify({
        success: true,
        results,
        timestamp: new Date().toISOString(),
        cached: false,
      }),
      {
        headers: responseHeaders,
        status: 200,
      }
    );
  } catch (error) {
    console.error('❌ Batch query error:', error);
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
