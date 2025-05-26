// Configuration - REPLACE WITH YOUR CLOUDFLARE WORKER URL
const WORKER_URL = 'https://backend.openvision.quiktek.net';

// DOM Elements
const webcamFeed = document.getElementById('webcamFeed');
const captureCanvas = document.getElementById('captureCanvas');
const statusOverlay = document.getElementById('statusOverlay');
const statusText = document.getElementById('statusText');
const loadingSpinner = document.getElementById('loadingSpinner');
const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');
const toggleAnalysisButton = document.getElementById('toggleAnalysisButton');
const analyzeNowButton = document.getElementById('analyzeNowButton');
const analysisInterval = document.getElementById('analysisInterval');
const cameraStatus = document.getElementById('cameraStatus');
const analysisStatus = document.getElementById('analysisStatus');
const primaryPrompt = document.getElementById('primaryPrompt');
const secondaryPrompt = document.getElementById('secondaryPrompt');
const responsesList = document.getElementById('responsesList');
const exportButton = document.getElementById('exportButton');
const clearButton = document.getElementById('clearButton');

// State
let currentStream = null;
let analysisIntervalId = null;
let isAnalysisRunning = false;
let isAnalyzing = false;
let responses = [];

// Event Listeners
startButton.addEventListener('click', startCamera);
stopButton.addEventListener('click', stopCamera);
toggleAnalysisButton.addEventListener('click', toggleAutoAnalysis);
analyzeNowButton.addEventListener('click', analyzeNow);
exportButton.addEventListener('click', exportToCSV);
clearButton.addEventListener('click', clearHistory);

// Camera Functions
async function startCamera() {
    try {
        statusText.textContent = 'Requesting camera permission...';
        loadingSpinner.style.display = 'block';

        currentStream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: 'user'
            } 
        });

        webcamFeed.srcObject = currentStream;
        
        webcamFeed.onloadedmetadata = () => {
            webcamFeed.play();
            statusOverlay.classList.add('hidden');
            
            // Update UI
            startButton.disabled = true;
            stopButton.disabled = false;
            toggleAnalysisButton.disabled = false;
            analyzeNowButton.disabled = false;
            
            cameraStatus.textContent = 'Camera: Connected';
            loadingSpinner.style.display = 'none';
        };

    } catch (error) {
        console.error('Camera error:', error);
        statusText.textContent = `Camera error: ${error.message}`;
        loadingSpinner.style.display = 'none';
        cameraStatus.textContent = `Camera: Error - ${error.message}`;
    }
}

function stopCamera() {
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
        webcamFeed.srcObject = null;
        currentStream = null;
    }

    stopAutoAnalysis();
    
    // Update UI
    statusOverlay.classList.remove('hidden');
    statusText.textContent = 'Click "Start Camera" to begin';
    startButton.disabled = false;
    stopButton.disabled = true;
    toggleAnalysisButton.disabled = true;
    analyzeNowButton.disabled = true;
    
    cameraStatus.textContent = 'Camera: Disconnected';
    analysisStatus.textContent = 'Analysis: Stopped';
}

// Analysis Functions
function toggleAutoAnalysis() {
    if (isAnalysisRunning) {
        stopAutoAnalysis();
    } else {
        startAutoAnalysis();
    }
}

function startAutoAnalysis() {
    if (!currentStream) return;

    const intervalSeconds = Math.max(parseInt(analysisInterval.value), 10);
    analysisInterval.value = intervalSeconds;

    // Immediate analysis
    analyzeFrame(false);

    // Set up recurring analysis
    analysisIntervalId = setInterval(() => {
        analyzeFrame(false);
    }, intervalSeconds * 1000);

    isAnalysisRunning = true;
    toggleAnalysisButton.textContent = 'Stop Auto Analysis';
    toggleAnalysisButton.classList.remove('warning');
    toggleAnalysisButton.classList.add('danger');
    analysisStatus.textContent = `Analysis: Auto (every ${intervalSeconds}s)`;
}

function stopAutoAnalysis() {
    if (analysisIntervalId) {
        clearInterval(analysisIntervalId);
        analysisIntervalId = null;
    }

    isAnalysisRunning = false;
    toggleAnalysisButton.textContent = 'Start Auto Analysis';
    toggleAnalysisButton.classList.remove('danger');
    toggleAnalysisButton.classList.add('warning');
    analysisStatus.textContent = 'Analysis: Stopped';
}

function analyzeNow() {
    if (!isAnalyzing) {
        analyzeFrame(true);
    }
}

function captureFrame() {
    if (!webcamFeed.videoWidth || !webcamFeed.videoHeight) {
        return null;
    }

    captureCanvas.width = webcamFeed.videoWidth;
    captureCanvas.height = webcamFeed.videoHeight;
    
    const context = captureCanvas.getContext('2d');
    context.drawImage(webcamFeed, 0, 0, captureCanvas.width, captureCanvas.height);
    
    return captureCanvas.toDataURL('image/jpeg', 0.8);
}

async function analyzeFrame(isManual) {
    if (isAnalyzing) {
        if (isManual) {
            alert('Analysis already in progress. Please wait...');
        }
        return;
    }

    // Validate prompts
    const primaryPromptText = primaryPrompt.value.trim();
    const secondaryPromptText = secondaryPrompt.value.trim();
    
    if (!primaryPromptText || !secondaryPromptText) {
        alert('Both primary and secondary prompts are required for dual analysis.');
        return;
    }

    isAnalyzing = true;
    
    // Update UI
    analyzeNowButton.disabled = true;
    if (isManual) {
        analysisStatus.textContent = 'Analysis: Processing dual analysis (manual)...';
    } else {
        analysisStatus.textContent = 'Analysis: Processing dual analysis (auto)...';
    }

    try {
        const imageData = captureFrame();
        if (!imageData) {
            throw new Error('Could not capture frame');
        }

        console.log('Sending request to:', WORKER_URL);
        console.log('Request payload:', {
            primaryPrompt: primaryPromptText,
            secondaryPrompt: secondaryPromptText,
            hasImage: !!imageData
        });

        const response = await fetch(WORKER_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                image: imageData,
                primaryPrompt: primaryPromptText,
                secondaryPrompt: secondaryPromptText
            }),
        });

        console.log('Response status:', response.status);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `HTTP ${response.status}`);
        }

        const data = await response.json();
        console.log('Response data:', data);
        
        // Validate response structure
        if (!data.primaryResponse) {
            throw new Error('Invalid response: missing primaryResponse');
        }

        // Add to responses
        const responseEntry = {
            timestamp: new Date().toLocaleString(),
            primaryPrompt: primaryPromptText,
            secondaryPrompt: secondaryPromptText,
            primaryResponse: data.primaryResponse,
            secondaryResponse: data.secondaryResponse || 'No secondary response',
            isManual: isManual
        };

        responses.unshift(responseEntry);
        updateResponsesDisplay();
        enableExport();

        console.log('Analysis completed successfully');

    } catch (error) {
        console.error('Analysis error:', error);
        
        const errorEntry = {
            timestamp: new Date().toLocaleString(),
            primaryPrompt: primaryPromptText,
            secondaryPrompt: secondaryPromptText,
            primaryResponse: `Error: ${error.message}`,
            secondaryResponse: 'Analysis failed',
            isManual: isManual,
            isError: true
        };

        responses.unshift(errorEntry);
        updateResponsesDisplay();
    } finally {
        isAnalyzing = false;
        analyzeNowButton.disabled = false;
        
        if (isAnalysisRunning) {
            const intervalSeconds = parseInt(analysisInterval.value);
            analysisStatus.textContent = `Analysis: Auto (every ${intervalSeconds}s)`;
        } else {
            analysisStatus.textContent = 'Analysis: Stopped';
        }
    }
}

function updateResponsesDisplay() {
    if (responses.length === 0) {
        responsesList.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #6c757d;">
                No analyses yet. Start the camera and begin analysis to see results here.
            </div>
        `;
        return;
    }

    responsesList.innerHTML = responses.map((response, index) => `
        <div class="response-entry ${response.isError ? 'error' : ''}" data-index="${index}">
            <div class="response-header">
                <span class="timestamp">${response.timestamp}</span>
                <span class="analysis-type">${response.isManual ? 'Manual' : 'Auto'} Analysis</span>
                ${response.isError ? '<span class="error-badge">ERROR</span>' : ''}
                <button class="copy-btn" onclick="copyResponse(${index})" title="Copy this analysis">📋</button>
            </div>
            
            <div class="analysis-section">
                <div class="prompt-section">
                    <div class="response-label">Primary Prompt:</div>
                    <div class="prompt-text">${escapeHtml(response.primaryPrompt)}</div>
                </div>
                <div class="primary-response">
                    <div class="response-label">Primary Analysis:</div>
                    <div class="response-text" onclick="copyText(this)" title="Click to copy">${escapeHtml(response.primaryResponse)}</div>
                </div>
            </div>
            
            <div class="analysis-section secondary">
                <div class="prompt-section">
                    <div class="response-label">Follow-up Prompt:</div>
                    <div class="prompt-text">${escapeHtml(response.secondaryPrompt)}</div>
                </div>
                <div class="secondary-response">
                    <div class="response-label">Follow-up Analysis:</div>
                    <div class="response-text" onclick="copyText(this)" title="Click to copy">${escapeHtml(response.secondaryResponse)}</div>
                </div>
            </div>
        </div>
    `).join('');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function copyText(element) {
    const text = element.textContent;
    navigator.clipboard.writeText(text).then(() => {
        // Visual feedback
        const original = element.style.backgroundColor;
        element.style.backgroundColor = '#d4edda';
        setTimeout(() => {
            element.style.backgroundColor = original;
        }, 500);
    }).catch(err => {
        console.error('Failed to copy text:', err);
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
    });
}

function copyResponse(index) {
    const response = responses[index];
    const text = `
Timestamp: ${response.timestamp}
Type: ${response.isManual ? 'Manual' : 'Auto'} Analysis

Primary Prompt: ${response.primaryPrompt}
Primary Response: ${response.primaryResponse}

Secondary Prompt: ${response.secondaryPrompt}
Secondary Response: ${response.secondaryResponse}
    `.trim();
    
    navigator.clipboard.writeText(text).then(() => {
        const btn = document.querySelector(`[data-index="${index}"] .copy-btn`);
        const original = btn.textContent;
        btn.textContent = '✅';
        setTimeout(() => {
            btn.textContent = original;
        }, 1000);
    }).catch(err => {
        console.error('Failed to copy response:', err);
    });
}

function enableExport() {
    exportButton.disabled = responses.length === 0;
}

function exportToCSV() {
    if (responses.length === 0) {
        alert('No data to export');
        return;
    }

    const headers = [
        'Timestamp', 
        'Type', 
        'Primary Prompt', 
        'Primary Response', 
        'Secondary Prompt', 
        'Secondary Response',
        'Status'
    ];
    const csvData = [headers];

    responses.forEach(response => {
        csvData.push([
            response.timestamp,
            response.isManual ? 'Manual' : 'Auto',
            response.primaryPrompt,
            response.primaryResponse,
            response.secondaryPrompt,
            response.secondaryResponse,
            response.isError ? 'Error' : 'Success'
        ]);
    });

    const csvContent = csvData.map(row => 
        row.map(field => `"${String(field).replace(/"/g, '""')}"`)
           .join(',')
    ).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-vision-dual-analysis-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
}

function clearHistory() {
    if (confirm('Clear all analysis history? This cannot be undone.')) {
        responses = [];
        updateResponsesDisplay();
        enableExport();
    }
}

// Initialize
enableExport();