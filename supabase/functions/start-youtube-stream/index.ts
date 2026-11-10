import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface StartStreamRequest {
  interviewId: string;
  action: 'start' | 'stop';
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const dailyApiKey = Deno.env.get('DAILY_API_KEY');
    if (!dailyApiKey) {
      throw new Error('DAILY_API_KEY not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { interviewId, action }: StartStreamRequest = await req.json();

    console.log(`🎥 ${action === 'start' ? 'Starting' : 'Stopping'} YouTube stream for interview ${interviewId}`);

    // Get interview details
    const { data: interview, error: fetchError } = await supabase
      .from('interviews')
      .select('daily_room_name, youtube_stream_key, is_streaming_to_youtube')
      .eq('id', interviewId)
      .single();

    if (fetchError || !interview) {
      throw new Error('Interview not found');
    }

    if (!interview.daily_room_name) {
      throw new Error('No Daily.co room associated with this interview');
    }

    if (action === 'start') {
      if (!interview.youtube_stream_key) {
        throw new Error('No YouTube stream key configured');
      }

      // Start live streaming to YouTube via Daily.co RTMP
      const startStreamResponse = await fetch(
        `https://api.daily.co/v1/rooms/${interview.daily_room_name}/live-streaming/start`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${dailyApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            rtmp_url: `rtmp://a.rtmp.youtube.com/live2/${interview.youtube_stream_key}`,
            width: 1920,
            height: 1080,
            fps: 30,
            video_bitrate: 4500,
            audio_bitrate: 128,
            audio_codec: 'aac',
            layout: {
              preset: 'default',
              max_cam_streams: 2
            }
          }),
        }
      );

      if (!startStreamResponse.ok) {
        const error = await startStreamResponse.text();
        console.error('Daily.co streaming start error:', error);
        throw new Error(`Failed to start YouTube streaming: ${error}`);
      }

      const streamData = await startStreamResponse.json();
      console.log(`✅ YouTube streaming started:`, streamData);

      // Update database
      await supabase
        .from('interviews')
        .update({ is_streaming_to_youtube: true })
        .eq('id', interviewId);

      return new Response(JSON.stringify({
        success: true,
        message: 'YouTube streaming started successfully',
        streamData
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });

    } else if (action === 'stop') {
      // Stop live streaming
      const stopStreamResponse = await fetch(
        `https://api.daily.co/v1/rooms/${interview.daily_room_name}/live-streaming/stop`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${dailyApiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!stopStreamResponse.ok) {
        const error = await stopStreamResponse.text();
        console.error('Daily.co streaming stop error:', error);
        throw new Error(`Failed to stop YouTube streaming: ${error}`);
      }

      console.log(`✅ YouTube streaming stopped`);

      // Update database
      await supabase
        .from('interviews')
        .update({ is_streaming_to_youtube: false })
        .eq('id', interviewId);

      return new Response(JSON.stringify({
        success: true,
        message: 'YouTube streaming stopped successfully'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    throw new Error('Invalid action. Must be "start" or "stop"');

  } catch (error: any) {
    console.error('Error in start-youtube-stream:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
};

serve(handler);
