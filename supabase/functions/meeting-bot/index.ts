
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

    // Start the real meeting bot process
    try {
      const botPath = new URL('./bot.js', import.meta.url).pathname;
      
      console.log('Starting bot process with path:', botPath);
      
      // Spawn the bot process
      const command = new Deno.Command('node', {
        args: [botPath, transcription.id, meetingUrl],
        env: {
          'SUPABASE_URL': supabaseUrl,
          'SUPABASE_SERVICE_ROLE_KEY': supabaseKey,
          'NODE_PATH': '/usr/local/lib/node_modules'
        },
        stdout: 'piped',
        stderr: 'piped'
      });

      const child = command.spawn();
      
      console.log('Bot process started');

      // Handle bot process output in background
      const decoder = new TextDecoder();
      
      // Read stdout
      (async () => {
        try {
          const reader = child.stdout.getReader();
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            const output = decoder.decode(value);
            console.log('Bot stdout:', output);
          }
        } catch (error) {
          console.error('Error reading bot stdout:', error);
        }
      })();

      // Read stderr
      (async () => {
        try {
          const reader = child.stderr.getReader();
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            const output = decoder.decode(value);
            console.log('Bot stderr:', output);
          }
        } catch (error) {
          console.error('Error reading bot stderr:', error);
        }
      })();

      // Don't wait for the bot process to complete - return immediately
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
      console.error('Error starting bot process:', error);
      
      // Update transcription with error status
      await supabase
        .from('transcriptions')
        .update({
          content: `Error starting meeting bot: ${error.message}. Please try again or use the manual recording feature.`,
          updated_at: new Date().toISOString()
        })
        .eq('id', transcription.id);

      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to start meeting bot',
          transcriptionId: transcription.id,
          redirectUrl: `/transcript/${transcription.id}`
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

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
