require('dotenv').config(); // Load environment variables from .env file
const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');

const app = express();
const port = process.env.PORT || 3000; // Use port from .env or default to 3000

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY, // Ensure this is set in your .env file
});

// Middleware
app.use(cors()); // Enable CORS for all origins (for development)
app.use(express.json({ limit: '10mb' })); // Increase limit for image data

// Trust proxy headers (important if running behind a proxy or in some dev setups)
app.set('trust proxy', true);

// Throttle middleware: 1 request per 20 seconds per IP
const throttleMap = new Map();
const THROTTLE_MS = 20000;

function getClientIp(req) {
    // Prefer x-forwarded-for if present, else fallback to req.ip
    return (req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim();
}

function throttle(req, res, next) {
    const ip = getClientIp(req);
    const now = Date.now();
    const last = throttleMap.get(ip) || 0;
    if (now - last < THROTTLE_MS) {
        return res.status(429).json({ message: `Too many requests. Please wait ${((THROTTLE_MS - (now - last))/1000).toFixed(1)}s.` });
    }
    throttleMap.set(ip, now);
    next();
}

// --- API Endpoint for Video Analysis ---
app.post('/analyze-video', throttle, async (req, res) => {
    const { image, prompt } = req.body;

    if (!image || !prompt) {
        return res.status(400).json({ message: 'Missing image or prompt data.' });
    }

    // OpenAI's Vision API expects Base64 images with the data URI prefix
    // The frontend sends it this way (e.g., "data:image/jpeg;base64,....")
    const base64Image = image; 

    try {
        const chatCompletion = await openai.chat.completions.create({
            model: "gpt-4o", // Or "gpt-4-vision-preview" if `gpt-4o` isn't available yet
            messages: [
                {
                    role: "user",
                    content: [
                        { type: "text", text: prompt },
                        { type: "image_url", image_url: { url: base64Image } },
                    ],
                },
            ],
            max_tokens: 500, // Limit the length of the AI's response
        });

        const description = chatCompletion.choices[0].message.content;
        res.json({ description });

    } catch (error) {
        console.error("Error calling OpenAI API:", error);
        if (error.response) {
            console.error("OpenAI API response error:", error.response.status, error.response.data);
            res.status(500).json({ message: `Error from OpenAI: ${error.response.data.error.message}` });
        } else {
            res.status(500).json({ message: `Internal server error: ${error.message}` });
        }
    }
});

// Basic route for checking if server is running
app.get('/', (req, res) => {
    res.send('Server is running');
});

// Start the server
app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});