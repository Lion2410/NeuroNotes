
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  const { headers } = req;
  const upgradeHeader = headers.get("upgrade") || "";

  if (upgradeHeader.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket connection", { status: 400 });
  }

  const { socket, response } = Deno.upgradeWebSocket(req);
  
  socket.onopen = () => {
    console.log("WebSocket connection opened for real-time transcription");
  };

  socket.onmessage = async (event) => {
    try {
      const data = JSON.parse(event.data);
      
      if (data.type === 'audio' && data.data) {
        const deepgramApiKey = Deno.env.get('DEEPGRAM_API_KEY');
        if (!deepgramApiKey) {
          socket.send(JSON.stringify({ error: 'Deepgram API key not configured' }));
          return;
        }

        // Convert base64 to binary
        const binaryString = atob(data.data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        // Send to Deepgram for real-time transcription
        const response = await fetch('https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&punctuate=true', {
          method: 'POST',
          headers: {
            'Authorization': `Token ${deepgramApiKey}`,
            'Content-Type': 'audio/webm',
          },
          body: bytes,
        });

        if (response.ok) {
          const result = await response.json();
          const transcript = result.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
          
          if (transcript.trim()) {
            socket.send(JSON.stringify({
              transcript: transcript,
              confidence: result.results?.channels?.[0]?.alternatives?.[0]?.confidence || 0,
            }));
          }
        }
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
      socket.send(JSON.stringify({ error: 'Failed to process audio' }));
    }
  };

  socket.onclose = () => {
    console.log("WebSocket connection closed");
  };

  socket.onerror = (error) => {
    console.error("WebSocket error:", error);
  };

  return response;
});
