
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
        content: 'Meeting bot is joining the meeting. Transcription will begin shortly...',
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

    // Start background task to simulate meeting bot
    // In production, this would be the actual Playwright automation
    setTimeout(async () => {
      const simulatedTranscript = `[${new Date().toLocaleTimeString()}] Meeting Bot: Successfully joined the meeting at ${meetingUrl}
[${new Date(Date.now() + 5000).toLocaleTimeString()}] System: Audio capture initialized
[${new Date(Date.now() + 10000).toLocaleTimeString()}] Participant: Welcome everyone to today's meeting
[${new Date(Date.now() + 15000).toLocaleTimeString()}] Participant: Let's start with our agenda items...
[${new Date(Date.now() + 20000).toLocaleTimeString()}] Participant: Thank you all for joining, meeting concluded.`;

      try {
        await supabase
          .from('transcriptions')
          .update({
            content: simulatedTranscript,
            duration: 5,
            updated_at: new Date().toISOString()
          })
          .eq('id', transcription.id);
        
        console.log('Simulated transcript updated for:', transcription.id);
      } catch (error) {
        console.error('Failed to update simulated transcript:', error);
      }
    }, 5000);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Meeting bot started successfully',
        transcriptionId: transcription.id,
        redirectUrl: `/transcript/${transcription.id}`
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
