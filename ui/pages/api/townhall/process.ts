import type { NextApiRequest, NextApiResponse } from 'next'
import { findBroadcastByVideoId } from '../../../lib/townhall/convertkit'
import { getLatestLiveVideo, getVideoMetadata } from '../../../lib/townhall/youtube'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  // Vercel crons send: Authorization: Bearer <CRON_SECRET>
  // Also support manual triggers via x-cron-secret header or ?secret= query param
  const authHeader = req.headers['authorization']
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  const cronSecret = bearerToken || req.headers['x-cron-secret'] || req.query.secret
  const expectedSecret = process.env.CRON_SECRET || process.env.TOWNHALL_CRON_SECRET

  if (expectedSecret && cronSecret !== expectedSecret) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  try {
    const youtubeApiKey = process.env.YOUTUBE_API_KEY
    const channelId = process.env.YOUTUBE_CHANNEL_ID
    const groqModel = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'
    const whisperModel = process.env.WHISPER_MODEL || 'whisper-large-v3'
    const processingServiceUrl = process.env.TOWNHALL_PROCESSING_SERVICE_URL

    if (!youtubeApiKey || !channelId) {
      return res.status(500).json({
        message: 'Missing required environment variables',
        error: 'YOUTUBE_API_KEY and YOUTUBE_CHANNEL_ID are required',
      })
    }

    if (!processingServiceUrl) {
      return res.status(500).json({
        message: 'Missing required environment variables',
        error: 'TOWNHALL_PROCESSING_SERVICE_URL is required',
      })
    }

    const latestVideo = await getLatestLiveVideo(channelId, youtubeApiKey)

    if (!latestVideo) {
      return res.status(404).json({
        message: 'No live video found',
      })
    }

    const existing = await findBroadcastByVideoId(latestVideo.id)

    if (existing) {
      return res.status(200).json({
        message: 'Video already processed',
        videoId: latestVideo.id,
        broadcastId: existing.id,
      })
    }

    const videoMetadata = await getVideoMetadata(latestVideo.id, youtubeApiKey)

    if (!videoMetadata) {
      return res.status(404).json({
        message: 'Video metadata not found',
      })
    }

    // Call the Cloud Run service to handle the full pipeline
    // Fire-and-forget: don't wait for response to avoid Vercel timeout limits
    // Use AbortController with a generous timeout to ensure the request is actually sent
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000) // 30s to ensure request reaches Cloud Run

    fetch(`${processingServiceUrl}/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        videoId: latestVideo.id,
        videoTitle: videoMetadata.title,
        videoDate: videoMetadata.publishedAt,
        groqModel: groqModel,
        whisperModel: whisperModel,
        convertKitApiKey: process.env.CONVERT_KIT_API_KEY || process.env.CONVERT_KIT_V4_API_KEY,
      }),
    })
      .then((resp) => {
        clearTimeout(timeout)
        console.log(`Processing service responded with status: ${resp.status}`)
      })
      .catch((error) => {
        clearTimeout(timeout)
        // Log errors but don't block the response
        if (error.name === 'AbortError') {
          console.log('Processing request sent successfully (timed out waiting for response, which is expected for long processing)')
        } else {
          console.error('Error triggering processing service (non-blocking):', error)
        }
      })

    return res.status(202).json({
      message: 'Town hall processing started successfully!',
      videoId: latestVideo.id,
      note: 'Processing is running in the background. This may take 10-15 minutes for long videos.',
    })
  } catch (error) {
    console.error('Error processing town hall:', error)
    return res.status(500).json({
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
