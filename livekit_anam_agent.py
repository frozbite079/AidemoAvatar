import os
import logging
from pathlib import Path
from urllib.request import urlopen, Request as URLRequest
from urllib.error import URLError
import json

from google.genai import types as genai_types
from livekit import rtc
from livekit.agents import Agent, AgentSession, JobContext, WorkerOptions, cli, function_tool, llm
from livekit.plugins import anam, google, silero
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("musaed-agent")

BASE_DIR = Path(__file__).resolve().parent
ENV_PATH = BASE_DIR / ".env"
DEFAULT_AGENT_NAME = "musaed-avatar"
APP_BASE_URL = os.getenv("MUSAED_APP_BASE_URL", "http://localhost:5000").strip() or "http://localhost:5000"
_session_document_id: str = ""


def load_dotenv(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        cleaned = line.strip()
        if not cleaned or cleaned.startswith("#") or "=" not in cleaned:
            continue
        key, value = cleaned.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


def require_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def get_float_env(name: str, default: float) -> float:
    raw = os.getenv(name, "").strip()
    if not raw:
        return default
    try:
        return float(raw)
    except ValueError:
        logger.warning("Invalid %s=%r, using default %s", name, raw, default)
        return default


def get_int_env(name: str, default: int) -> int:
    raw = os.getenv(name, "").strip()
    if not raw:
        return default
    try:
        return int(raw)
    except ValueError:
        logger.warning("Invalid %s=%r, using default %s", name, raw, default)
        return default


def _looks_like_missing_document_response(answer: str) -> bool:
    normalized = (answer or "").strip().lower()
    if not normalized:
        return True
    phrases = [
        "i need to see the document first",
        "i'm waiting for the document",
        "i am waiting for the document",
        "i don't see any attached document",
        "i dont see any attached document",
        "you haven't attached any documents",
        "you have not attached any documents",
        "you haven't uploaded",
        "you have not uploaded",
        "please provide the document",
        "please share the document",
        "upload the document",
        "upload a file",
        "copy and paste the document",
        "share the link",
        "no documents uploaded yet",
        "please upload",
        "لا أرى أي وثيقة",
        "لا ارى اي وثيقة",
        "بانتظار المستند",
        "لم أستلم المستند",
        "لم استلم المستند",
        "لا توجد مستندات",
        "يرجى رفع المستند",
        "لم يتم رفع",
    ]
    if any(phrase in normalized for phrase in phrases):
        return True

    english_doc_gate = "document" in normalized and any(
        token in normalized
        for token in ("upload", "attach", "share", "paste", "waiting")
    )
    arabic_doc_gate = "المستند" in normalized and any(
        token in normalized
        for token in ("رفع", "ارفع", "أرسل", "ارسل", "بانتظار", "لا أرى", "لا ارى", "لم")
    )
    return english_doc_gate or arabic_doc_gate


def _build_context_fallback_answer(question: str, contexts: list[dict]) -> str:
    excerpts: list[str] = []
    for item in contexts[:2]:
        content = str(item.get("content") or "").strip()
        if content:
            excerpts.append(" ".join(content.split()))

    if not excerpts:
        return ""

    combined = " ".join(excerpts)[:1200].strip()
    if not combined:
        return ""

    return (
        "بناءً على محتوى المستند المتاح لدي الآن، هذا ملخص أولي مرتبط بسؤالك:\n"
        f"{combined}\n\n"
        "إذا رغبت، أقدّم لك ملخصاً أدق بنقاط مرتبة حسب الأقسام."
    )


@function_tool
async def search_uploaded_documents(question: str, document_id: str = "") -> str:
    """ابحث في المستندات (PDF / ملفات المرفوعة) للرد على أسئلة المستخدم.
    Search uploaded PDF documents for relevant information. 
    CRITICAL INSTRUCTION: You MUST use this tool WHENEVER the user asks you to explain, summarize, or read a document, EVEN IF you think no document has been uploaded yet. The system will automatically find the active document. Do not decline to use the tool.
    
    Args:
        question: The user's specific question about the document content (in Arabic or English).
        document_id: Optional uploaded document id. Pass this when available for accurate retrieval.
    Returns:
        The text answer found from the document search.
    """
    logger.info(f"[TOOL] search_uploaded_documents called with: {question}")
    try:
        import asyncio

        def _candidate_base_urls() -> list[str]:
            candidates = [
                os.getenv("MUSAED_APP_BASE_URL", "").strip(),
                APP_BASE_URL,
                "http://localhost:5000",
                "http://localhost:8000",
            ]
            seen = set()
            resolved = []
            for base in candidates:
                if not base:
                    continue
                normalized = base.rstrip("/")
                if normalized in seen:
                    continue
                seen.add(normalized)
                resolved.append(normalized)
            return resolved

        def _sync_req():
            requested_document_id = str(document_id or "").strip()
            hinted_document_id = str(_session_document_id or "").strip()
            last_error = None
            fallback_answer = ""
            context_fallback_answer = ""

            for base_url in _candidate_base_urls():
                try:
                    active_document_id = ""
                    try:
                        active_req = URLRequest(
                            f"{base_url}/api/active-document",
                            headers={"Accept": "application/json"},
                            method="GET",
                        )
                        with urlopen(active_req, timeout=10) as active_resp:
                            active_payload = json.loads(active_resp.read().decode() or "{}")
                        active_document_id = str(active_payload.get("document_id") or "").strip()
                    except Exception:
                        # active-document is a convenience path; continue even if unavailable.
                        active_document_id = ""

                    candidate_doc_ids: list[str] = []
                    if requested_document_id:
                        candidate_doc_ids.append(requested_document_id)
                    if hinted_document_id and hinted_document_id not in candidate_doc_ids:
                        candidate_doc_ids.append(hinted_document_id)
                    if active_document_id and active_document_id not in candidate_doc_ids:
                        candidate_doc_ids.append(active_document_id)
                    if not candidate_doc_ids:
                        candidate_doc_ids.append("")

                    for resolved_document_id in candidate_doc_ids:
                        payload = {"question": question, "output_language": "ar"}
                        if resolved_document_id:
                            payload["document_id"] = resolved_document_id

                        rag_req = URLRequest(
                            f"{base_url}/api/rag-search",
                            data=json.dumps(payload).encode(),
                            headers={"Content-Type": "application/json"},
                            method="POST",
                        )
                        with urlopen(rag_req, timeout=20) as rag_resp:
                            data = json.loads(rag_resp.read().decode() or "{}")

                        answer = str(data.get("answer") or "").strip()
                        contexts = data.get("contexts") or []
                        context_count = len(contexts) if isinstance(contexts, list) else 0

                        logger.info(
                            "[TOOL] RAG attempt via %s (document_id=%s, contexts=%s)",
                            base_url,
                            resolved_document_id or "<none>",
                            context_count,
                        )

                        if context_count > 0 and answer and not _looks_like_missing_document_response(answer):
                            logger.info(
                                "[TOOL] RAG success via %s (document_id=%s)",
                                base_url,
                                resolved_document_id or "<none>",
                            )
                            return answer

                        if context_count > 0 and _looks_like_missing_document_response(answer):
                            logger.warning(
                                "[TOOL] RAG rejected inconsistent answer via %s (document_id=%s): got missing-document text with contexts=%s",
                                base_url,
                                resolved_document_id or "<none>",
                                context_count,
                            )
                            if not context_fallback_answer and isinstance(contexts, list):
                                context_fallback_answer = _build_context_fallback_answer(question, contexts)
                            continue

                        if answer and not _looks_like_missing_document_response(answer):
                            fallback_answer = answer
                except Exception as exc:
                    last_error = exc

            if context_fallback_answer:
                return context_fallback_answer

            if fallback_answer:
                return fallback_answer

            raise RuntimeError(
                f"Could not reach app RAG endpoint using known base URLs. Last error: {last_error}"
            )
        
        answer = await asyncio.to_thread(_sync_req)
        logger.info(f"[TOOL] RAG response: {answer[:100]}...")
        return answer
    except Exception as exc:
        logger.error(f"[RAG] Search failed: {exc}")
        return "حدث خطأ أثناء البحث في المستند."




async def entrypoint(ctx: JobContext) -> None:
    await ctx.connect()

    # --- Credentials ---
    anam_api_key = require_env("ANAM_API_KEY")
    anam_avatar_id = require_env("ANAM_AVATAR_ID")
    gemini_api_key = os.getenv("GOOGLE_API_KEY", "").strip() or os.getenv("GEMINI_API_KEY", "").strip()
    if not gemini_api_key:
        raise RuntimeError("Missing GOOGLE_API_KEY or GEMINI_API_KEY")

    gemini_voice = os.getenv("GEMINI_LIVE_VOICE", "Puck")
    # Defaults tuned for complete-sentence behavior (short pauses should not end the turn too early).
    endpointing_min_delay = 0.2
    endpointing_max_delay = 0.5
    aad_prefix_padding_ms = 100
    aad_silence_ms = 200

    if endpointing_min_delay > endpointing_max_delay:
        logger.warning(
            "LIVEKIT endpointing delays are invalid (min=%s, max=%s). Falling back to 0.6/1.8.",
            endpointing_min_delay,
            endpointing_max_delay,
        )
        endpointing_min_delay = 0.2
        endpointing_max_delay = 0.5

    logger.info(
        "Voice turn tuning: min_delay=%s max_delay=%s aad_prefix_padding_ms=%s aad_silence_ms=%s",
        endpointing_min_delay,
        endpointing_max_delay,
        aad_prefix_padding_ms,
        aad_silence_ms,
    )

    # --- System instructions ---
    instructions = os.getenv(
        "LIVEKIT_AGENT_INSTRUCTIONS",
        (
            "أنت مساعد (Musaed)، مساعد تنفيذي ذكي محترف لرجال الأعمال السعوديين. "
            "قواعد أساسية:\n"
            "- يجب أن تتحدث باللغة العربية دائماً. هذا إلزامي وليس اختيارياً.\n"
            "- لا تتحدث بالإنجليزية إلا إذا تحدث المستخدم بالإنجليزية أولاً.\n"
            "- كن موجزاً وعملياً ومباشراً. تجنب الإطالة في الردود.\n"
            "- لا تستخدم تنسيقات معقدة أو رموز تعبيرية في ردودك المنطوقة.\n"
            "- اجعل ردودك طبيعية ومحادثية لأنها ستُنطق بصوت عالٍ.\n"
            "- يمكنك المساعدة في الاستفسارات العامة والأعمال والتحليل والمهام المهنية.\n\n"
            "CRITICAL INSTRUCTION: If the user asks you to read, explain, summarize, or query a document, file, or PDF, YOU MUST USE THE `search_uploaded_documents` TOOL IMMEDIATELY. Do not say you cannot access files or that no document is uploaded. ALWAYS use the tool first, as the system tracks the uploaded documents automatically in the background.\n\n"
            "CRITICAL INSTRUCTION: If the user asks you to email, send, or mail information / a document summary to their email, YOU MUST USE THE `prepare_email` TOOL with the content they want to send. NEVER say you can't send an email or you don't know their address. The tool triggers a popup for them.\n\n"
            "CRITICAL RULE: You MUST respond in Arabic (العربية) at all times. "
            "Your default language is Arabic, not English."
        ),
    )

    # --- Gemini Live API (Native Multimodal) ---
    llm = google.realtime.RealtimeModel(
        model="gemini-2.5-flash-native-audio-preview-09-2025",
        modalities=["AUDIO"],
        voice=gemini_voice,
        api_key=gemini_api_key,
        instructions=instructions,
        temperature=0.8,
        #input_audio_transcription=genai_types.AudioTranscriptionConfig(),
        realtime_input_config=genai_types.RealtimeInputConfig(
            automatic_activity_detection=genai_types.AutomaticActivityDetection(
                prefix_padding_ms=aad_prefix_padding_ms,
                silence_duration_ms=aad_silence_ms,
            )
        ),
    )

    # --- Anam Avatar ---
    avatar = anam.AvatarSession(
        persona_config=anam.PersonaConfig(
            name=os.getenv("ANAM_AVATAR_NAME", "Musaed"),
            avatarId=anam_avatar_id,
        ),
        api_key=anam_api_key,
    )

    # --- Session (native multimodal - fastest) ---
    # By omitting stt and vad, we use the RealtimeModel's native VAD and STT
    session = AgentSession(
        llm=llm,
        turn_handling={
            "turn_detection": "realtime_llm",
            "endpointing": {
                "min_delay": endpointing_min_delay,
                "max_delay": endpointing_max_delay,
            },
        },
    )

    # Avatar must start BEFORE session (per Anam docs)
    await avatar.start(session, room=ctx.room)

    # --- Listeners (Handling Typed Messages via Data Channel) ---
    @ctx.room.on("data_received")
    def on_data_received(data_packet: rtc.DataPacket):
        global _session_document_id
        try:
            payload = json.loads(data_packet.data.decode("utf-8"))
            msg_type = payload.get("type", "")
            text = payload.get("text", "").strip()
            document_id = str(payload.get("document_id") or "").strip()
            if msg_type == "document_context":
                _session_document_id = document_id
                logger.info(
                    "[DATA] Document context updated: %s",
                    _session_document_id or "<none>",
                )
                return

            if not text:
                return

            if msg_type == "chat":
                # User typed a message — have the agent process it and speak the answer
                logger.info(f"[DATA] Chat message received: {text[:80]}...")
                effective_document_id = document_id or _session_document_id
                document_hint = (
                    f" The uploaded document_id is '{effective_document_id}'. "
                    "If you use search_uploaded_documents, pass this document_id explicitly."
                    if effective_document_id
                    else ""
                )
                session.generate_reply(
                    instructions=(
                        "The user typed this message (respond in Arabic)."
                        f"{document_hint}\nUser message: {text}"
                    )
                )
            elif msg_type == "speak":
                # Frontend wants the agent to speak specific text verbatim
                logger.info(f"[DATA] Speak request received: {text[:80]}...")
                session.say(text, allow_interruptions=True)
        except Exception as e:
            logger.error(f"[DATA] Error processing data packet: {e}")

    # --- Email tool (needs ctx closure) ---
    @function_tool(
        name="prepare_email",
        description="Use this tool if the user asks you to email, mail, or send some document summary or information to their email. NEVER say you can't send an email or you don't know their address. The tool triggers a popup for them."
    )
    async def prepare_email_tool(content: str) -> str:
        """Prepares an email to be sent and triggers the frontend email modal.

        Args:
            content: The content or document summary to be sent in the email, written in Arabic.
        """
        logger.info(f"[TOOL] prepare_email called with content: {content[:50]}...")
        try:
            payload = json.dumps({"type": "show_email_modal", "content": content}).encode("utf-8")
            await ctx.room.local_participant.publish_data(payload=payload)
            return "Email popup successfully triggered on the user's screen."
        except Exception as exc:
            logger.error(f"[TOOL] prepare_email failed: {exc}")
            return "حدث خطأ أثناء إعداد البريد الإلكتروني."

    await session.start(
        agent=Agent(
            instructions=instructions,
            tools=[search_uploaded_documents, prepare_email_tool]
        ),
        room=ctx.room,
    )

    session.generate_reply(
        instructions=os.getenv(
            "LIVEKIT_INITIAL_GREETING",
            "رحب بالمستخدم باللغة العربية وقل: مرحباً، أنا مساعد. كيف يمكنني مساعدتك اليوم؟",
        )
    )


if __name__ == "__main__":
    load_dotenv(ENV_PATH)
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            agent_name=os.getenv("LIVEKIT_AGENT_NAME", DEFAULT_AGENT_NAME),
        )
    )
