import os
import logging
from pathlib import Path
from urllib.request import urlopen, Request as URLRequest
from urllib.error import URLError
import json

from livekit import rtc
from livekit.agents import Agent, AgentSession, JobContext, WorkerOptions, cli, function_tool, llm
from livekit.agents.voice.room_io import RoomInputOptions, RoomOutputOptions
from livekit.plugins import anam, anthropic, azure, google
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
        parsed = value.strip()
        if (
            len(parsed) >= 2
            and parsed[0] == parsed[-1]
            and parsed[0] in {'"', "'"}
        ):
            parsed = parsed[1:-1]
        os.environ[key.strip()] = parsed


def require_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


# Ensure worker subprocesses always get current .env values (important in start mode).
load_dotenv(ENV_PATH)


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


def get_optional_env(name: str) -> str | None:
    raw = os.getenv(name, "").strip()
    return raw or None


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

    def _is_user_identity(identity: str) -> bool:
        lower = (identity or "").strip().lower()
        if not lower:
            return False
        if lower.startswith(("web-", "user-", "guest-")):
            return True
        if any(token in lower for token in ("anam", "avatar", "agent", "bot")):
            return False
        return True

    def _select_initial_user_identity() -> str | None:
        for participant in ctx.room.remote_participants.values():
            if _is_user_identity(participant.identity):
                return participant.identity
        return None

    # --- Credentials ---
    anam_api_key = require_env("ANAM_API_KEY")
    anam_avatar_id = require_env("ANAM_AVATAR_ID")
    anthropic_api_key = require_env("ANTHROPIC_API_KEY")
    anthropic_model = os.getenv("ANTHROPIC_MODEL", "claude-haiku-4-5-20251001").strip() or "claude-haiku-4-5-20251001"

    azure_speech_key = require_env("AZURE_SPEECH_KEY")
    azure_speech_region = require_env("AZURE_SPEECH_REGION")
    # Use dedicated endpoint overrides for LiveKit speech path.
    # Do not reuse AZURE_SPEECH_ENDPOINT because that value is often for other app REST flows.
    azure_stt_endpoint = get_optional_env("LIVEKIT_AZURE_STT_ENDPOINT")
    azure_tts_endpoint = (
        get_optional_env("LIVEKIT_AZURE_TTS_ENDPOINT")
        or f"https://{azure_speech_region}.tts.speech.microsoft.com/cognitiveservices/v1"
    )
    stt_language = os.getenv("LIVEKIT_STT_LANGUAGE", os.getenv("LIVEKIT_LANGUAGE", "ar-SA")).strip() or "ar-SA"
    tts_language = os.getenv("LIVEKIT_TTS_LANGUAGE", stt_language).strip() or stt_language
    tts_voice = os.getenv("AZURE_SPEECH_VOICE", "ar-SA-HamedNeural").strip() or "ar-SA-HamedNeural"
    stt_segmentation_silence_ms = get_int_env("LIVEKIT_STT_SEGMENTATION_SILENCE_MS", 500)
    stt_segmentation_max_time_ms = get_int_env("LIVEKIT_STT_SEGMENTATION_MAX_TIME_MS", 15000)
    min_endpointing_delay = get_float_env("LIVEKIT_MIN_ENDPOINTING_DELAY", 0.5)
    max_endpointing_delay = get_float_env("LIVEKIT_MAX_ENDPOINTING_DELAY", 1.5)
    llm_model = os.getenv("LIVEKIT_LLM_MODEL", "gemini-2.5-flash").strip() or "gemini-2.5-flash"

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

    # --- LLM + Azure Speech pipeline ---
    llm_model_client = anthropic.LLM(
        model=anthropic_model,
        api_key=anthropic_api_key,
        temperature=0.4,
    )
    stt_kwargs = {}
    if azure_stt_endpoint:
        stt_kwargs["speech_endpoint"] = azure_stt_endpoint

    stt = azure.STT(
        speech_key=azure_speech_key,
        speech_region=azure_speech_region,
        language=stt_language,
        segmentation_silence_timeout_ms=stt_segmentation_silence_ms,
        segmentation_max_time_ms=stt_segmentation_max_time_ms,
        **stt_kwargs,
    )
    tts = azure.TTS(
        voice=tts_voice,
        language=tts_language,
        speech_key=azure_speech_key,
        speech_region=azure_speech_region,
        speech_endpoint=azure_tts_endpoint,
    )

    # --- Anam Avatar ---
    avatar = anam.AvatarSession(
        persona_config=anam.PersonaConfig(
            name=os.getenv("ANAM_AVATAR_NAME", "Musaed"),
            avatarId=anam_avatar_id,
        ),
        api_key=anam_api_key,
    )

    # --- Session (Azure STT/TTS for faster realtime speech + robust language control) ---
    session = AgentSession(
        llm=llm_model_client,
        stt=stt,
        tts=tts,
        # Use STT-based endpointing to avoid VAD stalls where mic is enabled but no turn is committed.
        turn_detection="stt",
        min_endpointing_delay=min_endpointing_delay,
        max_endpointing_delay=max_endpointing_delay,
    )
    selected_user_identity = _select_initial_user_identity()
    room_io_started = False
    room_input_options = RoomInputOptions()
    if selected_user_identity:
        room_input_options.participant_identity = selected_user_identity
        logger.info("[AUDIO] Initial user participant selected: %s", selected_user_identity)

    room_output_options = RoomOutputOptions(
        transcription_enabled=True,
        sync_transcription=False,
    )

    # Avatar must start BEFORE session (per Anam docs)
    await avatar.start(session, room=ctx.room)

    @ctx.room.on("participant_connected")
    def on_participant_connected(participant: rtc.RemoteParticipant):
        nonlocal selected_user_identity, room_io_started
        if selected_user_identity:
            return
        if not _is_user_identity(participant.identity):
            return
        selected_user_identity = participant.identity
        logger.info("[AUDIO] Late user participant selected: %s", selected_user_identity)
        if room_io_started:
            session.room_io.set_participant(selected_user_identity)

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
        room_input_options=room_input_options,
        room_output_options=room_output_options,
    )
    room_io_started = True
    if selected_user_identity:
        session.room_io.set_participant(selected_user_identity)

    session.generate_reply(
        instructions=os.getenv(
            "LIVEKIT_INITIAL_GREETING",
            "رحب بالمستخدم باللغة العربية وقل: مرحباً، أنا مساعد. كيف يمكنني مساعدتك اليوم؟",
        )
    )


if __name__ == "__main__":
    load_dotenv(ENV_PATH)
    worker_port = get_int_env("LIVEKIT_WORKER_PORT", 0)
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            agent_name=os.getenv("LIVEKIT_AGENT_NAME", DEFAULT_AGENT_NAME),
            port=worker_port,
        )
    )
