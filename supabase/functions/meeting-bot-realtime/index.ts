
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
  
  // Initialize Supabase client
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const supabase = createClient(supabaseUrl!, supabaseKey!);
  
  let transcriptionId: string | null = null;
  let transcriptContent = '';
  
  socket.onopen = () => {
    console.log("WebSocket connection opened for meeting bot");
    socket.send(JSON.stringify({ type: 'connection', status: 'connected' }));
  };

  socket.onmessage = async (event) => {
    try {
      const data = JSON.parse(event.data);
      console.log("Received message:", data.type);
      
      if (data.type === 'initialize' && data.transcriptionId) {
        transcriptionId = data.transcriptionId;
        console.log('Meeting bot initialized for transcription:', transcriptionId);
        socket.send(JSON.stringify({ 
          type: 'initialized', 
          message: 'Meeting bot ready for audio capture' 
        }));
      }
      
      if (data.type === 'audio' && data.data && transcriptionId) {
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
              const timestamp = new Date().toLocaleTimeString();
              const formattedTranscript = `[${timestamp}] ${transcript}`;
              
              // Append to existing content
              transcriptContent += (transcriptContent ? '\n' : '') + formattedTranscript;
              
              // Update Supabase with the accumulated transcript
              const { error: updateError } = await supabase
                .from('transcriptions')
                .update({
                  content: transcriptContent,
                  updated_at: new Date().toISOString()
                })
                .eq('id', transcriptionId);

              if (updateError) {
                console.error('Error updating transcript:', updateError);
              } else {
                console.log('Transcript updated in database');
              }

              socket.send(JSON.stringify({
                type: 'transcript',
                transcript: transcript,
                confidence: result.results?.channels?.[0]?.alternatives?.[0]?.confidence || 0,
                fullTranscript: transcriptContent
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
      
      if (data.type === 'end_meeting' && transcriptionId) {
        console.log('Meeting ended for transcription:', transcriptionId);
        
        // Final update to mark meeting as complete
        await supabase
          .from('transcriptions')
          .update({
            content: transcriptContent + '\n\n[Meeting ended]',
            updated_at: new Date().toISOString()
          })
          .eq('id', transcriptionId);
        
        socket.send(JSON.stringify({
          type: 'complete',
          message: 'Meeting has ended. Do you want to summarize the transcript?',
          transcriptionId: transcriptionId
        }));
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
