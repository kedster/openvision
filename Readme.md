# OpenVision

OpenVision is an enterprise-grade, AI-powered video analysis platform that leverages OpenAI's Vision models to provide real-time insights from webcam or video streams. Designed for extensibility, security, and scalability, OpenVision is suitable for both rapid prototyping and production deployment in demanding environments.

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Technology Stack](#technology-stack)
- [Setup & Installation](#setup--installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [API Reference](#api-reference)
- [Security](#security)
- [Scaling & Deployment](#scaling--deployment)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)
- [Contact](#contact)

---

## Features

- **Real-time Video Analysis**: Analyze webcam frames using OpenAI's Vision models.
- **Customizable Prompts**: Users can ask context-aware questions about the video feed.
- **Throttling & Rate Limiting**: Prevents abuse with per-IP request throttling.
- **Enterprise Security**: CORS, environment variable management, and input validation.
- **Extensible Frontend**: Modular, modern UI for easy integration and customization.
- **Scalable Backend**: Node.js/Express backend ready for containerization and cloud deployment.

---

## Architecture

```
Frontend (HTML/JS) <----HTTP----> Backend (Node.js/Express) <----API----> OpenAI Vision API
```

- **Frontend**: Captures webcam frames, allows prompt input, and displays AI responses.
- **Backend**: Receives frames and prompts, applies throttling, and communicates with OpenAI.
- **OpenAI API**: Processes images and prompts, returns analysis to backend.

---

## Technology Stack

- **Frontend**: HTML5, JavaScript (ES6+), CSS3
- **Backend**: Node.js, Express.js, CORS, dotenv
- **AI Integration**: OpenAI Node.js SDK
- **Security**: Throttling, CORS, environment variables
- **DevOps**: Docker-ready, .env configuration, logging

---

## Setup & Installation

### Prerequisites

- Node.js (v18+ recommended)
- npm (v9+)
- OpenAI API Key (with Vision access)
- (Optional) Docker

### 1. Clone the Repository

```sh
git clone https://github.com/your-org/openvision.git
cd openvision
```

### 2. Backend Setup

```sh
cd Backend
cp .env.example .env
# Edit .env and set your OPENAI_API_KEY
npm install
```

### 3. Frontend Setup

No build step required for vanilla JS. All files are in the `Frontend` directory.

### 4. Start the Backend Server

```sh
cd Backend
npm start
# Or for development with auto-reload:
npm run dev
```

### 5. Serve the Frontend

Open `Frontend/index.html` in your browser, or use a static server:

```sh
cd Frontend
npx serve .
```

---

## Configuration

### Backend `.env` Example

```
OPENAI_API_KEY=sk-...
PORT=3000
```

- **OPENAI_API_KEY**: Your OpenAI API key with Vision access.
- **PORT**: (Optional) Port for the backend server.

### Throttling

- Default: 1 request per 20 seconds per IP (configurable in `Backend/index.js`).

---

## Usage

1. **Start the backend server.**
2. **Open the frontend in your browser.**
3. **Allow camera access.**
4. **Enter a prompt/question about the video.**
5. **Set the analysis interval (minimum 20 seconds).**
6. **Click "Start Webcam" and "Analyze Frame" or enable auto-analysis.**
7. **View AI-generated analysis in the output box.**

---

## API Reference

### POST `/analyze-video`

**Request Body:**
```json
{
  "image": "data:image/jpeg;base64,...",
  "prompt": "Describe the scene."
}
```

**Response:**
```json
{
  "description": "The image shows a person sitting at a desk with a laptop."
}
```

**Errors:**
- `400`: Missing image or prompt data.
- `429`: Too many requests (throttled).
- `500`: Internal server error.

---

## Security

- **CORS**: Enabled for all origins (adjust for production).
- **Throttling**: Per-IP, configurable.
- **Environment Variables**: Sensitive keys are never hardcoded.
- **Input Validation**: Ensures required fields are present.

---

## Scaling & Deployment

- **Stateless Backend**: Suitable for containerization (Docker, Kubernetes).
- **Horizontal Scaling**: Use a distributed cache (e.g., Redis) for throttling in multi-instance deployments.
- **HTTPS**: Strongly recommended for production.
- **Frontend**: Can be served from any static file host or CDN.

---

## Troubleshooting

- **429 Errors**: Lower your analysis frequency to match backend throttle.
- **CORS Issues**: Adjust CORS settings in `Backend/index.js`.
- **OpenAI Errors**: Ensure your API key is valid and has Vision access.
- **Webcam Not Working**: Check browser permissions and HTTPS.

---

## Contributing

1. Fork the repo and create your feature branch.
2. Commit your changes with clear messages.
3. Push to your branch and open a pull request.
4. Ensure all code is linted and tested.

---

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

---

## Contact

- **Enterprise Support**: support@yourcompany.com
- **General Inquiries**: info@yourcompany.com
- **GitHub Issues**: [Open an issue](https://github.com/your-org/openvision/issues)

---