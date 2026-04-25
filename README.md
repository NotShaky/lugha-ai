# Lugha AI.

Lugha AI is an Arabic language learning app powered by AI. It combines chat practice, voice input, pronunciation playback, and guided learning content in one Expo app.

## Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Python](https://www.python.org/) (v3.12.10)
- [Expo Go](https://expo.dev/go) on a physical device if you want to test on mobile
- A [Groq API key](https://console.groq.com/)
- A Supabase project for auth and profile stats

## Setup

### 1. Install frontend dependencies

```bash
npm install
```

### 2. Setup Backend (Python)

It is recommended to use a virtual environment:

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

Only `GROQ_API_KEY` is required for the core chat flow. `SUPABASE_URL` and `SUPABASE_KEY` are optional for backend features.

### 4. Start the backend server

The backend needs to be running before you use chat, voice transcription, or TTS:

```bash
cd backend
# If venv is active, just run:
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

## Main Features

- Email/password auth with a combined Sign In / Create Account flow
- AI conversation practice through the Home and Chat screens
- Voice recording with transcription through the `/transcribe` endpoint
- Arabic and English pronunciation playback through the `/tts` endpoint
- Structured learning content in the Learn tab
- Corrective Arabic replies with English translation output
- XP and streak tracking saved to Supabase profiles
- A 7-day activity chart on the Profile tab

## Backend Endpoints

- `GET /` - health check
- `POST /chat` - send a chat message to the AI tutor
- `POST /transcribe` - convert recorded audio to text
- `GET /tts` and `POST /tts` - generate spoken Arabic or English audio

## Progress Tracking

- Chat practice awards XP when the AI responds successfully.
- Drill mode also awards XP when the user answers correctly.
- The Profile tab shows total XP, streak, and the last 7 active days.
- Activity days are recorded when progress is awarded and when the Profile tab is opened.

## Project Structure

- `app/` - Expo Router screens
- `app/(tabs)/index.tsx` - Home tab and chat entry point
- `app/(tabs)/learn.tsx` - Learn tab with lessons and drills
- `app/(tabs)/profile.tsx` - Profile tab
- `app/chat/[id].tsx` - Chat conversation screen
- `utils/progress.ts` - XP, streak, and activity tracking helper
- `utils/supabase.ts` - Supabase client configuration
- `backend/main.py` - FastAPI backend with Groq, transcription, and TTS
- `components/` - Reusable React Native components
- `constants/` - Theme colors and configuration
