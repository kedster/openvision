// --- DOM Elements ---
const webcamFeed = document.getElementById('webcamFeed');
const captureCanvas = document.getElementById('captureCanvas');
const context = captureCanvas.getContext('2d');
const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');
const toggleAnalysisButton = document.getElementById('toggleAnalysisButton');
const promptInput = document.getElementById('promptInput');
const sendPromptButton = document.getElementById('sendPromptButton');
const outputBox = document.getElementById('outputBox');
const permissionStatus = document.getElementById('permissionStatus');
const analysisStatus = document.getElementById('analysisStatus');
const analysisIntervalInput = document.getElementById('analysisIntervalInput');
const logTableBody = document.getElementById('logTableBody');
const exportCsvButton = document.getElementById('exportCsvButton');
const clearLogButton = document.getElementById('clearLogButton');

// --- Global Variables ---
let currentStream = null;
let analysisIntervalId = null; // Stores the ID for setInterval
let isAnalysisRunning = false;
let isAnalyzingFrame = false; // Flag to prevent concurrent analysis calls
const MIN_ANALYSIS_INTERVAL_MS = 10000; // Minimum interval for analysis (10 seconds)
const CLOUDFLARE_WORKER_URL = 'YOUR_CLOUDFLARE_WORKER_URL'; // !!! IMPORTANT: REPLACE THIS WITH YOUR WORKER URL !!!
const backendUrl = 'https://api.example.com/analyze-video';

// --- Event Listeners ---
startButton.addEventListener('click', startWebcam);
stopButton.addEventListener('click', stopWebcam);
toggleAnalysisButton.addEventListener('click', toggleAnalysis);
sendPromptButton.addEventListener('click', () => performAnalysis(true)); // True for manual trigger
exportCsvButton.addEventListener('click', exportLogToCSV);
clearLogButton.addEventListener('click', clearLog);
analysisIntervalInput.addEventListener('change', () => {
    // Ensure value is at least MIN_ANALYSIS_INTERVAL_MS / 1000
    let val = parseInt(analysisIntervalInput.value, 10);
    if (isNaN(val) || val < (MIN_ANALYSIS_INTERVAL_MS / 1000)) {
        analysisIntervalInput.value = (MIN_ANALYSIS_INTERVAL_MS / 1000);
    }
    // If analysis is running, restart it with new interval
    if (isAnalysisRunning) {
        toggleAnalysis(); // Stop current
        toggleAnalysis(); // Start with new interval
    }
});

// --- Webcam Functions ---
async function startWebcam() {
    permissionStatus.textContent = 'Requesting camera permission...';
    outputBox.textContent = 'Connecting to webcam...';

    try {
        currentStream = await navigator.mediaDevices.getUserMedia({ video: true });
        webcamFeed.srcObject = currentStream;
        webcamFeed.onloadedmetadata = () => {
            webcamFeed.play();
            startButton.disabled = true;
            stopButton.disabled = false;
            toggleAnalysisButton.disabled = false;
            sendPromptButton.disabled = false;
            permissionStatus.textContent = 'Webcam connected.';
            outputBox.textContent = 'Webcam connected. You can now start real-time analysis or manually analyze a frame.';
            enableExportButton(); // Enable export if log might be filled later
        };
    } catch (err) {
        console.error("Error accessing webcam:", err);
        outputBox.textContent = `Error: Could not access webcam. Please ensure it's connected and you've granted permission. (${err.name}: ${err.message})`;
        permissionStatus.textContent = 'Error: Camera access denied or not available.';
        startButton.disabled = false;
        stopButton.disabled = true;
        toggleAnalysisButton.disabled = true;
        sendPromptButton.disabled = true;
        updateLog("Webcam Error", `Failed to start webcam: ${err.message}`, "N/A", true);
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
        toggleAnalysisButton.disabled = true;
        outputBox.textContent = 'Webcam stopped.';
        permissionStatus.textContent = 'Webcam disconnected.';
        analysisStatus.textContent = 'Analysis: Paused';
        toggleAnalysisButton.textContent = 'Start Analysis';
        stopAnalysis(); // Ensure analysis is stopped
        updateLog("Webcam Control", "Webcam stopped.", "N/A");
    }
}

// --- Analysis Control ---
function toggleAnalysis() {
    if (isAnalysisRunning) {
        stopAnalysis();
        toggleAnalysisButton.textContent = 'Start Analysis';
        toggleAnalysisButton.classList.remove('danger');
        toggleAnalysisButton.classList.add('warning');
        analysisStatus.textContent = 'Analysis: Paused';
        updateLog("Analysis Control", "Real-time analysis paused.", "N/A");
    } else {
        startAnalysis();
        toggleAnalysisButton.textContent = 'Pause Analysis';
        toggleAnalysisButton.classList.remove('warning');
        toggleAnalysisButton.classList.add('danger');
        analysisStatus.textContent = `Analysis: Running (every ${analysisIntervalInput.value}s)`;
        updateLog("Analysis Control", "Real-time analysis started.", "N/A");
    }
}

function startAnalysis() {
    if (!currentStream) {
        outputBox.textContent = "Please start the webcam first to begin analysis.";
        analysisStatus.textContent = 'Analysis: Not started (Webcam off)';
        return;
    }
    stopAnalysis(); // Clear any existing interval first

    const intervalMs = Math.max(parseInt(analysisIntervalInput.value, 10) * 1000, MIN_ANALYSIS_INTERVAL_MS);
    analysisIntervalInput.value = intervalMs / 1000; // Update input to ensure minimum value

    // Perform an immediate analysis upon starting
    performAnalysis(false); // false for auto-triggered

    // Set up the recurring analysis
    analysisIntervalId = setInterval(() => {
        performAnalysis(false); // false for auto-triggered
    }, intervalMs);

    isAnalysisRunning = true;
}

function stopAnalysis() {
    if (analysisIntervalId) {
        clearInterval(analysisIntervalId);
        analysisIntervalId = null;
    }
    isAnalysisRunning = false;
    isAnalyzingFrame = false; // Reset flag
}

// --- Frame Capture & AI Interaction ---
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

async function performAnalysis(isManual = false) {
    if (isAnalyzingFrame) {
        // console.log("Analysis already in progress, skipping frame.");
        // If it's a manual trigger and analysis is ongoing, show a message
        if (isManual) {
            outputBox.textContent = "An analysis is already running. Please wait for it to complete.";
        }
        return;
    }
    if (!currentStream) {
        outputBox.textContent = "Webcam is not active. Please start the webcam.";
        return;
    }

    isAnalyzingFrame = true; // Set flag
    sendPromptButton.disabled = true; // Disable manual button during analysis

    const imageData = captureFrame();
    if (!imageData) {
        outputBox.textContent = "Could not capture frame. Is webcam running and playing?";
        isAnalyzingFrame = false;
        sendPromptButton.disabled = false;
        return;
    }

    let promptText = promptInput.value.trim();
    if (promptText === "") {
        promptText = "Describe the main objects and activities visible in this image. Keep it concise.";
        // Optionally, update the input field to show the default
        // promptInput.value = promptText;
    }

    outputBox.textContent = "Sending frame to AI for analysis...";
    analysisStatus.textContent = isManual ? "Manually Analyzing..." : "Analyzing (auto)...";

    let aiResponse = "No response.";
    try {
        const response = await fetch(CLOUDFLARE_WORKER_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ image: imageData, prompt: promptText }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'No detailed error message from worker.' }));
            throw new Error(`Backend error: ${response.status} - ${errorData.message || 'Unknown error'}`);
        }

        const data = await response.json();
        aiResponse = data.description || "No description received from AI.";
        outputBox.textContent = aiResponse;
        analysisStatus.textContent = isManual ? `Manual analysis done.` : `Analysis: Running (next in ${analysisIntervalInput.value}s)`;

    } catch (error) {
        console.error("Error during analysis:", error);
        aiResponse = `Analysis failed: ${error.message}. Make sure your Cloudflare Worker URL is correct and deployed.`;
        outputBox.textContent = aiResponse;
        analysisStatus.textContent = `Analysis failed.`;
        updateLog(promptText, aiResponse, "Error", true); // Log error
    } finally {
        isAnalyzingFrame = false; // Reset flag
        sendPromptButton.disabled = false; // Re-enable manual button
        updateLog(promptText, aiResponse, isManual ? "Manual" : "Auto");
    }
}

// --- Log Management ---
function updateLog(prompt, response, type, isError = false) {
    const timestamp = new Date().toLocaleString();
    const row = logTableBody.insertRow(0); // Insert at top
    // Add classes for styling (e.g., error rows)
    if (isError) {
        row.classList.add('log-error');
    } else if (type === "Manual") {
        row.classList.add('log-manual');
    }

    const cell1 = row.insertCell(0);
    const cell2 = row.insertCell(1);
    const cell3 = row.insertCell(2);

    cell1.textContent = timestamp;
    cell2.textContent = prompt;
    cell3.textContent = response;

    enableExportButton();
}

function enableExportButton() {
    if (logTableBody.rows.length > 0) {
        exportCsvButton.disabled = false;
    } else {
        exportCsvButton.disabled = true;
    }
}

function clearLog() {
    if (confirm("Are you sure you want to clear all log entries? This action cannot be undone.")) {
        logTableBody.innerHTML = ''; // Clear all rows
        enableExportButton(); // Disable export button
        updateLog("Log Control", "Log cleared.", "N/A");
    }
}

function exportLogToCSV() {
    const rows = logTableBody.querySelectorAll('tr');
    if (rows.length === 0) {
        alert("No log data to export.");
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,";
    const headers = ["Timestamp", "Prompt", "AI Response"];
    csvContent += headers.join(",") + "\r\n";

    rows.forEach(row => {
        const rowData = Array.from(row.cells).map(cell => {
            let text = cell.textContent;
            // Handle commas and quotes in text
            text = text.replace(/"/g, '""'); // Escape double quotes
            if (text.includes(',') || text.includes('\n')) {
                text = `"${text}"`; // Enclose in quotes if it contains commas or newlines
            }
            return text;
        });
        csvContent += rowData.join(",") + "\r\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `ai_vision_log_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link); // Required for Firefox
    link.click();
    document.body.removeChild(link); // Clean up
    updateLog("Log Control", "Log exported to CSV.", "N/A");
}

// --- Initial State ---
window.onload = () => {
    startButton.disabled = false;
    stopButton.disabled = true;
    toggleAnalysisButton.disabled = true;
    sendPromptButton.disabled = true;
    analysisIntervalInput.value = (MIN_ANALYSIS_INTERVAL_MS / 1000); // Set default minimum
    outputBox.textContent = 'Click "Start Webcam" to begin.';
    permissionStatus.textContent = 'Awaiting camera permission...';
    enableExportButton(); // Check initial log state
    updateLog("App Start", "Application loaded.", "N/A");
};