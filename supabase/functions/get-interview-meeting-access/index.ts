import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const authorization = req.headers.get("Authorization") || "";
    const accessToken = authorization.replace(/^Bearer\\s+/i, "");
    if (!url || !anonKey || !serviceKey || !accessToken || accessToken === authorization) {
      return json({ success: false, error: "Authentication required" }, 401);
    }

    const auth = createClient(url, anonKey);
    const { data: authData, error: authError } = await auth.auth.getUser(accessToken);
    if (authError || !authData.user) return json({ success: false, error: "Invalid session" }, 401);

    const { interviewId } = await req.json();
    if (!interviewId) return json({ success: false, error: "interviewId is required" }, 400);

    const admin = createClient(url, serviceKey);
    const { data: interview, error } = await admin.from("interviews")
      .select("id,applicant_id,host_user_id,video_platform,jitsi_meeting_url,location_url,videosdk_room_id,videosdk_meeting_url,videosdk_host_token,videosdk_participant_tokens,hms_room_id,hms_room_url,hms_host_token,hms_participant_tokens,hms_host_prebuilt_url,hms_participant_prebuilt_urls")
      .eq("id", interviewId).maybeSingle();
    if (error || !interview) return json({ success: false, error: "Interview not found" }, 404);

    const uid = authData.user.id;
    const isHost = interview.host_user_id === uid;
    const isApplicant = interview.applicant_id === uid;
    if (!isHost && !isApplicant) return json({ success: false, error: "You are not a participant in this interview" }, 403);

    const platform = (interview.video_platform || "").toLowerCase();
    if (platform === "100ms") {
      const roomCode = isHost
        ? interview.hms_host_token
        : interview.hms_participant_tokens?.[uid];
      const meetingUrl = isHost
        ? interview.hms_host_prebuilt_url || interview.hms_room_url
        : interview.hms_participant_prebuilt_urls?.[uid] || interview.hms_room_url;
      if (!roomCode) return json({ success: false, error: "100ms room access is not ready" }, 409);
      return json({ success: true, provider: "100ms", roomCode, meetingUrl });
    }

    if (platform === "videosdk") {
      const token = isHost
        ? interview.videosdk_host_token
        : interview.videosdk_participant_tokens?.[uid];
      if (!interview.videosdk_room_id || !token) {
        return json({ success: false, error: "VideoSDK room access is not ready" }, 409);
      }
      return json({ success: true, provider: "videosdk", meetingId: interview.videosdk_room_id, token });
    }

    if (platform === "jitsi") {
      const meetingUrl = interview.jitsi_meeting_url || interview.location_url;
      if (!meetingUrl) return json({ success: false, error: "Jitsi meeting link is not ready" }, 409);
      return json({ success: true, provider: "jitsi", meetingUrl });
    }

    return json({ success: false, error: "This interview does not use a supported video provider" }, 400);
  } catch (error) {
    return json({ success: false, error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});
