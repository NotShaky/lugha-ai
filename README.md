# Lugha AI

An Arabic language learning app powered by AI. Practice conversations with an AI tutor through text or voice.

## Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Python](https://www.python.org/) (v3.10+)
- [Expo Go](https://expo.dev/go) app on your phone
- A [Groq API key](https://console.groq.com/)

## Getting Started

### 1. Install frontend dependencies

```bash
npm install
```

### 2. Set up the backend

```bash
cd backend
..\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

Create a `.env` file inside the `backend/` folder with your Groq API key:

```
GROQ_API_KEY=your_api_key_here
```

### 3. Start the backend server

The backend **must be running** for the chat to work. Start it before using the app:

```bash
cd backend
..\.venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

> **Tip:** Alternatively, activate the virtual environment first, then run `uvicorn` directly:
> ```bash
> ..\.venv\Scripts\Activate.ps1
> cd backend
> uvicorn main:app --host 0.0.0.0 --port 8001 --reload
> ```

You should see `Application startup complete` in the terminal. Keep this terminal open.

### 4. Start the Expo app

In a **separate terminal**:

```bash
npx expo start
```

Scan the QR code with Expo Go on your phone.

> **Note:** Your phone and computer must be on the same Wi-Fi network. The app auto-detects your local host IP in Expo Go. If needed, you can override it by creating a `.env` file in the project root with:
> ```bash
> EXPO_PUBLIC_BACKEND_URL=http://YOUR_LOCAL_IP:8001
> ```

## Project Structure

- `app/` — Expo Router screens
- `app/(tabs)/index.tsx` — Home tab (chat entry)
- `app/(tabs)/learn.tsx` — Learn tab (all learning sections)
- `app/chat/[id].tsx` — Chat conversation screen
- `backend/` — FastAPI server (Groq AI integration)
- `components/` — Reusable React Native components
- `constants/` — Theme colors and config
