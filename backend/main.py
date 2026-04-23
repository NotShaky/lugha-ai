from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import shutil
from typing import Optional
import openai
from groq import Groq
from dotenv import load_dotenv
from pathlib import Path
import edge_tts
import asyncio
import uuid
from typing import Optional, List 

# Load .env from the same directory as main.py
env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)

app = FastAPI()

# Allow CORS for development
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
    history: List[HistoryMessage] = [] # Allow frontend to pass history

class TTSRequest(BaseModel):
    text: str
    voice: str = "ar-SA-HamedNeural"

# Groq Configuration
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

# Debugging: Print status of API Key
if GROQ_API_KEY:
    print("✅ Groq API Key loaded successfully.")
    client = Groq(api_key=GROQ_API_KEY)
else:
    print(f"❌ Groq API Key NOT found in {env_path}")
    client = None

@app.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    """
    Receives an audio file and transcribes it using Groq Whisper.
    Leaves the AI reply generation to the /chat endpoint!
    """
    temp_filename = f"temp_{file.filename}"
    
    try:
        # 1. Save the uploaded file temporarily
        with open(temp_filename, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        print(f"Received file: {temp_filename}")

        # 2. Call Groq Whisper API if key exists
        if client:
            try:
                # Transcribe Audio
                audio_file = open(temp_filename, "rb")
                transcript = client.audio.transcriptions.create(
                    model="whisper-large-v3", 
                    file=audio_file,
                )
                print(f"Transcription: {transcript.text}")

                # Return ONLY the transcribed text so the frontend can send it to /chat
                return {"text": transcript.text}

            except Exception as e:
                print(f"Groq Error: {e}")
                # Return the actual error to the frontend for debugging
                return {"text": f"Error from Groq: {str(e)}"}
        else:
             # MOCK RESPONSE for demonstration/testing without key
            mock_text = "أريد قهوة من فضلك (Mock: Add Groq Key)"
            return {"text": mock_text}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
        
    finally:
        # 3. Cleanup: Delete the temp file
        if os.path.exists(temp_filename):
            audio_file.close() if 'audio_file' in locals() and not audio_file.closed else None
            os.remove(temp_filename)

@app.post("/chat")
async def chat_endpoint(request: ChatRequest):
    print(f"Received chat request: {request.text}")
    if not client:
        print("Error: Client not initialized")
        return {"reply": "Error: Groq API Key missing."}

    try:
        print("Calling Groq API...")
        
        # 1. Start with the System Prompt
        api_messages = [
            {
                "role": "system",
                "content": "You are a helpful and friendly Arabic language tutor. The user may write in Arabic, English, or a mix of both. If the user writes in English (e.g. asking how to say something in Arabic), respond helpfully with the Arabic translation, pronunciation guidance, and explanation. If the user writes in Arabic and makes any grammar, spelling, or vocabulary mistakes, first correct them by writing: \"✏️ Correction: [corrected version]\" with a brief explanation of the mistake. Then reply normally in Arabic to continue the conversation. Keep your answers concise. After your Arabic response, always add an English translation on a new line in parentheses, like: (English: ...)"
            }
        ]
        
        # 2. Append the conversation history from the frontend
        for msg in request.history:
            api_messages.append({
                "role": msg.role,
                "content": msg.content
            })
            
        # 3. Append the newest user message
        api_messages.append({
            "role": "user",
            "content": request.text
        })

        chat_completion = client.chat.completions.create(
            messages=api_messages,
            model="llama-3.3-70b-versatile",
        )
        reply = chat_completion.choices[0].message.content or "No content in response (None)."
        print(f"Success! Reply: {reply}")
        return {"reply": reply}
    except Exception as e:
        print(f"Backend Exception: {e}")
        return {"reply": f"Error: {str(e)}"}

@app.get("/")
def read_root():
    return {"message": "Lugha AI Backend is running"}

# Available Arabic voices:
# ar-SA-HamedNeural (Saudi male) - clear, natural
# ar-SA-ZariyahNeural (Saudi female)
# ar-EG-ShakirNeural (Egyptian male)
# ar-EG-SalmaNeural (Egyptian female)

@app.post("/tts")
async def text_to_speech(request: TTSRequest):
    """Convert Arabic text to speech using Microsoft Edge TTS."""
    temp_file = f"tts_{uuid.uuid4().hex}.mp3"
    try:
        communicate = edge_tts.Communicate(request.text, request.voice, rate="-10%")
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

@app.get("/tts")
async def text_to_speech_get(text: str, voice: str = "ar-SA-HamedNeural"):
    """GET version for native audio players that can't POST."""
    temp_file = f"tts_{uuid.uuid4().hex}.mp3"
    try:
        communicate = edge_tts.Communicate(text, voice, rate="-10%")
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
