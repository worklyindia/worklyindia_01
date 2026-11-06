import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

/**
 * 100ms Meeting Pricing Structure:
 * 
 * Base Charge: points_per_interview × number of candidates
 * Duration Charge: points_per_minute × duration_minutes × number of candidates
 * Total Cost: max(base + duration, minimum_points)
 * 
 * Example:
 * - 1 candidate, 30 minute interview
 * - points_per_interview = 10
 * - points_per_minute = 2
 * - Base: 10 × 1 = 10 points
 * - Duration: 2 × 30 × 1 = 60 points
 * - Total: 10 + 60 = 70 points
 */

/**
 * Generate 100ms Management Token dynamically using ACCESS_KEY and SECRET
 * This ensures token never expires - fresh token generated for each request
 */
async function generateManagementToken(accessKey: string, secret: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  // Create JWT payload as per 100ms specification
  const payload = {
    access_key: accessKey,
    type: "management",
    version: 2,
    iat: now,
    nbf: now,
    // Not Before - token valid from this time
    exp: now + 24 * 60 * 60,
    // 24 hours validity (fresh token each request)
    jti: crypto.randomUUID() // Unique JWT ID required by 100ms
  };

  // Encode header and payload to base64url
  const header = {
    alg: "HS256",
    typ: "JWT"
  };
  const encoder = new TextEncoder();
  const base64UrlEncode = (obj: any) => {
    const json = JSON.stringify(obj);
    const bytes = encoder.encode(json);
    return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  };
  const headerEncoded = base64UrlEncode(header);
  const payloadEncoded = base64UrlEncode(payload);
  const signatureInput = `${headerEncoded}.${payloadEncoded}`;

  // Create HMAC-SHA256 signature
  const keyData = encoder.encode(secret);
  const key = await crypto.subtle.importKey("raw", keyData, {
    name: "HMAC",
    hash: "SHA-256"
  }, false, ["sign"]);
  const signatureBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(signatureInput));
  const signatureArray = new Uint8Array(signatureBuffer);
  const signatureBase64 = btoa(String.fromCharCode(...signatureArray)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  return `${signatureInput}.${signatureBase64}`;
}
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
interface CreateRoomRequest {
  jobId: string;
  applicantId: string;
  applicantName: string;
  scheduledAt: string;
  scheduledEndAt: string;
}
const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const authorization = req.headers.get("Authorization") || "";
    const accessToken = authorization.replace(/^Bearer\\s+/i, "");
    if (!supabaseUrl || !anonKey || !serviceRoleKey || !accessToken || accessToken === authorization) {
      return new Response(JSON.stringify({ success: false, error: "Authentication required" }), {
        status: 401, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }
    const authClient = createClient(supabaseUrl, anonKey);
    const { data: authData, error: authError } = await authClient.auth.getUser(accessToken);
    if (authError || !authData.user) {
      return new Response(JSON.stringify({ success: false, error: "Invalid session" }), {
        status: 401, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }
    const admin = createClient(supabaseUrl, serviceRoleKey);
    const requestBody = await req.json();
    if (requestBody.action === "get-access") {
      const { interviewId } = requestBody;
      if (!interviewId) throw new Error("interviewId is required");
      const { data: interview, error: lookupError } = await admin.from("interviews")
        .select("id,applicant_id,host_user_id,video_platform,jitsi_meeting_url,location_url,videosdk_room_id,videosdk_host_token,videosdk_participant_tokens,hms_room_id,hms_room_url,hms_host_token,hms_participant_tokens,hms_host_prebuilt_url,hms_participant_prebuilt_urls")
        .eq("id", interviewId).maybeSingle();
      if (lookupError || !interview) {
        return new Response(JSON.stringify({ success: false, error: "Interview not found" }), {
          status: 404, headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
      const uid = authData.user.id;
      const isHost = interview.host_user_id === uid;
      const isApplicant = interview.applicant_id === uid;
      if (!isHost && !isApplicant) {
        return new Response(JSON.stringify({ success: false, error: "You are not a participant in this interview" }), {
          status: 403, headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
      const platform = (interview.video_platform || "").toLowerCase();
      if (platform === "100ms") {
        const roomCode = isHost ? interview.hms_host_token : interview.hms_participant_tokens?.[uid];
        const meetingUrl = isHost ? (interview.hms_host_prebuilt_url || interview.hms_room_url) :
          (interview.hms_participant_prebuilt_urls?.[uid] || interview.hms_room_url);
        if (!roomCode) return new Response(JSON.stringify({ success: false, error: "100ms room access is not ready" }), {
          status: 409, headers: { "Content-Type": "application/json", ...corsHeaders }
        });
        return new Response(JSON.stringify({ success: true, provider: "100ms", roomCode, meetingUrl }), {
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
      if (platform === "videosdk") {
        const token = isHost ? interview.videosdk_host_token : interview.videosdk_participant_tokens?.[uid];
        if (!interview.videosdk_room_id || !token) return new Response(JSON.stringify({ success: false, error: "VideoSDK room access is not ready" }), {
          status: 409, headers: { "Content-Type": "application/json", ...corsHeaders }
        });
        return new Response(JSON.stringify({ success: true, provider: "videosdk", meetingId: interview.videosdk_room_id, token }), {
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
      if (platform === "jitsi") {
        const meetingUrl = interview.jitsi_meeting_url || interview.location_url;
        return new Response(JSON.stringify({ success: true, provider: "jitsi", meetingUrl }), {
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
      throw new Error("Unsupported meeting provider");
    }
    // Get 100ms credentials from environment
    const HMS_ACCESS_KEY = Deno.env.get('HMS_ACCESS_KEY');
    const HMS_SECRET = Deno.env.get('HMS_SECRET');
    const HMS_TEMPLATE_ID = Deno.env.get('HMS_TEMPLATE_ID');
    const HMS_TEMPLATE_SUBDOMAIN = Deno.env.get('HMS_TEMPLATE_SUBDOMAIN');

    // Validate ACCESS_KEY
    if (!HMS_ACCESS_KEY || HMS_ACCESS_KEY === 'your-access-key') {
      console.error('❌ HMS_ACCESS_KEY not configured');
      throw new Error('100ms Access Key is not configured. Please set HMS_ACCESS_KEY in Edge Function secrets.');
    }

    // Validate SECRET
    if (!HMS_SECRET || HMS_SECRET === 'your-secret') {
      console.error('❌ HMS_SECRET not configured');
      throw new Error('100ms Secret is not configured. Please set HMS_SECRET in Edge Function secrets.');
    }

    // Validate TEMPLATE_ID
    if (!HMS_TEMPLATE_ID || HMS_TEMPLATE_ID === 'your-template-id') {
      console.error('❌ HMS_TEMPLATE_ID not configured');
      throw new Error('100ms Template ID is not configured. Please set HMS_TEMPLATE_ID in Edge Function secrets.');
    }

    // Validate SUBDOMAIN
    if (!HMS_TEMPLATE_SUBDOMAIN || HMS_TEMPLATE_SUBDOMAIN === 'your-template') {
      console.error('❌ HMS_TEMPLATE_SUBDOMAIN not configured');
      throw new Error('100ms Template Subdomain is not configured. Please set HMS_TEMPLATE_SUBDOMAIN in Edge Function secrets.');
    }

    // Generate fresh management token dynamically (never expires!)

    const HMS_MANAGEMENT_TOKEN = await generateManagementToken(HMS_ACCESS_KEY, HMS_SECRET);
    const {
      jobId,
      applicantId,
      applicantName,
      scheduledAt,
      scheduledEndAt,
      interviewId
    }: CreateRoomRequest & { interviewId?: string } = requestBody;
    if (!jobId || !applicantId || !scheduledAt || !scheduledEndAt) {
      throw new Error("jobId, applicantId, scheduledAt and scheduledEndAt are required");
    }
    const { data: job, error: jobError } = await admin
      .from("jobs").select("id, company_id").eq("id", jobId).maybeSingle();
    const { data: company, error: companyError } = job?.company_id
      ? await admin.from("companies").select("user_id").eq("id", job.company_id).maybeSingle()
      : { data: null, error: null };
    if (jobError || companyError || !job || !company || company.user_id !== authData.user.id) {
      return new Response(JSON.stringify({ success: false, error: "Only the job owner can create this interview room" }), {
        status: 403, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }
    const { data: application, error: applicationError } = await admin
      .from("job_applications").select("id")
      .eq("job_id", jobId).eq("applicant_id", applicantId).maybeSingle();
    if (applicationError || !application) {
      return new Response(JSON.stringify({ success: false, error: "Candidate application not found for this job" }), {
        status: 404, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }
    if (interviewId) {
      const { data: interview, error: interviewLookupError } = await admin
        .from("interviews").select("id, job_id, applicant_id, host_user_id")
        .eq("id", interviewId).maybeSingle();
      if (interviewLookupError || !interview || interview.job_id !== jobId ||
          interview.applicant_id !== applicantId || interview.host_user_id !== authData.user.id) {
        return new Response(JSON.stringify({ success: false, error: "Interview does not belong to this employer and candidate" }), {
          status: 403, headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
    }

    // Validate scheduledAt
    const startTime = new Date(scheduledAt).getTime();
    if (isNaN(startTime)) {
      throw new Error(`Invalid scheduledAt format: ${scheduledAt}`);
    }

    // Validate scheduledEndAt
    if (!scheduledEndAt) {
      throw new Error('scheduledEndAt is required for room duration');
    }
    const endTime = new Date(scheduledEndAt).getTime();
    if (isNaN(endTime)) {
      throw new Error(`Invalid scheduledEndAt format: ${scheduledEndAt}`);
    }

    // Calculate duration in seconds and clamp between 2 minutes and 12 hours
    let durationSeconds = Math.floor((endTime - startTime) / 1000);
    if (durationSeconds <= 0) {
      console.warn(`⚠️ Invalid duration calculated (${durationSeconds}s), defaulting to 900s (15 min)`);
      durationSeconds = 900;
    }
    durationSeconds = Math.max(120, Math.min(43200, durationSeconds)); // Clamp: 2 min to 12 hours

    // Create unique room name with random suffix to prevent duplicates
    const timestamp = startTime;
    const randomSuffix = crypto.randomUUID().slice(0, 8);
    const roomName = `interview-${jobId.slice(0, 8)}-${timestamp}-${randomSuffix}`;
    // Call 100ms API to create room
    const createRoomResponse = await fetch('https://api.100ms.live/v2/rooms', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HMS_MANAGEMENT_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: roomName,
        description: `Interview room for ${applicantName}`,
        template_id: HMS_TEMPLATE_ID,
        region: 'in',
        // India region for better performance
        max_duration_seconds: durationSeconds // Room will auto-expire after this duration
      })
    });
    if (!createRoomResponse.ok) {
      const errorText = await createRoomResponse.text();
      console.error(`❌ 100ms API error: ${createRoomResponse.status} - ${errorText}`);

      // Parse error and provide helpful message
      try {
        const errorData = JSON.parse(errorText);
        if (errorData.details && errorData.details.includes('template not found')) {
          throw new Error(`100ms Template ID '${HMS_TEMPLATE_ID}' not found. Please verify:\n1. Template ID is correct in your 100ms dashboard\n2. Management token has access to this template\n3. Template and token are from the same workspace`);
        }
      } catch (parseError) {
        // If we can't parse, use the raw error
      }
      throw new Error(`Failed to create 100ms room: ${errorText}`);
    }
    const roomData = await createRoomResponse.json();
    // Generate auth tokens for host and participant
    const hostTokenResponse = await fetch('https://api.100ms.live/v2/room-codes/room/' + roomData.id, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HMS_MANAGEMENT_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        role: 'host'
      })
    });
    const participantTokenResponse = await fetch('https://api.100ms.live/v2/room-codes/room/' + roomData.id, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HMS_MANAGEMENT_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        role: 'guest'
      })
    });
    if (!hostTokenResponse.ok || !participantTokenResponse.ok) {
      console.error('❌ Failed to generate auth tokens');
      throw new Error('Failed to generate room access tokens');
    }
    const hostTokenData = await hostTokenResponse.json();
    const participantTokenData = await participantTokenResponse.json();
    // Extract room codes from array response by filtering by role
    // 100ms API returns array: { data: [{ code: "...", role: "host" }, { code: "...", role: "guest" }] }
    const hostCode = hostTokenData?.data?.find((t: any) => t.role === 'host')?.code;
    const participantCode = participantTokenData?.data?.find((t: any) => t.role === 'guest')?.code;
    if (!hostCode || !participantCode) {
      console.error('❌ Room codes missing from API response');
      console.error('Host token data:', JSON.stringify(hostTokenData));
      console.error('Participant token data:', JSON.stringify(participantTokenData));
      throw new Error(`Failed to generate room codes. Host code: ${hostCode}, Participant code: ${participantCode}`);
    }
    // Construct clean meeting URLs using room codes directly in path (100ms standard format)
    const hostUrl = `https://${HMS_TEMPLATE_SUBDOMAIN}.app.100ms.live/meeting/${hostCode}`;
    const participantUrl = `https://${HMS_TEMPLATE_SUBDOMAIN}.app.100ms.live/meeting/${participantCode}`;
    if (interviewId) {
      const { error: updateError } = await admin.from("interviews").update({
        video_platform: "100ms",
        hms_room_id: roomData.id,
        hms_room_url: hostUrl,
        hms_host_token: hostCode,
        hms_participant_tokens: { [applicantId]: participantCode },
        hms_host_prebuilt_url: hostUrl,
        hms_participant_prebuilt_urls: { [applicantId]: participantUrl },
        location_url: hostUrl
      }).eq("id", interviewId).eq("host_user_id", authData.user.id);
      if (updateError) throw new Error(`Room created but interview update failed: ${updateError.message}`);
    }
    return new Response(JSON.stringify({
      success: true,
      roomId: roomData.id,
      roomName: roomData.name,
      meetingUrl: hostUrl,
      hostUrl: hostUrl,
      participantUrl: participantUrl,
      hostToken: hostCode,
      participantToken: participantCode
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  } catch (error: any) {
    console.error('❌ Error in create-100ms-room:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
};
serve(handler);