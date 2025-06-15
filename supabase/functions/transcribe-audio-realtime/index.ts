
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.10";

// CORS headers for browser compatibility
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
const deepgramApiKey = Deno.env.get('DEEPGRAM_API_KEY');

function getUserIdFromAuth(authHeader: string | null): string | null {
  // Handle 'Bearer {token}'
  if (!authHeader) return null;
  const token = authHeader.replace(/^Bearer /i, "");
  const payload = token.split('.')[1];
  if (!payload) return null;
  try {
    const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const json = JSON.parse(decoded);
    return json.sub || json.user_id || json.id || null;
  } catch {
    return null;
  }
}

serve(async (req: Request) => {
  const { headers } = req;
  const upgrade = headers.get("upgrade") || "";

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return new Response("Missing Supabase credentials", { status: 500 });
  }
  if (!deepgramApiKey) {
    return new Response("Deepgram API key not set", { status: 500 });
  }

  if (upgrade.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket connection for real-time transcription", { status: 400 });
  }

  const { socket, response } = Deno.upgradeWebSocket(req);

  // Parse auth info & set up Supabase
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const authHeader = headers.get("authorization");
  const userId = getUserIdFromAuth(authHeader);

  // For session logging
  let sessionId: string | null = null;
  let sessionStart: Date | null = null;
  let sessionEnded = false;
  let transcriptContent = "";
  let mode = "microphone"; // default unless client overrides
  let deviceLabel: string | undefined = undefined;

  let deepgramWS: WebSocket | null = null;

  socket.onopen = async () => {
    sessionStart = new Date();
    // Session metadata should be sent by frontend, but fallback to simple defaults
    socket.send(JSON.stringify({ type: "connection", status: "connected" }));
    if (!userId) {
      socket.send(JSON.stringify({ error: "Authentication required" }));
      socket.close();
      return;
    }
    // Create session row (in background)
    const { data, error } = await supabase.from("transcription_sessions").insert({
      user_id: userId,
      started_at: sessionStart.toISOString(),
      mode,
      device_label: deviceLabel,
      created_at: sessionStart.toISOString(),
      updated_at: sessionStart.toISOString()
    }).select('id').single();
    if (error) {
      socket.send(JSON.stringify({ error: "Could not create session log" }));
      console.error("Supabase session log insert error:", error);
      sessionId = null;
    } else {
      sessionId = data?.id;
    }
  };

  socket.onmessage = async (event) => {
    if (typeof event.data !== "string") {
      socket.send(JSON.stringify({ error: "Invalid data; expected stringified JSON." }));
      return;
    }
    try {
      const msg = JSON.parse(event.data);

      // 0. Accept session metadata at start
      if (msg.type === "session" && typeof msg.mode === "string") {
        mode = msg.mode;
        if (typeof msg.deviceLabel === "string") {
          deviceLabel = msg.deviceLabel;
        }
        return;
      }

      // 1. Start Deepgram WebSocket on first audio
      if (!deepgramWS && msg.type === "audio" && msg.data) {
        deepgramWS = new WebSocket(`wss://api.deepgram.com/v1/listen?model=nova-2&punctuate=true&encoding=linear16&sample_rate=24000&channels=1&endpointing=12`, [
          // The Deepgram API expects the token as a protocol ("token-{KEY}")
          `token-${deepgramApiKey}`
        ]);

        deepgramWS.onopen = () => {
          // Now that Deepgram is ready, send the audio chunk
          sendPCMToDeepgram(msg.data);
        };
        deepgramWS.onmessage = (e) => {
          const dgMsg = JSON.parse(typeof e.data === "string" ? e.data : "");
          // See Deepgram's docs - Alternative transcript messages
          if (dgMsg.channel && dgMsg.channel.alternatives && dgMsg.channel.alternatives.length > 0) {
            for (const alt of dgMsg.channel.alternatives) {
              if (alt.transcript && alt.transcript.trim() !== "") {
                transcriptContent += (transcriptContent ? " " : "") + alt.transcript;
                socket.send(JSON.stringify({
                  type: "transcript",
                  transcript: alt.transcript,
                  confidence: alt.confidence
                }));
              }
            }
          }
        };
        deepgramWS.onerror = (e) => {
          socket.send(JSON.stringify({ error: "Deepgram websocket error" }));
          console.error("Deepgram WS error", e);
        };
        deepgramWS.onclose = async () => {
          // On close, update session with transcript
          if (sessionId && !sessionEnded && transcriptContent) {
            sessionEnded = true;
            await supabase.from("transcription_sessions")
              .update({
                ended_at: new Date().toISOString(),
                transcript_content: transcriptContent,
                updated_at: new Date().toISOString(),
              }).eq("id", sessionId);
          }
        };
      } else if (deepgramWS && msg.type === "audio" && msg.data) {
        // Deepgram is open, continue streaming PCM to it
        sendPCMToDeepgram(msg.data);
      } else if (msg.type === 'end') {
        // Client signaled end of session
        if (deepgramWS) {
          deepgramWS.close();
        }
        if (!sessionEnded && sessionId) {
          sessionEnded = true;
          await supabase.from("transcription_sessions")
            .update({
              ended_at: new Date().toISOString(),
              transcript_content: transcriptContent,
              updated_at: new Date().toISOString(),
            }).eq("id", sessionId);
        }
        socket.send(JSON.stringify({ type: "ended", status: "ok" }));
        socket.close();
      }
    } catch (err) {
      console.error("Error in WebSocket/onmessage parse:", err);
      socket.send(JSON.stringify({ error: "Failed to process message" }));
    }

    // PCM base64 → Uint8Array and stream to Deepgram WS
    function sendPCMToDeepgram(base64Str: string) {
      if (!deepgramWS || deepgramWS.readyState !== WebSocket.OPEN) return;
      // PCM16, 24khz, mono. Accepts raw base64 PCM
      try {
        const bin = atob(base64Str);
        const buf = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; ++i) buf[i] = bin.charCodeAt(i);
        // Send raw buffer
        deepgramWS.send(buf);
      } catch (e) {
        socket.send(JSON.stringify({ error: "Audio decode error" }));
      }
    }
  };

  socket.onclose = async () => {
    if (sessionId && !sessionEnded) {
      sessionEnded = true;
      await supabase.from("transcription_sessions")
        .update({
          ended_at: new Date().toISOString(),
          transcript_content: transcriptContent,
          updated_at: new Date().toISOString(),
        }).eq("id", sessionId);
    }
    if (deepgramWS && deepgramWS.readyState === WebSocket.OPEN) {
      deepgramWS.close();
    }
    console.log("WebSocket connection closed (client or server)");
  };

  socket.onerror = (e) => {
    console.error("Top-level WebSocket error", e);
  };

  return response;
});
