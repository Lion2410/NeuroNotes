import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.10";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json'
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
const deepgramApiKey = Deno.env.get('DEEPGRAM_API_KEY');

function getUserIdFromAuth(authHeader: string | null): string | null {
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

async function processAudioAndTranscribe({
  userId, sessionId, audioBuf, mode, deviceLabel
}: {
  userId: string,
  sessionId?: string,
  audioBuf: Uint8Array,
  mode: string,
  deviceLabel?: string
}) {
  // Build a multipart form for Deepgram API
  const form = new FormData();
  const blob = new Blob([audioBuf], { type: 'audio/raw' }); // 24kHz PCM expected
  form.append('audio', blob, 'audio.pcm');
  form.append('model', 'nova-2');
  form.append('punctuate', 'true');
  form.append('diarize', 'true');
  form.append('encoding', 'linear16');
  form.append('sample_rate', '24000');
  form.append('language', 'en-US');

  // Deepgram POST not WebSocket
  const dgRes = await fetch("https://api.deepgram.com/v1/listen", {
    method: "POST",
    headers: {
      "Authorization": `Token ${deepgramApiKey}`
    },
    body: form
  });

  if (!dgRes.ok) {
    const text = await dgRes.text();
    throw new Error(`Deepgram error: ${text}`);
  }
  const dgJson = await dgRes.json();

  // Parse Deepgram output to extract transcript with speaker labels
  let transcript = '';
  let speakerSegments: { speaker: string, text: string, confidence: number }[] = [];
  if (dgJson.results && dgJson.results.channels) {
    const channel = dgJson.results.channels[0];
    if (channel.alternatives && channel.alternatives[0].transcript) {
      transcript = channel.alternatives[0].transcript;
    }
    // Diarization
    if (channel.alternatives[0].words && Array.isArray(channel.alternatives[0].words)) {
      // Group words by speaker
      let lastSpeaker = '';
      let curr = { speaker: '', text: '', confidence: 0, count: 0 };
      for (const w of channel.alternatives[0].words) {
        if (w.speaker !== lastSpeaker) {
          if (curr.speaker) {
            speakerSegments.push({
              speaker: curr.speaker,
              text: curr.text.trim(),
              confidence: curr.count ? curr.confidence / curr.count : 1
            });
          }
          curr = { speaker: w.speaker, text: '', confidence: 0, count: 0 };
          lastSpeaker = w.speaker;
        }
        curr.text += w.punctuated_word ? w.punctuated_word + " " : w.word + " ";
        curr.confidence += w.confidence ?? 1;
        curr.count += 1;
      }
      if (curr.speaker) {
        speakerSegments.push({
          speaker: curr.speaker,
          text: curr.text.trim(),
          confidence: curr.count ? curr.confidence / curr.count : 1
        });
      }
    }
  }

  // Update transcription_sessions table
  let newSessionId = sessionId;
  const supabase = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!);
  if (!sessionId) {
    // Create session row on first chunk
    const startedAt = new Date().toISOString();
    const { data, error } = await supabase.from("transcription_sessions").insert({
      user_id: userId,
      started_at: startedAt,
      mode,
      device_label: deviceLabel,
      created_at: startedAt,
      updated_at: startedAt
    }).select('id').single();
    if (error) throw new Error("Could not create session: " + error.message);
    newSessionId = data.id;
  }
  // Append transcript so far
  if (newSessionId) {
    const { error: upErr } = await supabase.from("transcription_sessions")
      .update({
        transcript_content: transcript,
        updated_at: new Date().toISOString(),
      }).eq("id", newSessionId);
    if (upErr) {
      console.error("Failed to update transcript_content:", upErr);
    }
  }

  return {
    transcript,
    speakerSegments,
    sessionId: newSessionId
  };
}

serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !deepgramApiKey) {
    console.error("Env Incomplete", { SUPABASE_URL, SUPABASE_ANON_KEY, deepgramApiKey });
    return new Response(JSON.stringify({ error: "Backend not properly configured" }), {
      status: 500,
      headers: corsHeaders
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Only POST supported" }), {
      status: 405,
      headers: corsHeaders
    });
  }

  try {
    // Parse fields: sessionId (optional), mode, deviceLabel (optional), audio (base64 string, or Blob)
    const authHeader = req.headers.get('authorization');
    const userId = getUserIdFromAuth(authHeader);
    if (!userId) {
      console.error("NO AUTH HEADER FOR USER", { headers: req.headers });
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
        headers: corsHeaders
      });
    }

    // Improved content type detection and logging!
    const ctype = req.headers.get("content-type") || "";
    let body: any = {};
    let contentReadMode = "";
    if (ctype.includes("application/json")) {
      body = await req.json();
      contentReadMode = "json";
      console.log("[INFO] Got JSON request for transcription", Object.keys(body));
    } else if (ctype.includes("multipart/form-data")) {
      const form = await req.formData();
      contentReadMode = "multipart";
      // Logging all received form fields
      const all = [...form.entries()];
      console.log("[INFO] Got multipart form data:", all.map(([k, v]) => typeof v === "object" && "name" in v ? [k, (v as any).name] : [k, v]));
      body.sessionId = form.get("sessionId")?.toString() || undefined;
      body.mode = form.get("mode")?.toString() || undefined;
      body.deviceLabel = form.get("deviceLabel")?.toString() || undefined;
      body.audio = form.get("audio");
    } else {
      // Log unsupported or missing content-type!
      console.error("[ERROR] Unsupported Content-Type:", ctype);
      return new Response(JSON.stringify({ error: "Unsupported content-type: " + ctype }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Log state of required fields after parse
    if (!body.audio) {
      console.error("[ERROR] audio field is missing after body parse", { contentReadMode, keys: Object.keys(body) });
    }
    if (!body.mode) {
      console.error("[ERROR] mode field is missing after body parse", { contentReadMode, keys: Object.keys(body) });
    }

    // Needed fields: audio, mode
    if (!body.audio || !body.mode) {
      return new Response(
        JSON.stringify({ error: `audio and mode are required fields. Received: audio=${typeof body.audio}, mode=${typeof body.mode}, content-type=${ctype}` }),
        { status: 422, headers: corsHeaders }
      );
    }

    let audioBuf: Uint8Array;
    if (typeof body.audio === "string") {
      const bin = atob(body.audio);
      audioBuf = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; ++i) audioBuf[i] = bin.charCodeAt(i);
    } else if (typeof body.audio === "object" && body.audio.arrayBuffer) {
      // Blob/File: browser multipart
      audioBuf = new Uint8Array(await body.audio.arrayBuffer());
    } else {
      // Logging the problematic format!
      console.error("[ERROR] Invalid audio format", { value: body.audio, typeof: typeof body.audio });
      return new Response(JSON.stringify({ error: "Invalid audio format. audio field type: " + typeof body.audio }), {
        status: 422,
        headers: corsHeaders
      });
    }

    // Call main logic; on errors, log and respond clearly
    let responseData;
    try {
      responseData = await processAudioAndTranscribe({
        userId,
        sessionId: body.sessionId,
        audioBuf,
        mode: body.mode,
        deviceLabel: body.deviceLabel
      });
    } catch (err: any) {
      console.error("[ERROR] processAudioAndTranscribe failure:", err && err.message, err && err.stack);
      return new Response(JSON.stringify({ error: "Internal ASR error: " + (err && err.message) }), {
        status: 500,
        headers: corsHeaders
      });
    }

    // Log result for debugging
    console.log("[INFO] Sending transcript response. sessionId:", responseData && responseData.sessionId);

    return new Response(JSON.stringify({
      transcript: responseData.transcript,
      speakerSegments: responseData.speakerSegments,
      sessionId: responseData.sessionId
    }), { headers: corsHeaders });

  } catch (err: any) {
    // Show deep error info for debugging
    console.error("[FATAL ERROR] Full stack:", err && err.stack, "Message:", err && err.message);
    return new Response(JSON.stringify({ error: err.message || "Error processing audio" }), {
      status: 500,
      headers: corsHeaders
    });
  }
});
