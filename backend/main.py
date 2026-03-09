from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import shutil
from typing import Optional
import openai
from groq import Groq
from dotenv import load_dotenv
from pathlib import Path

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

class ChatRequest(BaseModel):
    text: str

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
                # 2. Transcribe Audio
                audio_file = open(temp_filename, "rb")
                transcript = client.audio.transcriptions.create(
                    model="whisper-large-v3", 
                    file=audio_file,
                )
                print(f"Transcription: {transcript.text}")

                # 3. Generate AI Response (Llama 3)
                chat_completion = client.chat.completions.create(
                    messages=[
                        {
                            "role": "system",
                            "content": "You are a helpful and friendly Arabic language tutor. The user may speak in Arabic, English, or a mix of both. If the user speaks in English (e.g. asking how to say something in Arabic), respond helpfully with the Arabic translation, pronunciation guidance, and explanation. If the user speaks in Arabic and makes any grammar, spelling, or vocabulary mistakes, first correct them by writing: \"✏️ Correction: [corrected version]\" with a brief explanation of the mistake. Then reply normally in Arabic to continue the conversation. Keep your answers concise. After your Arabic response, always add an English translation on a new line in parentheses, like: (English: ...)"
                        },
                        {
                            "role": "user",
                            "content": transcript.text,
                        }
                    ],
                    model="llama-3.3-70b-versatile",
                )
                reply = chat_completion.choices[0].message.content
                print(f"AI Reply: {reply}")

                return {
                    "text": transcript.text,
                    "reply": reply
                }
            except Exception as e:
                print(f"Groq Error: {e}")
                # Return the actual error to the frontend for debugging
                return {"text": f"Error from Groq: {str(e)}", "reply": "Error generating reply."}
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
        chat_completion = client.chat.completions.create(
            messages=[
                {
                    "role": "system",
                    "content": "You are a helpful and friendly Arabic language tutor. The user may write in Arabic, English, or a mix of both. If the user writes in English (e.g. asking how to say something in Arabic), respond helpfully with the Arabic translation, pronunciation guidance, and explanation. If the user writes in Arabic and makes any grammar, spelling, or vocabulary mistakes, first correct them by writing: \"✏️ Correction: [corrected version]\" with a brief explanation of the mistake. Then reply normally in Arabic to continue the conversation. Keep your answers concise. After your Arabic response, always add an English translation on a new line in parentheses, like: (English: ...)"
                },
                {
                    "role": "user",
                    "content": request.text,
                }
            ],
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
