# Townhall Summarizer

A Google Cloud Run service that handles the complete townhall processing pipeline:
1. Extracts audio URLs from YouTube videos using `yt-dlp`
2. Transcribes audio using GROQ Whisper Large v3
3. Summarizes transcripts using GROQ Llama-3.3-70b-versatile
4. Creates ConvertKit email broadcast drafts (requires manual review and sending)

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
- `GROQ_API_KEY` - GROQ API key for transcription and summarization (free tier available)
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

Processes a complete townhall: extracts audio, transcribes, summarizes, and creates ConvertKit email broadcast draft (requires manual review and sending).

**Request Body**:
```json
{
  "videoId": "dQw4w9WgXcQ",
  "videoTitle": "Town Hall - January 2024",
  "videoDate": "2024-01-15T00:00:00Z",
  "groqModel": "llama-3.3-70b-versatile",
  "whisperModel": "whisper-large-v3",
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

**Audio Extraction Endpoint**: `GET /audio?videoId=<youtube-video-id>`

Returns direct audio stream URL as plain text. Useful for extracting audio from YouTube videos without running the full pipeline.

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
   export GROQ_API_KEY=your-groq-api-key
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
   - Transcribe using GROQ Whisper Large v3
   - Summarize using GROQ Llama-3.3-70b-versatile
   - Format the summary for ConvertKit
   - **Skip sending the ConvertKit email** (test mode)

7. **Test Audio Extraction Only**:
   ```bash
   curl "http://localhost:8080/audio?videoId=dQw4w9WgXcQ"
   ```

### Retroactive Processing

Process multiple historical townhall videos retroactively using the retro script.

1. **Set Required Environment Variables**:
   
   **Option 1: Create a `.env` file (recommended)**:
   Create a `.env` file in the `townhall-summarizer` directory:
   ```bash
   GROQ_API_KEY=your-groq-api-key
   YOUTUBE_API_KEY=your-youtube-api-key
   CONVERT_KIT_API_KEY=your-convertkit-api-key
   TOWNHALL_CONVERTKIT_TAG_ID=your-tag-id
   ALLOWED_YOUTUBE_CHANNEL_ID=UC_xxxxx  # Optional: restrict to specific channel
   ```
   
   **Option 2: Export in your shell**:
   ```bash
   export GROQ_API_KEY=your-groq-api-key
   export YOUTUBE_API_KEY=your-youtube-api-key
   export CONVERT_KIT_API_KEY=your-convertkit-api-key
   export TOWNHALL_CONVERTKIT_TAG_ID=your-tag-id
   export ALLOWED_YOUTUBE_CHANNEL_ID=UC_xxxxx  # Optional: restrict to specific channel
   ```
   
   **Important**: The `.env` file is gitignored, so you'll need to create it locally. Docker Compose will automatically read from `.env` if it exists.

2. **Run Retro Script**:
   ```bash
   yarn retro VIDEO_ID_1 VIDEO_ID_2
   ```

   The script accepts:
   - Video IDs directly (e.g., `dQw4w9WgXcQ`)
   - Full YouTube URLs (e.g., `https://youtube.com/watch?v=dQw4w9WgXcQ`)

   The script will:
   - Extract video IDs from input (URLs or IDs)
   - Check if videos are already processed (skips if broadcast exists)
   - Get video metadata from YouTube
   - Process each video: extract audio, transcribe, summarize, create ConvertKit broadcast draft
   - Output results summary

3. **Examples**:
   ```bash
   # Using video IDs (recommended)
   yarn retro dQw4w9WgXcQ KNejl2ThCf0
   
   # Using full URLs (also supported)
   yarn retro \
     https://www.youtube.com/watch?v=dQw4w9WgXcQ \
     https://youtu.be/abc123def45
   ```

**Note**: Broadcasts are created as drafts in ConvertKit and require manual review and sending. The script automatically skips videos that have already been processed (checks for existing ConvertKit broadcasts).

### Video Processing Order

**Important**: When processing multiple retro videos, they will be automatically sorted by their YouTube published date (oldest first) to ensure they appear in the correct chronological order on the website.

The system uses the video's `publishedAt` date from YouTube as the primary sorting mechanism. Videos are processed in chronological order (oldest first), which ensures they appear correctly on the townhall summaries page.

**How it works:**
1. The script fetches metadata for all provided videos
2. Videos are automatically sorted by their YouTube `publishedAt` date (oldest first)
3. Videos are then processed in this sorted order
4. On the website, summaries are displayed sorted by video publication date (newest first)

**Best Practice**: You can provide videos in any order - the script will automatically sort them chronologically. However, processing them in order (oldest first) is recommended for consistency.

**Example:**
```bash
# These will be automatically sorted by published date before processing
yarn retro VIDEO_ID_3 VIDEO_ID_1 VIDEO_ID_2
# Result: Videos will be processed in order: 1, 2, 3 (by published date)
#         And displayed on website as: 3, 2, 1 (newest first)
```

**Fallback Sorting**: If video publication dates cannot be determined, the system falls back to using ConvertKit broadcast creation dates for sorting.

### Docker Compose

Run the service using Docker Compose for containerized local development.

1. **Set Environment Variables**:
   ```bash
   export GROQ_API_KEY=your-groq-api-key
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

#### Testing with Docker

Run the test script inside Docker containers:

1. **Set Required Environment Variables**:
   ```bash
   export GROQ_API_KEY=your-groq-api-key
   ```
   
   **Optional (for channel validation)**:
   ```bash
   export YOUTUBE_API_KEY=your-youtube-api-key
   export ALLOWED_YOUTUBE_CHANNEL_ID=UC_xxxxx
   ```
   
   **Note**: If you set `ALLOWED_YOUTUBE_CHANNEL_ID`, you must also set `YOUTUBE_API_KEY` because channel validation requires the YouTube API.

2. **Run the Test**:
   ```bash
   yarn docker:test VIDEO_ID
   ```
   
   Example:
   ```bash
   yarn docker:test dQw4w9WgXcQ
   ```

**Note**: The `SERVICE_URL` is automatically set to `http://townhall-summarizer:8080` in the test container, so the test service connects to the main service running in Docker.

#### Running Retro Script in Docker

Run the retro script inside Docker for consistent environment and no local setup required.

1. **Set Required Environment Variables**:
   ```bash
   export GROQ_API_KEY=your-groq-api-key
   export YOUTUBE_API_KEY=your-youtube-api-key
   export CONVERT_KIT_API_KEY=your-convertkit-api-key
   export TOWNHALL_CONVERTKIT_TAG_ID=your-tag-id
   export ALLOWED_YOUTUBE_CHANNEL_ID=UC_xxxxx  # Optional: restrict to specific channel
   ```

2. **Run Retro Script**:
   
   **Using yarn (recommended - passes arguments automatically)**:
   ```bash
   yarn docker:retro VIDEO_ID_1 VIDEO_ID_2
   ```
   
   Example:
   ```bash
   yarn docker:retro dQw4w9WgXcQ KNejl2ThCf0
   ```
   
   **Or using docker-compose directly**:
   ```bash
   docker-compose --profile retro build retro
   docker-compose --profile retro run --rm retro yarn retro VIDEO_ID_1 VIDEO_ID_2
   ```

**Benefits of running retro in Docker:**
- No need to install yt-dlp, ffmpeg, Python, or other dependencies locally
- Consistent environment matching production
- Isolated from your local system
- Same Node version and dependencies as the production service

**Note**: The retro script will automatically sort videos by their published date (oldest first) before processing, ensuring correct chronological order on the website.

#### Tagging an Existing Broadcast

If you created a broadcast without tagging it (e.g., `TOWNHALL_CONVERTKIT_TAG_ID` wasn't set), you can tag it manually:

```bash
# Set the tag ID
export TOWNHALL_CONVERTKIT_TAG_ID=your-tag-id
export CONVERT_KIT_API_KEY=your-api-key

# Tag the broadcast
yarn tag-broadcast 22037489
```

Or using Docker:
```bash
docker-compose --profile retro run --rm retro yarn tag-broadcast 22037489
```

### Rate Limits

The service uses GROQ's free tier with built-in rate limiting. Rate limits are automatically enforced:

**Whisper (Transcription):**
- 20 requests/minute
- 2,000 requests/day
- 7,200 audio seconds/hour (2 hours)
- 28,800 audio seconds/day (8 hours)

**LLM (Summarization - llama-3.3-70b-versatile):**
- 30 requests/minute
- 1,000 requests/day
- 12,000 tokens/minute
- 100,000 tokens/day

For typical weekly town hall videos (1-1.5 hours), these limits are sufficient. The service will automatically wait and retry if rate limits are approached.

### Error Handling
- Missing `videoId` parameter: Returns 400
- Failed audio extraction: Returns 500 with error message
- Invalid video ID: Returns 500 with error message from yt-dlp
- Rate limit exceeded: Returns 500 with clear error message

### Integration
- `ui/pages/api/townhall/process.ts`

