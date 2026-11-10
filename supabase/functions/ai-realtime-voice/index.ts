import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import { BRAND_CONFIG } from '../_shared/brandConfig.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, upgrade',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const { headers } = req;
  const upgradeHeader = headers.get("upgrade") || "";

  if (upgradeHeader.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket connection", { status: 400 });
  }

  const { socket, response } = Deno.upgradeWebSocket(req);
  
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
  
  if (!OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY not configured");
    socket.close(1008, "Server configuration error");
    return response;
  }

  // Connect to OpenAI Realtime API with authentication in URL
  const openAIUrl = `wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01`;
  
  let openAISocket: WebSocket;
  
  try {
    // Create WebSocket without headers (Deno doesn't support it)
    openAISocket = new WebSocket(openAIUrl);
    
    // We'll send auth via the first message instead
    openAISocket.onopen = () => {
      console.log("Connected to OpenAI Realtime API");
      
      // Configure session with career-focused instructions and authentication
      openAISocket.send(JSON.stringify({
        type: 'session.update',
        session: {
          modalities: ['text', 'audio'],
          instructions: `You are an AI Career Assistant for ${BRAND_CONFIG.name}. Help users with job search, career advice, resume tips, interview preparation, and any questions about Workly India opportunities in India. Be friendly, professional, and helpful. You can speak both English and Hindi. Keep responses concise and conversational.`,
          voice: 'alloy',
          input_audio_format: 'pcm16',
          output_audio_format: 'pcm16',
          input_audio_transcription: {
            model: 'whisper-1'
          },
          turn_detection: {
            type: 'server_vad',
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: 1000
          },
          temperature: 0.8,
          max_response_output_tokens: 4096
        }
      }));
    };
  } catch (error) {
    console.error("Failed to create OpenAI WebSocket:", error);
    socket.close(1011, "Failed to connect to AI service");
    return response;
  }

  // Forward messages between client and OpenAI
  socket.onopen = () => {
    console.log("Client connected to voice call");
  };

  // Client → OpenAI
  socket.onmessage = (event) => {
    if (openAISocket.readyState === WebSocket.OPEN) {
      openAISocket.send(event.data);
    }
  };

  // OpenAI → Client
  openAISocket.onmessage = (event) => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(event.data);
    }
  };

  // Error handling
  socket.onerror = (error) => {
    console.error("Client WebSocket error:", error);
  };
  
  openAISocket.onerror = (error) => {
    console.error("OpenAI WebSocket error:", error);
    socket.close(1011, "AI service error");
  };

  // Cleanup
  socket.onclose = () => {
    console.log("Client disconnected");
    if (openAISocket.readyState === WebSocket.OPEN) {
      openAISocket.close();
    }
  };

  openAISocket.onclose = (event) => {
    console.log("OpenAI connection closed:", event.code, event.reason);
    if (socket.readyState === WebSocket.OPEN) {
      socket.close();
    }
  };

  return response;
});
