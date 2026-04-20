/* LiveKit Conversation Client */

const LiveKitSDK = window.LivekitClient || window.LiveKitClient || {};
const { Room, RoomEvent, ParticipantEvent, ConnectionState } = LiveKitSDK;

let room = null;
let localParticipant = null;
const remoteParticipants = new Map();
const messageHistory = [];
const MIN_MESSAGE_LENGTH = 1;

// Get room and user info from URL parameters
const searchParams = new URLSearchParams(window.location.search);
const roomName = searchParams.get("room") || "musaed-room";
const userName = searchParams.get("user") || "user-" + Math.random().toString(36).substr(2, 9);

// DOM Elements
const roomInfoEl = document.getElementById("room-info");
const connectionStatusEl = document.getElementById("connection-status");
const participantCountEl = document.getElementById("participant-count");
const participantsListEl = document.getElementById("participants-list");
const transcriptEl = document.getElementById("transcript");
const toggleMicBtn = document.getElementById("toggleMic");
const toggleCameraBtn = document.getElementById("toggleCamera");
const toggleScreenBtn = document.getElementById("toggleScreen");
const leaveRoomBtn = document.getElementById("leaveRoom");
const chatInputEl = document.getElementById("chat-input");
const sendMessageBtn = document.getElementById("send-message");
const micTranscribeBtn = document.getElementById("mic-transcribe");

// Speech Recognition Variables
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let isRecognizing = false;

if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = true; // Keep listening for faster, less choppy STT updates
    recognition.interimResults = true; // Show results as you speak
    recognition.lang = searchParams.get("lang") || "ar-SA";

    recognition.onstart = () => {
        isRecognizing = true;
        micTranscribeBtn.classList.add("active");
        chatInputEl.placeholder = "Listening...";
    };

    recognition.onresult = (event) => {
        let transcript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
        }
        chatInputEl.value = transcript;
        
        // If it's a final result, auto-send
        if (event.results[event.results.length - 1].isFinal) {
            recognition.stop();
            void sendChatMessage();
        }
    };

    recognition.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        stopRecognition();
    };

    recognition.onend = () => {
        stopRecognition();
    };
}

function stopRecognition() {
    isRecognizing = false;
    micTranscribeBtn.classList.remove("active");
    chatInputEl.placeholder = "Type a message...";
    if (recognition) recognition.stop();
}

micTranscribeBtn.addEventListener("click", () => {
    if (!recognition) {
        showError("Speech recognition not supported in this browser.");
        return;
    }

    if (isRecognizing) {
        recognition.stop();
    } else {
        chatInputEl.value = "";
        recognition.start();
    }
});
const anamVideoEl = document.getElementById("anam-video");
const localVideoEl = document.getElementById("local-video");
const remoteVideoContainerEl = document.getElementById("remote-video-container");
const errorToastEl = document.getElementById("error-toast");
const autoGainControlEl = document.getElementById("autoGainControl");
const noiseSuppressionEl = document.getElementById("noiseSuppression");
const echoCancellationEl = document.getElementById("echoCancellation");

// Audio Constraint Settings
const audioConstraints = {
    autoGainControl: { ideal: true },
    noiseSuppression: { ideal: true },
    echoCancellation: { ideal: true },
};

/**
 * Initialize and join the room
 */
async function joinRoom() {
    try {
        updateConnectionStatus("connecting", "Connecting...");
        
        // Request token from backend
        const response = await fetch("/api/livekit/token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                room: roomName,
                identity: userName,
                name: userName,
            }),
        });

        if (!response.ok) {
            throw new Error(`Failed to get token: ${response.statusText}`);
        }

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error);
        }

        console.log("Connecting to LiveKit URL:", data.url);
        console.log("With identity:", userName);

        // Connect to LiveKit
        if (!Room) {
            throw new Error("LiveKit SDK not loaded correctly. Please refresh the page.");
        }

        room = new Room({
            adaptiveStream: true,
            dynacast: true,
            publishDefaults: {
                videoEncoding: {
                    maxBitrate: 1_500_000,
                    maxFramerate: 30,
                },
            },
        });

        await room.connect(data.url, data.token);

        // Publish local tracks - wrap in try/catch to handle missing devices
        try {
            await room.localParticipant.setMicrophoneEnabled(true);
        } catch (e) {
            console.warn("Could not enable microphone:", e);
            addTranscript("Microphone not found or access denied.", "system");
        }

        try {
            await room.localParticipant.setCameraEnabled(true);
        } catch (e) {
            console.warn("Could not enable camera:", e);
            addTranscript("Camera not found or access denied.", "system");
        }

        updateConnectionStatus("connected", "Connected");
        setupRoomEventListeners();
        handleLocalParticipant();

        // Update room info
        roomInfoEl.textContent = `📍 Room: ${room.name} • You: ${userName}`;

        // Subscribe to existing participants
        if (room.remoteParticipants) {
            room.remoteParticipants.forEach((participant) => participantConnected(participant));
        }

        addTranscript(`You joined the room as "${userName}"`, "system");

    } catch (error) {
        console.error("Error joining room:", error);
        updateConnectionStatus("disconnected", "Connection Failed");
        showError(`Connection Error: ${error.message}`);
    }
}

/**
 * Setup room event listeners
 */
function setupRoomEventListeners() {
    room.on(RoomEvent.ParticipantConnected, participantConnected);
    room.on(RoomEvent.ParticipantDisconnected, participantDisconnected);
    room.on(RoomEvent.Disconnected, handleDisconnect);
    room.on(RoomEvent.DataReceived, handleDataMessage);
}

/**
 * Handle new participant connection
 */
function participantConnected(participant) {
    console.log(`Participant connected: ${participant.name}`);
    remoteParticipants.set(participant.sid, participant);
    updateParticipantsList();
    addTranscript(`${participant.name} joined the room`, "system");

    // Subscribe to participant events
    participant.on(ParticipantEvent.TrackSubscribed, handleTrackSubscribed);
    participant.on(ParticipantEvent.TrackUnsubscribed, handleTrackUnsubscribed);
    participant.on(ParticipantEvent.IsSpeakingChanged, (isSpeaking) => {
        updateParticipantsList();
        if (isSpeaking) {
            addTranscript(`${participant.name} is speaking...`, "status");
        }
    });

    // Initial render
    renderRemoteParticipants();
}

/**
 * Handle participant disconnection
 */
function participantDisconnected(participant) {
    console.log(`Participant disconnected: ${participant.name}`);
    remoteParticipants.delete(participant.sid);
    updateParticipantsList();
    renderRemoteParticipants();
    addTranscript(`${participant.name} left the room`, "system");
}

/**
 * Handle track subscription
 */
function handleTrackSubscribed(track, publication, participant) {
    if (track.kind === "video") {
        renderRemoteParticipants();
    } else if (track.kind === "audio") {
        const audioElement = track.attach();
        audioElement.play();
    }
}

/**
 * Handle track unsubscription
 */
function handleTrackUnsubscribed(track) {
    track.detach();
}

/**
 * Render remote participant videos
 */
function renderRemoteParticipants() {
    remoteVideoContainerEl.innerHTML = "";

    remoteParticipants.forEach((participant, sid) => {
        const videoPub = Array.from(participant.videoTrackPublications.values())[0];
        const videoTrack = videoPub?.track;

        if (videoTrack) {
            const videoEl = document.createElement("div");
            videoEl.className = `video-item ${participant.isSpeaking ? "speaking" : ""}`;

            const video = videoTrack.attach();
            video.style.width = "100%";
            video.style.height = "100%";
            video.style.objectFit = "cover";

            const label = document.createElement("div");
            label.className = "video-label";
            label.textContent = participant.name;

            videoEl.appendChild(video);
            videoEl.appendChild(label);
            remoteVideoContainerEl.appendChild(videoEl);
        }
    });
}

/**
 * Handle local participant setup
 */
function handleLocalParticipant() {
    localParticipant = room.localParticipant;

    // Attach local video
    const videoPub = Array.from(localParticipant.videoTrackPublications.values())[0];
    if (videoPub && videoPub.track) {
        const video = videoPub.track.attach();
        video.style.width = "100%";
        video.style.height = "100%";
        video.style.objectFit = "cover";
        localVideoEl.replaceWith(video);
        video.id = "local-video";
    }

    updateControlsState();
}

/**
 * Handle room disconnection
 */
function handleDisconnect() {
    console.log("Disconnected from room");
    updateConnectionStatus("disconnected", "Disconnected");
    addTranscript("You have been disconnected from the room", "system");
    cleanup();
}

/**
 * Handle data messages from other participants
 */
function handleDataMessage(payload, participant) {
    try {
        const message = JSON.parse(new TextDecoder().decode(payload));
        if (message.type === "chat") {
            addTranscript(`${participant.name}: ${message.text}`, "participant");
        }
    } catch (error) {
        console.error("Error handling data message:", error);
    }
}

/**
 * Send chat message to other participants
 */
async function sendChatMessage() {
    const text = chatInputEl.value.trim();

    if (!text || text.length < MIN_MESSAGE_LENGTH) {
        return;
    }

    if (!room || !localParticipant) {
        showError("Not connected to room");
        return;
    }

    try {
        // Add to local transcript
        addTranscript(`You: ${text}`, "user");

        // Send to other participants via data channel
        const message = JSON.stringify({ type: "chat", text });
        await room.localParticipant.publishData(new TextEncoder().encode(message), {
            reliable: true,
        });

        // Clear input
        chatInputEl.value = "";
    } catch (error) {
        console.error("Error sending message:", error);
        showError(`Failed to send message: ${error.message}`);
    }
}

/**
 * Update participants list in sidebar
 */
function updateParticipantsList() {
    participantsListEl.innerHTML = "";
    const totalParticipants = remoteParticipants.size + 1; // +1 for self
    participantCountEl.textContent = totalParticipants;

    // Add local participant
    const localItem = document.createElement("li");
    const localDot = document.createElement("span");
    localDot.className = "status-dot";
    localItem.appendChild(localDot);
    localItem.appendChild(document.createTextNode(`You (${userName})`));
    participantsListEl.appendChild(localItem);

    // Add remote participants
    remoteParticipants.forEach((participant) => {
        const item = document.createElement("li");
        if (participant.isSpeaking) {
            item.classList.add("speaking");
        }

        const dot = document.createElement("span");
        dot.className = "status-dot";
        item.appendChild(dot);
        item.appendChild(document.createTextNode(participant.name));
        participantsListEl.appendChild(item);
    });
}

/**
 * Add message to transcript
 */
function addTranscript(text, type = "assistant") {
    const message = {
        text,
        type,
        timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        }),
    };

    messageHistory.push(message);

    const messageEl = document.createElement("div");
    messageEl.className = `transcript-message ${type}`;
    messageEl.innerHTML = `
        <span class="timestamp">${message.timestamp}</span>
        <span class="text">${escapeHtml(text)}</span>
    `;

    transcriptEl.appendChild(messageEl);
    transcriptEl.scrollTop = transcriptEl.scrollHeight;
}

/**
 * Update connection status badge
 */
function updateConnectionStatus(state, label) {
    connectionStatusEl.textContent = `● ${label}`;
    connectionStatusEl.className = `status-badge ${state}`;
}

/**
 * Update control button states
 */
function updateControlsState() {
    const isMicOn = localParticipant.isMicrophoneEnabled;
    const isCameraOn = localParticipant.isCameraEnabled;

    toggleMicBtn.classList.toggle("off", !isMicOn);
    toggleCameraBtn.classList.toggle("off", !isCameraOn);
}

/**
 * Show error toast
 */
function showError(message) {
    errorToastEl.textContent = message;
    errorToastEl.classList.add("active");

    setTimeout(() => {
        errorToastEl.classList.remove("active");
    }, 5000);
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const map = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Cleanup on disconnect
 */
function cleanup() {
    remoteParticipants.clear();
    room = null;
    localParticipant = null;
}

/* Event Listeners */

toggleMicBtn.addEventListener("click", async () => {
    if (!localParticipant) return;
    const isMicOn = localParticipant.isMicrophoneEnabled;
    await localParticipant.setMicrophoneEnabled(!isMicOn);
    updateControlsState();
    addTranscript(
        `Microphone ${!isMicOn ? "enabled" : "disabled"}`,
        "system"
    );
});

toggleCameraBtn.addEventListener("click", async () => {
    if (!localParticipant) return;
    const isCameraOn = localParticipant.isCameraEnabled;
    await localParticipant.setCameraEnabled(!isCameraOn);
    updateControlsState();
    addTranscript(
        `Camera ${!isCameraOn ? "enabled" : "disabled"}`,
        "system"
    );
});

toggleScreenBtn.addEventListener("click", async () => {
    if (!localParticipant) return;
    try {
        const isScreenSharing = localParticipant.isScreenShareEnabled;
        if (isScreenSharing) {
            await localParticipant.setScreenShareEnabled(false);
            addTranscript("Screen share stopped", "system");
        } else {
            await localParticipant.setScreenShareEnabled(true, {
                resolution: { width: 1920, height: 1080 },
            });
            addTranscript("Screen share started", "system");
        }
    } catch (error) {
        showError(`Screen share error: ${error.message}`);
    }
});

leaveRoomBtn.addEventListener("click", async () => {
    if (room) {
        await room.disconnect();
        addTranscript("You left the room", "system");
        // Redirect to home after 2 seconds
        setTimeout(() => {
            window.location.href = "/";
        }, 2000);
    }
});

sendMessageBtn.addEventListener("click", sendChatMessage);

chatInputEl.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendChatMessage();
    }
});

autoGainControlEl.addEventListener("change", (event) => {
    audioConstraints.autoGainControl = { ideal: event.target.checked };
});

noiseSuppressionEl.addEventListener("change", (event) => {
    audioConstraints.noiseSuppression = { ideal: event.target.checked };
});

echoCancellationEl.addEventListener("change", (event) => {
    audioConstraints.echoCancellation = { ideal: event.target.checked };
});

/* Initialize on load */
document.addEventListener("DOMContentLoaded", () => {
    joinRoom();
});

/* Handle page unload */
window.addEventListener("beforeunload", async () => {
    if (room) {
        await room.disconnect();
    }
});
