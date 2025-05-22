const webcamFeed = document.getElementById('webcamFeed');
const captureCanvas = document.getElementById('captureCanvas');
const context = captureCanvas.getContext('2d');
const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');
const promptInput = document.getElementById('promptInput');
const sendPromptButton = document.getElementById('sendPromptButton');
const outputBox = document.getElementById('outputBox');
const permissionStatus = document.getElementById('permissionStatus');
const analysisStatus = document.getElementById('analysisStatus');
const waitTimeInput = document.getElementById('waitTimeInput');

let currentStream;
let analysisInterval = null;
let analysisTimeout = null;
let isAnalyzing = false;
const ANALYSIS_INTERVAL_MS = 20000; // Analyze every 2 seconds

// Set default and minimum to 20 seconds to match backend throttle
waitTimeInput.value = 20;
waitTimeInput.min = 20;

// --- Event Listeners ---
startButton.addEventListener('click', startWebcam);
stopButton.addEventListener('click', stopWebcam);
sendPromptButton.addEventListener('click', () => {
    if (currentStream) {
        performAnalysis();
    } else {
        outputBox.textContent = "Please start the webcam first.";
    }
});

// --- Webcam Functions ---
async function startWebcam() {
    clearAnalysisInterval(); // Stop any pending analysis from previous session
    outputBox.textContent = 'Connecting to webcam...';
    permissionStatus.textContent = 'Requesting camera permission...';

    try {
        currentStream = await navigator.mediaDevices.getUserMedia({ video: true });
        webcamFeed.srcObject = currentStream;
        webcamFeed.onloadedmetadata = () => {
            webcamFeed.play();
            startButton.disabled = true;
            stopButton.disabled = false;
            sendPromptButton.disabled = false;
            permissionStatus.textContent = 'Webcam connected.';
            outputBox.textContent = 'Webcam connected. Enter your prompt and click "Analyze" to begin real-time analysis.';
            startAnalysisPolling(); // Start continuous analysis after webcam loads
        };
    } catch (err) {
        console.error("Error accessing webcam:", err);
        outputBox.textContent = `Error: Could not access webcam. Please ensure it's connected and you've granted permission. (${err.name}: ${err.message})`;
        permissionStatus.textContent = 'Error: Camera access denied or not available.';
        startButton.disabled = false;
        stopButton.disabled = true;
        sendPromptButton.disabled = true;
    }
}

function stopWebcam() {
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
        webcamFeed.srcObject = null;
        currentStream = null;
        startButton.disabled = false;
        stopButton.disabled = true;
        sendPromptButton.disabled = true;
        outputBox.textContent = 'Webcam stopped.';
        permissionStatus.textContent = 'Webcam disconnected.';
        clearAnalysisInterval();
    }
}

function clearAnalysisInterval() {
    if (analysisInterval) {
        clearInterval(analysisInterval);
        analysisInterval = null;
        analysisStatus.textContent = '';
    }
    if (analysisTimeout) {
        clearTimeout(analysisTimeout);
        analysisTimeout = null;
        analysisStatus.textContent = '';
    }
}

// --- Frame Capture & Analysis ---
function captureFrame() {
    if (!webcamFeed.videoWidth || !webcamFeed.videoHeight) {
        console.warn("Video feed not ready for capture.");
        return null;
    }
    // Set canvas dimensions to match video feed
    captureCanvas.width = webcamFeed.videoWidth;
    captureCanvas.height = webcamFeed.videoHeight;
    // Draw the current video frame onto the canvas
    context.drawImage(webcamFeed, 0, 0, captureCanvas.width, captureCanvas.height);
    // Get the image data as a Base64 encoded JPEG
    return captureCanvas.toDataURL('image/jpeg', 0.8); // 0.8 is JPEG quality
}

async function performAnalysis() {
    const imageData = captureFrame();
    if (!imageData) {
        outputBox.textContent = "Could not capture frame. Is webcam running?";
        return;
    }

    const promptText = promptInput.value.trim();
    if (promptText === "") {
        // Default prompt if user doesn't enter one
        promptInput.value = "Describe what you see in the video. List objects, scenes, and actions.";
        // Recursively call with the now-set default prompt
        return performAnalysis();
    }

    analysisStatus.textContent = "Analyzing...";
    outputBox.textContent = "Sending frame to AI for analysis...";
    await new Promise(resolve => setTimeout(resolve, 20000)); // Wait 20 seconds
    sendPromptButton.disabled = true;

    try {
        // --- IMPORTANT: This URL points to your backend ---
        const backendUrl = 'http://localhost:3000/analyze-video'; // Adjust if your backend is different

        const response = await fetch(backendUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ image: imageData, prompt: promptText }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Backend error: ${response.status} - ${errorData.message || 'Unknown error'}`);
        }

        const data = await response.json();
        outputBox.textContent = data.description || "No description received from AI.";
        analysisStatus.textContent = `Last analysis: ${new Date().toLocaleTimeString()}`;

    } catch (error) {
        console.error("Error during analysis:", error);
        outputBox.textContent = `Analysis failed: ${error.message}. Make sure your backend server is running and accessible.`;
        analysisStatus.textContent = `Analysis failed.`;
    } finally {
        sendPromptButton.disabled = false; // Re-enable button after analysis
    }
}

function startAnalysisPolling() {
    clearAnalysisInterval();
    async function analysisLoop() {
        if (!currentStream) return;
        if (!isAnalyzing) {
            isAnalyzing = true;
            await performAnalysis();
            isAnalyzing = false;
        }
        let intervalSec = parseInt(waitTimeInput.value, 10);
        if (isNaN(intervalSec) || intervalSec < 1) intervalSec = 20;
        analysisStatus.textContent = `Real-time analysis active (every ${intervalSec}s).`;
        analysisTimeout = setTimeout(analysisLoop, intervalSec * 1000);
    }
    analysisLoop();
}

// --- Initial State ---
window.onload = () => {
    startButton.disabled = false;
    stopButton.disabled = true;
    sendPromptButton.disabled = true;
    outputBox.textContent = 'Click "Start Webcam" to begin.';
};