// Use environment binding for secret key: OPENAI_API_KEY
// During local dev, fallback to hardcoded (for dev only, never commit real key)
// Note: In Cloudflare Workers, secrets are accessed via environment variables passed to fetch handler

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request, event));
});

/**
 * @param {Request} request
 * @param {FetchEvent} event
 */
async function handleRequest(request, event) {
  // CORS headers for all responses
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*', // TODO: restrict to your frontend domain in production
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  // Handle CORS preflight OPTIONS request
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        ...corsHeaders,
        'Access-Control-Max-Age': '86400', // Cache preflight for 24 hours
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
      return new Response(
        JSON.stringify({ message: 'Missing image or prompt in request body.' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Basic validation for base64 jpeg/png data URL
    if (
      !image.startsWith('data:image/jpeg;base64,') &&
      !image.startsWith('data:image/png;base64,')
    ) {
      return new Response(
        JSON.stringify({ message: 'Invalid image data format. Only base64 JPEG/PNG allowed.' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Access your secret key from environment binding
    // This requires Wrangler configuration to bind OPENAI_API_KEY env var to this worker
    const OPENAI_API_KEY = event?.env?.OPENAI_API_KEY || 'YOUR_OPENAI_API_KEY_FOR_DEV_ONLY';

    if (!OPENAI_API_KEY || OPENAI_API_KEY === 'YOUR_OPENAI_API_KEY_FOR_DEV_ONLY') {
      return new Response(
        JSON.stringify({ message: 'API key not configured in environment.' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const openaiRequestBody = {
      model: 'gpt-4o', // Adjust this as needed for your OpenAI plan
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: {
                url: image,
                detail: 'low', // 'low' or 'high', tweak as needed
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
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify(openaiRequestBody),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('OpenAI API error:', openaiResponse.status, errorText);
      return new Response(
        JSON.stringify({ message: `OpenAI API error: ${openaiResponse.status} - ${errorText}` }),
        { status: openaiResponse.status, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const openaiData = await openaiResponse.json();
    const description = openaiData.choices?.[0]?.message?.content || 'No description found.';

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
