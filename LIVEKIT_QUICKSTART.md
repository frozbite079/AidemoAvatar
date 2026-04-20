# 🚀 LiveKit Integration - Quick Start Guide

## What's New

You now have a complete **real-time multi-user conversation system** integrated with Musaed AI Avatar!

### New Features Added:
✅ **Real-time Conversation UI** - Beautiful WebRTC-based interface  
✅ **Multi-user Support** - Multiple participants in one room  
✅ **Live Transcript** - Automatic message history with timestamps  
✅ **Participant Panel** - See who's in the room and who's speaking  
✅ **Audio Controls** - Mute/unmute, camera, screen share  
✅ **Chat & Data Messaging** - Send messages through LiveKit data channels  
✅ **Avatar Integration** - Anam avatar joins conversations automatically  
✅ **Professional UI** - Black & white glassmorphic design  

---

## 📦 Files Created/Modified

### New Files:
```
templates/conversation.html          - Conversation UI template
static/conversation-styles.css       - Professional styles (11.4 KB)
static/conversation.js               - LiveKit client logic (14 KB)
livekit_agent_worker.py             - Backend agent worker
LIVEKIT_INTEGRATION_QUICKSTART.md   - This file!
```

### Modified Files:
```
app.py                              - Added /conversation route
.env.example                        - Already has LiveKit config
requirements.txt                    - Already has LiveKit packages
```

---

## ⚙️ Setup Instructions

### Step 1: Get LiveKit Credentials

Go to **https://livekit.io** and:
1. Sign up for a free account
2. Create a new project
3. Copy your:
   - **LIVEKIT_URL** (e.g., `wss://your-project.livekit.cloud`)
   - **LIVEKIT_API_KEY**
   - **LIVEKIT_API_SECRET**

### Step 2: Update Your `.env` File

```bash
# Copy .env.example if you haven't already
cp .env.example .env

# Edit .env and fill in:
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your-api-key
LIVEKIT_API_SECRET=your-api-secret
LIVEKIT_ROOM=musaed-room

# Make sure these are also set (for Anam avatar):
ANAM_API_KEY=your-anam-key
ANAM_PERSONA_ID=your-persona-id
ANAM_AVATAR_ID=your-avatar-id
```

### Step 3: Install Dependencies

```bash
# Ensure you're in the virtual environment
source venv/bin/activate

# Install/update LiveKit packages
pip install -r requirements.txt

# Verify installation
python -c "from livekit import api; print('LiveKit OK')"
```

### Step 4: Run the Application

**Terminal 1 - Flask Backend:**
```bash
cd /home/redspark/Pictures/AIAvatarDemo
source venv/bin/activate
python app.py
# Runs on http://localhost:5000
```

**Terminal 2 - LiveKit Agent (Optional):**
```bash
cd /home/redspark/Pictures/AIAvatarDemo
source venv/bin/activate
python livekit_agent_worker.py dev
# Connects to LiveKit and joins rooms automatically
# (Only needed if you want AI agent responses)
```

---

## 🎯 Usage

### Start a Conversation Room

Open in your browser:
```
http://localhost:5000/conversation?room=musaed-room&user=john
```

### Access Parameters:
- `room` - Room name (default: "musaed-room")
- `user` - Your display name (default: random user ID)

### Examples:
```
# Single user test
http://localhost:5000/conversation?room=test&user=alice

# Multi-user conversation
http://localhost:5000/conversation?room=meeting&user=bob

# With specific room
http://localhost:5000/conversation?room=consulting-session&user=consultant-1
```

### In the UI:
1. **Allow camera/mic** when prompted
2. **Participant List** (right side) shows all users
3. **Transcript** updates in real-time
4. **Controls**: Mic 🎙️ • Camera 📹 • Share Screen 🖥️ • Leave 📞

---

## 🧪 Testing

### Test 1: Single User
1. Open: `http://localhost:5000/conversation`
2. Allow camera/mic
3. Should show your video feed
4. Speak - audio should play through speakers

### Test 2: Multi-User (Two Browsers)
1. Browser 1: `http://localhost:5000/conversation?room=test&user=alice`
2. Browser 2: `http://localhost:5000/conversation?room=test&user=bob`
3. Both should see each other
4. Participant count should be 2
5. Speaking status should update

### Test 3: Check Network
Use browser DevTools to verify:
- **Network tab**: WebRTC connections active
- **Console**: No JavaScript errors
- **Application**: WebSocket connections to LiveKit

---

## 🔧 Configuration

### Audio Quality Settings

In the UI sidebar under "Controls":
- ✅ **Auto Gain** - Automatically adjusts volume
- ✅ **Noise Suppression** - Removes background noise
- ✅ **Echo Cancel** - Prevents feedback loops

### Room Configuration

Add to `.env`:
```bash
# Room name when joining without ?room parameter
LIVEKIT_ROOM=musaed-room

# Language for avatar (if multilingual)
LIVEKIT_LANGUAGE=en-US

# Max participants (optional)
LIVEKIT_MAX_PARTICIPANTS=10
```

---

## 📊 Architecture Overview

```
┌─────────────────────────────────────────┐
│        Your Browser (WebRTC)            │
├─────────────────────────────────────────┤
│ conversation.html + conversation.js     │
│ ↓                                       │
│ LiveKit Client Connection               │
└──────────────┬──────────────────────────┘
               │
               ↓
    ┌──────────────────────┐
    │  LiveKit Cloud       │
    │  - WebRTC routing    │
    │  - Audio mixing      │
    │  - Video compositing │
    └──────────────────────┘
               │
      ┌────────┴────────┐
      ↓                 ↓
   User 2          Agent Worker
   (Browser)    (livekit_agent_worker.py)
                      ↓
              ┌─────────────────┐
              │ Flask Backend   │
              ├─────────────────┤
              │ Document Q&A    │
              │ Weaviate + LLM  │
              │ Anam Avatar     │
              └─────────────────┘
```

---

## 🐛 Troubleshooting

### "Connection Failed" Error
```
✓ Check LIVEKIT_URL, API_KEY, API_SECRET in .env
✓ Verify internet connection
✓ Check FireWall/NAT settings
✓ Try: curl https://your-livekit-url/
```

### No Audio/Video
```
✓ Check browser permissions (Allow Camera/Mic)
✓ Check browser console for errors
✓ Verify microphone is not muted
✓ Try different browser
```

### "Avatar not configured"
```
✓ Set ANAM_API_KEY, ANAM_PERSONA_ID in .env
✓ Avatar is optional - system works without it
✓ Restart Flask backend after changing .env
```

### Participant Not Visible
```
✓ Refresh the page
✓ Close and reopen the room
✓ Check participant list (they may be there)
✓ Verify network connection
```

### "Module not found" Error
```
✓ Activate virtual environment: source venv/bin/activate
✓ Reinstall requirements: pip install -r requirements.txt
✓ Check Python version: python --version (3.9+)
```

---

## 📝 API Endpoints

### Get LiveKit Token
```bash
POST /api/livekit/token
Content-Type: application/json

{
  "room": "musaed-room",
  "identity": "user-123",
  "name": "John Doe"
}

Response:
{
  "token": "eyJ0eXAi...",
  "url": "wss://project.livekit.cloud",
  "room": "musaed-room",
  "identity": "user-123"
}
```

### Get Configuration
```bash
GET /api/config

Response:
{
  "avatarProvider": "livekit",
  "livekitReady": true,
  "livekitUrl": "wss://...",
  "livekitRoom": "musaed-room",
  ...
}
```

---

## 🚀 Scaling Tips

### For 5-10 Users
- Current setup is perfect
- No additional configuration needed
- Monitor network bandwidth

### For 50+ Users
- Consider LiveKit Cloud (managed service)
- Enable SFU (Selective Forwarding Unit) mode
- Set up redundant connections

### For 1000+ Users
- Use multiple LiveKit rooms
- Implement room lobbies
- Load balance across regions

---

## 📱 Mobile Support

### iOS
- ✅ Safari 11+
- ✅ Camera/Mic access required
- ⚠️ Screen sharing not supported

### Android
- ✅ Chrome/Firefox
- ✅ Camera/Mic access required
- ✅ Screen sharing supported

### Desktop
- ✅ Chrome/Edge/Firefox/Safari
- ✅ All features supported
- ✅ Recommended for best experience

---

## 🔐 Security Notes

### For Production:
1. Use **HTTPS/WSS** (encrypted connections)
2. Implement **room authentication**
3. Set **token expiration** times
4. Use **API key rotation**
5. Monitor **access logs**

### Current Setup (Development):
- Direct token generation ✓
- No authentication layer (add this for production)
- WebRTC is encrypted by default ✓

---

## 📚 Additional Resources

- **LiveKit Docs**: https://docs.livekit.io
- **LiveKit Cloud**: https://livekit.io
- **WebRTC Guide**: https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API
- **Anam Integration**: Check Anam documentation for avatar customization

---

## 🎉 Next Steps

1. ✅ Test with 2 browsers
2. ✅ Try screen sharing
3. ✅ Send chat messages
4. ✅ Customize room names
5. ✅ Deploy to production (add authentication)
6. ✅ Monitor performance metrics

---

## 📞 Support

If you encounter issues:

1. **Check logs**:
   ```bash
   # Flask logs (Terminal 1)
   # Check for errors or warnings
   
   # Browser console (F12 or Cmd+Option+I)
   # Check JavaScript console for errors
   ```

2. **Test connectivity**:
   ```bash
   # Test LiveKit server
   curl -I https://your-livekit-url
   ```

3. **Verify configuration**:
   ```bash
   # Check .env file
   cat .env | grep LIVEKIT
   ```

---

**🎤 You're all set! Start your first conversation now! 🎤**

Visit: `http://localhost:5000/conversation`
