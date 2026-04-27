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


env_path = os.path.join(os.path.dirname(__file__), ".env")
load_dotenv(dotenv_path=env_path)

app = FastAPI()

# Development CORS policy: Expo clients can call this API from any host.
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
    persona: Optional[str] = "General Learner"
    scenario: Optional[str] = None
    history: Optional[List[dict]] = None
    was_audio: Optional[bool] = False

class TTSRequest(BaseModel):
    text: str
    voice: str = "ar-SA-HamedNeural"
    rate: str = "-10%"
    pitch: str = "+0Hz"


class AdaptiveDrillsRequest(BaseModel):
    user_id: str
    drill_set: Optional[str] = None
    count: int = 3


class PronunciationCheckRequest(BaseModel):
    user_text: str
    expected_text: str

class FreeformPronunciationRequest(BaseModel):
    user_text: str

# Integrations (Groq and Supabase) are enabled through environment variables.
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

SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase_admin: Client | None = None
if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY:
    supabase_admin = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    print("Supabase Admin Client Connected.")



# Core tutoring prompt shared by the `/chat` endpoint.
SYSTEM_PROMPT = """You are a helpful and friendly Arabic language tutor. The user may write in Arabic, English, or a mix of both. You must ONLY use English and Arabic in your responses. NEVER use any other languages.
NEVER repeat the same sentence, phrase, or word breakdown multiple times in a row. Do not get stuck in repetitive loops.
Prefer to include tashkeel (vowel marks / harakat) in Arabic when it is easy and natural to do so, especially for beginner-facing words, corrections, and potentially ambiguous terms. If full tashkeel is uncertain or would make the sentence unnatural, use partial or no tashkeel rather than forcing it.
If the user asks about an Arabic slang word (like Egyptian slang), explain its meaning in English clearly without necessarily trying to correct it to formal Arabic.
If the user writes in English, provide the Arabic translation (adding tashkeel where easy/useful), and then provide a helpful breakdown in English explaining what the individual Arabic words mean.
Do NOT include transliteration by default. Use Arabic script directly in normal replies.
Only include transliteration if the user explicitly asks for pronunciation/transliteration, or if a single keyword is likely hard to read; in that case, include at most 1-2 transliterations total in the format: Arabic {Transliteration}. NEVER transliterate full sentences.
If the user writes in Arabic, carefully evaluate it for mistakes. IF AND ONLY IF there is an actual grammar, spelling, or vocabulary mistake, your VERY FIRST LINE must be exactly: "✏️ Correction: [corrected Arabic (add tashkeel where easy/useful)] - [Brief explanation of the mistake in english]". ensure the correction always has some sort of english in it as the user will be an english speaker trying to learn arabic
If the user's Arabic is perfectly correct, DO NOT output a correction line at all.
Make sure there is a blank line after the correction (if you made one). Then, reply normally in Arabic (include tashkeel where easy/useful) to continue the conversation. Keep your conversational answers concise. 
Finally, add an English translation of ONLY your conversational reply on a new line in parentheses, exactly like: "(English: [translation of the Arabic reply])"."""


def _strip_json_code_fences(raw_text: str) -> str:
    cleaned = raw_text.strip()
    cleaned = re.sub(r"^```(?:json)?\\s*", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\\s*```$", "", cleaned)
    return cleaned.strip()


def _contains_arabic(text: str) -> bool:
    return bool(re.search(r"[\u0600-\u06FF]", text or ""))


def _add_tashkeel_if_easy(text: str) -> str:
    """Try to add natural tashkeel to Arabic text without changing wording."""
    clean_text = (text or "").strip()
    if not clean_text or not _contains_arabic(clean_text) or not client:
        return clean_text

    try:
        completion = client.chat.completions.create(
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You add Arabic tashkeel only when easy and confident. "
                        "Do not translate, do not explain, do not change wording, and output one plain line only."
                    ),
                },
                {
                    "role": "user",
                    "content": f"Add helpful tashkeel to this exact Arabic text when easy: {clean_text}",
                },
            ],
            model="llama-3.3-70b-versatile",
            temperature=0,
        )
        candidate = (completion.choices[0].message.content or "").strip()
        candidate = _strip_json_code_fences(candidate)

        if not candidate:
            return clean_text
        # Keep output safe: must remain Arabic-containing and roughly same length.
        if _contains_arabic(candidate) and abs(len(candidate) - len(clean_text)) <= max(20, len(clean_text)):
            return candidate
        return clean_text
    except Exception as exc:
        print(f"Tashkeel enrichment skipped: {exc}")
        return clean_text


def _extract_name_hint_from_messages(messages: list[dict[str, Any]]) -> Optional[str]:
    """Extract a likely user name from prior user messages (English/Arabic patterns)."""
    if not messages:
        return None

    english_patterns = [
        re.compile(r"\bmy\s+name\s+is\s+([A-Za-z][A-Za-z\-\s']{1,30})", re.IGNORECASE),
        re.compile(r"\bi\s+am\s+([A-Za-z][A-Za-z\-\s']{1,30})", re.IGNORECASE),
        re.compile(r"\bi['’]m\s+([A-Za-z][A-Za-z\-\s']{1,30})", re.IGNORECASE),
    ]
    arabic_patterns = [
        re.compile(r"(?:اسمي|أَ?نَا\s+اسمي|أنا\s+اسمي)\s*[:\-]?\s*([\u0621-\u064A]{2,30})"),
    ]

    for row in reversed(messages):
        content = str(row.get("content") or "").strip()
        if not content:
            continue

        for pattern in english_patterns:
            match = pattern.search(content)
            if match:
                return match.group(1).strip(" .,!?:;\"'")

        for pattern in arabic_patterns:
            match = pattern.search(content)
            if match:
                return match.group(1).strip()

    return None


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


PRONUNCIATION_SYSTEM_PROMPT = """You are an Arabic pronunciation analysis engine. Compare the user's spoken text against the expected text and identify phonetic mistakes.

RULES:
1. Focus on letter-level phonetic errors common in Arabic learners: confusing emphatic/non-emphatic pairs (ص/س, ض/د, ط/ت, ظ/ذ), throat sounds (ح/ه, ع/ا, خ/غ), and similar consonants (ق/ك, ث/ذ/ز).
2. Ignore diacritical marks (tashkeel) differences.
3. Ignore minor transcription artifacts like extra spaces or alif variations (أ/إ/ا).
4. Score from 0-100 based on how close the pronunciation was.

You MUST respond with ONLY valid JSON in this exact format (no markdown, no explanation):
{
  "score": 85,
  "feedback": "Good attempt! Watch your emphatic sounds.",
  "mistakes": [
    {
      "expected_char": "ص",
      "spoken_char": "س",
      "position": 3,
      "word_expected": "صباح",
      "word_spoken": "سباح",
      "explanation": "You used 'seen' (س) instead of 'saad' (ص). Saad is the emphatic version — press your tongue against the roof of your mouth."
    }
  ],
  "annotated_words": [
    {
      "word": "صباح",
      "letters": [
        {"char": "ص", "correct": false, "expected": "ص", "spoken": "س"},
        {"char": "ب", "correct": true},
        {"char": "ا", "correct": true},
        {"char": "ح", "correct": true}
      ]
    },
    {
      "word": "الخير",
      "letters": [
        {"char": "ا", "correct": true},
        {"char": "ل", "correct": true},
        {"char": "خ", "correct": true},
        {"char": "ي", "correct": true},
        {"char": "ر", "correct": true}
      ]
    }
  ]
}

If the texts are identical or nearly identical, return score 100 with empty mistakes array.
If user_text is empty or not Arabic, return score 0."""

@app.post("/pronunciation-check")
async def check_pronunciation(request: PronunciationCheckRequest):
    if not GROQ_API_KEY:
        raise HTTPException(status_code=500, detail="Groq API key not configured")

    if not request.user_text.strip() or not request.expected_text.strip():
        return {"score": 0, "feedback": "No text provided.", "mistakes": [], "annotated": []}

    print(f"Pronunciation check: '{request.user_text}' vs expected '{request.expected_text}'")

    try:
        completion = client.chat.completions.create(
            messages=[
                {"role": "system", "content": PRONUNCIATION_SYSTEM_PROMPT},
                {"role": "user", "content": f"Expected text: {request.expected_text}\nUser's spoken text: {request.user_text}"},
            ],
            model="llama-3.3-70b-versatile",
            temperature=0,
        )

        raw = completion.choices[0].message.content.strip()
        import json
        import re
        
        # Models occasionally wrap JSON in markdown fences; strip before parsing.
        if "```" in raw:
            match = re.search(r"```(?:json)?(.*?)```", raw, re.DOTALL)
            if match:
                raw = match.group(1).strip()
                
        # Some outputs include preamble/trailing text. Extract the JSON object only.
        if not raw.startswith("{"):
            match = re.search(r"({.*})", raw, re.DOTALL)
            if match:
                raw = match.group(1).strip()

        result = json.loads(raw)
        print(f"Pronunciation result: score={result.get('score')}, mistakes={len(result.get('mistakes', []))}")
        return result

    except Exception as e:
        print(f"Pronunciation check error: {e}")
        return {"score": -1, "feedback": "Analysis failed.", "mistakes": [], "annotated": []}


FREEFORM_SYSTEM_PROMPT = """You are an advanced Arabic language model.
The user will provide a transcribed Arabic text that may contain phonetic spelling mistakes due to speech-to-text inaccuracies or mispronunciations (e.g., swapping س and ص, or grammar mistakes).
Your task is to:
1. Determine the MOST LIKELY intended correct native Arabic sentence.
2. Compare the user's text against this expected correct sentence and identify phonetic/spelling mistakes.
3. Score the pronunciation from 0-100 based on how close the user's text is to the correct text.

You MUST respond with ONLY valid JSON in this exact format (no markdown, no explanation):
{
  "expected_text": "Corrected Arabic sentence here",
  "score": 85,
  "feedback": "Good attempt! Watch your emphatic sounds.",
  "mistakes": [
    {
      "expected_char": "ص",
      "spoken_char": "س",
      "position": 3,
      "word_expected": "صباح",
      "word_spoken": "سباح",
      "explanation": "You used 'seen' (س) instead of 'saad' (ص)."
    }
  ],
  "annotated_words": [
    {
      "word": "صباح",
      "letters": [
        {"char": "ص", "correct": false, "expected": "ص", "spoken": "س"},
        {"char": "ب", "correct": true},
        {"char": "ا", "correct": true},
        {"char": "ح", "correct": true}
      ]
    },
    {
      "word": "الخير",
      "letters": [
        {"char": "ا", "correct": true},
        {"char": "ل", "correct": true},
        {"char": "خ", "correct": true},
        {"char": "ي", "correct": true},
        {"char": "ر", "correct": true}
      ]
    }
  ]
}

If the user's text is already perfect or nearly perfect, set score to 100, mistakes to [], and expected_text to the user's text.
If user_text is completely unintelligible or not Arabic, return score 0."""

@app.post("/freeform-pronunciation")
async def freeform_pronunciation(request: FreeformPronunciationRequest):
    if not GROQ_API_KEY:
        raise HTTPException(status_code=500, detail="Groq API key not configured")

    if not request.user_text.strip():
        return {"expected_text": "", "score": 0, "feedback": "No text provided.", "mistakes": [], "annotated": []}

    print(f"Freeform Pronunciation check for: '{request.user_text}'")

    try:
        completion = client.chat.completions.create(
            messages=[
                {"role": "system", "content": FREEFORM_SYSTEM_PROMPT},
                {"role": "user", "content": f"User's transcribed text: {request.user_text}"},
            ],
            model="llama-3.3-70b-versatile",
            temperature=0,
        )

        raw = completion.choices[0].message.content.strip()
        import json
        import re
        
        # Models occasionally wrap JSON in markdown fences; strip before parsing.
        if "```" in raw:
            match = re.search(r"```(?:json)?(.*?)```", raw, re.DOTALL)
            if match:
                raw = match.group(1).strip()
                
        # Some outputs include preamble/trailing text. Extract the JSON object only.
        if not raw.startswith("{"):
            match = re.search(r"({.*})", raw, re.DOTALL)
            if match:
                raw = match.group(1).strip()

        result = json.loads(raw)
        print(f"Freeform result: score={result.get('score')}, expected='{result.get('expected_text')}'")
        return result

    except Exception as e:
        print(f"Freeform pronunciation check error: {e}")
        return {"expected_text": request.user_text, "score": -1, "feedback": "Analysis failed.", "mistakes": [], "annotated": []}

# Common Whisper hallucination phrases that appear when the model
# processes silence, background noise, or very short audio clips.
WHISPER_HALLUCINATION_PATTERNS = [
    r"(?i)thank\s*you\s*(for\s*watching|for\s*listening)?",
    r"(?i)please\s*subscribe",
    r"(?i)like\s*and\s*subscribe",
    r"(?i)see\s*you\s*(in\s*the\s*)?next\s*(video|episode)",
    r"(?i)bye[\s\-]*bye",
    r"(?i)^\.+$",
    r"(?i)^music$",
    r"(?i)^\[.*\]$",
    r"(?i)^thank\s*you\.?$",
    r"أعوذ بالله من الشيطان الرجيم",
    r"بسم الله الرحمن الرحيم",
    r"السلام عليكم ورحمة الله وبركاته",
    r"جزاكم الله خيرا",
    r"صلى الله عليه وسلم",
]

_hallucination_regexes = [re.compile(p) for p in WHISPER_HALLUCINATION_PATTERNS]


def _is_likely_hallucination(text: str) -> bool:
    """Return True if the transcription looks like a Whisper hallucination."""
    stripped = text.strip()
    if not stripped:
        return True
    for regex in _hallucination_regexes:
        if regex.fullmatch(stripped):
            return True
    return False


def _contains_cjk(text: str) -> bool:
    """Return True if text contains Chinese/Japanese/Kanji characters."""
    return bool(re.search(r"[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]", text or ""))


def _looks_disallowed_language_output(text: str) -> bool:
    """Return True when transcript appears to be outside Arabic/English."""
    stripped = (text or "").strip()
    if not stripped:
        return False

    if _contains_cjk(stripped):
        return True

    has_arabic = _contains_arabic(stripped)
    has_latin = bool(re.search(r"[A-Za-z]", stripped))

    # Must contain at least Arabic or English letters.
    if not (has_arabic or has_latin):
        return True

    # Reject common non-Arabic/non-English script blocks.
    if re.search(r"[\u0370-\u03FF\u0400-\u052F\u0590-\u05FF\u0900-\u097F\u3040-\u30FF\uAC00-\uD7AF]", stripped):
        return True

    return False


# Transcribe speech uploads used by the chat screen.
@app.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    temp_filename = f"temp_{file.filename}"
    
    try:
        with open(temp_filename, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Tiny uploads are usually accidental taps or silence; skip model calls.
        file_size = os.path.getsize(temp_filename)
        print(f"Received file: {temp_filename} ({file_size} bytes)")

        if file_size < 5000:
            print("Audio file too small, likely silence — skipping transcription.")
            return {"text": ""}

        if client:
            try:
                audio_file = open(temp_filename, "rb")

                def _transcribe_once(language: Optional[str], prompt: str) -> str:
                    audio_file.seek(0)
                    payload: dict[str, Any] = {
                        "model": "whisper-large-v3",
                        "file": audio_file,
                        "temperature": 0,
                        "prompt": prompt,
                    }
                    if language:
                        payload["language"] = language
                    transcript = client.audio.transcriptions.create(**payload)
                    return (transcript.text or "").strip()

                result_text = _transcribe_once(
                    None,
                    "Transcribe only spoken Arabic or English. If speech is unclear, output the best Arabic/English transcript only.",
                )
                print(f"Transcription: {result_text}")

                if _looks_disallowed_language_output(result_text):
                    print(f"Disallowed language/script detected, retrying for Arabic/English: {result_text}")
                    retry_ar = _transcribe_once(
                        "ar",
                        "Arabic speech only. Keep output in Arabic script. Example: ما اسمي؟",
                    )
                    retry_en = _transcribe_once(
                        "en",
                        "English speech only. Return clear English text.",
                    )

                    print(f"Retry Arabic transcription: {retry_ar}")
                    print(f"Retry English transcription: {retry_en}")

                    if retry_ar and not _looks_disallowed_language_output(retry_ar):
                        result_text = retry_ar
                    elif retry_en and not _looks_disallowed_language_output(retry_en):
                        result_text = retry_en
                    elif retry_ar:
                        result_text = retry_ar
                    elif retry_en:
                        result_text = retry_en

                if _is_likely_hallucination(result_text):
                    print(f"Filtered hallucination: \"{result_text}\"")
                    return {"text": ""}

                if _looks_disallowed_language_output(result_text):
                    print(f"Dropping transcription outside Arabic/English after retries: {result_text}")
                    return {"text": ""}

                enriched_text = _add_tashkeel_if_easy(result_text) if _contains_arabic(result_text) else result_text
                if enriched_text != result_text:
                    print(f"Transcription with tashkeel: {enriched_text}")

                return {"text": enriched_text}

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

# Generate the next AI tutoring response and persist conversation history.
@app.post("/chat")
async def chat_with_ai(request: ChatRequest):
    if not GROQ_API_KEY:
        raise HTTPException(status_code=500, detail="Groq API key not configured")

    print(f"Fetching permanent history for session: {request.session_id}...")

    # Primary source of chat context is persisted Supabase history.
    chat_history = []
    if supabase:
        try:
            history_query = (
                supabase
                .table("messages")
                .select("role, content")
                .eq("session_id", request.session_id)
            )
            if request.user_id:
                history_query = history_query.eq("user_id", request.user_id)

            history_response = history_query.order("created_at", desc=False).execute()
            chat_history = history_response.data if history_response.data else []
        except Exception as e:
            print(f"Supabase history fetch failed; continuing without history: {e}")

    # Fallback to frontend history when persistence has not caught up yet.
    if not chat_history and request.history:
        chat_history = [
            {"role": msg.get("role", "user"), "content": msg.get("content", "")}
            for msg in request.history
            if msg.get("content")
        ]
        print(f"Using frontend history fallback ({len(chat_history)} messages)")
    
    # Keep prompt size bounded to avoid token overflows on long sessions.
    recent_history = chat_history[-40:]
    print(f"History loaded: {len(recent_history)} messages for session {request.session_id}")

    dynamic_prompt = SYSTEM_PROMPT + f"\n\nThe user's learning profile is: {request.persona or 'General Learner'}."

    if supabase and request.user_id:
        try:
            all_user_messages_response = (
                supabase
                .table("messages")
                .select("role, content, created_at")
                .eq("user_id", request.user_id)
                .eq("role", "user")
                .order("created_at", desc=True)
                .limit(120)
                .execute()
            )
            all_user_messages = all_user_messages_response.data if all_user_messages_response.data else []
            remembered_name = _extract_name_hint_from_messages(all_user_messages)
            if remembered_name:
                dynamic_prompt += (
                    f"\n\nPersistent user memory hint: The user has previously said their name is '{remembered_name}'. "
                    "Use this ONLY when contextually relevant; do not force it into every reply."
                )
        except Exception as e:
            print(f"User-level memory fetch failed; continuing without persistent hint: {e}")

    if request.persona == "Faith-Based Learner":
        dynamic_prompt += " Whenever possible, include vocabulary and examples from classical Islamic texts and the Qur'an."
    elif request.persona == "University Student":
        dynamic_prompt += " Strictly use Modern Standard Arabic (MSA). Focus heavily on explaining complex grammar concepts and root patterns."
    elif request.persona == "Independent Learner":
        dynamic_prompt += " Focus on practical, conversational 'survival' Arabic. Emphasize dialects and common slang used in daily business or travel."
    elif request.persona == "Heritage Learner":
        dynamic_prompt += " The user likely has good listening skills but struggles with literacy. Help bridge the gap between spoken dialects and written MSA."

    if request.scenario:
        dynamic_prompt += f" IMPORTANT: We are roleplaying a specific scenario: '{request.scenario}'. Stay in character as the other person in this scenario. Continue the conversation naturally based on what has already been said. Do NOT re-introduce yourself or restart the scenario if you have already greeted the user."

    if request.was_audio:
        dynamic_prompt += " The user's latest message came from speech transcription. For this turn, include helpful Arabic tashkeel where easy and useful, especially on beginner words and any corrected forms."

    api_messages = [{"role": "system", "content": dynamic_prompt}]

    for msg in recent_history:
        api_messages.append({"role": msg["role"], "content": msg["content"]})

    api_messages.append({"role": "user", "content": request.text})

    chat_completion = client.chat.completions.create(
        messages=api_messages,
        model="llama-3.3-70b-versatile",
        temperature=0.5,
    )
    ai_response = chat_completion.choices[0].message.content
    
    # Persist both turns so subsequent requests can rebuild context from storage.
    if supabase:
        try:
            supabase.table("messages").insert({
                "session_id": request.session_id,
                "user_id": request.user_id,
                "role": "user",
                "content": request.text
            }).execute()

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


@app.get("/leaderboard")
def get_leaderboard(limit: int = 10):
    safe_limit = min(max(limit, 1), 50)
    db = supabase_admin or supabase
    if not db:
        raise HTTPException(status_code=500, detail="Supabase not configured")

    try:
        response = (
            db
            .table("profiles")
            .select("id, email, xp_points, streak")
            .order("xp_points", desc=True)
            .limit(safe_limit)
            .execute()
        )

        rows = response.data if response.data else []
        leaders = [
            {
                "id": row.get("id"),
                "email": row.get("email") or "",
                "xp_points": int(row.get("xp_points") or 0),
                "streak": int(row.get("streak") or 0),
            }
            for row in rows
        ]
        return {"leaders": leaders}
    except Exception as e:
        print(f"Leaderboard fetch failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch leaderboard")

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
