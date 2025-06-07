
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Meeting bot function called');
    
    const { meetingUrl } = await req.json();
    
    if (!meetingUrl) {
      console.error('Meeting URL is missing');
      return new Response(
        JSON.stringify({ error: 'Meeting URL is required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('Meeting bot starting for URL:', meetingUrl);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase configuration');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user ID from the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('Authorization header missing');
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    console.log('Validating user token');
    
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      console.error('User validation failed:', userError);
      return new Response(
        JSON.stringify({ error: 'Invalid authorization' }),
        { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('User validated:', user.id);

    // Create a transcription record with a unique title
    const meetingTitle = `Live Meeting - ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`;
    
    const { data: transcription, error: insertError } = await supabase
      .from('transcriptions')
      .insert({
        user_id: user.id,
        title: meetingTitle,
        content: 'Meeting bot is ready. Please start screen sharing with audio to begin transcription...',
        source_type: 'live_meeting',
        meeting_url: meetingUrl,
        audio_url: null,
        duration: null
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating transcription record:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to create transcription record' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('Transcription record created:', transcription.id);

    // Return success with instructions for browser-based audio capture
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Meeting bot initialized successfully. Browser-based audio capture ready.',
        transcriptionId: transcription.id,
        redirectUrl: `/transcript/${transcription.id}`,
        instructions: {
          step1: 'Navigate to the meeting URL in your browser',
          step2: 'Join the meeting',
          step3: 'Use the browser-based audio capture feature',
          step4: 'Audio will be transcribed in real-time'
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in meeting-bot function:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
