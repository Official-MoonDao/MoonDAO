import type { NextApiRequest, NextApiResponse } from 'next'
import { extractVideoId, getVideoMetadata } from '../../../lib/townhall/youtube'
import { transcribeYouTubeVideo, summarizeTranscript } from '../../../lib/townhall/openai'
import { createTownHallBroadcast, findBroadcastByVideoId } from '../../../lib/townhall/convertkit'
import { formatSummaryForConvertKit } from '../../../lib/townhall/prompts'
import apiKeyMiddleware from '../../../lib/mongodb/models/middleware'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
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

    if (!youtubeApiKey) {
      return res.status(500).json({
        message: 'Missing YOUTUBE_API_KEY environment variable',
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

        const transcript = await transcribeYouTubeVideo(videoId, whisperModel)
        if (!transcript || transcript.trim().length === 0) {
          results.push({
            videoUrl,
            videoId,
            success: false,
            error: 'Empty transcript',
          })
          continue
        }

        const summary = await summarizeTranscript(transcript, openaiModel)
        if (!summary) {
          results.push({
            videoUrl,
            videoId,
            success: false,
            error: 'Failed to generate summary',
          })
          continue
        }

        const formattedSummary = formatSummaryForConvertKit(
          summary,
          videoMetadata.title,
          videoMetadata.publishedAt,
          videoId
        )

        const broadcastSubject = `Town Hall Summary - ${new Date(videoMetadata.publishedAt).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })}`

        const broadcast = await createTownHallBroadcast(
          broadcastSubject,
          formattedSummary,
          tagId,
          false
        )

        if (!broadcast) {
          results.push({
            videoUrl,
            videoId,
            success: false,
            error: 'Failed to create ConvertKit broadcast',
          })
          continue
        }

        results.push({
          videoUrl,
          videoId,
          success: true,
          broadcastId: broadcast.id,
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
      message: 'Retroactive processing completed',
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

