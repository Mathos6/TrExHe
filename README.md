·# TrExHe

**TrExHe** (**Tr**anscribe, **Ex**hausted, **He**ar) is a self-hosted, lightweight PWA designed for students who are too exhausted to listen to and manually transcribe hours of recorded lectures. It automatically converts audio recordings into structured Markdown study notes.

---

## Tech Stack

- **Frontend:** PWA (HTML5 / Vanilla JS / CSS)
- **Backend:** Go (HTTP server & orchestration)
- **Audio Processing:** FFmpeg (Converts audio to 16kHz Mono WAV)
- **Transcription:** `whisper.cpp` 
- **Structuring:** Google Gemini API (Free tier for Markdown formatting)

---

## Prerequisites & Setup

1. **Install dependencies (Debian/Ubuntu):**
   ```bash
   sudo apt update && sudo apt install -y build-essential cmake ffmpeg golang git
	```
		
2. Build whisper.cpp
   ```bash
   cd whisper.cpp
   sh ./models/download-ggml-model.sh small
   cmake -B build
   cmake --build build -j --config Release
   cd ..
   ```


## Quick Start

1. Set your API KEY
   ```bash
   export GEMINI_API_KEY="your_gemini_api_key"
   ```

2. Run the server
   ```bash
   go run main.go
   ```
      
Open http://localhost:8080 in your browser.

