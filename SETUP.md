# 🛠️ Setup Guide - Configure API Keys

## ⚡ Quick Setup Steps

### 1. Azure Speech Services (Required for Avatar)

**❌ If you see "Name or service not known" error, this means Azure Speech is not configured properly.**

1. **Go to Azure Portal**: https://portal.azure.com
2. **Create a Speech Service**: Search for "Speech Service" → Create new resource
3. **Get your credentials**:
   - **Endpoint**: Copy the endpoint URL (e.g., `https://your-speech-resource.cognitiveservices.azure.com/`)
   - **Region**: Copy the region (e.g., `eastus`, `westus2`) 
   - **Key**: Copy one of the subscription keys

4. **Update .env file** with REAL values (not placeholders):
   ```bash
   AZURE_SPEECH_ENDPOINT=https://your-speech-resource.cognitiveservices.azure.com/
   AZURE_SPEECH_REGION=eastus
   AZURE_SPEECH_KEY=your-subscription-key-here
   ```

   ⚠️ **Important**: Replace `your-resource-name` with your actual Azure resource name!

### 2. Anthropic API (Required for AI Chat)
1. **Go to Anthropic Console**: https://console.anthropic.com
2. **Create an API Key**: Go to API Keys → Create Key
3. **Update .env file**:
   ```bash
   ANTHROPIC_API_KEY=your-anthropic-api-key-here
   ```

### 3. Anam Avatar via Python SDK
1. Install dependencies from `requirements.txt` (includes `anam` and `Pillow`).
2. Add Anam credentials to `.env`:
   ```bash
   AVATAR_PROVIDER=anam
   ANAM_API_KEY=your-anam-api-key
   ANAM_PERSONA_ID=your-anam-persona-id
   ```
3. Start app and click **تشغيل الأفاتار**.

If `AVATAR_PROVIDER=azure`, the existing Azure avatar flow is used.

### 4. LiveKit + Anam Plugin (Optional alternative)
1. Add to `.env`:
   ```bash
   AVATAR_PROVIDER=livekit
   LIVEKIT_URL=wss://your-project.livekit.cloud
   LIVEKIT_API_KEY=your-livekit-api-key
   LIVEKIT_API_SECRET=your-livekit-api-secret
   LIVEKIT_ROOM=musaed-room
   LIVEKIT_LANGUAGE=ar-SA
   ANAM_API_KEY=your-anam-api-key
   ANAM_AVATAR_ID=your-anam-avatar-id
   ANTHROPIC_API_KEY=your-anthropic-api-key
   ANTHROPIC_MODEL=your-anthropic-model
   ```
2. Start the web app:
   ```bash
   uvicorn app:app --host 0.0.0.0 --port 5000
   ```
3. In another terminal, start the LiveKit agent worker:
   ```bash
   python livekit_anam_agent.py dev
   ```
4. Open the UI and click **تشغيل الأفاتار**.

## 🚀 Test Your Setup
After updating .env:
```bash
cd /home/redspark/Pictures/AIAvatarDemo
source venv/bin/activate
uvicorn app:app --reload
```

Visit: http://localhost:8000

## ✅ What Should Work
- **With Azure Speech**: Avatar, voice recognition, text-to-speech
- **With Anam Python SDK**: Avatar video streaming (and browser speech output in UI)
- **With LiveKit + Anam plugin**: Synced avatar video + audio in the browser
- **With Anthropic API**: Document Q&A, smart email content generation
- **Without keys**: Basic upload and email sending still works

## 🔧 Troubleshooting

### "Name or service not known" Error
- Your `.env` file still has placeholder values like `your-resource-name.cognitiveservices.azure.com`
- Update with your actual Azure Speech endpoint URL
- Or keep placeholders to disable avatar features (app still works for other features)

### "Model is overloaded" Error
- TEI embedding server is busy - wait and retry
- PDFs are now processed page-by-page to reduce server load

## 💡 Notes
- Email feature works independently (uses redsparkdevelopers@gmail.com)
- TEI embedding server (port 8083) and Weaviate (port 8081) should already be running
- Avatar features will be gracefully disabled until Azure Speech is configured
