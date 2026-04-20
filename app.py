import asyncio
import json
import os
import uuid
import base64
from io import BytesIO
from pathlib import Path
from urllib import error, request

import weaviate
import yagmail
from fastapi import (
    FastAPI,
    File,
    Form,
    HTTPException,
    Request,
    UploadFile,
    WebSocket,
    WebSocketDisconnect,
)
from fastapi.responses import HTMLResponse, JSONResponse, StreamingResponse
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_text_splitters import RecursiveCharacterTextSplitter
from PIL import Image
from pypdf import PdfReader
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from weaviate.classes.config import Configure, DataType, Property
from weaviate.classes.query import Filter, MetadataQuery

try:
    from anam import AnamClient
except Exception:  # pragma: no cover - optional integration
    AnamClient = None

try:
    from livekit import api as livekit_api
except Exception:  # pragma: no cover - optional integration
    livekit_api = None

try:
    from google import genai
    from google.genai import types as genai_types
except ImportError:
    genai = None
    genai_types = None


BASE_DIR = Path(__file__).resolve().parent
ENV_PATH = BASE_DIR / ".env"
UPLOAD_DIR = BASE_DIR / "uploads"
COLLECTION_NAME = "DocumentChunk"
DEFAULT_LIVEKIT_AGENT_NAME = "musaed-avatar"

# Track the most recently uploaded document for LiveKit agent access
_last_document_id: str = ""


# ── Gemini STT (Vertex AI) ────────────────────────────────────────────


def _is_gemini_stt_configured() -> bool:
    """Return True when google-genai is installed and a GCP project is set."""
    return genai is not None and bool(os.getenv("GOOGLE_CLOUD_PROJECT", "").strip())


def transcribe_with_gemini(
    audio_bytes: bytes,
    file_name: str,
    language: str | None = None,
    mime_type: str | None = None,
) -> tuple[str, str, str | None]:
    """Transcribe audio using Vertex AI Gemini."""
    if genai is None or genai_types is None:
        raise HTTPException(
            status_code=500,
            detail="google-genai package is not installed. Run: pip install google-genai",
        )

    project = os.getenv("GOOGLE_CLOUD_PROJECT", "").strip()
    if not project:
        raise HTTPException(
            status_code=500,
            detail="GOOGLE_CLOUD_PROJECT is not set in .env",
        )

    location = os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1").strip()
    model_name = os.getenv("GEMINI_STT_MODEL", "gemini-2.0-flash").strip()

    client = genai.Client(vertexai=True, project=project, location=location)

    # Determine MIME type from the file or form field
    audio_mime = (mime_type or "").strip()
    if not audio_mime:
        ext = Path(file_name or "").suffix.lower()
        mime_map = {
            ".webm": "audio/webm",
            ".mp3": "audio/mpeg",
            ".mp4": "audio/mp4",
            ".wav": "audio/wav",
            ".ogg": "audio/ogg",
            ".flac": "audio/flac",
        }
        audio_mime = mime_map.get(ext, "audio/webm")

    # Build language instruction
    lang_hint = ""
    requested_language = (language or "").strip().lower()
    if requested_language.startswith("ar"):
        lang_hint = "The audio is in Arabic. "
    elif requested_language.startswith("en"):
        lang_hint = "The audio is in English. "

    prompt = (
        f"{lang_hint}Transcribe this audio exactly as spoken. "
        "Return ONLY the transcribed text, with no extra commentary."
    )

    print(f"[Gemini STT] Sending {len(audio_bytes)} bytes ({audio_mime}) to {model_name}")

    try:
        response = client.models.generate_content(
            model=model_name,
            contents=[
                prompt,
                genai_types.Part.from_bytes(data=audio_bytes, mime_type=audio_mime),
            ],
        )
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Gemini STT request failed: {exc}",
        )

    transcript = (response.text or "").strip()
    if not transcript:
        raise HTTPException(
            status_code=502,
            detail="Gemini returned an empty transcript.",
        )

    detected = "ar" if requested_language.startswith("ar") else "en"
    print(f"[Gemini STT] Transcript ({detected}): {transcript[:80]}...")
    return transcript, f"gemini-{model_name}", detected


def encode_video_frame_to_base64_jpeg(frame) -> str:
    rgb = frame.to_ndarray(format="rgb24")
    image = Image.fromarray(rgb)
    buffer = BytesIO()
    image.save(buffer, format="JPEG", quality=72)
    return base64.b64encode(buffer.getvalue()).decode("ascii")


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
        os.environ.setdefault(key.strip(), parsed)


def require_env(name: str) -> str:
    value = os.getenv(name)

    if not value:
        raise HTTPException(
            status_code=500,
            detail=f"Missing required server config: {name}",
        )

    return value


def is_azure_speech_configured() -> bool:
    """Check if Azure Speech is properly configured with real credentials"""
    endpoint = os.getenv("AZURE_SPEECH_ENDPOINT", "")
    key = os.getenv("AZURE_SPEECH_KEY", "")
    region = os.getenv("AZURE_SPEECH_REGION", "")

    # Check if we have real values (not placeholder values)
    has_real_endpoint = endpoint and not any(
        placeholder in endpoint
        for placeholder in ["your-resource-name", "example.com", "placeholder"]
    )
    has_real_key = key and not any(
        placeholder in key
        for placeholder in ["your-resource-key", "your-key", "placeholder"]
    )
    has_region = region and region != "your-region"

    return has_real_endpoint and has_real_key and has_region


def is_anam_configured() -> bool:
    return bool(os.getenv("ANAM_API_KEY")) and bool(os.getenv("ANAM_PERSONA_ID"))


def is_livekit_configured() -> bool:
    return all(
        bool(os.getenv(name))
        for name in (
            "LIVEKIT_URL",
            "LIVEKIT_API_KEY",
            "LIVEKIT_API_SECRET",
        )
    )


def get_avatar_provider() -> str:
    provider = (os.getenv("AVATAR_PROVIDER", "") or "").strip().lower()
    if provider in {"azure", "anam", "livekit"}:
        return provider
    if is_anam_configured():
        return "anam"
    if is_livekit_configured():
        return "livekit"
    return "azure"


async def ensure_livekit_dispatch(room: str) -> None:
    if livekit_api is None:
        raise HTTPException(
            status_code=500,
            detail="livekit-api package is not installed on the server.",
        )

    api_key = require_env("LIVEKIT_API_KEY")
    api_secret = require_env("LIVEKIT_API_SECRET")
    url = require_env("LIVEKIT_URL")
    agent_name = (
        os.getenv("LIVEKIT_AGENT_NAME", DEFAULT_LIVEKIT_AGENT_NAME).strip()
        or DEFAULT_LIVEKIT_AGENT_NAME
    )

    lkapi = livekit_api.LiveKitAPI(url=url, api_key=api_key, api_secret=api_secret)
    try:
        await lkapi.agent_dispatch.create_dispatch(
            livekit_api.CreateAgentDispatchRequest(
                agent_name=agent_name,
                room=room,
            )
        )
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"LiveKit agent dispatch failed: {exc}",
        ) from exc
    finally:
        await lkapi.aclose()


def issue_speech_token(endpoint: str, key: str) -> str:
    # Check if Azure Speech is configured before attempting connection
    if not is_azure_speech_configured():
        raise HTTPException(
            status_code=503,
            detail="Azure Speech is not configured. Please add your Azure Speech credentials to the .env file.",
        )

    token_url = f"{endpoint.rstrip('/')}/sts/v1.0/issueToken"
    token_request = request.Request(
        token_url,
        method="POST",
        headers={
            "Ocp-Apim-Subscription-Key": key,
            "Content-Length": "0",
        },
    )

    try:
        with request.urlopen(token_request, timeout=15) as response:
            return response.read().decode("utf-8")
    except error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="ignore")
        raise HTTPException(
            status_code=exc.code, detail=detail or "Speech token request failed"
        )
    except error.URLError as exc:
        raise HTTPException(
            status_code=502, detail=f"Speech token request failed: {exc.reason}"
        )


def fetch_avatar_relay(region: str, key: str) -> dict:
    relay_url = f"https://{region}.tts.speech.microsoft.com/cognitiveservices/avatar/relay/token/v1"
    relay_request = request.Request(
        relay_url,
        method="GET",
        headers={"Ocp-Apim-Subscription-Key": key},
    )

    try:
        with request.urlopen(relay_request, timeout=15) as response:
            return json.loads(response.read().decode("utf-8"))
    except error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="ignore")
        raise HTTPException(
            status_code=exc.code, detail=detail or "Avatar relay request failed"
        )
    except error.URLError as exc:
        raise HTTPException(
            status_code=502, detail=f"Avatar relay request failed: {exc.reason}"
        )


def format_email_content(content: str, subject: str) -> str:
    """Format email content as professional HTML, removing markdown and improving formatting."""
    from datetime import datetime
    import re

    # Clean up markdown-style formatting
    cleaned_content = content.strip()

    # Remove markdown bold formatting (**text** -> <strong>text</strong>)
    cleaned_content = re.sub(r"\*\*(.*?)\*\*", r"<strong>\1</strong>", cleaned_content)

    # Remove markdown headers (# -> nothing, make them bold instead)
    cleaned_content = re.sub(
        r"^#+\s*(.+)$", r"<strong>\1</strong>", cleaned_content, flags=re.MULTILINE
    )

    # Convert bullet points (- item -> proper HTML list items)
    lines = cleaned_content.split("\n")
    formatted_lines = []
    in_list = False
    list_items = []

    for line in lines:
        line = line.strip()

        # Check if line starts with bullet point
        if line.startswith("- ") or line.startswith("• "):
            if not in_list:
                in_list = True
                list_items = []
            # Remove bullet point marker and add to list
            clean_item = line.lstrip("- •").strip()
            if clean_item:
                list_items.append(clean_item)
        else:
            # If we were in a list, close it
            if in_list:
                if list_items:
                    list_html = '<ul style="margin: 16px 0; padding-left: 20px; list-style-type: disc;">'
                    for item in list_items:
                        list_html += f'<li style="margin-bottom: 8px; line-height: 1.5; color: #444;">{item}</li>'
                    list_html += "</ul>"
                    formatted_lines.append(list_html)
                in_list = False
                list_items = []

            # Add regular line if not empty
            if line:
                formatted_lines.append(line)

    # Handle any remaining list at the end
    if in_list and list_items:
        list_html = (
            '<ul style="margin: 16px 0; padding-left: 20px; list-style-type: disc;">'
        )
        for item in list_items:
            list_html += f'<li style="margin-bottom: 8px; line-height: 1.5; color: #444;">{item}</li>'
        list_html += "</ul>"
        formatted_lines.append(list_html)

    # Join lines and split into paragraphs
    content_text = "\n".join(formatted_lines)

    # Split into paragraphs (double line breaks)
    paragraphs = [p.strip() for p in content_text.split("\n\n") if p.strip()]
    if not paragraphs:
        paragraphs = [content_text.strip()]

    # Format paragraphs as HTML
    formatted_paragraphs = []
    for paragraph in paragraphs:
        # Skip if it's already HTML (contains < and >)
        if "<ul" in paragraph and "</ul>" in paragraph:
            formatted_paragraphs.append(paragraph)
        else:
            # Convert line breaks within paragraphs
            paragraph_html = paragraph.replace("\n", "<br>")
            formatted_paragraphs.append(
                f'<p style="margin: 16px 0; line-height: 1.6; color: #333; text-align: justify;">{paragraph_html}</p>'
            )

    # Get current date for professional touch
    current_date = datetime.now().strftime("%B %d, %Y")

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>{subject}</title>
    </head>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
        <div style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); overflow: hidden; border: 1px solid #e9ecef;">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: white; padding: 40px; text-align: center;">
                <h1 style="margin: 0; font-size: 32px; font-weight: 400; letter-spacing: 0.5px; text-shadow: 0 2px 4px rgba(0,0,0,0.2);">{subject}</h1>
                <div style="margin-top: 15px; padding: 8px 16px; background-color: rgba(255,255,255,0.15); border-radius: 20px; display: inline-block;">
                    <p style="margin: 0; opacity: 0.95; font-size: 14px; font-weight: 300;">Generated by Musaed AI Assistant</p>
                </div>
            </div>
            
            <!-- Content -->
            <div style="padding: 50px 40px;">
                <div style="margin-bottom: 35px;">
                    <div style="display: flex; align-items: center; padding: 20px; background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%); border-radius: 10px; border-left: 5px solid #4f46e5;">
                        <div style="background-color: #4f46e5; color: white; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 15px; font-size: 18px;">📅</div>
                        <div>
                            <p style="margin: 0; font-weight: 600; color: #1e293b; font-size: 16px;">Document Date</p>
                            <p style="margin: 0; color: #64748b; font-size: 14px;">{current_date}</p>
                        </div>
                    </div>
                </div>
                
                <div style="color: #1e293b; font-size: 16px; line-height: 1.8;">
                    {"".join(formatted_paragraphs)}
                </div>
            </div>
            
            <!-- Footer -->
            <div style="background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%); padding: 30px 40px; border-top: 1px solid #e2e8f0; text-align: center;">
                <div style="display: flex; align-items: center; justify-content: center; margin-bottom: 15px;">
                    <div style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: white; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 10px; font-size: 14px;">🤖</div>
                    <p style="margin: 0; color: #475569; font-weight: 600; font-size: 16px;">Musaed AI Assistant</p>
                </div>
                <p style="margin: 0; color: #64748b; font-size: 13px; font-style: italic;">
                    Intelligent document analysis and professional communication
                </p>
                <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #cbd5e1;">
                    <p style="margin: 0; color: #94a3b8; font-size: 12px;">
                        This email was automatically generated and formatted for optimal readability
                    </p>
                </div>
            </div>
        </div>
        
        <!-- Responsive styles -->
        <style>
            @media only screen and (max-width: 600px) {{
                body {{ padding: 10px !important; }}
                .content {{ padding: 30px 20px !important; }}
                h1 {{ font-size: 24px !important; }}
                .header {{ padding: 30px 20px !important; }}
            }}
        </style>
    </body>
    </html>
    """

    return html_content


def send_email(recipient_email: str, subject: str, content: str) -> dict:
    """Send email using yagmail with configured sender credentials."""
    sender_email = "redsparkdevelopers@gmail.com"
    sender_password = "qrwd wxho orcm mnwy"

    try:
        # Format content as professional HTML
        formatted_content = format_email_content(content, subject)

        # Initialize yagmail SMTP connection
        yag = yagmail.SMTP(sender_email, sender_password)

        # Send the email with HTML content
        yag.send(to=recipient_email, subject=subject, contents=formatted_content)

        # Close the connection
        yag.close()

        return {
            "success": True,
            "message": f"Email sent successfully to {recipient_email}",
        }

    except Exception as exc:
        # Handle various email sending errors
        error_msg = str(exc)
        if "authentication" in error_msg.lower() or "password" in error_msg.lower():
            raise HTTPException(
                status_code=502,
                detail="Email authentication failed. Please check sender credentials.",
            )
        elif "network" in error_msg.lower() or "connection" in error_msg.lower():
            raise HTTPException(
                status_code=502,
                detail="Failed to connect to email server. Please check internet connection.",
            )
        elif "invalid" in error_msg.lower() and "email" in error_msg.lower():
            raise HTTPException(
                status_code=400, detail="Invalid recipient email address."
            )
        else:
            raise HTTPException(
                status_code=500, detail=f"Failed to send email: {error_msg}"
            )


load_dotenv(ENV_PATH)
UPLOAD_DIR.mkdir(exist_ok=True)

app = FastAPI(title="Musaed Demo UI")
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))


def chunk_text(text: str, chunk_size: int = 1200, overlap: int = 200) -> list[str]:
    normalized = " ".join(text.split())

    if not normalized:
        return []

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=overlap,
        separators=["\n\n", "\n", ". ", " ", ""],
    )
    return splitter.split_text(normalized)


def extract_pdf_text_by_pages(file_path: Path) -> list[str]:
    """Extract text from PDF page by page for better memory management"""
    reader = PdfReader(str(file_path))
    pages = []
    for i, page in enumerate(reader.pages):
        page_text = (page.extract_text() or "").strip()
        if page_text:  # Only include non-empty pages
            pages.append(page_text)
    return pages


def process_pdf_page_by_page(file_path: Path, document_id: str, file_name: str):
    """Process PDF page by page to avoid overloading the embedding service"""
    pages = extract_pdf_text_by_pages(file_path)

    if not pages:
        raise HTTPException(
            status_code=400, detail="Could not extract any text from the PDF."
        )

    total_chunks = 0

    with get_weaviate_client() as client:
        ensure_collection(client)
        collection = client.collections.get(COLLECTION_NAME)

        for page_num, page_text in enumerate(pages):
            # Chunk each page separately
            page_chunks = chunk_text(page_text)

            if page_chunks:
                # Embed chunks for this page (smaller batch)
                page_vectors = embed_texts(page_chunks)

                # Store chunks for this page
                for chunk_index, (chunk, vector) in enumerate(
                    zip(page_chunks, page_vectors, strict=False)
                ):
                    global_chunk_index = total_chunks + chunk_index
                    collection.data.insert(
                        properties={
                            "document_id": document_id,
                            "file_name": file_name,
                            "chunk_index": global_chunk_index,
                            "page_number": page_num
                            + 1,  # Add page number for reference
                            "content": chunk,
                        },
                        vector=vector,
                    )

                total_chunks += len(page_chunks)

                # Small delay to avoid overwhelming the embedding service
                import time

                time.sleep(0.1)

    return total_chunks


def get_chat_model() -> ChatAnthropic:
    api_key = require_env("ANTHROPIC_API_KEY")
    model = require_env("ANTHROPIC_MODEL")
    return ChatAnthropic(
        api_key=api_key,
        model=model,
        temperature=0.2,
        timeout=30,
        max_retries=2,
    )


def embed_via_sentence_transformer(texts: list[str]) -> list[list[float]]:
    """Generate embeddings using sentence-transformers locally"""
    try:
        from sentence_transformers import SentenceTransformer
        import os

        # Initialize model (singleton pattern)
        if not hasattr(embed_via_sentence_transformer, "model"):
            model_name = os.getenv("LOCAL_EMBED_MODEL", "BAAI/bge-large-en-v1.5")
            print(f"[Embedding] Loading model: {model_name}")
            embed_via_sentence_transformer.model = SentenceTransformer(model_name)
            print(f"[Embedding] Model '{model_name}' loaded successfully.")

        # Generate embeddings
        embeddings = embed_via_sentence_transformer.model.encode(
            texts, normalize_embeddings=True
        )
        return embeddings.tolist()
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Local sentence-transformers embedding failed: {exc}",
        )


def embed_via_tei(texts: list[str]) -> list[list[float]]:
    tei_url = os.getenv("TEI_EMBEDDING_URL", "http://localhost:8083/embed").strip()
    payload = json.dumps({"inputs": texts, "truncate": True}).encode("utf-8")
    req = request.Request(
        tei_url,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with request.urlopen(req, timeout=30) as response:
            raw = response.read().decode("utf-8")
            data = json.loads(raw or "[]")

        if not isinstance(data, list):
            raise HTTPException(
                status_code=503,
                detail=f"TEI returned unexpected payload type: {type(data).__name__}",
            )

        if data and isinstance(data[0], (int, float)):
            return [data]

        if data and isinstance(data[0], list):
            return data

        raise HTTPException(
            status_code=503,
            detail="TEI returned an empty or unsupported embedding response.",
        )
    except error.HTTPError as exc:
        tei_detail = exc.read().decode("utf-8", errors="ignore")
        try:
            return embed_via_sentence_transformer(texts)
        except Exception as fallback_exc:
            raise HTTPException(
                status_code=503,
                detail=(
                    f"TEI request failed ({exc.code}): {tei_detail or 'no response body'}. "
                    f"Local embedding fallback also failed: {fallback_exc}"
                ),
            )
    except error.URLError as exc:
        try:
            return embed_via_sentence_transformer(texts)
        except Exception as fallback_exc:
            raise HTTPException(
                status_code=503,
                detail=(
                    f"TEI is unreachable at {tei_url}: {exc.reason}. "
                    f"Local embedding fallback also failed: {fallback_exc}"
                ),
            )
    except json.JSONDecodeError as exc:
        try:
            return embed_via_sentence_transformer(texts)
        except Exception as fallback_exc:
            raise HTTPException(
                status_code=503,
                detail=(
                    f"TEI returned invalid JSON from {tei_url}: {exc}. "
                    f"Local embedding fallback also failed: {fallback_exc}"
                ),
            )
    except HTTPException:
        raise
    except Exception as exc:
        try:
            return embed_via_sentence_transformer(texts)
        except Exception as fallback_exc:
            raise HTTPException(
                status_code=503,
                detail=(
                    f"Unexpected TEI embedding failure at {tei_url}: {exc}. "
                    f"Local embedding fallback also failed: {fallback_exc}"
                ),
            )


def embed_texts(texts: list[str]) -> list[list[float]]:
    if not texts:
        raise HTTPException(
            status_code=400,
            detail="No input text was provided for embedding.",
        )
    return embed_via_tei(texts)


def get_weaviate_client():
    host = os.getenv("WEAVIATE_HOST", "localhost")
    port = int(os.getenv("WEAVIATE_PORT", "8081"))
    grpc_port = int(os.getenv("WEAVIATE_GRPC_PORT", "50052"))

    try:
        return weaviate.connect_to_local(host=host, port=port, grpc_port=grpc_port)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=502,
            detail=f"Failed to connect to local Weaviate at {host}:{port}: {exc}",
        )


def ensure_collection(client) -> None:
    if client.collections.exists(COLLECTION_NAME):
        return

    client.collections.create(
        name=COLLECTION_NAME,
        vector_config=Configure.Vectors.self_provided(),
        properties=[
            Property(name="document_id", data_type=DataType.TEXT),
            Property(name="file_name", data_type=DataType.TEXT),
            Property(name="chunk_index", data_type=DataType.INT),
            Property(name="page_number", data_type=DataType.INT),
            Property(name="content", data_type=DataType.TEXT),
        ],
    )


def build_chat_messages(
    question: str, contexts: list[dict] | None = None, output_language: str = "ar"
) -> list:
    language_name = "Arabic" if output_language == "ar" else "English"
    usable_contexts = [
        item
        for item in (contexts or [])
        if item.get("content")
        and (item.get("distance") is None or item.get("distance", 1) <= 0.45)
    ]

    if usable_contexts:
        context_block = "\n\n".join(
            f"[Chunk {item['chunk_index']}] {item['content']}"
            for item in usable_contexts
        )
        return [
            SystemMessage(
                content=(
                    "You are Musaed, a concise and practical assistant. "
                    f"Answer in {language_name}. "
                    "Document context is already provided in this prompt. "
                    "Never ask the user to upload, attach, or share a document again when context exists. "
                    "Use the provided document context when it is relevant to the user's question. "
                    "If the document context is partially insufficient, still provide the best possible answer from available context first, "
                    "then clearly state what is missing. "
                    "If the context is unrelated, answer from your general knowledge instead and say that briefly. "
                    "Do not claim the document contains information it does not contain."
                )
            ),
            HumanMessage(
                content=f"Question:\n{question}\n\nDocument context:\n{context_block}"
            ),
        ]

    return [
        SystemMessage(
            content=(
                "You are Musaed, a concise and practical assistant. "
                f"Answer in {language_name}. "
                "Answer from your general knowledge when no relevant document context is available. "
                "Prefer direct, useful answers."
            )
        ),
        HumanMessage(content=question),
    ]


def _extract_chunk_text(content) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for item in content:
            if isinstance(item, dict) and item.get("type") == "text":
                parts.append(item.get("text", ""))
            elif isinstance(item, str):
                parts.append(item)
        return "".join(parts)
    return str(content or "")


def _invoke_chat(messages: list) -> str:
    model = get_chat_model()

    try:
        response = model.invoke(messages)
        return (response.content or "").strip()
    except Exception as exc:  # noqa: BLE001
        message = str(exc)
        if "429" in message or "rate limit" in message.lower():
            raise HTTPException(
                status_code=429,
                detail="The Claude model is rate-limited right now. Try again in a moment.",
            )
        if "authentication" in message.lower() or "api key" in message.lower():
            raise HTTPException(
                status_code=502,
                detail=f"Claude authentication failed: {exc}",
            )
        if "connection" in message.lower() or "timeout" in message.lower():
            raise HTTPException(
                status_code=502,
                detail=f"Could not reach the Claude model endpoint: {exc}",
            )
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected chat generation failure: {exc}",
        )


def generate_answer(
    question: str, contexts: list[dict] | None = None, output_language: str = "ar"
) -> str:
    return _invoke_chat(build_chat_messages(question, contexts, output_language))


def collect_contexts(document_id: str, question: str) -> list[dict]:
    if not document_id:
        return []

    query_vector = embed_texts([question])[0]

    with get_weaviate_client() as client:
        ensure_collection(client)
        collection = client.collections.get(COLLECTION_NAME)
        response = collection.query.near_vector(
            near_vector=query_vector,
            filters=Filter.by_property("document_id").equal(document_id),
            limit=5,
            return_metadata=MetadataQuery(distance=True),
        )

    contexts = []
    for item in response.objects:
        contexts.append(
            {
                "content": item.properties.get("content", ""),
                "chunk_index": item.properties.get("chunk_index", -1),
                "distance": getattr(item.metadata, "distance", None),
            }
        )
    return contexts


def resolve_document_id(payload: dict) -> str:
    return str(payload.get("document_id") or "").strip() or _last_document_id


@app.get("/", response_class=HTMLResponse)
async def home(request: Request) -> HTMLResponse:
    return templates.TemplateResponse(
        request=request,
        name="index.html",
        context={
            "page_title": "Musaed AI Demo UI",
            "app_config": {
                "avatarProvider": get_avatar_provider(),
                "anamReady": is_anam_configured(),
                "livekitReady": is_livekit_configured(),
                "livekitUrl": os.getenv("LIVEKIT_URL", ""),
                "livekitRoom": os.getenv("LIVEKIT_ROOM", "musaed-room"),
                "speechReady": all(
                    os.getenv(name)
                    for name in (
                        "AZURE_SPEECH_ENDPOINT",
                        "AZURE_SPEECH_REGION",
                        "AZURE_SPEECH_KEY",
                    )
                ),
                "geminiSttReady": _is_gemini_stt_configured(),
                "speechEndpoint": os.getenv("AZURE_SPEECH_ENDPOINT", ""),
                "speechRegion": os.getenv("AZURE_SPEECH_REGION", ""),
                "defaultVoice": os.getenv(
                    "AZURE_SPEECH_VOICE",
                    "ar-SA-HamedNeural",
                ),
                "avatarCharacter": os.getenv("AZURE_AVATAR_CHARACTER", "harry"),
                "avatarStyle": os.getenv("AZURE_AVATAR_STYLE", "business"),
                "ragReady": all(
                    os.getenv(name)
                    for name in (
                        "ANTHROPIC_API_KEY",
                        "ANTHROPIC_MODEL",
                    )
                ),
            },
        },
    )


@app.get("/conversation", response_class=HTMLResponse)
async def conversation(request: Request) -> HTMLResponse:
    if not is_livekit_configured():
        raise HTTPException(
            status_code=503,
            detail="LiveKit is not configured. Please add LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET to .env.",
        )
    return templates.TemplateResponse(
        request=request,
        name="conversation.html",
        context={
            "page_title": "Musaed Live Conversation",
            "livekit_ready": True,
            "livekit_url": os.getenv("LIVEKIT_URL", ""),
            "livekit_room": os.getenv("LIVEKIT_ROOM", "musaed-room"),
        },
    )


@app.get("/api/config")
async def get_config() -> JSONResponse:
    return JSONResponse(
        {
            "avatarProvider": get_avatar_provider(),
            "anamReady": is_anam_configured(),
            "livekitReady": is_livekit_configured(),
            "livekitUrl": os.getenv("LIVEKIT_URL", ""),
            "livekitRoom": os.getenv("LIVEKIT_ROOM", "musaed-room"),
            "speechReady": is_azure_speech_configured(),
            "geminiSttReady": _is_gemini_stt_configured(),
            "speechRegion": os.getenv("AZURE_SPEECH_REGION", ""),
            "speechEndpoint": os.getenv("AZURE_SPEECH_ENDPOINT", ""),
        }
    )


@app.post("/api/livekit/token")
async def get_livekit_token(request: Request) -> JSONResponse:
    if not is_livekit_configured():
        raise HTTPException(
            status_code=503,
            detail="LiveKit is not configured. Add LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET to .env.",
        )

    if livekit_api is None:
        raise HTTPException(
            status_code=500,
            detail="livekit-api package is not installed on the server.",
        )

    payload = (
        await request.json()
        if request.headers.get("content-type", "").startswith("application/json")
        else {}
    )
    identity = (payload.get("identity") or f"web-{uuid.uuid4().hex[:10]}").strip()
    room = (payload.get("room") or os.getenv("LIVEKIT_ROOM", "musaed-room")).strip()
    display_name = (payload.get("name") or "Musaed Web User").strip()

    api_key = require_env("LIVEKIT_API_KEY")
    api_secret = require_env("LIVEKIT_API_SECRET")
    url = require_env("LIVEKIT_URL")
    await ensure_livekit_dispatch(room)

    token = (
        livekit_api.AccessToken(api_key, api_secret)
        .with_identity(identity)
        .with_name(display_name)
        .with_grants(
            livekit_api.VideoGrants(
                room_join=True,
                room=room,
                can_subscribe=True,
                can_publish=True,
                can_publish_data=True,
            )
        )
    )

    return JSONResponse(
        {
            "token": token.to_jwt(),
            "url": url,
            "room": room,
            "identity": identity,
        }
    )


@app.post("/api/speech/token")
async def get_speech_token() -> JSONResponse:
    endpoint = require_env("AZURE_SPEECH_ENDPOINT")
    key = require_env("AZURE_SPEECH_KEY")
    region = require_env("AZURE_SPEECH_REGION")
    token = issue_speech_token(endpoint, key)
    return JSONResponse({"token": token, "region": region})


@app.post("/api/transcribe")
async def transcribe_audio(
    file: UploadFile = File(...),
    language: str | None = Form(None),
    mime_type: str | None = Form(None),
) -> JSONResponse:
    """Transcribe audio using Vertex AI Gemini."""
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded audio file is empty.")

    try:
        text, provider, detected_language = await asyncio.to_thread(
            transcribe_with_gemini,
            content,
            file.filename or "recording.webm",
            language,
            mime_type,
        )
        return JSONResponse(
            {
                "text": text,
                "language": detected_language or (language or "").strip().lower(),
                "provider": provider,
            }
        )
    except Exception as exc:
        raise HTTPException(
            status_code=getattr(exc, "status_code", 500),
            detail=getattr(exc, "detail", f"Speech transcription failed: {exc}"),
        )


@app.get("/api/avatar/relay")
async def get_avatar_relay() -> JSONResponse:
    # Check if Azure Speech is properly configured
    if not is_azure_speech_configured():
        raise HTTPException(
            status_code=503,
            detail="Azure Speech Service is not configured. Please add your Azure Speech credentials to the .env file to enable avatar features.",
        )

    region = require_env("AZURE_SPEECH_REGION")
    key = require_env("AZURE_SPEECH_KEY")
    relay = fetch_avatar_relay(region, key)
    return JSONResponse(
        {
            "urls": relay.get("Urls", []),
            "username": relay.get("Username", ""),
            "password": relay.get("Password", ""),
        }
    )


@app.websocket("/ws/anam/video")
async def anam_video_stream(websocket: WebSocket) -> None:
    await websocket.accept()

    if not is_anam_configured():
        await websocket.send_text(
            json.dumps({"error": "ANAM_API_KEY and ANAM_PERSONA_ID are required."})
        )
        await websocket.close(code=1011)
        return

    if AnamClient is None:
        await websocket.send_text(
            json.dumps({"error": "anam package is not installed on server."})
        )
        await websocket.close(code=1011)
        return

    api_key = os.getenv("ANAM_API_KEY", "")
    persona_id = os.getenv("ANAM_PERSONA_ID", "")
    client = AnamClient(api_key=api_key, persona_id=persona_id)
    frame_index = 0

    try:
        async with client.connect() as session:

            async def stream_video() -> None:
                nonlocal frame_index
                async for frame in session.video_frames():
                    frame_index += 1
                    if frame_index % 2 != 0:
                        continue

                    jpeg_base64 = await asyncio.to_thread(
                        encode_video_frame_to_base64_jpeg, frame
                    )
                    await websocket.send_text(
                        json.dumps(
                            {
                                "type": "video",
                                "data": jpeg_base64,
                            }
                        )
                    )

            async def stream_audio() -> None:
                while True:
                    try:
                        async for frame in session.audio_frames():
                            pcm = frame.to_ndarray()
                            await websocket.send_text(
                                json.dumps(
                                    {
                                        "type": "audio",
                                        "data": base64.b64encode(pcm.tobytes()).decode(
                                            "ascii"
                                        ),
                                        "sampleRate": frame.sample_rate,
                                        "channels": frame.layout.nb_channels,
                                    }
                                )
                            )
                        return
                    except RuntimeError as exc:
                        if "Audio track not available" not in str(exc):
                            raise
                        await asyncio.sleep(0.25)

            async def handle_commands() -> None:
                while True:
                    raw_message = await websocket.receive_text()
                    payload = json.loads(raw_message)
                    action = (payload.get("action") or "").strip().lower()
                    text = (payload.get("text") or "").strip()

                    if action == "talk" and text:
                        await session.talk(text)
                    elif action == "talk_stream":
                        stream_content = payload.get("text")
                        stream_content = (
                            "" if stream_content is None else str(stream_content)
                        )
                        start_of_speech = bool(payload.get("start_of_speech", False))
                        end_of_speech = bool(payload.get("end_of_speech", False))
                        correlation_id = payload.get("correlation_id")

                        if stream_content or start_of_speech or end_of_speech:
                            await session.send_talk_stream(
                                content=stream_content,
                                start_of_speech=start_of_speech,
                                end_of_speech=end_of_speech,
                                correlation_id=correlation_id,
                            )
                    elif action == "interrupt":
                        await session.interrupt()

            tasks = [
                asyncio.create_task(stream_video()),
                asyncio.create_task(stream_audio()),
                asyncio.create_task(handle_commands()),
            ]
            done, pending = await asyncio.wait(
                tasks, return_when=asyncio.FIRST_EXCEPTION
            )

            for task in pending:
                task.cancel()

            await asyncio.gather(*pending, return_exceptions=True)

            for task in done:
                exc = task.exception()
                if exc:
                    raise exc
    except WebSocketDisconnect:
        return
    except Exception as exc:
        try:
            await websocket.send_text(
                json.dumps({"error": f"Anam stream failed: {exc}"})
            )
        finally:
            await websocket.close(code=1011)


@app.post("/api/email/send")
async def send_email_endpoint(request: Request) -> JSONResponse:
    """Send email with specified content to recipient."""
    payload = await request.json()

    recipient_email = payload.get("recipient_email", "").strip()
    subject = payload.get("subject", "").strip()
    content = payload.get("content", "").strip()

    if not recipient_email:
        raise HTTPException(status_code=400, detail="recipient_email is required.")

    if not content:
        raise HTTPException(status_code=400, detail="content is required.")

    # Use default subject if not provided
    if not subject:
        subject = "Information from Musaed AI Assistant"

    # Send the email
    result = send_email(recipient_email, subject, content)

    return JSONResponse(result)


@app.post("/api/documents/upload")
async def upload_document(file: UploadFile = File(...)) -> JSONResponse:
    suffix = Path(file.filename or "").suffix.lower()

    if suffix != ".pdf":
        raise HTTPException(
            status_code=400, detail="Only PDF uploads are supported right now."
        )

    document_id = str(uuid.uuid4())
    safe_name = f"{document_id}{suffix}"
    destination = UPLOAD_DIR / safe_name
    content = await file.read()
    destination.write_bytes(content)

    try:
        # Run indexing in a worker thread so websocket/avatar traffic stays responsive.
        total_chunks = await asyncio.to_thread(
            process_pdf_page_by_page,
            destination,
            document_id,
            file.filename or "uploaded.pdf",
        )

        global _last_document_id
        _last_document_id = document_id

        return JSONResponse(
            {
                "document_id": document_id,
                "file_name": file.filename,
                "chunk_count": total_chunks,
            }
        )
    except HTTPException:
        # Re-raise HTTP exceptions (like embedding failures)
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to process PDF: {exc}")


@app.post("/api/rag-search")
async def rag_search(request: Request) -> JSONResponse:
    """Simple RAG search endpoint for LiveKit agent function tools."""
    payload = await request.json()
    question = str(payload.get("question") or "").strip()
    output_language = str(payload.get("output_language") or "ar").strip().lower()
    if not question:
        raise HTTPException(status_code=400, detail="question is required.")

    document_id = resolve_document_id(payload)

    if not document_id:
        return JSONResponse({"answer": "لا توجد مستندات مرفوعة حالياً." if output_language == "ar" else "No documents uploaded yet.", "contexts": []})

    contexts = collect_contexts(document_id, question)
    if not contexts:
        return JSONResponse({"answer": "لم أجد معلومات ذات صلة في المستند." if output_language == "ar" else "No relevant information found in the document.", "contexts": []})

    answer = generate_answer(question, contexts, output_language=output_language)
    return JSONResponse({"answer": answer, "contexts": contexts})


@app.get("/api/active-document")
async def get_active_document() -> JSONResponse:
    """Returns the last uploaded document ID."""
    return JSONResponse({"document_id": _last_document_id})


@app.post("/api/chat")
async def chat_with_document(request: Request) -> JSONResponse:
    payload = await request.json()
    document_id = resolve_document_id(payload)
    question = str(payload.get("message") or "").strip()
    output_language = str(payload.get("output_language") or "ar").strip().lower()
    if output_language not in {"ar", "en"}:
        output_language = "ar"

    if not question:
        raise HTTPException(status_code=400, detail="message is required.")

    # Check if user is requesting to send an email
    email_keywords = [
        "send a mail",
        "send an email",
        "email this",
        "send me",
        "send email",
    ]
    is_email_request = any(keyword in question.lower() for keyword in email_keywords)

    if is_email_request:
        return JSONResponse(
            {
                "answer": (
                    "سأساعدك في إرسال البريد الإلكتروني. املأ النموذج برسالتك."
                    if output_language == "ar"
                    else "I'll help you send an email. Please fill out the form with your message."
                ),
                "is_email_request": True,
                "matches": [],
            }
        )

    contexts = collect_contexts(document_id, question)

    answer = generate_answer(question, contexts, output_language=output_language)

    return JSONResponse(
        {
            "answer": answer,
            "matches": contexts,
        }
    )


@app.post("/api/chat/stream")
async def chat_with_document_stream(request: Request) -> StreamingResponse:
    payload = await request.json()
    document_id = resolve_document_id(payload)
    question = str(payload.get("message") or "").strip()
    output_language = str(payload.get("output_language") or "ar").strip().lower()
    if output_language not in {"ar", "en"}:
        output_language = "ar"

    if not question:
        raise HTTPException(status_code=400, detail="message is required.")

    email_keywords = [
        "send a mail",
        "send an email",
        "email this",
        "send me",
        "send email",
    ]
    is_email_request = any(keyword in question.lower() for keyword in email_keywords)
    if is_email_request:
        answer = (
            "سأساعدك في إرسال البريد الإلكتروني. املأ النموذج برسالتك."
            if output_language == "ar"
            else "I'll help you send an email. Please fill out the form with your message."
        )

        async def email_stream():
            yield json.dumps({"type": "chunk", "text": answer}) + "\n"
            yield (
                json.dumps(
                    {
                        "type": "done",
                        "is_email_request": True,
                        "answer": answer,
                        "matches": [],
                    }
                )
                + "\n"
            )

        return StreamingResponse(email_stream(), media_type="application/x-ndjson")

    contexts = collect_contexts(document_id, question)
    messages = build_chat_messages(question, contexts, output_language)

    async def event_stream():
        model = get_chat_model()
        full_text = ""
        try:
            async for chunk in model.astream(messages):
                text = _extract_chunk_text(getattr(chunk, "content", ""))
                if not text:
                    continue
                full_text += text
                yield (
                    json.dumps({"type": "chunk", "text": text}, ensure_ascii=False)
                    + "\n"
                )
            yield (
                json.dumps(
                    {
                        "type": "done",
                        "answer": full_text,
                        "is_email_request": False,
                        "matches": contexts,
                    },
                    ensure_ascii=False,
                )
                + "\n"
            )
        except HTTPException:
            raise
        except Exception as exc:  # noqa: BLE001
            yield (
                json.dumps({"type": "error", "detail": str(exc)}, ensure_ascii=False)
                + "\n"
            )

    return StreamingResponse(event_stream(), media_type="application/x-ndjson")
