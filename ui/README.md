# MoonDAO App UI

https://moondao.com/

## Run the UI locally

Navigate to the folder of the UI app:
```
cd ui/
```

Install the dependencies:
```
yarn install
```

Add testnet variables to your local development environment:
```
cp .env.testnet .env.local
```

Build:
```
yarn build
```

Lint:
```
yarn lint
```

Start the development server:
```
yarn dev
```

Then open http://localhost:3000 in a browser.

## E2E and Integration Testing
Start the development server:
```
yarn dev
```

Run the end-to-end tests headlessly:
```
yarn cy:run
```

Run the integration (component) tests headlessly:
```
yarn cy:run-ct
```

*This project is tested with [Browser Stack](https://www.browserstack.com/).*

## Town Hall Summarizer

The Town Hall Summarizer automatically processes weekly Town Hall YouTube videos, transcribes them, and creates summaries that are sent to newsletter subscribers.

### Environment Variables

The following environment variables are required for the Town Hall Summarizer:

- `YOUTUBE_API_KEY` - YouTube Data API v3 key
- `YOUTUBE_CHANNEL_ID` - MoonDAO YouTube channel ID
- `OPENAI_API_KEY` - OpenAI API key for Whisper transcription and GPT-4 summarization
- `CONVERT_KIT_API_KEY` or `CONVERT_KIT_V4_API_KEY` - ConvertKit API key (for creating broadcasts)
- `TOWNHALL_CONVERTKIT_TAG_ID` - ConvertKit tag ID for town hall broadcasts (optional)
- `TOWNHALL_CRON_SECRET` - Secret for securing the cron endpoint
- `OPENAI_MODEL` - Model for summarization (default: "gpt-4")
- `WHISPER_MODEL` - Whisper model for transcription (default: "whisper-1")
- `YOUTUBE_AUDIO_EXTRACTION_SERVICE_URL` - URL for audio extraction service (required)

### YouTube Audio Extraction Service

You need a service to extract audio from YouTube videos. This service should:

- Accept `?videoId=abc123` as a query parameter
- Return the direct audio stream URL as plain text
- Set `YOUTUBE_AUDIO_EXTRACTION_SERVICE_URL` to your service URL

**Option 1: Deploy Your Own Service (Recommended)**

Deploy a simple serverless function using `yt-dlp`. See `scripts/audio-extraction-service-example.js` for a reference implementation.

**Deployment Platforms:**
- **Railway** (Recommended): Easy deployment, supports Docker and npm, no execution time limits
- **Render**: Free tier available, simple deployment, good for long-running processes
- **Fly.io**: Good for serverless functions with more flexibility than Vercel
- **Vercel**: Possible but **not recommended** due to:
  - Execution time limits (10s Hobby, 60s Pro) - may timeout on longer videos
  - Binary dependencies (`yt-dlp`) are difficult to bundle
  - Cold starts can add latency

**Option: Use Vercel API Route (Not Recommended)**

A Vercel API route is available at `pages/api/youtube-audio-extract.ts`, but it has limitations:
- Requires `yt-dlp` to be available (difficult in serverless environment)
- May timeout on longer videos
- Better to use Railway/Render for reliability

**Quick Deploy to Railway (Recommended):**
1. Create a new project on Railway
2. Add a service with the example code from `scripts/audio-extraction-service-example.js`
3. Create a `Dockerfile` that installs `yt-dlp`:
   ```dockerfile
   FROM node:18
   RUN apt-get update && apt-get install -y yt-dlp
   WORKDIR /app
   COPY package*.json ./
   RUN npm install
   COPY . .
   CMD ["node", "scripts/audio-extraction-service-example.js"]
   ```
4. Set the service URL as `YOUTUBE_AUDIO_EXTRACTION_SERVICE_URL` (e.g., `https://your-service.railway.app`)

**Option 2: Use Existing Services**

Some third-party services provide YouTube audio extraction APIs, but be aware of:
- Rate limits
- Costs
- Terms of service compliance

The system uses OpenAI Whisper for transcription, which requires a direct audio stream URL (not a YouTube watch URL).

### Local Testing

Test the summarization pipeline locally:

```bash
# Run test script (requires YOUTUBE_AUDIO_EXTRACTION_SERVICE_URL)
yarn townhall:test-local "https://youtube.com/watch?v=abc123"
```

This will:
- Extract audio URL using the extraction service
- Transcribe video with OpenAI Whisper
- Generate summary with GPT-4
- Save results to `townhall-test-output.txt`
- **Does NOT post to ConvertKit** (test only)

### Retroactive Processing

To process past town halls, use the retroactive script:

```bash
yarn townhall:retro "https://youtube.com/watch?v=abc123" "https://youtube.com/watch?v=def456"
```

Note: URLs must be quoted to prevent shell globbing issues.

The script requires `NEXT_PUBLIC_MONGO_MOONDAO_API_KEY` to be set for authentication.