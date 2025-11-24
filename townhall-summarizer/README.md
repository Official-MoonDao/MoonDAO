# Townhall Summarizer

A Google Cloud Run service that handles the complete townhall processing pipeline:
1. Extracts audio URLs from YouTube videos using `yt-dlp`
2. Transcribes audio using OpenAI Whisper
3. Summarizes transcripts using OpenAI GPT-4
4. Creates and sends ConvertKit email broadcasts

## Setup

### Google Cloud Configuration

1. **Enable Required APIs**:
   ```bash
   gcloud services enable cloudbuild.googleapis.com
   gcloud services enable run.googleapis.com
   gcloud services enable secretmanager.googleapis.com
   ```

2. **Set Project** (if not already set):
   ```bash
   gcloud config set project YOUR_PROJECT_ID
   ```

3. **Create Secret for OpenAI API Key**:
   ```bash
   echo -n "your-openai-api-key" | gcloud secrets create openai-api-key \
     --data-file=- \
     --replication-policy="automatic"
   ```

   Grant Cloud Run access to the secret:
   ```bash
   gcloud secrets add-iam-policy-binding openai-api-key \
     --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
     --role="roles/secretmanager.secretAccessor"
   ```

   Replace `PROJECT_NUMBER` with your project number (find it with `gcloud projects describe YOUR_PROJECT_ID --format="value(projectNumber)"`).

### Deployment

1. **Build and Deploy**:
   ```bash
   cd townhall-summarizer
   gcloud builds submit --config cloudbuild.yaml
   ```

2. **Verify Deployment**:
   ```bash
   gcloud run services describe townhall-summarizer --region us-central1
   ```

3. **Get Service URL**:
   ```bash
   gcloud run services describe townhall-summarizer --region us-central1 --format 'value(status.url)'
   ```

### Configuration

The service URL will be in the format:
```
https://townhall-summarizer-<project-id>-<region>.a.run.app
```

Set this URL as the `TOWNHALL_PROCESSING_SERVICE_URL` environment variable in Vercel.

**Required Environment Variables (in Cloud Run):**
- `OPENAI_API_KEY` - OpenAI API key for transcription and summarization

**Required Environment Variables (in Vercel):**
- `TOWNHALL_PROCESSING_SERVICE_URL` - URL of this Cloud Run service
- `CONVERT_KIT_API_KEY` or `CONVERT_KIT_V4_API_KEY` - ConvertKit API key (passed to service)
- `YOUTUBE_API_KEY` - YouTube API key (for video metadata)
- `YOUTUBE_CHANNEL_ID` - YouTube channel ID
- `TOWNHALL_CONVERTKIT_TAG_ID` - ConvertKit tag ID for townhall broadcasts

### Infrastructure
- Memory: 512Mi
- Timeout: 60 minutes (for long videos)
- Min Instances: 0 (scale to zero when not in use)
- Max Instances: 10
- Region: us-central1

### API Usage

**Full Pipeline Endpoint**: `POST /process`

Processes a complete townhall: extracts audio, transcribes, summarizes, and sends ConvertKit email.

**Request Body**:
```json
{
  "videoId": "dQw4w9WgXcQ",
  "videoTitle": "Town Hall - January 2024",
  "videoDate": "2024-01-15T00:00:00Z",
  "openaiModel": "gpt-4",
  "whisperModel": "whisper-1",
  "convertKitApiKey": "your-api-key",
  "convertKitTagId": "123456"
}
```

**Response**:
```json
{
  "success": true,
  "videoId": "dQw4w9WgXcQ",
  "broadcastId": "789012",
  "summary": "Summary preview..."
}
```

**Legacy Audio Extraction Endpoint**: `GET /?videoId=<youtube-video-id>`

Returns direct audio stream URL as plain text (for backward compatibility).

**Health Check**: `GET /health`

Returns `{ "status": "ok" }` if the service is running.

### Local Development

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Install yt-dlp** (required):
   ```bash
   # macOS
   brew install yt-dlp
   
   # Linux
   sudo apt-get install yt-dlp
   ```

3. **Set Environment Variables**:
   ```bash
   export OPENAI_API_KEY=your-openai-api-key
   ```

4. **Build TypeScript**:
   ```bash
   npm run build
   ```

5. **Run Locally** (production mode):
   ```bash
   npm start
   ```

   Or run in development mode (with ts-node):
   ```bash
   npm run dev
   ```

6. **Test the Full Pipeline** (without sending emails):
   ```bash
   # Test with a YouTube video ID
   npm test dQw4w9WgXcQ
   
   # Or specify a custom service URL
   SERVICE_URL=http://localhost:8080 npm test dQw4w9WgXcQ
   ```

   The test script will:
   - Extract audio from the YouTube video
   - Transcribe using OpenAI Whisper
   - Summarize using OpenAI GPT-4
   - Format the summary for ConvertKit
   - **Skip sending the ConvertKit email** (test mode)

7. **Test Audio Extraction Only**:
   ```bash
   curl "http://localhost:8080/?videoId=dQw4w9WgXcQ"
   ```

### Error Handling
- Missing `videoId` parameter: Returns 400
- Failed audio extraction: Returns 500 with error message
- Invalid video ID: Returns 500 with error message from yt-dlp

### Integration
- `ui/pages/api/townhall/process.ts`

