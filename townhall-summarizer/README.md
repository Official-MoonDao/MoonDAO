# Townhall Summarizer

A Google Cloud Run service that handles the complete townhall processing pipeline:
1. Extracts audio URLs from YouTube videos using `yt-dlp`
2. Transcribes audio using OpenAI Whisper
3. Summarizes transcripts using OpenAI GPT-4
4. Creates and sends ConvertKit email broadcasts

## Credits

This feature was inspired by [@wonderofme](https://github.com/wonderofme)'s original proposal and prototype repository ([Moondao-Weekly](https://github.com/wonderofme/Moondao-Weekly)). While the final implementation took a different direction, their work was instrumental in sparking this feature.

## Setup

### Configuration

The service URL will be in the format:
```
https://townhall-summarizer-<project-id>-<region>.a.run.app
```

Set this URL as the `TOWNHALL_PROCESSING_SERVICE_URL` environment variable in Vercel.

**Required Environment Variables (in Cloud Run):**
- `OPENAI_API_KEY` - OpenAI API key for transcription and summarization
- `ALLOWED_YOUTUBE_CHANNEL_ID` - YouTube channel ID to restrict processing to (e.g., for @officialmoondao). If not set, any channel is allowed.

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
   yarn install
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
   export ALLOWED_YOUTUBE_CHANNEL_ID=UC_xxxxx  # Optional: restrict to specific channel
   ```

   To find the channel ID for a YouTube handle (e.g., @officialmoondao), you can:
   - Use the helper script: `yarn get-channel-id @officialmoondao` (requires YOUTUBE_API_KEY)
   - Or use an online tool like [this](https://commentpicker.com/youtube-channel-id.php)
   
   The channel ID is required to restrict processing to a specific channel. If not set, the service will process videos from any channel.

4. **Build TypeScript**:
   ```bash
   yarn build
   ```

5. **Run Locally** (production mode):
   ```bash
   yarn start
   ```

   Or run in development mode (with ts-node):
   ```bash
   yarn dev
   ```

6. **Test the Full Pipeline** (without sending emails):
   ```bash
   # Test with a YouTube video ID
   yarn test dQw4w9WgXcQ
   
   # Or specify a custom service URL
   SERVICE_URL=http://localhost:8080 yarn test dQw4w9WgXcQ
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

### Retroactive Processing

Process multiple historical townhall videos retroactively using the retro script.

1. **Set Required Environment Variables**:
   ```bash
   export OPENAI_API_KEY=your-openai-api-key
   export YOUTUBE_API_KEY=your-youtube-api-key
   export CONVERT_KIT_API_KEY=your-convertkit-api-key
   export TOWNHALL_CONVERTKIT_TAG_ID=your-tag-id
   export ALLOWED_YOUTUBE_CHANNEL_ID=UC_xxxxx  # Optional: restrict to specific channel
   ```

2. **Run Retro Script**:
   ```bash
   yarn retro https://youtube.com/watch?v=VIDEO_ID_1 https://youtube.com/watch?v=VIDEO_ID_2
   ```

   The script will:
   - Extract video IDs from URLs
   - Check if videos are already processed (skips if broadcast exists)
   - Get video metadata from YouTube
   - Process each video: extract audio, transcribe, summarize, create ConvertKit broadcast
   - Output results summary

3. **Example**:
   ```bash
   yarn retro \
     https://www.youtube.com/watch?v=dQw4w9WgXcQ \
     https://youtu.be/abc123def45
   ```

The script automatically skips videos that have already been processed (checks for existing ConvertKit broadcasts).

### Docker Compose

Run the service using Docker Compose for containerized local development.

1. **Set Environment Variables**:
   ```bash
   export OPENAI_API_KEY=your-openai-api-key
   ```

2. **Build and Start**:
   ```bash
   yarn docker:build
   yarn docker:up
   ```

3. **View Logs**:
   ```bash
   yarn docker:logs
   ```

4. **Stop the Service**:
   ```bash
   yarn docker:down
   ```

5. **Restart the Service**:
   ```bash
   yarn docker:restart
   ```

The service will be available at `http://localhost:8080`.

### Error Handling
- Missing `videoId` parameter: Returns 400
- Failed audio extraction: Returns 500 with error message
- Invalid video ID: Returns 500 with error message from yt-dlp

### Integration
- `ui/pages/api/townhall/process.ts`

