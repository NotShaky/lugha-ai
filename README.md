# Lugha AI

**What the software does:** Lugha AI is an interactive Arabic language learning application powered by AI. It provides scenario-based roleplay, personalized adaptive drills, pronunciation feedback, and competitive leaderboards to help users master Arabic conversational skills.

## Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Python](https://www.python.org/) (v3.12.10)
- [Expo Go](https://expo.dev/go) on a physical device to test on mobile
- A [Groq API key](https://console.groq.com/)
- A [Supabase] project for auth and profile stats

## Setup

### 1. Install frontend dependencies

```bash
npm install
```

### 2. Setup Backend (Python)

```bash
cd backend

# Create a virtual environment inside the backend folder
python -m venv venv

# Activate the virtual environment
# On Windows:
.\venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Configure backend environment variables

Copy `backend/.env.example` to `backend/.env` and fill in your own values:

```env
GROQ_API_KEY=your_api_key_here
SUPABASE_URL=https://kpncjxfyzfgtxsyrrnbc.supabase.co
SUPABASE_KEY=sb_publishable_2b677eiHDDHLCxOVFTrKqg_7T11eOo7 
```

### 4. Start the backend server

The backend needs to be running before you use chat, voice transcription, or TTS:

```bash
cd backend
python -m uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

### 5. Start the Expo app

In a separate terminal:

```bash
npx expo start
```

Scan the QR code with Expo Go on your phone.

Your phone and computer must be on the same Wi-Fi network. If needed, override the backend host by creating a root `.env` file with:

```env
EXPO_PUBLIC_BACKEND_URL=http://YOUR_LOCAL_IP:8001
```

## Core Features

- **AI Conversation Practice & Roleplay:** Engage in open-ended chats or structured scenarios (e.g. at the airport, at a restaurant) with an AI tutor.
- **Scenario Drill Packs & Adaptive Mastery:** Complete structured drills to earn XP. Failing drills logs mistakes which are then used to dynamically generate a personalized "Adaptive Mastery Pack".
- **Pronunciation Analysis:** Speak Arabic into the microphone and receive a 0-100 pronunciation score with visual feedback highlighting exact mispronounced letters in red.
- **Interactive Flashcards:** Smooth 3D-flipping vocabulary cards with native TTS pronunciation playback.
- **Leaderboard & Progress Tracking:** Compete with others for the most XP with a top 3 podium, while tracking personal streaks and activity.
- **Voice Transcription & TTS:** Whisper-powered Arabic/English transcription with filtering to keep outputs within Arabic/English, plus native-sounding Text-to-Speech (TTS).
- **Auto-Corrections:** AI tutor actively corrects grammar mistakes in a collapsible UI bubble while maintaining conversation flow.

## Recent Behavior Notes

- **Persistent general chat session:** The main chat now uses a stable chat ID so history retrieval is more consistent across app restarts.
- **Audio-aware chat responses:** Messages coming from voice transcription are tagged so the backend can tailor Arabic formatting and response style when appropriate.
- **Greeting flow tuning:** The tutor is tuned to keep greeting order clearer and avoid over-correcting common valid greeting variants.

## Backend Endpoints

- `GET /` - health check
- `POST /chat` - send a chat message to the AI tutor
- `POST /transcribe` - convert recorded audio to text
- `GET /tts` and `POST /tts` - generate spoken Arabic or English audio

## Progress Tracking

- Chat practice awards XP when the AI responds.
- Drill mode also awards XP when the user answers correctly.
- The Profile tab shows total XP, streak, and the last 7 active days.
- Activity days are recorded when progress is awarded and when the Profile tab is opened.

## Project Structure

- `app/` - Expo Router screens
- `app/(tabs)/index.tsx` - Home tab and chat entry point
- `app/(tabs)/learn.tsx` - Learn tab with interactive flashcards
- `app/(tabs)/leaderboard.tsx` - Leaderboard tab querying user ranks
- `app/(tabs)/profile.tsx` - Profile tab with streaks and 7-day charts
- `app/chat/[id].tsx` - Core chat UI including drill logic and pronunciation UI
- `utils/progress.ts` - XP, streak, and error-logging logic
- `backend/main.py` - FastAPI backend powering LLM endpoints and TTS

## Test Credentials

The app uses Supabase for authentication. You can sign up with any test email and password on the login screen. Supabase will send a confirmation email
- **Demo test user:** `test@lugha.ai` / `test123`

## Known Limitations

- **Simulated Pronunciation Analysis:** True waveform-based phonetic grading is highly complex and requires specialized ML models (like speech-assessment models). To achieve a robust experience, Lugha AI simulates this by transcribing your speech via Whisper and then using an LLM to perform letter-by-letter phonetic comparison against the expected text. While effective for learning, it relies on the accuracy of the underlying transcription.
- **Free-Tier API Reliability (Groq/Whisper):** This project currently relies on free-tier API access for parts of speech-to-text and response generation. As a result, transcription quality can occasionally miss or mishear words, and in some cases the assistant may produce a less accurate reply than expected.
- **No Root Morphology Features Implemented Yet:** This version does not include Arabic root extraction, pattern analysis, or morphology dictionary integration. This feature was out of scope for the current build due to time and resource constraints.
- **Same-Network Requirement for Local Testing:** When running the backend locally and testing on a physical device (Expo Go), the phone must be on the same Wi-Fi network as the host machine. If not, the app cannot reach local endpoints (chat, transcription, TTS) unless the backend is deployed to a public URL.
- **Cloud Latency:** Because STT, TTS, and LLM completions are processed through external APIs (Groq and Edge TTS), poor network connections can lead to slower response times.
- **Supabase Realtime Sync:** Local UI state is used optimistically for chat history to prevent race conditions while Supabase syncs in the background.

