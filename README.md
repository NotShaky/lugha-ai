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

> **Note:** Your phone and computer must be on the same Wi-Fi network. If you change networks, update `BACKEND_URL` in `app/chat/[id].tsx` with your new local IP address.

## Project Structure

- `app/` — Expo Router screens (tabs, chat)
- `backend/` — FastAPI server (Groq AI integration)
- `components/` — Reusable React Native components
- `constants/` — Theme colors and config
