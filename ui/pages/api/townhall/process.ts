import type { NextApiRequest, NextApiResponse } from 'next'
import { findBroadcastByVideoId } from '../../../lib/townhall/convertkit'
import { getLatestLiveVideo, getVideoMetadata } from '../../../lib/townhall/youtube'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const cronSecret = req.headers['x-cron-secret'] || req.query.secret
  const expectedSecret = process.env.TOWNHALL_CRON_SECRET

  if (expectedSecret && cronSecret !== expectedSecret) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  try {
    const youtubeApiKey = process.env.YOUTUBE_API_KEY
    const channelId = process.env.YOUTUBE_CHANNEL_ID
    const openaiModel = process.env.OPENAI_MODEL || 'gpt-4'
    const whisperModel = process.env.WHISPER_MODEL || 'whisper-1'
    const tagId = process.env.TOWNHALL_CONVERTKIT_TAG_ID
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

    const existing = await findBroadcastByVideoId(latestVideo.id, tagId)

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
    // This returns immediately, the service handles transcription, summarization, and email sending
    const processingResponse = await fetch(`${processingServiceUrl}/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        videoId: latestVideo.id,
        videoTitle: videoMetadata.title,
        videoDate: videoMetadata.publishedAt,
        openaiModel: openaiModel,
        whisperModel: whisperModel,
        convertKitApiKey: process.env.CONVERT_KIT_API_KEY || process.env.CONVERT_KIT_V4_API_KEY,
        convertKitTagId: tagId,
      }),
    })

    if (!processingResponse.ok) {
      const errorText = await processingResponse.text()
      console.error('Processing service error:', errorText)
      return res.status(500).json({
        message: 'Failed to process town hall',
        error: errorText,
      })
    }

    const result = await processingResponse.json()

    return res.status(200).json({
      message: 'Town hall processing started successfully!',
      videoId: latestVideo.id,
      broadcastId: result.broadcastId,
      summary: result.summary,
    })
  } catch (error) {
    console.error('Error processing town hall:', error)
    return res.status(500).json({
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
