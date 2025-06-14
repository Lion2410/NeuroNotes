
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { HfInference } from 'https://esm.sh/@huggingface/inference@2.3.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { content } = await req.json();

    if (!content) {
      throw new Error('Content is required');
    }

    const hfToken = Deno.env.get('HUGGING_FACE_ACCESS_TOKEN');
    
    if (!hfToken) {
      throw new Error('Hugging Face access token is not configured');
    }

    console.log('Initializing Hugging Face client...');
    const hf = new HfInference(hfToken);

    let summary;
    let lastError;

    // Try original summarization model first (fastest option)
    try {
      console.log('Trying original summarization model: sshleifer/distilbart-cnn-12-6');
      const response = await hf.summarization({
        model: 'sshleifer/distilbart-cnn-12-6',
        inputs: content,
        parameters: {
          max_length: 150,
          min_length: 30,
          do_sample: false,
        },
      });
      summary = response.summary_text;
    } catch (originalError) {
      console.log('Original summarization model failed:', originalError.message);
      lastError = originalError;

      // Fallback to text generation models
      const textGenModels = [
        'microsoft/DialoGPT-medium',
        'facebook/bart-large-cnn'
      ];

      for (const model of textGenModels) {
        try {
          console.log(`Trying text generation with model: ${model}`);
          
          const response = await hf.textGeneration({
            model: model,
            inputs: `Summarize the following text in a concise manner:\n\n${content}\n\nSummary:`,
            parameters: {
              max_new_tokens: 150,
              temperature: 0.7,
              do_sample: false,
            },
          });

          console.log('Text generation response:', response);
          summary = response.generated_text.replace(`Summarize the following text in a concise manner:\n\n${content}\n\nSummary:`, '').trim();
          break;
        } catch (modelError) {
          console.log(`Model ${model} failed:`, modelError.message);
          lastError = modelError;
          continue;
        }
      }
    }

    if (!summary) {
      throw lastError || new Error('All summarization models failed');
    }

    return new Response(JSON.stringify({ summary }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in generate-summary-hf function:', error);
    
    // Provide more specific error messages
    let errorMessage = 'Failed to generate summary. Please try again.';
    
    if (error.message.includes('authentication') || error.message.includes('permissions') || error.message.includes('401')) {
      errorMessage = 'Hugging Face authentication failed. Please check your access token configuration.';
    } else if (error.message.includes('rate limit') || error.message.includes('429')) {
      errorMessage = 'Rate limit exceeded. Please try again in a few minutes.';
    } else if (error.message.includes('model') || error.message.includes('blob') || error.message.includes('503') || error.message.includes('500')) {
      errorMessage = 'Model temporarily unavailable. Please try again in a few moments.';
    } else if (error.message.includes('timeout')) {
      errorMessage = 'Request timed out. Please try again.';
    }
    
    return new Response(JSON.stringify({ 
      error: errorMessage,
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
