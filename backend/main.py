import json
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import shutil
from groq import Groq
from dotenv import load_dotenv
from pathlib import Path
import edge_tts
import asyncio
import uuid
from typing import Optional, List 
from supabase import create_client, Client
import redis

env_path = os.path.join(os.path.dirname(__file__), ".env")
load_dotenv(dotenv_path=env_path)

app = FastAPI()

# Allow the Expo app to call the backend during development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class HistoryMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    text: str
    session_id: str

class TTSRequest(BaseModel):
    text: str
    voice: str = "ar-SA-HamedNeural"
    rate: str = "-10%"
    pitch: str = "+0Hz"

# External service configuration.
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None

if GROQ_API_KEY:
    print("Groq API Key loaded successfully.")
    client = Groq(api_key=GROQ_API_KEY)
else:
    print(f"Groq API Key NOT found in {env_path}")
    client = None

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase: Client | None = None
if SUPABASE_URL and SUPABASE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    print("Supabase Connected.")

REDIS_URL = os.getenv("REDIS_URL")
redis_client = None
if REDIS_URL:
    redis_client = redis.from_url(REDIS_URL, decode_responses=True)
    print("Redis Connected.")

# Prompt tuned for Arabic tutoring, corrections, and concise replies.
SYSTEM_PROMPT = """You are a helpful and friendly Arabic language tutor. The user may write in Arabic, English, or a mix of both. You must ONLY use English and Arabic in your responses. NEVER use any other languages.
NEVER repeat the same sentence, phrase, or word breakdown multiple times in a row. Do not get stuck in repetitive loops.
If the user asks about an Arabic slang word (like Egyptian slang), explain its meaning in English clearly without necessarily trying to correct it to formal Arabic.
If the user writes in English, provide the Arabic translation, and then provide a helpful breakdown in English explaining what the individual Arabic words mean.
Do NOT include transliteration by default. Use Arabic script directly in normal replies.
Only include transliteration if the user explicitly asks for pronunciation/transliteration, or if a single keyword is likely hard to read; in that case, include at most 1-2 transliterations total in the format: Arabic {Transliteration}. NEVER transliterate full sentences.
If the user writes in Arabic, carefully evaluate it for mistakes. IF AND ONLY IF there is an actual grammar, spelling, or vocabulary mistake, your VERY FIRST LINE must be exactly: "✏️ Correction: [corrected Arabic] - [Brief English explanation of the mistake]". 
If the user's Arabic is perfectly correct, DO NOT output a correction line at all.
Make sure there is a blank line after the correction (if you made one). Then, reply normally in Arabic to continue the conversation. Keep your conversational answers concise. 
Finally, add an English translation of ONLY your conversational reply on a new line in parentheses, exactly like: "(English: [translation of the Arabic reply])"."""

# Transcribe uploaded speech into text for the chat screen.
@app.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    temp_filename = f"temp_{file.filename}"
    
    try:
        with open(temp_filename, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        print(f"Received file: {temp_filename}")

        if client:
            try:
                audio_file = open(temp_filename, "rb")
                transcript = client.audio.transcriptions.create(
                    model="whisper-large-v3", 
                    file=audio_file,
                    prompt="The user is speaking either English or Arabic (العربية). Please transcribe exactly what they are saying."
                )
                print(f"Transcription: {transcript.text}")

                return {"text": transcript.text}

            except Exception as e:
                print(f"Groq Error: {e}")
                return {"text": f"Error from Groq: {str(e)}"}
        else:
            mock_text = "أريد قهوة من فضلك (Mock: Add Groq Key)"
            return {"text": mock_text}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
        
    finally:
        if os.path.exists(temp_filename):
            audio_file.close() if 'audio_file' in locals() and not audio_file.closed else None
            os.remove(temp_filename)

# Generate the next AI tutoring response.
@app.post("/chat")
async def chat_with_ai(request: ChatRequest):
    if not GROQ_API_KEY:
        raise HTTPException(status_code=500, detail="Groq API key not configured")

    print(f"Calling Groq API for session: {request.session_id}...")
    
    history_key = f"chat_history:{request.session_id}"
    chat_history = []
    
    if redis_client:
        stored_history = redis_client.get(history_key)
        if stored_history:
            chat_history = json.loads(stored_history)
            
    api_messages = [
        {
            "role": "system",
            "content": SYSTEM_PROMPT
        }
    ]
    
    for msg in chat_history:
        api_messages.append(msg)
        
    api_messages.append({
        "role": "user",
        "content": request.text
    })

    chat_completion = client.chat.completions.create(
        messages=api_messages,
        model="llama-3.3-70b-versatile",
        temperature=0.5,
    )
    
    ai_response = chat_completion.choices[0].message.content
    
    if redis_client:
        chat_history.append({"role": "user", "content": request.text})
        chat_history.append({"role": "assistant", "content": ai_response})
        
        chat_history = chat_history[-10:]
        
        redis_client.setex(history_key, 86400, json.dumps(chat_history))

    return {"response": ai_response, "reply": ai_response}

# Health check.
@app.get("/")
def read_root():
    return {"message": "Lugha AI Backend is running"}

# Convert text to spoken audio for the app.
@app.post("/tts")
async def text_to_speech(request: TTSRequest):
    """Convert Arabic text to speech using Microsoft Edge TTS."""
    temp_file = f"tts_{uuid.uuid4().hex}.mp3"
    try:
        communicate = edge_tts.Communicate(
            request.text, 
            request.voice, 
            rate=request.rate, 
            pitch=request.pitch
        )
        await communicate.save(temp_file)
        return FileResponse(
            temp_file,
            media_type="audio/mpeg",
            filename="speech.mp3",
            background=None,
        )
    except Exception as e:
        print(f"TTS Error: {e}")
        if os.path.exists(temp_file):
            os.remove(temp_file)
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        import threading
        def cleanup():
            import time
            time.sleep(5)
            if os.path.exists(temp_file):
                os.remove(temp_file)
        threading.Thread(target=cleanup, daemon=True).start()

# GET version for native audio players.
@app.get("/tts")
async def text_to_speech_get(
    text: str, 
    voice: str = "ar-SA-HamedNeural",
    rate: str = "-10%",
    pitch: str = "+0Hz"
):
    """GET version for native audio players that can't POST."""
    temp_file = f"tts_{uuid.uuid4().hex}.mp3"
    try:
        communicate = edge_tts.Communicate(
            text, 
            voice, 
            rate=rate, 
            pitch=pitch
        )
        await communicate.save(temp_file)
        return FileResponse(
            temp_file,
            media_type="audio/mpeg",
            filename="speech.mp3",
            background=None,
        )
    except Exception as e:
        print(f"TTS Error: {e}")
        if os.path.exists(temp_file):
            os.remove(temp_file)
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        import threading
        def cleanup():
            import time
            time.sleep(5)
            if os.path.exists(temp_file):
                os.remove(temp_file)
        threading.Thread(target=cleanup, daemon=True).start()
