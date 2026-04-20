"""
LiveKit Agent Worker for Musaed AI Avatar Demo
"""

import os
import logging
from pathlib import Path
from dotenv import load_dotenv

# Check for required LiveKit packages
try:
    from livekit import agents, rtc
    from livekit.agents import (
        Agent,
        AgentSession,
        JobContext,
        WorkerOptions,
        cli,
        llm,
    )
    from livekit.plugins import anthropic, azure, anam, silero
except ImportError as e:
    raise ImportError(
        f"LiveKit agents not installed. Install with: pip install livekit livekit-agents "
        f"livekit-plugins-anthropic livekit-plugins-azure livekit-plugins-anam livekit-plugins-silero\nError: {e}"
    )

# Setup base directory and env path
BASE_DIR = Path(__file__).resolve().parent
ENV_PATH = BASE_DIR / ".env"
load_dotenv(ENV_PATH)

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


async def entrypoint(ctx: JobContext):
    """
    Main entrypoint for the LiveKit agent worker
    """
    logger.info(f"Agent joining room: {ctx.room.name}")
    
    await ctx.connect()
    
    try:
        # Create agent session with Anthropic and Azure Speech
        # Note: We use credentials directly from environment variables loaded above
        session = AgentSession(
            llm=anthropic.LLM(
                model=os.getenv("ANTHROPIC_MODEL", "claude-3-5-sonnet-20241022"),
            ),
            stt=azure.STT(
                language=os.getenv("LIVEKIT_LANGUAGE", "ar-SA"),
            ),
            tts=azure.TTS(
                voice=os.getenv("AZURE_SPEECH_VOICE", "ar-SA-HamedNeural"),
            ),
            vad=silero.VAD.load(),
        )

        # Configure Anam avatar if credentials are available
        anam_api_key = os.getenv("ANAM_API_KEY")
        anam_avatar_id = os.getenv("ANAM_AVATAR_ID")
        
        if anam_api_key and anam_avatar_id:
            logger.info(f"Initializing Anam avatar: {anam_avatar_id}")
            avatar = anam.AvatarSession(
                persona_config=anam.PersonaConfig(
                    name="Musaed",
                    avatarId=anam_avatar_id,
                ),
                api_key=anam_api_key,
            )
            # Start avatar session
            await avatar.start(session, room=ctx.room)
        else:
            logger.warning("Anam avatar credentials not fully configured in .env")

        # Create the agent logic
        agent = Agent(
            instructions=(
                "You are Musaed, a professional and helpful AI assistant. "
                "You engage in natural, friendly conversations while maintaining professionalism. "
                "Keep responses concise and engaging. You speak in a friendly, natural manner."
            ),
        )

        # Start the session
        await session.start(agent=agent, room=ctx.room)

        logger.info(f"Agent started in room: {ctx.room.name}")

        # Generate initial greeting
        session.generate_reply(
            instructions="Greet the user warmly in Arabic and ask how you can help."
        )

        # Wait for the session to finish
        await session.wait()

    except Exception as e:
        logger.error(f"Error in agent entrypoint: {e}", exc_info=True)
        raise
    finally:
        logger.info("Agent shutting down")


if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            agent_name="musaed-avatar",
        )
    )
