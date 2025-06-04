
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const audioFile = formData.get('audio') as File;
    
    if (!audioFile) {
      throw new Error('No audio file provided');
    }

    const deepgramApiKey = Deno.env.get('DEEPGRAM_API_KEY');
    if (!deepgramApiKey) {
      throw new Error('Deepgram API key not configured');
    }

    // Convert file to ArrayBuffer
    const audioBuffer = await audioFile.arrayBuffer();

    // Send to Deepgram for transcription
    const response = await fetch('https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&punctuate=true&diarize=true', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${deepgramApiKey}`,
        'Content-Type': audioFile.type,
      },
      body: audioBuffer,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Deepgram API error: ${errorText}`);
    }

    const result = await response.json();
    
    return new Response(
      JSON.stringify({
        transcript: result.results?.channels?.[0]?.alternatives?.[0]?.transcript || '',
        words: result.results?.channels?.[0]?.alternatives?.[0]?.words || [],
        confidence: result.results?.channels?.[0]?.alternatives?.[0]?.confidence || 0,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Transcription error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
