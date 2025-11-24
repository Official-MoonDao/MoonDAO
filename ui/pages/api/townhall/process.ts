import type { NextApiRequest, NextApiResponse } from 'next'
import { getLatestLiveVideo, getVideoMetadata } from '../../../lib/townhall/youtube'
import { transcribeYouTubeVideo, summarizeTranscript } from '../../../lib/townhall/openai'
import { createTownHallBroadcast, findBroadcastByVideoId } from '../../../lib/townhall/convertkit'
import { formatSummaryForConvertKit } from '../../../lib/townhall/prompts'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
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

    if (!youtubeApiKey || !channelId) {
      return res.status(500).json({
        message: 'Missing required environment variables',
        error: 'YOUTUBE_API_KEY and YOUTUBE_CHANNEL_ID are required',
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

    let transcript: string
    try {
      transcript = await transcribeYouTubeVideo(latestVideo.id, whisperModel)
    } catch (error) {
      console.error('Transcription error:', error)
      return res.status(500).json({
        message: 'Failed to transcribe video',
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }

    if (!transcript || transcript.trim().length === 0) {
      return res.status(500).json({
        message: 'Empty transcript received',
      })
    }

    const summary = await summarizeTranscript(transcript, openaiModel)

    if (!summary) {
      return res.status(500).json({
        message: 'Failed to generate summary',
      })
    }

    const formattedSummary = formatSummaryForConvertKit(
      summary,
      videoMetadata.title,
      videoMetadata.publishedAt,
      latestVideo.id
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
      true
    )

    if (!broadcast) {
      return res.status(500).json({
        message: 'Failed to create ConvertKit broadcast',
      })
    }

    return res.status(200).json({
      message: 'Town hall processed successfully',
      videoId: latestVideo.id,
      broadcastId: broadcast.id,
      summary: summary.substring(0, 200) + '...',
    })
  } catch (error) {
    console.error('Error processing town hall:', error)
    return res.status(500).json({
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

