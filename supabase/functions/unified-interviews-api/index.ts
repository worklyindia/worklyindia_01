import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
};

// Helper function to generate VideoSDK JWT token
async function generateVideoSDKToken(payload: any, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const header = { alg: 'HS256', typ: 'JWT' };
  
  const base64UrlEncode = (str: string) => {
    return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(`${encodedHeader}.${encodedPayload}`)
  );
  
  const encodedSignature = base64UrlEncode(String.fromCharCode(...new Uint8Array(signature)));
  
  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID().substring(0, 8);
  const startTime = Date.now();
  
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { action } = body;

    console.log(`[${requestId}] 📋 Interview API action: ${action}`);

    // ==========================================
    // ACTION: create - Schedule new interviews
    // ==========================================
    if (action === 'create') {
      const apiKey = req.headers.get('x-api-key');
      const authHeader = req.headers.get('Authorization');
      let userId: string | null = null;

      // API Key auth for external access
      if (apiKey) {
        const { data: keyData, error: keyError } = await supabase
          .from('api_keys')
          .select('*')
          .eq('api_key', apiKey)
          .eq('is_active', true)
          .single();

        if (keyError || !keyData) {
          throw new Error('Invalid or inactive API key');
        }
        userId = keyData.user_id;
        
        await supabase
          .from('api_keys')
          .update({ 
            usage_count: (keyData.usage_count || 0) + 1,
            last_used_at: new Date().toISOString()
          })
          .eq('id', keyData.id);
      } 
      // JWT auth for internal access
      else if (authHeader) {
        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) throw new Error('Unauthorized');
        userId = user.id;
      } else {
        throw new Error('Authentication required');
      }

      const { applicants, scheduledAt, scheduledEndAt, mode, locationUrl, notes } = body;

      if (!applicants || !Array.isArray(applicants) || applicants.length === 0) {
        throw new Error('Applicants array is required');
      }

      // Wallet payments were removed: interviews are paid via Razorpay in the employer portal
      return new Response(JSON.stringify({
        success: false,
        error: 'Payment Required',
        message: 'Interview scheduling is paid via Razorpay in the employer portal.',
      }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      // Create interviews
      const createdInterviews = [];
      
      for (const applicant of applicants) {
        // Get application
        const { data: application } = await supabase
          .from('job_applications')
          .select('id')
          .eq('applicant_id', applicant.applicantId)
          .eq('job_id', applicant.jobId)
          .single();

        if (!application) continue;

        // Create video room if needed
        let videosdkRoomId = null;
        let videosdkMeetingUrl = null;
        
        if (mode === 'videosdk_iframe') {
          const meetingId = Math.random().toString(36).substring(2, 10).toUpperCase();
          const VIDEOSDK_TOKEN = Deno.env.get('VIDEOSDK_TOKEN');
          
          if (VIDEOSDK_TOKEN) {
            videosdkRoomId = meetingId;
            videosdkMeetingUrl = `https://embed.videosdk.live/rtc-js-prebuilt/0.3.43?meetingId=${meetingId}&token=${VIDEOSDK_TOKEN}&micEnabled=true&webcamEnabled=false`;
          }
        }

        const { data: interview, error: interviewError } = await supabase
          .from('interviews')
          .insert({
            job_application_id: application.id,
            scheduled_at: scheduledAt,
            scheduled_end_at: scheduledEndAt,
            mode,
            location_url: locationUrl,
            notes,
            videosdk_room_id: videosdkRoomId,
            videosdk_meeting_url: videosdkMeetingUrl,
            status: 'scheduled'
          })
          .select()
          .single();

        if (!interviewError && interview) {
          createdInterviews.push(interview);
        }
      }

      return new Response(JSON.stringify({
        success: true,
        data: {
          interviews: createdInterviews,
          scheduled_count: createdInterviews.length,
        }
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ==========================================
    // ACTION: cancel - Cancel an interview
    // ==========================================
    if (action === 'cancel') {
      const { interviewId, cancellationReason } = body;
      
      if (!interviewId) throw new Error('Interview ID is required');

      const authHeader = req.headers.get('Authorization');
      if (!authHeader) throw new Error('Authorization required');
      
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) throw new Error('Unauthorized');

      // Get interview and verify ownership
      const { data: interview, error: interviewError } = await supabase
        .from('interviews')
        .select(`
          id, status, scheduled_at,
          job_applications!inner(jobs!inner(employer_id, title))
        `)
        .eq('id', interviewId)
        .single();

      if (interviewError || !interview) throw new Error('Interview not found');
      
      const jobData = interview.job_applications as any;
      if (jobData.jobs.employer_id !== user.id) {
        throw new Error('You do not have permission to cancel this interview');
      }

      if (interview.status === 'cancelled') throw new Error('Interview already cancelled');
      if (interview.status === 'completed') throw new Error('Cannot cancel completed interview');

      // Update status
      const { error: updateError } = await supabase
        .from('interviews')
        .update({ 
          status: 'cancelled',
          cancellation_reason: cancellationReason || 'Cancelled by employer',
          cancelled_at: new Date().toISOString()
        })
        .eq('id', interviewId);

      if (updateError) throw updateError;

      return new Response(JSON.stringify({
        success: true,
        message: 'Interview cancelled successfully'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ==========================================
    // ACTION: auto_end - Auto-end expired interviews
    // ==========================================
    if (action === 'auto_end') {
      const now = new Date().toISOString();
      
      const { data: expiredInterviews, error: fetchError } = await supabase
        .from('interviews')
        .select('id, videosdk_session_id, videosdk_room_id, hms_room_id, mode, scheduled_end_at')
        .in('status', ['scheduled', 'in_progress'])
        .lte('scheduled_end_at', now)
        .not('scheduled_end_at', 'is', null);
      
      if (fetchError) throw fetchError;
      
      console.log(`[${requestId}] 📊 Found ${expiredInterviews?.length || 0} expired interviews`);
      
      const results = { ended: 0, failed: 0 };
      
      for (const interview of expiredInterviews || []) {
        const { error: updateError } = await supabase
          .from('interviews')
          .update({ 
            status: 'completed',
            updated_at: new Date().toISOString()
          })
          .eq('id', interview.id);
        
        if (updateError) {
          results.failed++;
        } else {
          results.ended++;
        }
      }

      // Cleanup old interviews (24+ hours)
      const cutoffTime = new Date();
      cutoffTime.setHours(cutoffTime.getHours() - 24);
      
      const { data: deletedCompleted } = await supabase
        .from('interviews')
        .delete()
        .eq('status', 'completed')
        .lt('updated_at', cutoffTime.toISOString())
        .select('id');

      const { data: deletedCancelled } = await supabase
        .from('interviews')
        .delete()
        .eq('status', 'cancelled')
        .lt('updated_at', cutoffTime.toISOString())
        .select('id');

      const deletedCount = (deletedCompleted?.length || 0) + (deletedCancelled?.length || 0);

      return new Response(JSON.stringify({
        success: true,
        message: `Ended ${results.ended} interviews, deleted ${deletedCount} old records`,
        results: { ...results, deleted: deletedCount }
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ==========================================
    // ACTION: get - Get interview details
    // ==========================================
    if (action === 'get') {
      const { interviewId } = body;
      
      if (!interviewId) throw new Error('Interview ID is required');

      const { data: interview, error } = await supabase
        .from('interviews')
        .select('*')
        .eq('id', interviewId)
        .single();

      if (error) throw error;

      return new Response(JSON.stringify({
        success: true,
        data: interview
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    throw new Error(`Unknown action: ${action}`);

  } catch (error: any) {
    console.error(`[${requestId}] ❌ Error:`, error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'An unexpected error occurred'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
