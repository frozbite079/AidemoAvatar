// Mobile-specific optimizations
function initializeMobileOptimizations() {
  // Prevent iOS zoom on input focus
  const inputs = document.querySelectorAll('input, textarea, select');
  inputs.forEach(input => {
    // Ensure minimum font-size to prevent zoom
    if (window.innerWidth <= 768) {
      input.style.fontSize = '16px';
    }
  });

  // Touch-friendly button sizing
  const buttons = document.querySelectorAll('button');
  buttons.forEach(button => {
    if (window.innerWidth <= 768) {
      button.style.minHeight = '44px'; // Apple's recommended touch target size
    }
  });

  // Improve scroll behavior on mobile
  if ('ontouchstart' in window) {
    document.body.style.webkitOverflowScrolling = 'touch';
  }

  // Prevent double-tap zoom on buttons
  buttons.forEach(button => {
    button.addEventListener('touchend', function (e) {
      e.preventDefault();
      e.target.click();
    }, { passive: false });
  });

  // Handle orientation changes
  window.addEventListener('orientationchange', function () {
    setTimeout(() => {
      // Recalculate avatar stage dimensions
      const avatarStage = document.querySelector('.avatar-stage');
      if (avatarStage) {
        avatarStage.style.height = window.innerHeight < 600 ? '150px' : '200px';
      }

      // Adjust chat thread height
      const chatThread = document.getElementById('chatThread');
      if (chatThread && window.innerWidth <= 640) {
        chatThread.style.maxHeight = `calc(${window.innerHeight}px - 300px)`;
      }
    }, 100);
  });

  // Improve modal positioning on mobile keyboards
  const modal = document.getElementById('emailModal');
  if (modal) {
    const inputs = modal.querySelectorAll('input, textarea');
    inputs.forEach(input => {
      input.addEventListener('focus', () => {
        if (window.innerWidth <= 640) {
          setTimeout(() => {
            modal.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 300); // Wait for keyboard animation
        }
      });
    });
  }
}

// Initialize mobile optimizations on load
document.addEventListener('DOMContentLoaded', initializeMobileOptimizations);
window.addEventListener('resize', initializeMobileOptimizations);

// Enhanced touch handling for avatar controls
function addTouchOptimizations() {
  const avatarStage = document.querySelector('.avatar-stage');
  if (avatarStage) {
    // Add touch feedback
    avatarStage.addEventListener('touchstart', function () {
      this.style.transform = 'scale(0.98)';
    }, { passive: true });

    avatarStage.addEventListener('touchend', function () {
      this.style.transform = 'scale(1)';
    }, { passive: true });
  }

  // Improve prompt chip interactions
  const promptChips = document.querySelectorAll('.prompt-chip');
  promptChips.forEach(chip => {
    chip.addEventListener('touchstart', function () {
      this.style.transform = 'scale(0.95)';
    }, { passive: true });

    chip.addEventListener('touchend', function () {
      this.style.transform = 'scale(1)';
    }, { passive: true });
  });
}

// Call touch optimizations after DOM is ready
document.addEventListener('DOMContentLoaded', addTouchOptimizations);

// Enhanced drag and drop for mobile
function enhanceMobileFileUpload() {
  const uploadTrigger = document.getElementById('uploadTrigger');
  const fileInput = document.getElementById('fileInput');

  if (uploadTrigger && fileInput) {
    // Add visual feedback for file selection
    uploadTrigger.addEventListener('touchstart', function () {
      this.style.backgroundColor = 'rgba(0, 0, 0, 0.1)';
    }, { passive: true });

    uploadTrigger.addEventListener('touchend', function () {
      this.style.backgroundColor = '';
    }, { passive: true });

    // Improve file input accessibility on mobile
    fileInput.addEventListener('change', function () {
      if (window.innerWidth <= 640) {
        uploadTrigger.textContent = this.files.length > 0 ? '📎' : '+';
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', enhanceMobileFileUpload);

const speechCard = document.getElementById("speechCard");
const fileInput = document.getElementById("fileInput");
const uploadResult = document.getElementById("uploadResult");
const chatThread = document.getElementById("chatThread");
const chatComposer = document.getElementById("chatComposer");
const chatInput = document.getElementById("chatInput");
const promptChips = document.querySelectorAll(".prompt-chip");
const micButton = document.getElementById("toggleMic");
const speakButton = document.getElementById("speakResponse");
const avatarPlaceholder = document.getElementById("avatarPlaceholder");
const languageSelect = document.getElementById("languageSelect");
const sdkStatus = document.getElementById("sdkStatus");
const remoteVideo = document.getElementById("remoteVideo");
const subtitles = document.getElementById("subtitles");
const assistantLauncher = document.getElementById("assistantLauncher");
const assistantPopup = document.getElementById("assistantPopup");
const assistantClose = document.getElementById("assistantClose");
const uploadTrigger = document.getElementById("uploadTrigger");

// Enhanced avatar elements
const avatarCharacterInput = document.getElementById("avatarCharacter");
const avatarStyleInput = document.getElementById("avatarStyle");
const ttsVoiceInput = document.getElementById("ttsVoice");
const backgroundColorInput = document.getElementById("backgroundColor");
const customizedAvatarCheckbox = document.getElementById("customizedAvatar");
const transparentBackgroundCheckbox = document.getElementById("transparentBackground");
const videoCropCheckbox = document.getElementById("videoCrop");
const showSubtitlesCheckbox = document.getElementById("showSubtitles");
const startAvatarButton = document.getElementById("startAvatarSession");
const stopAvatarButton = document.getElementById("stopAvatarSession");
const customSpeechText = document.getElementById("customSpeechText");
const speakCustomTextButton = document.getElementById("speakCustomText");
const canvasElement = document.getElementById("canvas");
const tmpCanvasElement = document.getElementById("tmpCanvas");

// Email modal elements
const emailModal = document.getElementById("emailModal");
const emailModalClose = document.getElementById("emailModalClose");
const emailForm = document.getElementById("emailForm");
const recipientEmail = document.getElementById("recipientEmail");
const emailSubject = document.getElementById("emailSubject");
const emailContent = document.getElementById("emailContent");
const sendEmailButton = document.getElementById("sendEmail");
const cancelEmailButton = document.getElementById("cancelEmail");

const config = window.APP_CONFIG || {};
let activeDocumentId = null;
let greetingSpoken = false;
let assistantLanguage = "ar";

const cannedResponses = {
  "Summarize the file":
    "This demo presents Musaed as a modern AI avatar assistant that can ingest files and answer questions from uploaded content.",
  "Extract key points":
    "Key points include a live avatar interface, local document retrieval, and conversational answers in voice and text.",
  "Prepare a follow-up":
    "Here is a sample follow-up: Thank you for reviewing the Musaed assistant. I can summarize your uploaded file and answer questions from it.",
  "لخّص الملف":
    "هذا النظام يقدّم مساعدًا افتراضيًا ذكيًا لتحليل المستندات والإجابة الدقيقة بطريقة احترافية.",
  "استخرج النقاط الرئيسية":
    "أهم النقاط: واجهة تنفيذية عربية، أفاتار تفاعلي مباشر، ورفع ملفات مع إجابات مبنية على المحتوى.",
  "حضّر متابعة":
    "مقترح متابعة: شكرًا لوقتكم الكريم، ويسعدني تزويدكم بملخص تنفيذي وتوصيات عملية من المستند.",
};

const speechState = {
  recognizer: null,
  avatarSynthesizer: null,
  peerConnection: null,
  recognizing: false,
  avatarReady: false,
  synthesizing: false,
  dataChannelReady: false,
  responding: false,
  handlingMicMessage: false,
  continuousConversation: false,
  _continuousRestartTimer: null,
  lastRecognizedText: "",
  lastRecognizedAt: 0,
  // Gemini STT state
  _mediaRecorder: null,
  _mediaStream: null,
  _silenceInterval: null,
  _audioCtx: null,
};

function scheduleContinuousRecognitionRestart(delayMs = 500) {
  if (!speechState.continuousConversation) {
    return;
  }

  if (speechState._continuousRestartTimer) {
    clearTimeout(speechState._continuousRestartTimer);
  }

  // Track how many times we've deferred due to busy state
  if (!scheduleContinuousRecognitionRestart._deferCount) {
    scheduleContinuousRecognitionRestart._deferCount = 0;
  }

  speechState._continuousRestartTimer = setTimeout(async () => {
    speechState._continuousRestartTimer = null;

    if (!speechState.continuousConversation || speechState.recognizing) {
      scheduleContinuousRecognitionRestart._deferCount = 0;
      return;
    }

    // Wait until response/audio playback has settled to reduce echo.
    // But don't wait forever — after 15 defers (~5s), force-clear and restart.
    const isBusy =
      speechState.responding ||
      speechState.synthesizing ||
      speechState.handlingMicMessage ||
      anamState.isVoiceActive;

    if (isBusy && scheduleContinuousRecognitionRestart._deferCount < 15) {
      scheduleContinuousRecognitionRestart._deferCount++;
      scheduleContinuousRecognitionRestart(350);
      return;
    }

    // Reset stale flags if we hit the max defer count
    if (scheduleContinuousRecognitionRestart._deferCount >= 15) {
      console.warn("[Voice] Force-clearing stale state flags for mic restart");
      speechState.responding = false;
      speechState.synthesizing = false;
      speechState.handlingMicMessage = false;
    }
    scheduleContinuousRecognitionRestart._deferCount = 0;

    await startRecognition();
  }, delayMs);
}

const anamState = {
  socket: null,
  imageElement: null,
  audioContext: null,
  nextAudioTime: 0,
  activeSources: new Set(),
  lastAudioAt: 0,
  hasVideoFrame: false,
  isVoiceActive: false,
  voiceStatusTimer: null,
};

const livekitState = {
  room: null,
  videoElement: null,
  audioElements: new Map(),
  micEnabled: false,
  _agentTranscriptBuffer: "",
  _agentBubble: null,
  _userBubble: null,
  _recentFinalUser: null,
  _recentFinalAgent: null,
};

// Email state
let pendingEmailContent = "";
let awaitingEmailContent = false;

// Enhanced avatar state
let previousAnimationFrameTimestamp = 0;
let transparentBackgroundAnimationId = null;

// Enhanced avatar functions
function updateTransparentBackground() {
  if (transparentBackgroundCheckbox.checked) {
    backgroundColorInput.value = "#00FF00FF";
    backgroundColorInput.disabled = true;
  } else {
    backgroundColorInput.value = "#FFFFFFFF";
    backgroundColorInput.disabled = false;
  }
}

function makeBackgroundTransparent(timestamp) {
  // Throttle the frame rate to 30 FPS to reduce CPU usage
  if (timestamp - previousAnimationFrameTimestamp > 30) {
    const video = remoteVideo.querySelector("video");
    if (video && video.videoWidth > 0) {
      const tmpCanvas = tmpCanvasElement;
      const tmpCanvasContext = tmpCanvas.getContext('2d', { willReadFrequently: true });

      tmpCanvas.width = video.videoWidth;
      tmpCanvas.height = video.videoHeight;
      tmpCanvasContext.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);

      let frame = tmpCanvasContext.getImageData(0, 0, video.videoWidth, video.videoHeight);

      // Process frame for green screen removal
      for (let i = 0; i < frame.data.length / 4; i++) {
        let r = frame.data[i * 4 + 0];
        let g = frame.data[i * 4 + 1];
        let b = frame.data[i * 4 + 2];

        if (g - 150 > r + b) {
          // Set alpha to 0 for pixels that are close to green
          frame.data[i * 4 + 3] = 0;
        } else if (g + g > r + b) {
          // Reduce green part of the green pixels to avoid green edge issue
          const adjustment = (g - (r + b) / 2) / 3;
          r += adjustment;
          g -= adjustment * 2;
          b += adjustment;
          frame.data[i * 4 + 0] = r;
          frame.data[i * 4 + 1] = g;
          frame.data[i * 4 + 2] = b;
          // Reduce alpha part for green pixels to make the edge smoother
          const a = Math.max(0, 255 - adjustment * 4);
          frame.data[i * 4 + 3] = a;
        }
      }

      const canvas = canvasElement;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const canvasContext = canvas.getContext('2d');
      canvasContext.putImageData(frame, 0, 0);
    }
    previousAnimationFrameTimestamp = timestamp;
  }

  if (transparentBackgroundCheckbox.checked && speechState.avatarReady) {
    transparentBackgroundAnimationId = requestAnimationFrame(makeBackgroundTransparent);
  }
}

function htmlEncode(text) {
  const entityMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '/': '&#x2F;'
  };
  return String(text).replace(/[&<>"'\/]/g, (match) => entityMap[match]);
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

async function ensureSpeechSdk() {
  if (window.SpeechSDK) {
    return true;
  }

  const sources = [
    "https://aka.ms/csspeech/jsbrowserpackageraw",
    "https://cdn.jsdelivr.net/npm/microsoft-cognitiveservices-speech-sdk/distrib/browser/microsoft.cognitiveservices.speech.sdk.bundle-min.js",
    "https://unpkg.com/microsoft-cognitiveservices-speech-sdk/distrib/browser/microsoft.cognitiveservices.speech.sdk.bundle-min.js",
  ];

  for (const src of sources) {
    try {
      await loadScript(src);
      if (window.SpeechSDK) {
        return true;
      }
    } catch {
      // Try the next source.
    }
  }

  return false;
}

function setStatus(message) {
  console.info(`[Musaed] ${message}`);
}

function setSpeechMessage(message) {
  speechCard.querySelector(".speech-text").textContent = message;
}

function setSdkStatus(message, tone = "neutral") {
  // Only update if content or tone has actually changed
  if (sdkStatus.textContent === message && sdkStatus.dataset.tone === tone) {
    return;
  }
  sdkStatus.textContent = message;
  sdkStatus.dataset.tone = tone;
}

function detectLanguagePreference(message) {
  const normalized = (message || "").trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (
    normalized.includes("change language to english") ||
    normalized.includes("speak english") ||
    normalized.includes("answer in english") ||
    normalized.includes("بالانجليزي") ||
    normalized.includes("بالإنجليزي") ||
    normalized.includes("باللغة الانجليزية") ||
    normalized.includes("باللغة الإنجليزية")
  ) {
    return "en";
  }

  if (
    normalized.includes("change language to arabic") ||
    normalized.includes("speak arabic") ||
    normalized.includes("answer in arabic") ||
    normalized.includes("بالعربي") ||
    normalized.includes("بالعربية") ||
    normalized.includes("باللغة العربية")
  ) {
    return "ar";
  }

  return null;
}

function appendBubble(content, type) {
  const bubble = document.createElement("div");
  bubble.className = `bubble ${type === "user" ? "bubble-user" : "bubble-assistant"}`;
  bubble.dir = "auto"; // Automatically infer text direction based on content language
  bubble.textContent = content;
  chatThread.appendChild(bubble);
  chatThread.scrollTop = chatThread.scrollHeight;
  // Make response area visible when bubbles exist
  const responseArea = document.querySelector('.response-area');
  if (responseArea) responseArea.style.display = 'block';
  return bubble;
}

function normalizeTranscriptText(text) {
  return (text || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function isLikelyDuplicateFinalTranscript(type, text, windowMs = 1800) {
  const normalized = normalizeTranscriptText(text);
  if (!normalized) return false;

  const now = Date.now();
  const key = type === "user" ? "_recentFinalUser" : "_recentFinalAgent";
  const prev = livekitState[key];

  if (prev && prev.text === normalized && now - prev.at < windowMs) {
    return true;
  }

  livekitState[key] = { text: normalized, at: now };
  return false;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.detail || `Request failed: ${response.status}`);
  }

  return response.json();
}

function ensureAnamAudioContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    throw new Error("Web Audio API is not available in this browser.");
  }

  if (!anamState.audioContext || anamState.audioContext.state === "closed") {
    anamState.audioContext = new AudioContextClass();
    anamState.nextAudioTime = 0;
  }

  if (anamState.audioContext.state === "suspended") {
    anamState.audioContext.resume().catch(() => {
      setSdkStatus("Click the page to enable avatar audio.", "neutral");
    });
  }

  return anamState.audioContext;
}

function decodeBase64ToBytes(base64) {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function queueAnamAudio(base64Data, sampleRate, channels) {
  if (!base64Data || !sampleRate || !channels) {
    return;
  }

  const audioContext = ensureAnamAudioContext();
  const bytes = decodeBase64ToBytes(base64Data);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const frameCount = bytes.byteLength / 2 / channels;

  if (!Number.isFinite(frameCount) || frameCount <= 0) {
    return;
  }

  const buffer = audioContext.createBuffer(channels, frameCount, sampleRate);

  for (let channel = 0; channel < channels; channel += 1) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i += 1) {
      const sampleIndex = (i * channels + channel) * 2;
      channelData[i] = view.getInt16(sampleIndex, true) / 32768;
    }
  }

  const source = audioContext.createBufferSource();
  source.buffer = buffer;
  source.connect(audioContext.destination);
  anamState.activeSources.add(source);
  source.onended = () => {
    anamState.activeSources.delete(source);
  };

  if (anamState.nextAudioTime - audioContext.currentTime > 0.75) {
    anamState.nextAudioTime = audioContext.currentTime + 0.02;
  }
  const startTime = Math.max(audioContext.currentTime + 0.02, anamState.nextAudioTime);
  source.start(startTime);
  anamState.nextAudioTime = startTime + buffer.duration;
  anamState.lastAudioAt = Date.now();
}

function resetAnamAudioQueue() {
  if (anamState.audioContext && anamState.audioContext.state !== "closed") {
    anamState.nextAudioTime = anamState.audioContext.currentTime + 0.02;
  } else {
    anamState.nextAudioTime = 0;
  }

  anamState.activeSources.forEach((source) => {
    try {
      source.stop();
    } catch {
      // Ignore sources that already ended.
    }
  });
  anamState.activeSources.clear();
}

function sendAnamCommand(action, text = "", extras = {}) {
  if (!anamState.socket || anamState.socket.readyState !== WebSocket.OPEN) {
    throw new Error("Anam avatar is not connected.");
  }

  anamState.socket.send(JSON.stringify({ action, text, ...extras }));
}

async function streamChatReply(message, onEvent) {
  const response = await fetch("/api/chat/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      document_id: activeDocumentId,
      message,
      output_language: assistantLanguage,
    }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.detail || `Request failed: ${response.status}`);
  }

  if (!response.body) {
    throw new Error("Streaming response body is not available.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }
      onEvent(JSON.parse(trimmed));
    }
  }

  if (buffer.trim()) {
    onEvent(JSON.parse(buffer.trim()));
  }
}

// ── Cached Speech Config (avoid re-fetching token on every recognition) ──
let _cachedSpeechConfig = null;
let _cachedSpeechConfigTime = 0;
const SPEECH_CONFIG_TTL_MS = 8 * 60 * 1000; // 8 min (Azure tokens expire at 10 min)

async function createSpeechConfig() {
  const now = Date.now();
  // Reuse cached config if still fresh
  if (_cachedSpeechConfig && (now - _cachedSpeechConfigTime) < SPEECH_CONFIG_TTL_MS) {
    // Update language in case it changed
    _cachedSpeechConfig.speechRecognitionLanguage = languageSelect.value;
    return _cachedSpeechConfig;
  }

  console.log("[Speech] Fetching new Azure auth token...");
  const payload = await fetchJson("/api/speech/token", { method: "POST" });
  const speechConfig = SpeechSDK.SpeechConfig.fromAuthorizationToken(
    payload.token,
    payload.region
  );
  speechConfig.speechRecognitionLanguage = languageSelect.value;
  speechConfig.speechSynthesisVoiceName = config.defaultVoice;

  _cachedSpeechConfig = speechConfig;
  _cachedSpeechConfigTime = now;
  console.log("[Speech] Token cached. Next fetch in ~8 min.");
  return speechConfig;
}

// Pre-warm: fetch token + load SDK on page load so first recognition is instant
async function warmUpSpeechConfig() {
  try {
    const sdkReady = await ensureSpeechSdk();
    if (sdkReady && config.speechReady) {
      await createSpeechConfig();
      console.log("[Speech] Warm-up complete — first recognition will be fast.");
    }
  } catch (err) {
    console.warn("[Speech] Warm-up failed (will retry on first use):", err.message);
  }
}
warmUpSpeechConfig();

function resetRemoteMedia() {
  remoteVideo.innerHTML = "";
  subtitles.hidden = true;
  avatarPlaceholder.classList.remove("is-hidden");
}

function mountRemoteTrack(event) {
  [...remoteVideo.children].forEach((node) => {
    if (node.localName === event.track.kind) {
      remoteVideo.removeChild(node);
    }
  });

  const mediaPlayer = document.createElement(event.track.kind);
  mediaPlayer.id = event.track.kind;
  mediaPlayer.srcObject = event.streams[0];
  mediaPlayer.autoplay = true;
  mediaPlayer.playsInline = true;
  mediaPlayer.controls = false;

  // Force video to play when loaded
  mediaPlayer.addEventListener("loadeddata", async () => {
    try {
      await mediaPlayer.play();
      console.log(`${event.track.kind} started playing`);
      // Hide play button if it was showing
      if (event.track.kind === "video") {
        document.getElementById('playVideoButton').style.display = 'none';
      }
    } catch (error) {
      console.log(`${event.track.kind} play failed:`, error);
      // Show manual play button for video
      if (event.track.kind === "video") {
        document.getElementById('playVideoButton').style.display = 'block';
      }
      // Try to play again after a short delay
      setTimeout(async () => {
        try {
          await mediaPlayer.play();
          if (event.track.kind === "video") {
            document.getElementById('playVideoButton').style.display = 'none';
          }
        } catch (retryError) {
          console.error(`${event.track.kind} retry play failed:`, retryError);
        }
      }, 500);
    }
  });

  // Additional event listeners for debugging
  mediaPlayer.addEventListener("canplay", () => {
    console.log(`${event.track.kind} can play`);
  });

  mediaPlayer.addEventListener("playing", () => {
    console.log(`${event.track.kind} is playing`);
  });

  if (event.track.kind === "video") {
    avatarPlaceholder.classList.add("is-hidden");

    // Handle transparent background
    if (transparentBackgroundCheckbox.checked) {
      remoteVideo.style.width = '0.1px';
      canvasElement.getContext('2d').clearRect(0, 0, canvasElement.width, canvasElement.height);
      canvasElement.style.display = 'block';
    } else {
      canvasElement.style.display = 'none';
    }

    mediaPlayer.addEventListener('play', () => {
      if (transparentBackgroundCheckbox.checked) {
        makeBackgroundTransparent();
      } else {
        // Don't resize the video, let CSS handle it
        console.log(`Video dimensions: ${mediaPlayer.videoWidth}x${mediaPlayer.videoHeight}`);
      }
    });
  } else {
    // Mute the audio player initially to allow autoplay, will unmute when speaking
    mediaPlayer.muted = true;
  }

  remoteVideo.appendChild(mediaPlayer);
  console.log(`Mounted ${event.track.kind} track`);
}

function handleAvatarEvent(payload) {
  try {
    const webRtcEvent = JSON.parse(payload);
    const eventType = webRtcEvent?.event?.eventType;

    if (eventType === "EVENT_TYPE_TURN_START" && showSubtitlesCheckbox.checked) {
      // Show current speech text as subtitles
      const currentText = speechCard.querySelector(".speech-text")?.textContent || "";
      if (currentText) {
        subtitles.textContent = currentText;
        subtitles.hidden = false;
      }
    } else if (
      eventType === "EVENT_TYPE_SESSION_END" ||
      eventType === "EVENT_TYPE_SWITCH_TO_IDLE"
    ) {
      subtitles.hidden = true;
    }

    console.log(`[Avatar Event] ${eventType || 'Unknown event'}`);
  } catch {
    // Ignore malformed data channel payloads.
  }
}

function setupWebRtc(iceServerUrl, iceServerUsername, iceServerCredential) {
  const peerConnection = new RTCPeerConnection({
    iceServers: [
      {
        urls: [iceServerUrl],
        username: iceServerUsername,
        credential: iceServerCredential,
      },
    ],
    iceTransportPolicy: "all",
  });

  peerConnection.ontrack = (event) => {
    mountRemoteTrack(event);
  };

  peerConnection.addEventListener("datachannel", (event) => {
    const dataChannel = event.channel;
    dataChannel.onmessage = (messageEvent) => {
      handleAvatarEvent(messageEvent.data);
    };
  });

  peerConnection.createDataChannel("eventChannel");

  peerConnection.oniceconnectionstatechange = () => {
    const state = peerConnection.iceConnectionState;

    if (state === "connected") {
      speechState.avatarReady = true;
      speakButton.disabled = false;
      speakCustomTextButton.disabled = false;
      stopAvatarButton.disabled = false;
      startAvatarButton.disabled = true;
      setSdkStatus("تم ربط الأفاتار بنجاح.", "success");
      setStatus("Avatar session connected to Azure Speech.");
      setSpeechMessage("أهلاً بك، أنا مساعد الذكي. ارفع ملفك واسألني ما تريد.");
      if (!greetingSpoken) {
        greetingSpoken = true;
        queueMicrotask(() => {
          speakText("أهلاً بك، أنا مساعد الذكي. جاهز لدعمك في التحليل والعروض التنفيذية.");
        });
      }
    }

    if (state === "disconnected" || state === "failed" || state === "closed") {
      disconnectAvatar(false);
      setSdkStatus(`Avatar ${state}.`, state === "failed" ? "error" : "neutral");
    }
  };

  peerConnection.addTransceiver("video", { direction: "sendrecv" });
  peerConnection.addTransceiver("audio", { direction: "sendrecv" });
  speechState.peerConnection = peerConnection;
  return peerConnection;
}

function isAnamProvider() {
  return (config.avatarProvider || "").toLowerCase() === "anam";
}

function isLiveKitProvider() {
  return (config.avatarProvider || "").toLowerCase() === "livekit";
}

async function connectLiveKitAvatar() {
  if (livekitState.room) {
    return;
  }

  if (!config.livekitReady) {
    setSdkStatus("LiveKit is selected but not configured on server.", "error");
    return;
  }

  if (!window.LivekitClient || !window.LivekitClient.Room) {
    setSdkStatus("LiveKit client SDK did not load.", "error");
    return;
  }

  setSdkStatus("Connecting LiveKit avatar...", "pending");

  try {
    const identity = `web-${Math.random().toString(36).slice(2, 10)}`;
    const tokenPayload = await fetchJson("/api/livekit/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identity,
        room: config.livekitRoom || "musaed-room",
      }),
    });

    const sdkEvents = window.LivekitClient.RoomEvent || {};
    const room = new window.LivekitClient.Room({
      adaptiveStream: true,
      dynacast: true,
    });
    livekitState.room = room;
    let hasMediaTrack = false;
    let waitingHintTimer = null;

    if (sdkEvents.Connected) {
      room.on(sdkEvents.Connected, () => {
        setSdkStatus("Connected to LiveKit room. Waiting for avatar stream...", "pending");
      });
    }

    room.on(sdkEvents.TrackSubscribed, (track, publication) => {
      hasMediaTrack = true;
      if (waitingHintTimer) {
        clearTimeout(waitingHintTimer);
        waitingHintTimer = null;
      }

      const kind = track.kind;
      if (kind === "video") {
        const videoElement = track.attach();
        videoElement.autoplay = true;
        videoElement.playsInline = true;
        videoElement.controls = false;
        livekitState.videoElement = videoElement;
        remoteVideo.innerHTML = "";
        remoteVideo.appendChild(videoElement);
        avatarPlaceholder.classList.add("is-hidden");
      } else if (kind === "audio") {
        const audioElement = track.attach();
        audioElement.autoplay = true;
        audioElement.controls = false;
        audioElement.muted = false;
        audioElement.volume = 1.0;
        audioElement.style.display = "none";
        const sid = track.sid || publication?.trackSid || `audio-${Date.now()}`;
        livekitState.audioElements.set(sid, audioElement);
        document.body.appendChild(audioElement);
        audioElement.play().catch(() => {
          setSdkStatus("Click anywhere on the page to enable avatar audio.", "neutral");
          const unlock = () => {
            audioElement.play().catch(() => { });
            document.removeEventListener("click", unlock);
          };
          document.addEventListener("click", unlock);
        });
      }

      speechState.avatarReady = true;
      speakButton.disabled = false;
      stopAvatarButton.disabled = false;
      startAvatarButton.disabled = true;
      setSdkStatus("LiveKit avatar connected.", "success");
    });

    room.on(sdkEvents.TrackUnsubscribed, (track, publication) => {
      try {
        track.detach().forEach((el) => el.remove());
      } catch {
        // Ignore cleanup errors
      }
      if (track.kind === "audio") {
        const sid = track.sid || publication?.trackSid;
        if (sid) {
          livekitState.audioElements.delete(sid);
        }
      }
    });

    if (sdkEvents.Disconnected) {
      room.on(sdkEvents.Disconnected, () => {
        livekitState.room = null;
        livekitState.videoElement = null;
        livekitState.audioElements.clear();
        speechState.avatarReady = false;
        speakButton.disabled = true;
        stopAvatarButton.disabled = true;
        startAvatarButton.disabled = false;
        resetRemoteMedia();
        setSdkStatus("LiveKit avatar disconnected.", "neutral");
      });
    }

    const connectPromise = room.connect(tokenPayload.url || config.livekitUrl, tokenPayload.token);
    await Promise.race([
      connectPromise,
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error("LiveKit connection timeout. Check LIVEKIT_URL and network.")), 12000);
      }),
    ]);

    if (activeDocumentId) {
      try {
        const encoder = new TextEncoder();
        const data = encoder.encode(
          JSON.stringify({ type: "document_context", document_id: activeDocumentId })
        );
        await room.localParticipant.publishData(data, { reliable: true });
      } catch (err) {
        console.warn("[LiveKit] Failed to send initial document context:", err);
      }
    }

    waitingHintTimer = setTimeout(() => {
      if (livekitState.room && !hasMediaTrack) {
        setSdkStatus(
          "Connected, but no avatar track yet. Start worker: python livekit_anam_agent.py dev",
          "neutral"
        );
      }
    }, 8000);

    // --- LiveKit real-time voice: listen for agent transcriptions ---
    if (sdkEvents.TranscriptionReceived) {
      room.on(sdkEvents.TranscriptionReceived, (segments, participant) => {
        const isLocalUser = participant && participant.identity === room.localParticipant.identity;

        for (const seg of segments) {
          const text = (seg.text || "").trim();
          if (!text) continue;

          // Initialize trackers for segment deduplication
          livekitState._userBubbles = livekitState._userBubbles || {};
          livekitState._agentBubbles = livekitState._agentBubbles || {};
          livekitState._finalizedSegments = livekitState._finalizedSegments || new Set();

          if (livekitState._finalizedSegments.has(seg.id)) {
            continue; // We already completely processed this segment, ignore redundant events
          }

          if (seg.final) {
            const speakerType = isLocalUser ? "user" : "assistant";
            if (isLikelyDuplicateFinalTranscript(speakerType, text)) {
              livekitState._finalizedSegments.add(seg.id);
              if (isLocalUser) {
                chatInput.value = "";
              }
              continue;
            }
          }

          if (isLocalUser) {
            let bubble = livekitState._userBubbles[seg.id];

            // User's own speech — show bubble immediately so it appears before agent response
            if (!bubble) {
              bubble = appendBubble(text, "user");
              livekitState._userBubbles[seg.id] = bubble;
            } else {
              bubble.textContent = text;
            }
            chatInput.value = text;

            if (seg.final) {
              // Lock the user bubble and clear for next turn
              livekitState._finalizedSegments.add(seg.id);
              delete livekitState._userBubbles[seg.id];
              chatInput.value = "";
            }
          } else {
            // Agent response transcript — replace, don't append
            let bubble = livekitState._agentBubbles[seg.id];

            if (!bubble) {
              // If there's a pending chat bubble from typed input, reuse it
              if (livekitState._pendingChatBubble) {
                bubble = livekitState._pendingChatBubble;
                livekitState._pendingChatBubble = null;
              } else {
                bubble = appendBubble("...", "assistant");
              }
              livekitState._agentBubbles[seg.id] = bubble;
            }

            bubble.innerHTML = typeof marked !== "undefined" ? marked.parse(text) : text;

            if (seg.final) {
              livekitState._finalizedSegments.add(seg.id);
              delete livekitState._agentBubbles[seg.id];
            }
          }
        }
      });
    }

    // --- LiveKit real-time voice: listen for data channel messages ---
    if (sdkEvents.DataReceived) {
      room.on(sdkEvents.DataReceived, (payload, participant) => {
        try {
          const strData = new TextDecoder().decode(payload);
          const msg = JSON.parse(strData);
          if (msg.type === "show_email_modal" && msg.content) {
            console.log("[LiveKit] Agent requested to show email modal");
            showEmailModal(msg.content);
          }
        } catch (e) {
          console.warn("[LiveKit] Failed to parse DataReceived payload", e);
        }
      });
    }

    // Publish local microphone (enabled from the start for real-time voice)
    try {
      await room.localParticipant.setMicrophoneEnabled(true);
      livekitState.micEnabled = true;
      if (micButton) {
        micButton.title = "Stop mic";
        micButton.classList.add("active-mic");
      }
      const lb = document.getElementById("listeningBar");
      if (lb) lb.style.display = "flex";
      setSdkStatus("🎙️ Listening (LiveKit real-time)...", "pending");
    } catch (micErr) {
      console.warn("[LiveKit] Could not enable mic:", micErr);
    }
  } catch (error) {
    if (livekitState.room) {
      try {
        livekitState.room.disconnect();
      } catch {
        // Ignore disconnect errors
      }
    }
    livekitState.room = null;
    livekitState.videoElement = null;
    livekitState.audioElements.clear();
    setSdkStatus(error.message || "LiveKit avatar connection failed.", "error");
  }
}

function connectAnamAvatar() {
  if (anamState.socket) {
    return;
  }

  if (!config.anamReady) {
    setSdkStatus("Anam credentials missing on server.", "error");
    return;
  }

  setSdkStatus("Connecting Anam avatar...", "pending");
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  const socket = new WebSocket(`${protocol}://${window.location.host}/ws/anam/video`);
  anamState.socket = socket;
  anamState.hasVideoFrame = false;
  anamState.isVoiceActive = false;
  if (anamState.voiceStatusTimer) {
    clearTimeout(anamState.voiceStatusTimer);
    anamState.voiceStatusTimer = null;
  }
  ensureAnamAudioContext();

  socket.onmessage = (event) => {
    if (typeof event.data !== "string") {
      return;
    }

    if (event.data.startsWith("{")) {
      try {
        const payload = JSON.parse(event.data);
        if (payload.error) {
          setSdkStatus(payload.error, "error");
          return;
        }

        if (payload.type === "video") {
          if (!anamState.imageElement) {
            const img = document.createElement("img");
            img.className = "anam-video-feed";
            anamState.imageElement = img;
            remoteVideo.innerHTML = "";
            remoteVideo.appendChild(img);
            avatarPlaceholder.classList.add("is-hidden");
            speechState.avatarReady = true;
            speakButton.disabled = false;
            stopAvatarButton.disabled = false;
            startAvatarButton.disabled = true;
          }

          anamState.imageElement.src = `data:image/jpeg;base64,${payload.data}`;
          if (!anamState.hasVideoFrame) {
            anamState.hasVideoFrame = true;
            setSdkStatus("Anam avatar connected.", "success");
          }
          return;
        }

        if (payload.type === "audio") {
          queueAnamAudio(payload.data, payload.sampleRate, payload.channels);
          if (!anamState.isVoiceActive) {
            anamState.isVoiceActive = true;
            setSdkStatus("Anam voice output active.", "success");
          }

          if (anamState.voiceStatusTimer) {
            clearTimeout(anamState.voiceStatusTimer);
          }

          anamState.voiceStatusTimer = setTimeout(() => {
            anamState.isVoiceActive = false;
            if (
              speechState.avatarReady &&
              isAnamProvider() &&
              anamState.socket &&
              anamState.socket.readyState === WebSocket.OPEN
            ) {
              setSdkStatus("Anam avatar connected.", "success");
            }
          }, 350);
        }
      } catch {
        // Ignore malformed diagnostics.
      }
      return;
    }
  };

  socket.onerror = () => {
    setSdkStatus("Anam avatar connection failed.", "error");
  };

  socket.onclose = () => {
    anamState.socket = null;
    anamState.imageElement = null;
    anamState.nextAudioTime = 0;
    anamState.lastAudioAt = 0;
    anamState.hasVideoFrame = false;
    anamState.isVoiceActive = false;
    if (anamState.voiceStatusTimer) {
      clearTimeout(anamState.voiceStatusTimer);
      anamState.voiceStatusTimer = null;
    }
    if (speechState.avatarReady) {
      speechState.avatarReady = false;
      startAvatarButton.disabled = false;
      stopAvatarButton.disabled = true;
      speakButton.disabled = true;
      resetRemoteMedia();
      setSdkStatus("Anam avatar disconnected.", "neutral");
    }
  };
}

async function connectAvatar() {
  if (isLiveKitProvider()) {
    await connectLiveKitAvatar();
    return;
  }

  if (isAnamProvider()) {
    connectAnamAvatar();
    return;
  }

  if (speechState.avatarReady || speechState.avatarSynthesizer) {
    setSdkStatus("Avatar session already active.", "success");
    return;
  }

  if (!(await ensureSpeechSdk())) {
    setSdkStatus("Azure Speech SDK did not load.", "error");
    return;
  }

  setSdkStatus("Connecting avatar session...", "pending");

  try {
    const [speechConfig, relay] = await Promise.all([
      createSpeechConfig(),
      fetchJson("/api/avatar/relay"),
    ]);

    // Use configuration from UI inputs
    const avatarCharacter = avatarCharacterInput.value || config.avatarCharacter || "lisa";
    const avatarStyle = avatarStyleInput.value || config.avatarStyle || "casual-sitting";
    const backgroundColor = backgroundColorInput.value || "#FFFFFFFF";

    // Configure speech synthesis voice
    speechConfig.speechSynthesisVoiceName = ttsVoiceInput.value || config.defaultVoice;

    // Set up video format with crop options
    const videoFormat = new SpeechSDK.AvatarVideoFormat();
    if (videoCropCheckbox.checked) {
      const videoCropTopLeftX = 600;
      const videoCropBottomRightX = 1320;
      videoFormat.setCropRange(
        new SpeechSDK.Coordinate(videoCropTopLeftX, 0),
        new SpeechSDK.Coordinate(videoCropBottomRightX, 1080)
      );
    }

    const avatarConfig = new SpeechSDK.AvatarConfig(avatarCharacter, avatarStyle, videoFormat);
    avatarConfig.backgroundColor = backgroundColor;
    avatarConfig.customized = customizedAvatarCheckbox.checked;
    avatarConfig.remoteIceServers = [
      {
        urls: [relay.urls[0]],
        username: relay.username,
        credential: relay.password,
      },
    ];

    const avatarSynthesizer = new SpeechSDK.AvatarSynthesizer(
      speechConfig,
      avatarConfig
    );

    avatarSynthesizer.avatarEventReceived = (_, event) => {
      if (event?.description) {
        console.log(`[Avatar Event] ${event.description}`);
      }
    };

    const peerConnection = setupWebRtc(
      relay.urls[0],
      relay.username,
      relay.password
    );

    const result = await avatarSynthesizer.startAvatarAsync(peerConnection);
    speechState.avatarSynthesizer = avatarSynthesizer;

    if (result.reason !== SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
      throw new Error("Avatar start request was not accepted.");
    }
  } catch (error) {
    setSdkStatus(error.message || "Avatar connection failed.", "error");
    setStatus("Avatar connection failed.");
    disconnectAvatar(false);
  }
}

function disconnectAvatar(updateStatus = true) {
  if (livekitState.room) {
    livekitState.room.disconnect();
    livekitState.room = null;
    livekitState.videoElement = null;
    livekitState.audioElements.clear();
  }

  if (anamState.socket) {
    anamState.socket.close();
    anamState.socket = null;
    anamState.imageElement = null;
  }

  anamState.hasVideoFrame = false;
  anamState.isVoiceActive = false;
  if (anamState.voiceStatusTimer) {
    clearTimeout(anamState.voiceStatusTimer);
    anamState.voiceStatusTimer = null;
  }

  if (anamState.audioContext) {
    resetAnamAudioQueue();
    anamState.audioContext.close().catch(() => {
      // Ignore audio context cleanup errors.
    });
    anamState.audioContext = null;
    anamState.nextAudioTime = 0;
  }

  if (speechState.recognizing) {
    stopRecognition(false);
  }

  if (speechState.avatarSynthesizer) {
    speechState.avatarSynthesizer.close();
    speechState.avatarSynthesizer = null;
  }

  if (speechState.peerConnection) {
    speechState.peerConnection.getSenders().forEach((sender) => sender.track?.stop());
    speechState.peerConnection.getReceivers().forEach((receiver) => receiver.track?.stop());
    speechState.peerConnection.close();
    speechState.peerConnection = null;
  }

  speechState.avatarReady = false;
  speechState.synthesizing = false;
  speakButton.disabled = true;
  speakCustomTextButton.disabled = true;
  stopAvatarButton.disabled = true;
  startAvatarButton.disabled = false;

  // Stop transparent background animation
  if (transparentBackgroundAnimationId) {
    cancelAnimationFrame(transparentBackgroundAnimationId);
    transparentBackgroundAnimationId = null;
  }

  // Hide canvas elements
  canvasElement.style.display = 'none';

  resetRemoteMedia();

  if (updateStatus) {
    setSdkStatus("Avatar disconnected.", "neutral");
    setStatus("Avatar session closed.");
  }
}

function buildSsml(text) {
  const escaped = text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

  const voice = ttsVoiceInput?.value || config.defaultVoice || "ar-SA-HamedNeural";
  const ssmlLang = (languageSelect?.value || "ar-SA").startsWith("ar") ? "ar-SA" : "en-US";
  return `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xmlns:mstts='http://www.w3.org/2001/mstts' xml:lang='${ssmlLang}'><voice name='${voice}'><mstts:leadingsilence-exact value='0'/>${escaped}</voice></speak>`;
}

// Aggressive markdown stripper for TTS streams
function sanitizeSpeechText(text) {
  return String(text)
    // Remove bold/italic asterisks and underscores
    .replace(/[*_]{1,3}/g, "")
    // Remove code blocks and inline code
    .replace(/`{1,3}[a-z]*/g, "")
    // Remove headers
    .replace(/^#{1,6}\s+/gm, "")
    // Remove URLs
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    // Remove blockquotes/list bullets
    .replace(/^[\s]*[>\-•+]\s+/gm, "")
    // Collapse whitespace
    .replace(/\s+/g, " ")
    .trim();
}
// Email functions
function showEmailModal(contentToSend = "") {
  emailContent.value = contentToSend;
  emailSubject.value = "معلومات من مساعد الذكي";
  recipientEmail.value = "";
  emailModal.classList.remove("is-hidden");
  recipientEmail.focus();
}

function hideEmailModal() {
  emailModal.classList.add("is-hidden");
}

async function sendEmail(email, subject, content) {
  try {
    const response = await fetchJson("/api/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient_email: email,
        subject: subject || "معلومات من مساعد الذكي",
        content: content
      }),
    });
    return response;
  } catch (error) {
    throw new Error(error.message || "Failed to send email");
  }
}

async function speakViaAzureAudio(text) {
  if (!config.speechReady) {
    throw new Error("Azure Speech is not configured.");
  }

  const loaded = await ensureSpeechSdk();
  if (!loaded || !window.SpeechSDK) {
    throw new Error("Azure Speech SDK is not available.");
  }

  const speechConfig = await createSpeechConfig();
  speechConfig.speechSynthesisVoiceName = ttsVoiceInput?.value || config.defaultVoice || "ar-SA-HamedNeural";
  const audioConfig = SpeechSDK.AudioConfig.fromDefaultSpeakerOutput();
  const synthesizer = new SpeechSDK.SpeechSynthesizer(speechConfig, audioConfig);

  await new Promise((resolve, reject) => {
    synthesizer.speakTextAsync(
      text,
      (result) => {
        synthesizer.close();
        if (result.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
          resolve();
          return;
        }
        reject(new Error("Azure TTS did not complete."));
      },
      (err) => {
        synthesizer.close();
        reject(new Error(String(err || "Azure TTS failed.")));
      }
    );
  });
}

function speakViaBrowserTTS(text) {
  const spokenText = sanitizeSpeechText(text);
  const utterance = new SpeechSynthesisUtterance(spokenText);
  const targetLang = languageSelect?.value || "ar-SA";
  const voices = window.speechSynthesis.getVoices();
  const match = voices.find((voice) => voice.lang.toLowerCase().startsWith(targetLang.toLowerCase()));
  if (match) {
    utterance.voice = match;
  }
  utterance.lang = targetLang;
  utterance.volume = 1.0;
  utterance.rate = 1.0;
  utterance.pitch = 1.0;
  window.speechSynthesis.resume();
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

async function speakText(text) {
  if (!text) {
    return;
  }

  if (isAnamProvider()) {
    const spokenText = sanitizeSpeechText(text);
    setSpeechMessage(spokenText);
    try {
      ensureAnamAudioContext();
      try {
        sendAnamCommand("interrupt");
      } catch {
        // Ignore interrupt failures before first utterance.
      }
      resetAnamAudioQueue();
      sendAnamCommand("talk", spokenText);
      setSdkStatus("Anam voice output active.", "success");
    } catch (error) {
      setSdkStatus(error.message || "Anam speech failed.", "error");
    }
    return;
  }

  if (isLiveKitProvider()) {
    const spokenText = sanitizeSpeechText(text);
    setSpeechMessage(spokenText);

    // Send text to the LiveKit agent via data channel so the avatar speaks it
    if (livekitState.room && livekitState.room.localParticipant) {
      try {
        const encoder = new TextEncoder();
        const data = encoder.encode(JSON.stringify({ type: "speak", text: spokenText }));
        await livekitState.room.localParticipant.publishData(data, { reliable: true });
        setSdkStatus("Avatar speaking...", "success");
      } catch (err) {
        console.error("[LiveKit] Failed to send speak command:", err);
        // Fallback to browser TTS
        speakViaBrowserTTS(spokenText);
        setSdkStatus("Voice output active (browser TTS).", "success");
      }
    } else {
      // No LiveKit room — fallback to browser TTS
      speakViaBrowserTTS(spokenText);
      setSdkStatus("Voice output active (browser TTS).", "success");
    }
    return;
  }

  if (!speechState.avatarReady || !speechState.avatarSynthesizer) {
    setSdkStatus("قم بتشغيل الأفاتار أولاً.", "error");
    return;
  }

  if (speechState.synthesizing) {
    return;
  }

  speechState.synthesizing = true;
  setSdkStatus("Avatar speaking...", "pending");

  try {
    const spokenText = sanitizeSpeechText(text);
    const audio = remoteVideo.querySelector("audio");
    if (audio) {
      audio.muted = false;
    }

    const result = await speechState.avatarSynthesizer.speakSsmlAsync(buildSsml(spokenText));

    if (result.reason !== SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
      throw new Error("Speech synthesis did not complete.");
    }

    setSpeechMessage(spokenText);
    setSdkStatus("Avatar finished speaking.", "success");
  } catch (error) {
    setSdkStatus(error.message || "Speech synthesis failed.", "error");
  } finally {
    speechState.synthesizing = false;
  }
}

function buildAssistantReply(userText) {
  const normalized = userText.trim().toLowerCase();

  if (normalized.includes("summarize")) {
    return cannedResponses["Summarize the file"];
  }
  if (normalized.includes("لخ") || normalized.includes("ملخص")) {
    return cannedResponses["لخّص الملف"];
  }

  if (normalized.includes("key point") || normalized.includes("extract")) {
    return cannedResponses["Extract key points"];
  }
  if (normalized.includes("النقاط") || normalized.includes("الرئيسية")) {
    return cannedResponses["استخرج النقاط الرئيسية"];
  }

  if (normalized.includes("follow")) {
    return cannedResponses["Prepare a follow-up"];
  }
  if (normalized.includes("متابعة")) {
    return cannedResponses["حضّر متابعة"];
  }

  return assistantLanguage === "ar"
    ? "أستطيع الإجابة من المستند المرفوع عند الحاجة، أو من المعرفة العامة عندما لا يكون سياق المستند مطلوبًا."
    : "I can answer from the uploaded document when relevant, or from general knowledge when no document context is needed.";
}

async function submitMessage(message) {
  speechState.responding = true;
  try {
    appendBubble(message, "user");
    const requestedLanguage = detectLanguagePreference(message);
    if (requestedLanguage) {
      assistantLanguage = requestedLanguage;
      if (languageSelect) {
        languageSelect.value = assistantLanguage === "ar" ? "ar-SA" : "en-US";
      }
    }
    let reply = buildAssistantReply(message);
    let isEmailRequest = false;
    let assistantBubble = null;
    let streamedReply = "";

    const hasLiveKitRoom = !!(livekitState.room && livekitState.room.localParticipant);
    // Only use LiveKit data-channel path when we KNOW the agent is online
    // avatarReady is set only when a media track from the agent has been received
    const isLiveKitActive = hasLiveKitRoom && speechState.avatarReady;
    const canStreamVoice = (isAnamProvider() && speechState.avatarReady && anamState.socket) || isLiveKitActive;

    try {
      console.log("[submitMessage] isLiveKitActive:", isLiveKitActive, "avatarReady:", speechState.avatarReady, "hasRoom:", hasLiveKitRoom);

      if (isLiveKitActive) {
        // --- LiveKit Path: Send message directly to the Gemini agent ---
        // The agent will process it (using tools like RAG search) and speak the answer.
        // Agent transcription events will populate the assistant bubble.
        // Mark that we have a pending typed chat, so the transcription handler
        // knows to NOT create a duplicate bubble for the first agent response.
        livekitState._pendingChatBubble = appendBubble("...", "assistant");
        try {
          const encoder = new TextEncoder();
          const data = encoder.encode(JSON.stringify({
            type: "chat",
            text: message,
            document_id: activeDocumentId || "",
          }));
          await livekitState.room.localParticipant.publishData(data, { reliable: true });
          console.log("[LiveKit] Chat message sent to agent:", message.slice(0, 80));
        } catch (err) {
          console.error("[LiveKit] Failed to send chat message:", err);
          if (livekitState._pendingChatBubble) {
            livekitState._pendingChatBubble.textContent = "Failed to send message to agent.";
            livekitState._pendingChatBubble = null;
          }
        }
        // The agent's response will appear via LiveKit transcription events
        speechState.responding = false;
        return;
      }

      if (canStreamVoice) {
        try {
          if (isLiveKitActive) {
            // Signal interruption to Agent if possible (Agent handles it naturally usually)
          } else {
            sendAnamCommand("interrupt");
          }
        } catch {
          // Ignore interrupt failures before first utterance.
        }
        resetAnamAudioQueue();
      }

      assistantBubble = appendBubble("", "assistant");

      // For Anam/LiveKit, stream each chunk immediately to avoid conversation timeout/gaps.
      const useSpeechStream = canStreamVoice;
      let speechStreamStarted = false;

      // Generate ONE correlation_id for Anam.
      const talkCorrelationId = (isAnamProvider() && !isLiveKitActive)
        ? (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`)
        : null;

      // Buffer tokens into sentence-level chunks for smoother TTS.
      let speechTextBuffer = "";
      const SENTENCE_DELIMITERS = /[.!?؟،\n]/;
      const MIN_FLUSH_CHARS = 18;

      async function flushSpeechBuffer(force = false) {
        const trimmed = speechTextBuffer.trim();
        if (!trimmed) return;

        // Only flush if we have a sentence boundary, enough text, or are forced
        if (!force && trimmed.length < MIN_FLUSH_CHARS && !SENTENCE_DELIMITERS.test(trimmed)) {
          return;
        }

        // Clean all markdown tokens before sending to TTS
        const sanitized = sanitizeSpeechText(trimmed);

        if (sanitized) {
          if (isLiveKitActive) {
            try {
              const encoder = new TextEncoder();
              const data = encoder.encode(JSON.stringify({ type: "speak", text: sanitized }));
              await livekitState.room.localParticipant.publishData(data, { reliable: true });
            } catch (err) {
              console.error("[LiveKit] Failed to send speak chunk:", err);
            }
          } else {
            sendAnamCommand("talk_stream", sanitized, {
              start_of_speech: !speechStreamStarted,
              end_of_speech: false,
              correlation_id: talkCorrelationId,
            });
          }
          speechStreamStarted = true;
        }

        speechTextBuffer = "";
      }

      // Fallback flow (non-Anam providers).
      let hasSpokeStarted = false;
      const MIN_CHARS_TO_SPEAK = 40; // Wait for ~2-3 words before starting
      let speakPromise = null;

      await streamChatReply(message, (event) => {
        if (event.type === "chunk") {
          const text = event.text || "";
          if (!text) {
            return;
          }
          streamedReply += text;
          assistantBubble.innerHTML = typeof marked !== "undefined" ? marked.parse(streamedReply) : streamedReply;
          chatThread.scrollTop = chatThread.scrollHeight;

          if (useSpeechStream) {
            // Accumulate tokens into the buffer.
            if (/\S/.test(text)) {
              speechTextBuffer += text;
              flushSpeechBuffer(false);
            }
          } else if (!hasSpokeStarted && streamedReply.length >= MIN_CHARS_TO_SPEAK) {
            // Start speaking as soon as we have enough text (parallel with response generation)
            hasSpokeStarted = true;
            // Fire and forget - speak in parallel with response generation
            speakPromise = speakText(streamedReply).catch((err) => {
              console.error("Speech error:", err);
            });
          }
        } else if (event.type === "done") {
          reply = event.answer || streamedReply || reply;
          isEmailRequest = Boolean(event.is_email_request);
        } else if (event.type === "error") {
          throw new Error(event.detail || "Streaming failed.");
        }
      });

      if (streamedReply) {
        reply = streamedReply;

        if (useSpeechStream) {
          // Flush any remaining buffered text before closing the stream.
          if (speechTextBuffer.trim()) {
            await flushSpeechBuffer(true);
          }

          // Close the active stream explicitly (only relevant for Anam socket)
          if (speechStreamStarted && !isLiveKitActive) {
            sendAnamCommand("talk_stream", "", {
              start_of_speech: false,
              end_of_speech: true,
              correlation_id: talkCorrelationId,
            });
          }
        } else if (!hasSpokeStarted) {
          // If we didn't start speaking yet (response was very short), speak now
          speakPromise = speakText(reply).catch((err) => {
            console.error("Speech error:", err);
          });
        }
      }
    } catch (error) {
      if (assistantBubble) {
        assistantBubble.remove();
        assistantBubble = null;
      }
      reply = error.message || "I couldn't generate a response right now.";
    }

    // Handle email workflow with smart content generation
    if (isEmailRequest) {
      if (assistantBubble) {
        assistantBubble.remove();
        assistantBubble = null;
      }
      appendBubble("I'll help you send an email. Let me prepare the content...", "assistant");
      await speakText("I'll help you send an email. Let me prepare the content.");

      // Check if user is asking for specific document content
      const messageContent = message.toLowerCase();
      let emailContent = "";

      if (messageContent.includes("summary") || messageContent.includes("summarize")) {
        // Generate summary from document
        if (activeDocumentId) {
          try {
            const summaryResponse = await fetchJson("/api/chat", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                document_id: activeDocumentId,
                message: "Please provide a comprehensive summary of this document."
              }),
            });
            emailContent = summaryResponse.answer;
          } catch (error) {
            emailContent = "Sorry, I couldn't generate the summary. Please describe what you'd like to send.";
          }
        }
      } else if (messageContent.includes("key points") || messageContent.includes("main points")) {
        // Generate key points
        if (activeDocumentId) {
          try {
            const keyPointsResponse = await fetchJson("/api/chat", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                document_id: activeDocumentId,
                message: "Please extract the key points from this document."
              }),
            });
            emailContent = keyPointsResponse.answer;
          } catch (error) {
            emailContent = "Sorry, I couldn't generate the key points. Please describe what you'd like to send.";
          }
        }
      } else {
        // For other requests, generate content based on their specific question
        if (activeDocumentId) {
          try {
            const contentResponse = await fetchJson("/api/chat", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                document_id: activeDocumentId,
                message: message.replace(/send|email|mail/gi, "").trim() // Remove email keywords
              }),
            });
            emailContent = contentResponse.answer;
          } catch (error) {
            emailContent = "Please describe what you'd like to send in the email.";
          }
        } else {
          emailContent = "Please describe what you'd like to send in the email.";
        }
      }

      showEmailModal(emailContent);
      return;
    }

    if (!assistantBubble) {
      assistantBubble = appendBubble(reply, "assistant");
    }
    assistantBubble.innerHTML = typeof marked !== "undefined" ? marked.parse(reply) : reply;
    setStatus("Realtime speech demo active.");
  } finally {
    speechState.responding = false;
    // Kick continuous listening restart now that response is done
    scheduleContinuousRecognitionRestart(500);
  }
}

// ── Azure STT browser-side recognizer ─────────────────────────────────
async function startAzureRecognition() {
  const sdkReady = await ensureSpeechSdk();
  if (!sdkReady) throw new Error("Azure Speech SDK failed to load.");

  const speechConfig = await createSpeechConfig();
  const audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
  const recognizer = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfig);

  speechState.recognizer = recognizer;
  speechState.recognizing = true;

  const selectedLang = languageSelect?.value || (assistantLanguage === "en" ? "en-US" : "ar-SA");

  // Show interim results as user speaks
  recognizer.recognizing = (s, e) => {
    if (e.result.reason === SpeechSDK.ResultReason.RecognizingSpeech) {
      const interim = (e.result.text || "").trim();
      if (interim) {
        chatInput.value = interim;
        setSdkStatus(`Hearing: "${interim.slice(0, 60)}..."`, "pending");
      }
    }
  };

  micButton.title = "Stop mic";
  micButton.classList.add("active-mic");
  setSdkStatus(
    selectedLang.startsWith("ar") ? "🎙️ Listening (Arabic)..." : "🎙️ Listening (English)...",
    "pending"
  );
  const lb = document.getElementById("listeningBar");
  if (lb) lb.style.display = "flex";

  console.log("[Azure STT] Starting recognizeOnceAsync...");

  recognizer.recognizeOnceAsync(
    async (result) => {
      // Clean up recognizer
      speechState.recognizing = false;
      speechState.recognizer = null;
      try { recognizer.close(); } catch { /* ignore */ }

      micButton.title = "Start mic";
      micButton.classList.remove("active-mic");
      const lb2 = document.getElementById("listeningBar");
      if (lb2) lb2.style.display = "none";

      if (result.reason === SpeechSDK.ResultReason.RecognizedSpeech) {
        const text = (result.text || "").trim();
        if (!text) {
          setSdkStatus("No speech detected. Try again.", "neutral");
          scheduleContinuousRecognitionRestart(500);
          return;
        }

        console.log("[Azure STT] Recognized:", text);
        chatInput.value = text;

        // Auto-submit voice input
        speechState.handlingMicMessage = true;
        try {
          await submitMessage(text);
          chatInput.value = "";
        } finally {
          speechState.handlingMicMessage = false;
        }

        setSdkStatus("Recognition complete.", "success");
      } else if (result.reason === SpeechSDK.ResultReason.NoMatch) {
        console.warn("[Azure STT] NoMatch - could not recognize speech");
        setSdkStatus("Could not recognize speech. Try speaking louder/closer.", "neutral");
      } else if (result.reason === SpeechSDK.ResultReason.Canceled) {
        const cancellation = SpeechSDK.CancellationDetails.fromResult(result);
        console.error("[Azure STT] Canceled:", cancellation.reason, cancellation.errorDetails);
        setSdkStatus("STT error: " + (cancellation.errorDetails || cancellation.reason), "error");
      }

      // Restart if continuous mode
      const restartDelay = speechState.synthesizing || anamState.isVoiceActive ? 1500 : 400;
      scheduleContinuousRecognitionRestart(restartDelay);
    },
    (err) => {
      console.error("[Azure STT] Error:", err);
      speechState.recognizing = false;
      speechState.recognizer = null;

      micButton.title = "Start mic";
      micButton.classList.remove("active-mic");
      const lb2 = document.getElementById("listeningBar");
      if (lb2) lb2.style.display = "none";

      setSdkStatus("Azure STT failed: " + err, "error");
      scheduleContinuousRecognitionRestart(1000);
    }
  );
}

async function startRecognition() {
  if (speechState.recognizing) {
    return;
  }

  // ── Try Azure STT first (real-time, built-in VAD, much better accuracy) ──
  if (config.speechReady) {
    try {
      await startAzureRecognition();
      return; // Success — Azure is handling it
    } catch (err) {
      console.warn("[STT] Azure STT unavailable, falling back to Gemini:", err.message);
    }
  }

  // ── Fallback: MediaRecorder + Gemini batch STT ──
  try {
    const selectedLang = (languageSelect?.value || (assistantLanguage === "en" ? "en-US" : "ar-SA"));
    const recognitionLang = selectedLang.startsWith("en") ? "en-US" : "ar-SA";

    if (!navigator.mediaDevices) {
      navigator.mediaDevices = {};
    }
    if (!navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia = function (constraints) {
        const legacy = navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
        if (!legacy) {
          return Promise.reject(
            new Error(
              "Microphone access requires HTTPS or localhost. " +
              "Please access this page via https:// or http://localhost."
            )
          );
        }
        return new Promise((resolve, reject) => {
          legacy.call(navigator, constraints, resolve, reject);
        });
      };
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: 16000,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";

    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());

      if (speechState._silenceInterval) {
        clearInterval(speechState._silenceInterval);
        speechState._silenceInterval = null;
      }
      if (speechState._audioCtx) {
        speechState._audioCtx.close().catch(() => { });
        speechState._audioCtx = null;
      }

      if (chunks.length === 0) {
        setSdkStatus("No audio captured.", "neutral");
        scheduleContinuousRecognitionRestart(500);
        return;
      }

      const blob = new Blob(chunks, { type: mimeType });
      const ext = mimeType.includes("webm") ? "webm" : "mp4";

      setSdkStatus("Transcribing via Gemini...", "pending");

      try {
        const fd = new FormData();
        fd.append("file", blob, `recording.${ext}`);
        fd.append("language", recognitionLang.startsWith("ar") ? "ar" : "en");
        fd.append("mime_type", mimeType);
        fd.append("sample_rate_hz", "16000");

        const res = await fetch("/api/transcribe", { method: "POST", body: fd });
        if (!res.ok) {
          const p = await res.json().catch(() => ({}));
          throw new Error(p.detail || `Transcription failed: ${res.status}`);
        }

        const result = await res.json();
        const text = (result.text || "").trim();

        if (!text) {
          setSdkStatus("No speech detected. Try again.", "neutral");
          scheduleContinuousRecognitionRestart(250);
          return;
        }

        chatInput.value = text;

        // Auto-submit voice input directly to chat.
        // The recorder is already stopped so there is no echo risk.
        speechState.handlingMicMessage = true;
        try {
          await submitMessage(text);
          chatInput.value = "";
        } finally {
          speechState.handlingMicMessage = false;
        }

        setSdkStatus("Transcription complete.", "success");
      } catch (err) {
        setSdkStatus(err.message || "Transcription failed.", "error");
      } finally {
        // Restart listening after a delay long enough for avatar audio to finish.
        // This prevents the mic from picking up the AI's own voice output.
        const restartDelay = speechState.synthesizing || anamState.isVoiceActive ? 1500 : 300;
        scheduleContinuousRecognitionRestart(restartDelay);
      }
    };

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);
    speechState._audioCtx = audioCtx;

    let silentFrames = 0;
    let totalFrames = 0;
    const SILENCE_THRESHOLD = 6;          // RMS level below which = silence (lowered to catch soft speech)
    const SILENCE_FRAMES_TO_STOP = 60;    // ~1.5s of silence to stop (was 20 / ~0.5s — way too fast)
    const MIN_RECORDING_FRAMES = 40;      // ~1s minimum recording (was 8 / ~0.2s)
    const POLL_MS = 25;                   // poll every 25ms

    speechState._silenceInterval = setInterval(() => {
      const data = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(data);
      const rms = Math.sqrt(data.reduce((s, v) => s + v * v, 0) / data.length);
      totalFrames++;

      if (rms < SILENCE_THRESHOLD) {
        silentFrames++;
        if (silentFrames >= SILENCE_FRAMES_TO_STOP && totalFrames > MIN_RECORDING_FRAMES) {
          stopRecognition();
        }
      } else {
        silentFrames = 0;
      }
    }, POLL_MS);

    recorder.start(120);
    speechState._mediaRecorder = recorder;
    speechState._mediaStream = stream;
    speechState.recognizing = true;

    micButton.title = "Stop mic";
    micButton.classList.add("active-mic");
    setSdkStatus(
      recognitionLang.startsWith("ar") ? "Listening (Arabic)..." : "Listening (English)...",
      "pending"
    );
    const lb = document.getElementById("listeningBar");
    if (lb) lb.style.display = "flex";
  } catch (error) {
    setSdkStatus(error.message || "Microphone start failed.", "error");
  }
}

function stopRecognition(updateStatus = true) {
  if (speechState.recognizer) {
    try {
      speechState.recognizer.stopContinuousRecognitionAsync?.(() => {}, () => {});
      speechState.recognizer.close();
    } catch {
      // Ignore stop failures when recognizer is already ending.
    }
    speechState.recognizer = null;
  }

  if (speechState._silenceInterval) {
    clearInterval(speechState._silenceInterval);
    speechState._silenceInterval = null;
  }

  if (speechState._mediaRecorder && speechState._mediaRecorder.state !== "inactive") {
    speechState._mediaRecorder.stop(); // triggers onstop → Whisper transcription
  } else {
    // If no active recorder, just clean up stream
    if (speechState._mediaStream) {
      speechState._mediaStream.getTracks().forEach((t) => t.stop());
      speechState._mediaStream = null;
    }
  }

  if (speechState._audioCtx) {
    speechState._audioCtx.close().catch(() => { });
    speechState._audioCtx = null;
  }

  speechState.recognizing = false;
  speechState._mediaRecorder = null;

  micButton.title = "Start mic";
  micButton.classList.remove("active-mic");
  // Hide listening bar
  const lb = document.getElementById("listeningBar");
  if (lb) lb.style.display = "none";

  if (updateStatus) {
    setSdkStatus("Processing audio...", "pending");
  }
}

fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];

  if (!file) {
    return;
  }

  const formData = new FormData();
  formData.append("file", file);

  uploadResult.innerHTML = `
    <p class="upload-state"><strong>${file.name}</strong> uploading and processing page by page...</p>
  `;

  fetch("/api/documents/upload", {
    method: "POST",
    body: formData,
  })
    .then(async (response) => {
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.detail || `Upload failed: ${response.status}`);
      }

      return response.json();
    })
    .then((payload) => {
      activeDocumentId = payload.document_id;
      if (livekitState.room && livekitState.room.localParticipant) {
        const encoder = new TextEncoder();
        const data = encoder.encode(
          JSON.stringify({
            type: "document_context",
            document_id: activeDocumentId,
          })
        );
        livekitState.room.localParticipant.publishData(data, { reliable: true }).catch((err) => {
          console.warn("[LiveKit] Failed to publish uploaded document context:", err);
        });
      }
      uploadResult.innerHTML = `
        <p class="upload-state"><strong>${payload.file_name}</strong> processed successfully! ${payload.chunk_count} chunks from all pages stored in Weaviate.</p>
      `;
      setSpeechMessage("Your document is ready. Ask by voice or by text.");
      setStatus("Document uploaded and indexed page by page in Weaviate.");
    })
    .catch((error) => {
      activeDocumentId = null;
      if (livekitState.room && livekitState.room.localParticipant) {
        const encoder = new TextEncoder();
        const data = encoder.encode(
          JSON.stringify({
            type: "document_context",
            document_id: "",
          })
        );
        livekitState.room.localParticipant.publishData(data, { reliable: true }).catch((err) => {
          console.warn("[LiveKit] Failed to clear document context after upload error:", err);
        });
      }

      // Provide better error messages for common issues
      let errorMessage = error.message;

      if (error.message.includes("overloaded")) {
        errorMessage = "The AI model is currently busy. Page-by-page processing will help - please try again in a moment.";
      } else if (error.message.includes("connection") || error.message.includes("timeout")) {
        errorMessage = "Connection issue during page processing. Please check your connection and try again.";
      } else if (error.message.includes("too large")) {
        errorMessage = "File is too large. Please try with a smaller file (max 5MB).";
      }

      uploadResult.innerHTML = `
        <p class="upload-state">Upload failed: ${errorMessage}</p>
        <p style="font-size: 0.8em; color: #666; margin-top: 8px;">
          💡 If the model is overloaded, wait 10-30 seconds and try again.
        </p>
      `;
      setStatus("Document upload failed.");
    });
});

promptChips.forEach((chip) => {
  chip.addEventListener("click", async () => {
    const prompt = chip.textContent.trim();
    await submitMessage(prompt);
  });
});

chatComposer.addEventListener("submit", async (event) => {
  event.preventDefault();

  const question = chatInput.value.trim();
  if (!question) {
    return;
  }

  chatInput.value = "";
  await submitMessage(question);
});

speakButton.addEventListener("click", async () => {
  const lastAssistant = [...chatThread.querySelectorAll(".bubble-assistant")].pop();
  await speakText(lastAssistant?.textContent?.trim() || "مرحبًا، أنا مساعد.");
});

async function toggleContinuousVoiceChat() {
  // --- LiveKit real-time voice toggle (only when agent is actually connected) ---
  if (isLiveKitProvider() && livekitState.room && speechState.avatarReady) {
    livekitState.micEnabled = !livekitState.micEnabled;
    try {
      await livekitState.room.localParticipant.setMicrophoneEnabled(livekitState.micEnabled);
      if (livekitState.micEnabled) {
        micButton.title = "Stop mic";
        micButton.classList.add("active-mic");
        setSdkStatus("🎙️ Listening (LiveKit real-time)...", "pending");
        const lb = document.getElementById("listeningBar");
        if (lb) lb.style.display = "flex";
      } else {
        micButton.title = "Start mic";
        micButton.classList.remove("active-mic");
        setSdkStatus("Mic paused.", "neutral");
        const lb = document.getElementById("listeningBar");
        if (lb) lb.style.display = "none";
      }
    } catch (err) {
      setSdkStatus("Mic toggle failed: " + err.message, "error");
    }
    return;
  }

  // --- Fallback: batch Gemini STT (non-LiveKit) ---
  if (speechState.recognizing || speechState.continuousConversation) {
    speechState.continuousConversation = false;
    if (speechState._continuousRestartTimer) {
      clearTimeout(speechState._continuousRestartTimer);
      speechState._continuousRestartTimer = null;
    }
    stopRecognition();
    setSdkStatus("Voice chat paused.", "neutral");
    return;
  }

  speechState.continuousConversation = true;
  await startRecognition();
}

micButton.addEventListener("click", async () => {
  await toggleContinuousVoiceChat();
});

resetRemoteMedia();

if (isAnamProvider()) {
  if (!config.anamReady) {
    setSdkStatus("Anam is selected but not configured on the server.", "error");
  } else {
    setSdkStatus("Anam avatar ready — voice input active.", "neutral");
  }
  micButton.disabled = false; // Cloud STT — always available when backend is configured
  speakButton.disabled = true;
} else if (isLiveKitProvider()) {
  if (!config.livekitReady) {
    setSdkStatus("LiveKit is selected but not configured on server.", "error");
  } else {
    setSdkStatus("LiveKit avatar ready — voice input active.", "neutral");
  }
  micButton.disabled = false; // Cloud STT — always available when backend is configured
  speakButton.disabled = true;
} else if (!config.speechReady) {
  setSdkStatus("Voice input ready. Avatar TTS requires Azure config.", "neutral");
  micButton.disabled = false; // Cloud STT — always available when backend is configured
  speakButton.disabled = true;
} else {
  setSdkStatus("Azure TTS + voice input جاهز. يمكنك بدء العرض الآن.", "neutral");
  micButton.disabled = false;
  ensureSpeechSdk().then((loaded) => {
    if (!loaded) {
      setSdkStatus("Azure Speech SDK did not load for TTS.", "error");
    }
  });
}

function openAssistant() {
  if (assistantPopup) {
    assistantPopup.classList.remove("is-hidden");
  }
  if (assistantLauncher) {
    assistantLauncher.hidden = true;
  }
  if (!speechState.avatarReady && !speechState.avatarSynthesizer) {
    if (isLiveKitProvider()) {
      connectLiveKitAvatar();
    } else if (isAnamProvider()) {
      connectAnamAvatar();
    } else if (config.speechReady) {
      connectAvatar();
    }
  }
}

function closeAssistant() {
  speechState.continuousConversation = false;
  if (speechState._continuousRestartTimer) {
    clearTimeout(speechState._continuousRestartTimer);
    speechState._continuousRestartTimer = null;
  }
  if (speechState.recognizing) {
    stopRecognition(false);
  }
  if (speechState.avatarReady || speechState.avatarSynthesizer) {
    disconnectAvatar(false);
  }
  greetingSpoken = false;
  if (isLiveKitProvider()) {
    setSdkStatus(config.livekitReady ? "LiveKit avatar ready." : "LiveKit is not configured.", config.livekitReady ? "neutral" : "error");
  } else if (isAnamProvider()) {
    setSdkStatus(config.anamReady ? "Anam avatar ready." : "Anam is not configured.", config.anamReady ? "neutral" : "error");
  } else {
    setSdkStatus(config.speechReady ? "Azure Speech جاهز." : "إعدادات Azure Speech غير مكتملة.", config.speechReady ? "neutral" : "error");
  }
  if (assistantPopup) {
    assistantPopup.classList.add("is-hidden");
  }
  if (assistantLauncher) {
    assistantLauncher.hidden = false;
  }
}

if (assistantLauncher) {
  assistantLauncher.addEventListener("click", openAssistant);
}
if (assistantClose) {
  assistantClose.addEventListener("click", closeAssistant);
}
uploadTrigger.addEventListener("click", () => fileInput.click());

// Full-page mode: keep assistant open by default
openAssistant();

// Email modal event listeners
emailModalClose.addEventListener("click", hideEmailModal);
cancelEmailButton.addEventListener("click", hideEmailModal);

// Close modal when clicking outside
emailModal.addEventListener("click", (event) => {
  if (event.target === emailModal) {
    hideEmailModal();
  }
});

// Handle email sending
sendEmailButton.addEventListener("click", async () => {
  const email = recipientEmail.value.trim();
  const subject = emailSubject.value.trim();
  const content = emailContent.value.trim();

  if (!email) {
    recipientEmail.focus();
    return;
  }

  if (!content) {
    emailContent.focus();
    return;
  }

  try {
    sendEmailButton.disabled = true;
    sendEmailButton.textContent = "Sending...";

    const result = await sendEmail(email, subject, content);

    hideEmailModal();

    const successMessage = `Email sent successfully to ${email}!`;
    appendBubble(successMessage, "assistant");
    await speakText(successMessage);

  } catch (error) {
    alert(`Failed to send email: ${error.message}`);
  } finally {
    sendEmailButton.disabled = false;
    sendEmailButton.textContent = "Send Email";
  }
});

// Handle form submission
emailForm.addEventListener("submit", (event) => {
  event.preventDefault();
  sendEmailButton.click();
});

// Handle escape key to close modal
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !emailModal.classList.contains("is-hidden")) {
    hideEmailModal();
  }
});

// Enhanced Avatar Controls Event Listeners
transparentBackgroundCheckbox.addEventListener('change', updateTransparentBackground);

startAvatarButton.addEventListener('click', async () => {
  if (isLiveKitProvider()) {
    await connectLiveKitAvatar();
    return;
  }
  if (isAnamProvider()) {
    connectAnamAvatar();
    return;
  }
  await connectAvatar();
});

stopAvatarButton.addEventListener('click', () => {
  disconnectAvatar(true);
});

speakCustomTextButton.addEventListener('click', async () => {
  const text = customSpeechText.value.trim();
  if (text) {
    setSpeechMessage(text);
    await speakText(text);
  }
});

// Update TTS voice when changed
ttsVoiceInput.addEventListener('change', () => {
  if (speechState.avatarSynthesizer && speechState.avatarReady) {
    // Need to reconnect to apply voice changes
    setSdkStatus("Voice changed - reconnect avatar to apply", "neutral");
  }
});

// Initialize configuration states
updateTransparentBackground();

// Manual video play function
window.playAvatarVideo = function () {
  const video = remoteVideo.querySelector('video');
  const playBtn = document.getElementById('playVideoButton');

  if (video) {
    video.play().then(() => {
      console.log('Video started playing manually');
      playBtn.style.display = 'none';
    }).catch(error => {
      console.error('Manual video play failed:', error);
    });
  }
};

// Show play button when avatar is connected but video isn't playing
function checkVideoPlayback() {
  const video = remoteVideo.querySelector('video');
  const playBtn = document.getElementById('playVideoButton');

  if (speechState.avatarReady && video && video.paused && video.readyState >= 2) {
    // Video is loaded but not playing
    playBtn.style.display = 'block';
  }
}

// Check video playback every 2 seconds when avatar is connected
setInterval(() => {
  if (speechState.avatarReady) {
    checkVideoPlayback();
  }
}, 2000);

// ═══════ NEW UI BINDINGS ═══════

// Inline mic button in chat composer
const micInlineBtn = document.getElementById('micInline');
if (micInlineBtn) {
  micInlineBtn.addEventListener('click', async () => {
    await toggleContinuousVoiceChat();
  });
}

// Stop pill overlay on avatar
const stopPillBtn = document.getElementById('stopPill');
if (stopPillBtn) {
  stopPillBtn.addEventListener('click', () => {
    disconnectAvatar(true);
  });
}

// Show/hide stop overlay based on avatar state
const avatarStopOverlay = document.getElementById('avatarStopOverlay');
function updateStopOverlay() {
  if (avatarStopOverlay) {
    avatarStopOverlay.style.display = speechState.avatarReady ? 'block' : 'none';
  }
}
setInterval(updateStopOverlay, 500);
