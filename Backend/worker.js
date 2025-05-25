// worker.js

// This should be set as a secret in your Cloudflare Worker environment.
// For local testing, you might define it here, but for deployment, use `wrangler secret put OPENAI_API_KEY`
const OPENAI_API_KEY = typeof OPENAI_API_KEY_VAR !== 'undefined' ? OPENAI_API_KEY_VAR : 'YOUR_OPENAI_API_KEY_FOR_DEV_ONLY'; // Replace for local dev if needed

addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
    // Set CORS headers for all responses
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*', // Adjust this to your frontend domain in production
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle preflight OPTIONS request
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            headers: {
                ...corsHeaders,
                'Access-Control-Max-Age': '86400', // Cache preflight for 24 hours
            },
        });
    }

    if (request.method !== 'POST') {
        return new Response(JSON.stringify({ message: 'Method Not Allowed' }), { status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    try {
        const { image, prompt } = await request.json();

        if (!image || !prompt) {
            return new Response(JSON.stringify({ message: 'Missing image or prompt in request body.' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }

        // Validate image data URL format (basic check)
        if (!image.startsWith('data:image/jpeg;base64,') && !image.startsWith('data:image/png;base64,')) {
            return new Response(JSON.stringify({ message: 'Invalid image data format. Only base64 JPEG/PNG allowed.' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }

        const openaiRequestBody = {
            model: "gpt-4o", // Using gpt-4o for better vision capabilities and cost-efficiency
            messages: [
                {
                    role: "user",
                    content: [
                        { type: "text", text: prompt },
                        {
                            type: "image_url",
                            image_url: {
                                url: image,
                                detail: "low" // 'low' or 'high'. 'low' is faster and cheaper for general descriptions.
                            }
                        }
                    ]
                }
            ],
            max_tokens: 500, // Limit response length
        };

        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
            },
            body: JSON.stringify(openaiRequestBody),
        });

        if (!openaiResponse.ok) {
            const errorText = await openaiResponse.text();
            console.error('OpenAI API Error:', openaiResponse.status, errorText);
            return new Response(JSON.stringify({ message: `OpenAI API error: ${openaiResponse.status} - ${errorText}` }), { status: openaiResponse.status, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }

        const openaiData = await openaiResponse.json();
        const description = openaiData.choices[0]?.message?.content || 'No description found.';

        return new Response(JSON.stringify({ description: description }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

    } catch (error) {
        console.error('Worker error:', error);
        return new Response(JSON.stringify({ message: `Internal server error: ${error.message}` }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }
}