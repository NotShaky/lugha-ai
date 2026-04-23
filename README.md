# Lugha AI

Lugha AI is an Arabic language learning app powered by AI. It combines chat practice, voice input, pronunciation playback, and guided learning content in one Expo app.

## What’s New

- AI chat now supports both typed and spoken input.
- The backend includes speech-to-text, text-to-speech, and conversation history.
- The Learn tab includes Arabic letters, grammar basics, vocabulary sets, sentence patterns, and drills.
- The chat UI can show Arabic corrections and English translations side by side.

## Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Python](https://www.python.org/) (v3.12.10)
- [Expo Go](https://expo.dev/go) on a physical device if you want to test on mobile
- A [Groq API key](https://console.groq.com/)
- Optional: Redis and Supabase credentials if you want persistence and remote storage configured

## Setup

### 1. Install frontend dependencies

```bash
npm install
```

### 2. Install backend dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 3. Configure backend environment variables

Create a `.env` file inside `backend/` and add the keys you need:

```env
GROQ_API_KEY=your_api_key_here
SUPABASE_URL=your_supabase_url_here
SUPABASE_KEY=your_supabase_key_here
REDIS_URL=your_redis_url_here
```

Only `GROQ_API_KEY` is required for the core chat flow. `SUPABASE_URL`, `SUPABASE_KEY`, and `REDIS_URL` are optional.

### 4. Start the backend server

The backend needs to be running before you use chat, voice transcription, or TTS:

```bash
cd backend
..\.venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

If you prefer to use a virtual environment, activate it first and then run the same command.

### 5. Start the Expo app

In a separate terminal:

```bash
npx expo start
```

Scan the QR code with Expo Go on your phone.

> **Note:** Your phone and computer must be on the same Wi-Fi network. The app auto-detects the backend host in Expo Go. If needed, override it by creating a root `.env` file with:
> ```env
> EXPO_PUBLIC_BACKEND_URL=http://YOUR_LOCAL_IP:8001
> ```

## Main Features

- AI conversation practice through the Home and Chat screens
- Voice recording with transcription through the `/transcribe` endpoint
- Arabic and English pronunciation playback through the `/tts` endpoint
- Structured learning content in the Learn tab
- Corrective Arabic replies with English translation output

## Backend Endpoints

- `GET /` - health check
- `POST /chat` - send a chat message to the AI tutor
- `POST /transcribe` - convert recorded audio to text
- `GET /tts` and `POST /tts` - generate spoken Arabic or English audio

## Project Structure

- `app/` - Expo Router screens
- `app/(tabs)/index.tsx` - Home tab and chat entry point
- `app/(tabs)/learn.tsx` - Learn tab with lessons and drills
- `app/(tabs)/profile.tsx` - Profile tab
- `app/chat/[id].tsx` - Chat conversation screen
- `backend/main.py` - FastAPI backend with Groq, transcription, and TTS
- `components/` - Reusable React Native components
- `constants/` - Theme colors and configuration
