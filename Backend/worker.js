export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          ...corsHeaders,
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ message: 'Method Not Allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    try {
      const { image, primaryPrompt, secondaryPrompt } = await request.json();

      if (!image || !primaryPrompt || !secondaryPrompt) {
        return new Response(JSON.stringify({ 
          message: 'Missing image, primaryPrompt, or secondaryPrompt in request body.' 
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      if (
        !image.startsWith('data:image/jpeg;base64,') &&
        !image.startsWith('data:image/png;base64,')
      ) {
        return new Response(JSON.stringify({ 
          message: 'Invalid image format. Must be base64 JPEG/PNG.' 
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      const apiKey = env.OPENAI_API_KEY;

      if (!apiKey) {
        return new Response(JSON.stringify({ 
          message: 'API key not configured in environment.' 
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // First API call - Primary analysis
      const primaryRequestBody = {
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: primaryPrompt },
              {
                type: 'image_url',
                image_url: {
                  url: image,
                  detail: 'low',
                },
              },
            ],
          },
        ],
        max_tokens: 300,
      };

      const primaryResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(primaryRequestBody),
      });

      if (!primaryResponse.ok) {
        const errorText = await primaryResponse.text();
        console.error('OpenAI API error (primary):', primaryResponse.status, errorText);
        return new Response(JSON.stringify({ 
          message: `Primary analysis error: ${errorText}` 
        }), {
          status: primaryResponse.status,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      const primaryData = await primaryResponse.json();
      const primaryResult = primaryData.choices?.[0]?.message?.content ?? 'No primary analysis found.';

      // Second API call - Follow-up analysis using first result
      const secondaryRequestBody = {
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              { 
                type: 'text', 
                text: `Based on this image analysis: "${primaryResult}"\n\n${secondaryPrompt}` 
              },
              {
                type: 'image_url',
                image_url: {
                  url: image,
                  detail: 'low',
                },
              },
            ],
          },
        ],
        max_tokens: 300,
      };

      const secondaryResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(secondaryRequestBody),
      });

      if (!secondaryResponse.ok) {
        const errorText = await secondaryResponse.text();
        console.error('OpenAI API error (secondary):', secondaryResponse.status, errorText);
        
        // Return primary result even if secondary fails
        return new Response(JSON.stringify({ 
          primaryResponse: primaryResult,
          secondaryResponse: `Secondary analysis failed: ${errorText}`,
          timestamp: new Date().toISOString()
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      const secondaryData = await secondaryResponse.json();
      const secondaryResult = secondaryData.choices?.[0]?.message?.content ?? 'No secondary analysis found.';

      return new Response(JSON.stringify({ 
        primaryResponse: primaryResult,
        secondaryResponse: secondaryResult,
        timestamp: new Date().toISOString()
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });

    } catch (err) {
      console.error('Worker error:', err);
      return new Response(JSON.stringify({ 
        message: `Internal server error: ${err.message}` 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
  }
};