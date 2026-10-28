import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { whatsapp_number, user_type, current_user_id, check_type, email, phone, current_company_id } = await req.json();

    console.log('Check request:', { whatsapp_number, user_type, current_user_id, check_type, email, phone, current_company_id });

    if (!user_type) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: user_type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role to bypass RLS
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const table = user_type === 'job_seeker' ? 'profiles' : 'companies';
    
    // Helper function to filter out current user's records
    const filterOwnRecords = (records: any[]) => {
      return records?.filter(record => {
        // Exclude if it's the current user's record
        if (record.user_id === current_user_id) return false;
        // For companies, also exclude by company ID
        if (current_company_id && record.id === current_company_id) return false;
        return true;
      }) || [];
    };

    const authTaken = async (digits10: string) => {
      const { data } = await supabase.rpc('auth_phone_taken', { _digits: digits10, _exclude: current_user_id || null });
      return data === true;
    };

    // Handle email check
    if (check_type === 'email' && email) {
      const cleanEmail = email.trim().toLowerCase();
      
      if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        return new Response(
          JSON.stringify({ exists: false, error: 'Invalid email format' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data, error } = await supabase
        .from(table)
        .select('id, user_id')
        .ilike('email', cleanEmail);

      if (error) {
        console.error('Database query error:', error);
        return new Response(
          JSON.stringify({ error: 'Database query failed' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const otherRecords = filterOwnRecords(data || []);
      const exists = otherRecords.length > 0;

      console.log('Email check result:', { cleanEmail, exists, recordsFound: otherRecords.length, totalRecords: data?.length });

      return new Response(
        JSON.stringify({ exists, user_type, check_type: 'email' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle phone/mobile check (global — any country's E.164 number)
    if (check_type === 'phone' && phone) {
      const digits = phone.replace(/\D/g, '');
      // E.164: 7-15 digits including country code
      const cleanNumber = digits;

      if (cleanNumber.length < 7 || cleanNumber.length > 15) {
        return new Response(
          JSON.stringify({ exists: false, error: 'Invalid phone number format' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data, error } = await supabase
        .from(table)
        .select('id, user_id')
        .ilike('phone', `%${cleanNumber}`);

      if (error) {
        console.error('Database query error:', error);
        return new Response(
          JSON.stringify({ error: 'Database query failed' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const otherRecords = filterOwnRecords(data || []);
      const exists = otherRecords.length > 0 || await authTaken(cleanNumber);

      console.log('Phone check result:', { cleanNumber, exists, recordsFound: otherRecords.length, totalRecords: data?.length });

      return new Response(
        JSON.stringify({ exists, user_type, check_type: 'phone' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle WhatsApp check (default)
    if (!whatsapp_number) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: whatsapp_number, email, or phone' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Global — accept any country's E.164 number (7-15 digits with country code)
    const digits = whatsapp_number.replace(/\D/g, '');
    const cleanNumber = digits;

    if (cleanNumber.length < 7 || cleanNumber.length > 15) {
      return new Response(
        JSON.stringify({ exists: false, error: 'Invalid phone number format' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use ILIKE to match the full number (with country code) regardless of stored format
    const { data, error } = await supabase
      .from(table)
      .select('id, user_id')
      .ilike('whatsapp_number', `%${cleanNumber}`);

    if (error) {
      console.error('Database query error:', error);
      return new Response(
        JSON.stringify({ error: 'Database query failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Filter out current user's own record (for profile edit scenario)
    const otherRecords = filterOwnRecords(data || []);
    const exists = otherRecords.length > 0 || await authTaken(cleanNumber);

    console.log('WhatsApp check result:', { cleanNumber, exists, recordsFound: otherRecords.length, totalRecords: data?.length });

    return new Response(
      JSON.stringify({ exists, user_type }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in check-whatsapp function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
