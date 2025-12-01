# Google Cloud Setup Guide - Townhall Summarizer

## Prerequisites

- Google Cloud account with billing enabled
- `gcloud` CLI installed and authenticated
- Access to GROQ API key (free tier available but you may exceed the ratelimits)
- Access to YouTube Data API key
- Access to ConvertKit API key

## Part 1: Google Cloud Run Service Setup

### 1.1 Initial Google Cloud Configuration

1. **Set your Google Cloud project**:
   ```bash
   gcloud config set project YOUR_PROJECT_ID
   ```

2. **Enable required APIs**:
   ```bash
   gcloud services enable cloudbuild.googleapis.com
   gcloud services enable run.googleapis.com
   gcloud services enable secretmanager.googleapis.com
   ```

3. **Get your project number** (needed for service account):
   ```bash
   gcloud projects describe YOUR_PROJECT_ID --format="value(projectNumber)"
   ```
   Save this value as `PROJECT_NUMBER`.

### 1.2 Create Secrets in Secret Manager

1. **Create GROQ API Key secret**:
   ```bash
   echo -n "your-groq-api-key" | gcloud secrets create groq-api-key \
     --data-file=- \
     --replication-policy="automatic"
   ```

2. **Grant Cloud Run access to the secret**:
   ```bash
   gcloud secrets add-iam-policy-binding groq-api-key \
     --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
     --role="roles/secretmanager.secretAccessor"
   ```
   Replace `PROJECT_NUMBER` with the value from step 1.1.3.

3. **Create YouTube API Key secret** (required for channel validation):
   ```bash
   echo -n "your-youtube-api-key" | gcloud secrets create youtube-api-key \
     --data-file=- \
     --replication-policy="automatic"
   ```

   Grant Cloud Run access:
   ```bash
   gcloud secrets add-iam-policy-binding youtube-api-key \
     --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
     --role="roles/secretmanager.secretAccessor"
   ```

4. **Create YouTube Channel ID secret** (recommended for security):
   ```bash
   # First, get the channel ID using the helper script locally:
   # yarn get-channel-id @officialmoondao
   # Or use: https://commentpicker.com/youtube-channel-id.php
   
   # Then create the secret:
   echo -n "UC_xxxxx" | gcloud secrets create allowed-youtube-channel-id \
     --data-file=- \
     --replication-policy="automatic"
   
   # Grant access:
   gcloud secrets add-iam-policy-binding allowed-youtube-channel-id \
     --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
     --role="roles/secretmanager.secretAccessor"
   ```
   
   **Important**: 
   - If you create `allowed-youtube-channel-id`, you **must** also create `youtube-api-key` (step 1.2.3) because channel validation requires the YouTube API.
   - If you don't create these secrets, the service will process videos from any channel.
   - The `cloudbuild.yaml` is configured to use all three secrets. If you don't want channel validation, you can remove `YOUTUBE_API_KEY` and `ALLOWED_YOUTUBE_CHANNEL_ID` from the deployment.

### 1.3 Deploy the Service

1. **Navigate to the townhall-summarizer directory**:
   ```bash
   cd townhall-summarizer
   ```

2. **Build and deploy using Cloud Build**:
   ```bash
   gcloud builds submit --config cloudbuild.yaml
   ```

   This will:
   - Build the Docker image
   - Push it to Google Container Registry
   - Deploy to Cloud Run with the configured settings
   
   **Note**: The default `cloudbuild.yaml` only includes `GROQ_API_KEY`. If you want to enable channel validation (recommended for production), you need to add the YouTube secrets after deployment (see section 1.4).

3. **Verify deployment**:
   ```bash
   gcloud run services describe townhall-summarizer --region us-central1
   ```

4. **Get the service URL**:
   ```bash
   gcloud run services describe townhall-summarizer --region us-central1 --format 'value(status.url)'
   ```
   Save this URL - you'll need it for Vercel configuration.

   The URL will be in the format:
   ```
   https://townhall-summarizer-<project-id>-<region>.a.run.app
   ```

### 1.4 Update Cloud Run Service Configuration (Optional)

If you need to update environment variables or secrets after deployment:

1. **Add channel validation** (recommended for production):
   
   If you created the YouTube API key and channel ID secrets (steps 1.2.3 and 1.2.4), you can enable channel validation:
   ```bash
   gcloud run services update townhall-summarizer \
     --region us-central1 \
     --set-secrets="GROQ_API_KEY=groq-api-key:latest,YOUTUBE_API_KEY=youtube-api-key:latest,ALLOWED_YOUTUBE_CHANNEL_ID=allowed-youtube-channel-id:latest"
   ```
   
   **Important**: 
   - You must create both `youtube-api-key` and `allowed-youtube-channel-id` secrets before running this
   - Channel validation requires both `YOUTUBE_API_KEY` and `ALLOWED_YOUTUBE_CHANNEL_ID` to work
   - This will restrict processing to videos from the specified YouTube channel only
   - Without these, the service will process videos from any channel

2. **Update other settings** (memory, timeout, etc.):
   ```bash
   gcloud run services update townhall-summarizer \
     --region us-central1 \
     --memory 512Mi \
     --timeout 3600 \
     --min-instances 0 \
     --max-instances 10
   ```

### 1.5 Test the Service

1. **Health check**:
   ```bash
   curl https://townhall-summarizer-<project-id>-<region>.a.run.app/health
   ```
   Should return: `{"status":"ok"}`

2. **Test audio extraction** (legacy endpoint):
   ```bash
   curl "https://townhall-summarizer-<project-id>-<region>.a.run.app/?videoId=VIDEO_ID"
   ```

## Part 2: Vercel/UI API Route Configuration

### 2.1 Required Environment Variables in Vercel

Add these environment variables in your Vercel project settings:

1. **Townhall Processing Service URL**:
   ```
   TOWNHALL_PROCESSING_SERVICE_URL=https://townhall-summarizer-<project-id>-<region>.a.run.app
   ```

2. **YouTube API Configuration**:
   ```
   YOUTUBE_API_KEY=your-youtube-api-key
   YOUTUBE_CHANNEL_ID=UC_xxxxx  # Channel ID for @officialmoondao
   ```

3. **ConvertKit Configuration**:
   ```
   CONVERT_KIT_API_KEY=your-convertkit-api-key
   # OR
   CONVERT_KIT_V4_API_KEY=your-convertkit-v4-api-key
   TOWNHALL_CONVERTKIT_TAG_ID=your-tag-id
   ```

4. **GROQ Model Configuration** (optional, defaults shown):
   ```
   GROQ_MODEL=llama-3.3-70b-versatile
   WHISPER_MODEL=whisper-large-v3
   ```

5. **Cron Secret** (for scheduled processing):
   ```
   TOWNHALL_CRON_SECRET=your-random-secret-string
   ```

### 2.2 API Routes Overview

The UI has the following API routes that interact with the Cloud Run service:

#### `/api/townhall/process` (POST)
- **Purpose**: Automatically process the latest townhall video from the configured YouTube channel
- **Authentication**: Requires `TOWNHALL_CRON_SECRET` header or query parameter
- **Flow**:
  1. Fetches latest video from YouTube channel
  2. Checks if already processed
  3. Calls Cloud Run `/process` endpoint
  4. Returns processing result

**Example usage** (for cron job):
```bash
curl -X POST "https://your-domain.com/api/townhall/process?secret=YOUR_CRON_SECRET"
```

#### `/api/townhall/[id]` (GET)
- **Purpose**: Fetch a specific townhall summary by broadcast ID
- **Authentication**: Public (rate limited)
- **Returns**: Broadcast details including content, title, published date

#### `/api/townhall/summaries` (GET)
- **Purpose**: List all townhall summaries
- **Authentication**: Public (rate limited)
- **Returns**: Array of summary objects

### 2.3 Setting Up Scheduled Processing

The project already has a cron job configured in `vercel.json` that runs weekly on Mondays at midnight:

```json
{
  "crons": [
    {
      "path": "/api/townhall/process",
      "schedule": "0 0 * * 1"
    }
  ]
}
```

**To modify the schedule**:
- Edit `vercel.json` in the root directory
- Update the `schedule` field using cron syntax
- Common schedules:
  - `"0 */6 * * *"` - Every 6 hours
  - `"0 0 * * *"` - Daily at midnight
  - `"0 0 * * 1"` - Weekly on Monday (current)

**Note**: The cron job requires `TOWNHALL_CRON_SECRET` to be set in Vercel environment variables for authentication.

## Part 3: Security Configuration

### 3.1 Cloud Run Security

The service is deployed with `--allow-unauthenticated` for public access. If you want to restrict access:

1. **Remove public access**:
   ```bash
   gcloud run services update townhall-summarizer \
     --region us-central1 \
     --no-allow-unauthenticated
   ```

2. **Create a service account for Vercel** (if using authenticated access):
   ```bash
   gcloud iam service-accounts create vercel-townhall \
     --display-name="Vercel Townhall Service"
   
   gcloud run services add-iam-policy-binding townhall-summarizer \
     --region us-central1 \
     --member="serviceAccount:vercel-townhall@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
     --role="roles/run.invoker"
   ```

### 3.2 Channel Restriction

The service validates that videos are from the allowed YouTube channel when `ALLOWED_YOUTUBE_CHANNEL_ID` is set. This prevents processing videos from unauthorized channels.

To enable:
1. Get channel ID: `yarn get-channel-id @officialmoondao`
2. Set as secret in Cloud Run (see section 1.2.3)
3. Or pass as environment variable in Cloud Run

## Part 4: Monitoring and Troubleshooting

### 4.1 View Logs

```bash
gcloud run services logs read townhall-summarizer --region us-central1 --limit 50
```

### 4.2 Check Service Status

```bash
gcloud run services describe townhall-summarizer --region us-central1
```

### 4.3 Common Issues

1. **Service timeout**: Increase timeout in `cloudbuild.yaml` or via `gcloud run services update`
2. **Memory issues**: Increase memory allocation (currently 512Mi)
3. **Secret access denied**: Verify IAM bindings for Secret Manager
4. **Channel validation fails**: Check `ALLOWED_YOUTUBE_CHANNEL_ID` matches video's channel

### 4.4 Cost Optimization

- **Min instances**: Set to 0 (scale to zero when not in use)
- **Max instances**: Adjust based on expected load (default: 10)
- **Timeout**: Set appropriately (60 minutes for long videos)
- **Memory**: 512Mi is sufficient for most videos

## Part 5: Infrastructure Summary

### Cloud Run Service Configuration

- **Service Name**: `townhall-summarizer`
- **Region**: `us-central1`
- **Memory**: `512Mi`
- **Timeout**: `3600s` (60 minutes)
- **Min Instances**: `0` (scale to zero)
- **Max Instances**: `10`
- **Platform**: `managed`
- **Authentication**: `unauthenticated` (public)

### Secrets Used

- `groq-api-key` - GROQ API key for transcription and summarization (required, free tier available)
- `youtube-api-key` - YouTube Data API key for channel validation (required if using channel restriction)
- `allowed-youtube-channel-id` (optional) - YouTube channel ID restriction (requires youtube-api-key)

### Environment Variables (Cloud Run)

Set via secrets:
- `GROQ_API_KEY` - From Secret Manager (required)
- `YOUTUBE_API_KEY` - From Secret Manager (required if using channel validation)
- `ALLOWED_YOUTUBE_CHANNEL_ID` - From Secret Manager (optional, but requires YOUTUBE_API_KEY if set)

### Environment Variables (Vercel)

- `TOWNHALL_PROCESSING_SERVICE_URL` - Cloud Run service URL
- `YOUTUBE_API_KEY` - YouTube Data API key
- `YOUTUBE_CHANNEL_ID` - YouTube channel ID
- `CONVERT_KIT_API_KEY` or `CONVERT_KIT_V4_API_KEY` - ConvertKit API key
- `TOWNHALL_CONVERTKIT_TAG_ID` - ConvertKit tag ID
- `GROQ_MODEL` - GROQ model (default: llama-3.3-70b-versatile)
- `WHISPER_MODEL` - Whisper model (default: whisper-large-v3)
- `TOWNHALL_CRON_SECRET` - Secret for cron authentication

## Part 6: Deployment Checklist

- [ ] Google Cloud project created and billing enabled
- [ ] Required APIs enabled (Cloud Build, Cloud Run, Secret Manager)
- [ ] GROQ API key secret created in Secret Manager
- [ ] YouTube API key secret created in Secret Manager (if using channel validation)
- [ ] YouTube Channel ID secret created in Secret Manager (optional, but requires YouTube API key)
- [ ] IAM permissions configured for all secrets
- [ ] Service deployed via Cloud Build
- [ ] Service URL obtained and tested
- [ ] Vercel environment variables configured
- [ ] YouTube API key configured in Vercel
- [ ] ConvertKit API key configured in Vercel
- [ ] Channel ID obtained and configured (optional)
- [ ] Cron job configured (if using scheduled processing)
- [ ] Health check endpoint verified
- [ ] Test processing completed successfully

## Part 7: Quick Reference Commands

```bash
# Deploy service
gcloud builds submit --config cloudbuild.yaml

# View logs
gcloud run services logs read townhall-summarizer --region us-central1

# Update service
gcloud run services update townhall-summarizer --region us-central1

# Get service URL
gcloud run services describe townhall-summarizer --region us-central1 --format 'value(status.url)'

# Test health endpoint
curl https://townhall-summarizer-<project-id>-<region>.a.run.app/health
```

