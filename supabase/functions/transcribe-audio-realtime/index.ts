
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
    // Send connection confirmation
    socket.send(JSON.stringify({ type: 'connection', status: 'connected' }));
  };

  socket.onmessage = async (event) => {
    try {
      const data = JSON.parse(event.data);
      console.log("Received message:", data.type);
      
      if (data.type === 'audio' && data.data) {
        const deepgramApiKey = Deno.env.get('DEEPGRAM_API_KEY');
        if (!deepgramApiKey) {
          console.error('Deepgram API key not configured');
          socket.send(JSON.stringify({ error: 'Deepgram API key not configured' }));
          return;
        }

        try {
          // Convert base64 to binary
          const binaryString = atob(data.data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }

          console.log("Sending audio to Deepgram, size:", bytes.length);

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
            console.log("Deepgram response:", result);
            const transcript = result.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
            
            if (transcript.trim()) {
              socket.send(JSON.stringify({
                type: 'transcript',
                transcript: transcript,
                confidence: result.results?.channels?.[0]?.alternatives?.[0]?.confidence || 0,
              }));
            }
          } else {
            console.error('Deepgram API error:', response.status, await response.text());
            socket.send(JSON.stringify({ error: 'Transcription service error' }));
          }
        } catch (transcriptionError) {
          console.error('Transcription error:', transcriptionError);
          socket.send(JSON.stringify({ error: 'Failed to process audio' }));
        }
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
      socket.send(JSON.stringify({ error: 'Failed to process message' }));
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
