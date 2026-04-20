import asyncio
import traceback
from livekit.plugins.google import STT

async def main():
    try:
        stt = STT(languages=["ar-SA"])
        with open("google_stt_result.txt", "w") as f:
            f.write("Success!")
    except Exception as e:
        with open("google_stt_result.txt", "w") as f:
            f.write(f"Error: {traceback.format_exc()}")

asyncio.run(main())
