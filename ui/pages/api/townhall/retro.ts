import type { NextApiRequest, NextApiResponse } from 'next'
import apiKeyMiddleware from '../../../lib/mongodb/models/middleware'
import { findBroadcastByVideoId } from '../../../lib/townhall/convertkit'
import { extractVideoId, getVideoMetadata } from '../../../lib/townhall/youtube'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const auth = await apiKeyMiddleware(req, res)
  if (!auth) return

  try {
    const { videoUrls } = req.body

    if (!videoUrls || !Array.isArray(videoUrls) || videoUrls.length === 0) {
      return res.status(400).json({
        message: 'videoUrls array is required',
      })
    }

    const youtubeApiKey = process.env.YOUTUBE_API_KEY
    const openaiModel = process.env.OPENAI_MODEL || 'gpt-4'
    const whisperModel = process.env.WHISPER_MODEL || 'whisper-1'
    const tagId = process.env.TOWNHALL_CONVERTKIT_TAG_ID
    const processingServiceUrl = process.env.TOWNHALL_PROCESSING_SERVICE_URL

    if (!youtubeApiKey) {
      return res.status(500).json({
        message: 'Missing YOUTUBE_API_KEY environment variable',
      })
    }

    if (!processingServiceUrl) {
      return res.status(500).json({
        message: 'Missing TOWNHALL_PROCESSING_SERVICE_URL environment variable',
      })
    }

    const results = []

    for (const videoUrl of videoUrls) {
      try {
        const videoId = extractVideoId(videoUrl)
        if (!videoId) {
          results.push({
            videoUrl,
            success: false,
            error: 'Invalid video URL or ID',
          })
          continue
        }

        const existing = await findBroadcastByVideoId(videoId, tagId)
        if (existing) {
          results.push({
            videoUrl,
            videoId,
            success: false,
            error: 'Video already processed',
            broadcastId: existing.id,
          })
          continue
        }

        const videoMetadata = await getVideoMetadata(videoId, youtubeApiKey)
        if (!videoMetadata) {
          results.push({
            videoUrl,
            videoId,
            success: false,
            error: 'Video metadata not found',
          })
          continue
        }

        // Call the Cloud Run service to handle the full pipeline
        const processingResponse = await fetch(`${processingServiceUrl}/process`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            videoId: videoId,
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
          results.push({
            videoUrl,
            videoId,
            success: false,
            error: `Processing failed: ${errorText}`,
          })
          continue
        }

        const result = await processingResponse.json()

        results.push({
          videoUrl,
          videoId,
          success: true,
          broadcastId: result.broadcastId,
        })
      } catch (error) {
        results.push({
          videoUrl,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    return res.status(200).json({
      message: 'Retroactive processing completed!',
      results,
      total: videoUrls.length,
      successful: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
    })
  } catch (error) {
    console.error('Error in retroactive processing:', error)
    return res.status(500).json({
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
