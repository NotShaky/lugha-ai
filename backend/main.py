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
import re
from typing import Any, Optional, List
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
    user_id: str  

class TTSRequest(BaseModel):
    text: str
    voice: str = "ar-SA-HamedNeural"
    rate: str = "-10%"
    pitch: str = "+0Hz"


class AdaptiveDrillsRequest(BaseModel):
    user_id: str
    drill_set: Optional[str] = None
    count: int = 3

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


def _strip_json_code_fences(raw_text: str) -> str:
    cleaned = raw_text.strip()
    cleaned = re.sub(r"^```(?:json)?\\s*", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\\s*```$", "", cleaned)
    return cleaned.strip()


def _fallback_adaptive_drills(recent_errors: list[dict[str, Any]], count: int) -> dict[str, Any]:
    fallback_drills: list[dict[str, str]] = []

    for row in recent_errors:
        expected = str(row.get("expected_answer") or "").strip()
        prompt = str(row.get("drill_prompt") or "").strip()

        if expected and prompt:
            fallback_drills.append({
                "prompt": f"Try again: {prompt}",
                "answer": expected,
            })

        if len(fallback_drills) >= count:
            break

    if len(fallback_drills) < count:
        defaults = [
            {
                "prompt": "Translate to Arabic: \"Where is the house?\"",
                "answer": "أَيْنَ الْبَيْتُ؟",
            },
            {
                "prompt": "Build in Arabic: \"I have a notebook.\"",
                "answer": "عِنْدِي دَفْتَرٌ",
            },
            {
                "prompt": "Translate to English: هٰذِهِ مَدْرَسَةٌ",
                "answer": "This is a school.",
            },
        ]

        for item in defaults:
            if len(fallback_drills) >= count:
                break
            fallback_drills.append(item)

    return {
        "title": "Adaptive Practice Drills",
        "intro": "These drills focus on your recent weak points.",
        "drills": fallback_drills[:count],
    }


@app.post("/adaptive-drills")
async def generate_adaptive_drills(request: AdaptiveDrillsRequest):
    drill_count = min(max(request.count, 1), 6)

    if not supabase:
        fallback = _fallback_adaptive_drills([], drill_count)
        return {
            **fallback,
            "source": "fallback_no_supabase",
            "error_count": 0,
        }

    try:
        errors_response = (
            supabase
            .table("user_errors")
            .select("drill_prompt, user_input, expected_answer, created_at")
            .eq("user_id", request.user_id)
            .order("created_at", desc=True)
            .limit(15)
            .execute()
        )
        recent_errors = errors_response.data if errors_response.data else []
    except Exception as exc:
        print(f"Failed to fetch user errors for adaptive drills: {exc}")
        recent_errors = []

    if not client:
        fallback = _fallback_adaptive_drills(recent_errors, drill_count)
        return {
            **fallback,
            "source": "fallback_no_llm",
            "error_count": len(recent_errors),
        }

    if not recent_errors:
        fallback = _fallback_adaptive_drills(recent_errors, drill_count)
        return {
            **fallback,
            "source": "fallback_no_errors",
            "error_count": 0,
        }

    condensed_errors = []
    for row in recent_errors:
        drill_prompt = str(row.get("drill_prompt") or "").strip()
        user_input = str(row.get("user_input") or "").strip()
        expected = str(row.get("expected_answer") or "").strip()
        if drill_prompt or expected:
            condensed_errors.append({
                "prompt": drill_prompt,
                "wrong": user_input,
                "expected": expected,
            })

    adaptive_prompt = (
        "You are an Arabic tutoring assistant building targeted practice drills. "
        "Use the user's recent mistakes to generate drills that focus on weak words and structures.\n\n"
        f"Drill set tag: {request.drill_set or 'adaptive'}\n"
        f"Mistakes (latest first): {json.dumps(condensed_errors[:15], ensure_ascii=False)}\n\n"
        f"Generate exactly {drill_count} drills.\n"
        "Return STRICT JSON only with this shape:\n"
        "{\"title\":\"...\",\"intro\":\"...\",\"drills\":[{\"prompt\":\"...\",\"answer\":\"...\"}]}\n"
        "Rules: short prompts, clear expected answer, no markdown, no code fences, no extra keys."
    )

    try:
        completion = client.chat.completions.create(
            messages=[
                {"role": "system", "content": "You output strict JSON only."},
                {"role": "user", "content": adaptive_prompt},
            ],
            model="llama-3.3-70b-versatile",
            temperature=0.3,
        )

        content = completion.choices[0].message.content or ""
        parsed = json.loads(_strip_json_code_fences(content))

        drills_raw = parsed.get("drills") if isinstance(parsed, dict) else None
        title = str(parsed.get("title") or "Adaptive Practice Drills") if isinstance(parsed, dict) else "Adaptive Practice Drills"
        intro = str(parsed.get("intro") or "These drills focus on your recent weak points.") if isinstance(parsed, dict) else "These drills focus on your recent weak points."

        drills: list[dict[str, str]] = []
        if isinstance(drills_raw, list):
            for item in drills_raw:
                if not isinstance(item, dict):
                    continue
                prompt = str(item.get("prompt") or "").strip()
                answer = str(item.get("answer") or "").strip()
                if prompt and answer:
                    drills.append({"prompt": prompt, "answer": answer})
                if len(drills) >= drill_count:
                    break

        if not drills:
            raise ValueError("No valid drills produced by model")

        return {
            "title": title,
            "intro": intro,
            "drills": drills,
            "source": "llm",
            "error_count": len(recent_errors),
        }
    except Exception as exc:
        print(f"Adaptive drill generation failed, using fallback: {exc}")
        fallback = _fallback_adaptive_drills(recent_errors, drill_count)
        return {
            **fallback,
            "source": "fallback_parse_or_generation",
            "error_count": len(recent_errors),
        }

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

    print(f"Fetching permanent history for session: {request.session_id}...")

    # 1. Fetch the conversation history from Supabase (ordered oldest to newest).
    chat_history = []
    if supabase:
        try:
            history_response = (
                supabase
                .table("messages")
                .select("role, content")
                .eq("session_id", request.session_id)
                .order("created_at", desc=False)
                .execute()
            )
            chat_history = history_response.data if history_response.data else []
        except Exception as e:
            print(f"Supabase history fetch failed; continuing without history: {e}")
    
    # Candor Note: LLMs have "token limits". If a conversation has 10,000 messages, it will crash. 
    # grab the last 40 messages to give it great long-term memory without breaking the AI.
    recent_history = chat_history[-40:]

    # 2. Start with the System Prompt
    api_messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    
    # 3. Append the Supabase conversation history
    for msg in recent_history:
        api_messages.append({"role": msg["role"], "content": msg["content"]})
        
    # 4. Append the newest user message
    api_messages.append({"role": "user", "content": request.text})

    # 5. Get the AI Response
    chat_completion = client.chat.completions.create(
        messages=api_messages,
        model="llama-3.3-70b-versatile",
        temperature=0.5,
    )
    ai_response = chat_completion.choices[0].message.content
    
    # 6. Save BOTH messages to Supabase permanently when possible.
    if supabase:
        try:
            # Save User Message
            supabase.table("messages").insert({
                "session_id": request.session_id,
                "user_id": request.user_id,
                "role": "user",
                "content": request.text
            }).execute()

            # Save AI Message
            supabase.table("messages").insert({
                "session_id": request.session_id,
                "user_id": request.user_id,
                "role": "assistant",
                "content": ai_response
            }).execute()
        except Exception as e:
            print(f"Supabase history save failed; returning AI response anyway: {e}")

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
