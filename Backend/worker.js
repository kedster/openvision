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
      const { image, prompt } = await request.json();

      if (!image || !prompt) {
        return new Response(JSON.stringify({ message: 'Missing image or prompt in request body.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      if (
        !image.startsWith('data:image/jpeg;base64,') &&
        !image.startsWith('data:image/png;base64,')
      ) {
        return new Response(JSON.stringify({ message: 'Invalid image format. Must be base64 JPEG/PNG.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      const apiKey = env.OPENAI_API_KEY;

      if (!apiKey) {
        return new Response(JSON.stringify({ message: 'API key not configured in environment.' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      const openaiRequestBody = {
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
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
        max_tokens: 500,
      };

      const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(openaiRequestBody),
      });

      if (!openaiResponse.ok) {
        const errorText = await openaiResponse.text();
        console.error('OpenAI API error:', openaiResponse.status, errorText);
        return new Response(JSON.stringify({ message: `OpenAI error: ${errorText}` }), {
          status: openaiResponse.status,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      const openaiData = await openaiResponse.json();
      const description = openaiData.choices?.[0]?.message?.content ?? 'No description found.';

      return new Response(JSON.stringify({ description }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });

    } catch (err) {
      console.error('Worker error:', err);
      return new Response(JSON.stringify({ message: `Internal server error: ${err.message}` }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
  }
};
