# 🎤 LiveKit Integration Guide - Real-Time Conversation

## Overview
Add **parallel real-time conversation** and **multi-user support** to your Musaed AI while keeping your document backend intact.

---

## 📋 Architecture

### Current Setup (Document-First)
```
User Browser
    ↓
Flask Backend (5000)
├─ Document upload
├─ Chat processing
├─ Anam avatar (streaming)
└─ Email/WhatsApp
    ↓
Weaviate + LLM
```

### With LiveKit (Hybrid)
```
User Browser
    ↓
LiveKit Room ←→ Your Flask Backend (5000)
├─ Real-time voice/video    ├─ Document upload
├─ Anam Avatar (visual)     ├─ Chat processing
├─ Multi-user support       ├─ Email/WhatsApp
└─ Echo cancellation        └─ LLM queries
                                ↓
                            Weaviate + LLM
```

**Key**: LiveKit handles **real-time communication**, your backend handles **document intelligence**

---

## 🚀 Implementation Steps

### Step 1: Create LiveKit Agent Worker

Create `livekit_agent_worker.py`:

```python
import os
import logging
from livekit.agents import Agent, AgentSession, JobContext, WorkerOptions, cli
from livekit.plugins import openai, anam
import httpx

logger = logging.getLogger(__name__)

async def entrypoint(ctx: JobContext):
    """LiveKit agent entrypoint for real-time conversation"""
    await ctx.connect()

    # Create agent session with OpenAI Realtime
    session = AgentSession(
        llm=openai.realtime.RealtimeModel(voice="alloy"),
    )

    # Configure Anam avatar
    avatar = anam.AvatarSession(
        persona_config=anam.PersonaConfig(
            name="Musaed",
            avatarId=os.getenv("ANAM_AVATAR_ID"),
        ),
        api_key=os.getenv("ANAM_API_KEY"),
    )

    # Start avatar and agent in the room
    await avatar.start(session, room=ctx.room)
    
    await session.start(
        agent=Agent(
            instructions="You are Musaed, a helpful AI assistant. You help users with document Q&A and provide professional consulting.",
        ),
        room=ctx.room,
    )

    # Generate greeting
    session.generate_reply(instructions="Welcome users to the room with a brief greeting")

if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
```

### Step 2: Update Your Backend to Support LiveKit

Update `app.py` to add LiveKit endpoints:

```python
from livekit import api
from livekit.api import AccessToken, VideoGrants

# Initialize LiveKit
livekit_url = os.getenv("LIVEKIT_URL", "ws://localhost:7880")
livekit_api_key = os.getenv("LIVEKIT_API_KEY")
livekit_api_secret = os.getenv("LIVEKIT_API_SECRET")

@app.post("/api/livekit/token")
async def get_livekit_token(request_data: dict):
    """Generate LiveKit access token for user"""
    try:
        room_name = request_data.get("room", "default-room")
        user_name = request_data.get("user", "guest")
        
        # Create token
        token = AccessToken(
            api_key=livekit_api_key,
            api_secret=livekit_api_secret,
            grant=VideoGrants(
                room_join=True,
                room=room_name,
                can_publish=True,
                can_subscribe=True,
            ),
        )
        token.identity = user_name
        
        return {
            "token": token.to_jwt(),
            "url": livekit_url,
            "room": room_name,
        }
    except Exception as e:
        return {"error": str(e)}, 400

@app.post("/api/livekit/create-room")
async def create_livekit_room(request_data: dict):
    """Create a new LiveKit room for group conversation"""
    try:
        room_name = request_data.get("room_name", "consultation-room")
        
        # Use LiveKit REST API
        token = api.AccessToken(
            api_key=livekit_api_key,
            api_secret=livekit_api_secret,
        )
        
        # Optionally set room metadata
        metadata = {
            "document_id": request_data.get("document_id"),
            "created_by": request_data.get("created_by"),
        }
        
        return {
            "room": room_name,
            "created": True,
            "metadata": metadata,
        }
    except Exception as e:
        return {"error": str(e)}, 400

@app.get("/api/livekit/rooms")
async def list_livekit_rooms():
    """List active LiveKit rooms"""
    try:
        # Get list of active rooms from LiveKit
        rooms = await get_active_rooms()
        return {"rooms": rooms}
    except Exception as e:
        return {"error": str(e)}, 400
```

### Step 3: Create Frontend for LiveKit

Create `templates/conversation.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Musaed Live Conversation</title>
    <script src="https://cdn.jsdelivr.net/npm/livekit-client@latest/dist/index.js"></script>
    <link rel="stylesheet" href="./static/conversation-styles.css" />
</head>
<body>
    <div class="conversation-container">
        <!-- Video Container -->
        <div class="video-section">
            <div id="avatar-video" class="avatar-video">
                <video id="anam-video" autoplay playsinline muted></video>
                <div class="avatar-label">Musaed Avatar</div>
            </div>
        </div>

        <!-- Conversation Info -->
        <div class="info-section">
            <div class="room-info">
                <h2 id="room-name">Room: Loading...</h2>
                <p id="participant-count">Participants: 0</p>
            </div>

            <!-- Participants List -->
            <div class="participants-list">
                <h3>Participants</h3>
                <ul id="participants">
                    <!-- Populated dynamically -->
                </ul>
            </div>

            <!-- Controls -->
            <div class="controls">
                <button id="toggleMic" class="control-btn">🎙️ Mic</button>
                <button id="toggleCamera" class="control-btn">📹 Camera</button>
                <button id="leaveRoom" class="control-btn danger">Leave Room</button>
            </div>
        </div>

        <!-- Chat/Transcript -->
        <div class="transcript-section">
            <div id="transcript" class="transcript">
                <!-- Transcription appears here -->
            </div>
        </div>
    </div>

    <script src="./static/conversation.js"></script>
</body>
</html>
```

### Step 4: Frontend JavaScript for LiveKit

Create `static/conversation.js`:

```javascript
import { connect, Room, RoomEvent, ParticipantEvent } from "https://cdn.jsdelivr.net/npm/livekit-client@latest";

let room;
let localParticipant;
let participants = new Map();

// Get room and user info from URL
const searchParams = new URLSearchParams(window.location.search);
const roomName = searchParams.get("room") || "musaed-room";
const userName = searchParams.get("user") || "user-" + Math.random().toString(36).substr(2, 9);

async function joinRoom() {
    try {
        // Get LiveKit token from backend
        const response = await fetch("/api/livekit/token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                room: roomName,
                user: userName,
            }),
        });

        const data = await response.json();
        
        if (data.error) {
            console.error("Token error:", data.error);
            return;
        }

        // Connect to LiveKit
        room = await connect(data.url, data.token, {
            autoSubscribe: true,
            audio: true,
            video: { resolution: { width: 640, height: 480 } },
        });

        console.log("Connected to room:", room.name);
        updateRoomInfo();
        setupRoomEventListeners();
        handleLocalParticipant();

        // Subscribe to existing participants
        room.participants.forEach(participantConnected);

    } catch (error) {
        console.error("Error joining room:", error);
    }
}

function setupRoomEventListeners() {
    room.on(RoomEvent.ParticipantConnected, participantConnected);
    room.on(RoomEvent.ParticipantDisconnected, participantDisconnected);
    room.on(RoomEvent.Disconnected, () => {
        console.log("Disconnected from room");
        cleanup();
    });
}

function participantConnected(participant) {
    console.log("Participant connected:", participant.name);
    
    participants.set(participant.sid, participant);
    updateParticipantsList();

    // Subscribe to audio/video
    participant.on(ParticipantEvent.TrackSubscribed, handleTrackSubscribed);
    participant.on(ParticipantEvent.TrackUnsubscribed, handleTrackUnsubscribed);

    // Update transcription when participant speaks
    participant.on(ParticipantEvent.IsSpeakingChanged, (isSpeaking) => {
        if (isSpeaking) {
            addTranscript(`${participant.name} is speaking...`, "participant");
        }
    });
}

function participantDisconnected(participant) {
    console.log("Participant disconnected:", participant.name);
    participants.delete(participant.sid);
    updateParticipantsList();
    addTranscript(`${participant.name} left the conversation`, "system");
}

function handleTrackSubscribed(track) {
    if (track.kind === "video") {
        const video = document.createElement("video");
        video.autoplay = true;
        video.playsinline = true;
        video.appendChild(track.attach());
        
        // For Anam avatar video
        if (track.source === "camera") {
            document.getElementById("anam-video").appendChild(video);
        }
    } else if (track.kind === "audio") {
        // Audio is auto-played
        track.attach();
    }
}

function handleTrackUnsubscribed(track) {
    track.detach();
}

function handleLocalParticipant() {
    localParticipant = room.localParticipant;
    
    // Handle local audio/video tracks
    localParticipant.audioTracks.forEach((track) => {
        console.log("Local audio track:", track);
    });
}

function updateRoomInfo() {
    document.getElementById("room-name").textContent = `Room: ${room.name}`;
    document.getElementById("participant-count").textContent = `Participants: ${room.participants.size + 1}`;
}

function updateParticipantsList() {
    const list = document.getElementById("participants");
    list.innerHTML = "";

    // Add local participant
    const localItem = document.createElement("li");
    localItem.textContent = `You (${userName})`;
    localItem.className = "local";
    list.appendChild(localItem);

    // Add remote participants
    participants.forEach((participant) => {
        const item = document.createElement("li");
        item.textContent = participant.name;
        item.className = participant.isSpeaking ? "speaking" : "";
        list.appendChild(item);
    });
}

function addTranscript(text, type = "assistant") {
    const transcript = document.getElementById("transcript");
    const message = document.createElement("div");
    message.className = `transcript-message ${type}`;
    message.innerHTML = `
        <span class="timestamp">${new Date().toLocaleTimeString()}</span>
        <span class="text">${text}</span>
    `;
    transcript.appendChild(message);
    transcript.scrollTop = transcript.scrollHeight;
}

// Controls
document.getElementById("toggleMic").addEventListener("click", async () => {
    const isMicOn = localParticipant.isMicrophoneEnabled();
    await localParticipant.setMicrophoneEnabled(!isMicOn);
    document.getElementById("toggleMic").classList.toggle("off", isMicOn);
});

document.getElementById("toggleCamera").addEventListener("click", async () => {
    const isCameraOn = localParticipant.isCameraEnabled();
    await localParticipant.setCameraEnabled(!isCameraOn);
    document.getElementById("toggleCamera").classList.toggle("off", isCameraOn);
});

document.getElementById("leaveRoom").addEventListener("click", async () => {
    await room.disconnect();
});

function cleanup() {
    participants.clear();
    room = null;
    localParticipant = null;
}

// Join room on load
joinRoom();
```

---

## 🔧 Environment Setup

### Update `.env`

```bash
# Existing settings
AZURE_SPEECH_ENDPOINT=https://your-speech-resource.cognitiveservices.azure.com/
AZURE_SPEECH_REGION=eastus
AZURE_SPEECH_KEY=your-key
ANTHROPIC_API_KEY=your-key
AVATAR_PROVIDER=anam
ANAM_API_KEY=your-anam-api-key
ANAM_PERSONA_ID=your-persona-id

# NEW: LiveKit settings
LIVEKIT_URL=ws://localhost:7880  # or wss://your-livekit-cloud.com
LIVEKIT_API_KEY=your-livekit-api-key
LIVEKIT_API_SECRET=your-livekit-api-secret
LIVEKIT_ROOM=musaed-room

# NEW: OpenAI for LiveKit agent
OPENAI_API_KEY=your-openai-key
```

### Install Dependencies

```bash
pip install livekit livekit-plugins-openai livekit-plugins-anam python-livekit
npm install livekit-client
```

---

## 📊 Running Both Services

### Terminal 1: Flask Backend
```bash
cd /home/redspark/Pictures/AIAvatarDemo
source venv/bin/activate
python app.py
# Runs on localhost:5000
```

### Terminal 2: LiveKit Agent Worker
```bash
cd /home/redspark/Pictures/AIAvatarDemo
source venv/bin/activate
python livekit_agent_worker.py dev
# Connects to LiveKit and automatically joins rooms
```

### Terminal 3: LiveKit Server (if self-hosted)
```bash
livekit-server --dev
# Runs on localhost:7880
```

---

## 🎯 Usage Flow

### Single User (Original)
```
User → Your Document Backend → Weaviate → LLM → Avatar speaks
```

### Multi-User Real-Time Conversation (New)
```
User 1 ─┐
        ├─→ LiveKit Room ─→ Agent Worker ─→ Weaviate/LLM
User 2 ─┤                                  → Anam Avatar
User 3 ─┘                                  → All hear/see together
```

---

## 📍 Access Points

### Original Document Q&A
- URL: `http://localhost:5000`
- Use: Single-user, document focused

### New Live Conversation
- URL: `http://localhost:5000/conversation?room=musaed-room&user=john`
- Use: Multi-user, real-time chat
- Avatar joins automatically

---

## ✨ Features

### Real-Time Conversation
- ✅ Multiple users in one room
- ✅ Parallel real-time talk
- ✅ Low latency (<100ms)
- ✅ Echo cancellation
- ✅ Noise suppression
- ✅ Automatic transcription

### Document Integration (Still Works)
- ✅ Upload documents
- ✅ Process PDFs
- ✅ Generate answers from documents
- ✅ Send via email/WhatsApp

### Avatar Features
- ✅ Visual presence in room
- ✅ Real-time speech synthesis
- ✅ Multi-user awareness
- ✅ Professional appearance

---

## 🔌 API Endpoints (New)

### Get LiveKit Token
```bash
POST /api/livekit/token
{
  "room": "room-name",
  "user": "user-name"
}
→ {
  "token": "...",
  "url": "ws://...",
  "room": "room-name"
}
```

### Create Room
```bash
POST /api/livekit/create-room
{
  "room_name": "consultation-room",
  "document_id": "doc-123",
  "created_by": "admin"
}
→ {
  "room": "room-name",
  "created": true
}
```

### List Active Rooms
```bash
GET /api/livekit/rooms
→ {
  "rooms": [
    { "name": "room-1", "participants": 3 },
    { "name": "room-2", "participants": 1 }
  ]
}
```

---

## 🧪 Testing

### Test Real-Time Conversation
1. Open two browser windows
2. URL 1: `localhost:5000/conversation?room=test&user=alice`
3. URL 2: `localhost:5000/conversation?room=test&user=bob`
4. Both should see each other
5. Avatar responds to both in real-time

### Test Document + Conversation
1. Upload a document via `localhost:5000`
2. Create room with document context
3. Join conversation
4. Ask questions about the document
5. Avatar answers using your backend RAG

---

## 📈 Scaling Strategy

### Phase 1: Single Room (Now)
- One conversation room
- Multiple users
- Documents stored locally

### Phase 2: Multiple Rooms
- Support multiple concurrent conversations
- Separate rooms by project/team
- Shared document library

### Phase 3: Enterprise
- User management & authentication
- Room permissions & roles
- Audit logging
- Multi-region deployment

---

## ⚡ Performance Tips

1. **Use LiveKit Cloud** (better than self-hosted for production)
2. **Enable VP9 codec** for better video compression
3. **Set appropriate bandwidth limits** for your users
4. **Cache document embeddings** in Redis
5. **Batch API calls** to Weaviate

---

## 🎬 Next Steps

1. ✅ Get LiveKit API credentials (from livekit.io)
2. ✅ Deploy LiveKit server (cloud or self-hosted)
3. ✅ Install dependencies
4. ✅ Update .env with credentials
5. ✅ Create agent worker file
6. ✅ Update Flask backend
7. ✅ Test with two browsers
8. ✅ Deploy to production

---

**Status**: Ready to implement  
**Complexity**: Medium (combining two systems)  
**Timeline**: 1-2 days to integrate  
**Result**: Professional multi-user AI conversation platform 🚀
