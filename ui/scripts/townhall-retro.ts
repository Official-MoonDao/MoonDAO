import { exec } from 'child_process'
import dotenv from 'dotenv'
import { config } from 'dotenv'
import * as fs from 'fs'
import OpenAI from 'openai'
import * as path from 'path'
import { promisify } from 'util'
import { createTownHallBroadcast, findBroadcastByVideoId } from '../lib/townhall/convertkit'
import { summarizeTranscript } from '../lib/townhall/openai'
import { formatSummaryForConvertKit } from '../lib/townhall/prompts'
import { extractVideoId, getVideoMetadata } from '../lib/townhall/youtube'

config({ path: '.env.local' })

const execAsync = promisify(exec)

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

async function processTownHall(videoUrl: string) {
  const youtubeApiKey = process.env.YOUTUBE_API_KEY
  const openaiModel = process.env.OPENAI_MODEL || 'gpt-4'
  const tagId = process.env.TOWNHALL_CONVERTKIT_TAG_ID

  if (!youtubeApiKey) {
    throw new Error('YOUTUBE_API_KEY environment variable is required')
  }

  console.log(`\nProcessing: ${videoUrl}`)

  const videoId = extractVideoId(videoUrl)
  if (!videoId) {
    throw new Error('Invalid YouTube URL. Could not extract video ID.')
  }

  console.log(`Video ID: ${videoId}`)

  const existing = await findBroadcastByVideoId(videoId, tagId)
  if (existing) {
    console.log(`⚠️  Video already processed. Broadcast ID: ${existing.id}`)
    return {
      videoId,
      success: false,
      error: 'Video already processed',
      broadcastId: existing.id,
    }
  }

  console.log('Fetching video metadata...')
  const videoMetadata = await getVideoMetadata(videoId, youtubeApiKey)
  if (!videoMetadata) {
    throw new Error('Could not fetch video metadata')
  }

  console.log(`Title: ${videoMetadata.title}`)
  console.log(`Published: ${videoMetadata.publishedAt}`)

  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is required')
  }

  const audioExtractionService = process.env.YOUTUBE_AUDIO_EXTRACTION_SERVICE_URL
  if (!audioExtractionService) {
    throw new Error('YOUTUBE_AUDIO_EXTRACTION_SERVICE_URL environment variable is required')
  }

  console.log('Extracting audio URL from YouTube...')
  let audioUrl: string
  try {
    const response = await fetch(`${audioExtractionService}?videoId=${videoId}`)
    if (!response.ok) {
      throw new Error(`Failed to extract audio: ${response.statusText}`)
    }
    audioUrl = await response.text()
    console.log('✓ Audio URL extracted')
  } catch (error) {
    throw new Error(
      `Failed to extract audio URL: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }

  console.log('Transcribing video with OpenAI Whisper...')
  let transcript: string
  try {
    const audioResponse = await fetch(audioUrl)
    if (!audioResponse.ok) {
      throw new Error(`Failed to fetch audio: ${audioResponse.statusText}`)
    }

    const audioBuffer = await audioResponse.arrayBuffer()
    const audioFile = new File([audioBuffer], 'audio.mp3', { type: 'audio/mpeg' })

    const transcription = await openai.audio.transcriptions.create({
      file: audioFile as any,
      model: process.env.WHISPER_MODEL || 'whisper-1',
      response_format: 'text',
    })
    transcript = transcription as unknown as string
    console.log(`✓ Transcription complete (${transcript.length} characters)`)
  } catch (error) {
    throw new Error(
      `Failed to transcribe: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
  if (!transcript || transcript.trim().length === 0) {
    throw new Error('Empty transcript received')
  }

  console.log(`Transcript length: ${transcript.length} characters`)

  console.log('Generating summary...')
  const summary = await summarizeTranscript(transcript, openaiModel)
  if (!summary) {
    throw new Error('Failed to generate summary')
  }

  console.log('Formatting summary...')
  const formattedSummary = formatSummaryForConvertKit(
    summary,
    videoMetadata.title,
    videoMetadata.publishedAt,
    videoId
  )

  const broadcastSubject = `Town Hall Summary - ${new Date(
    videoMetadata.publishedAt
  ).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })}`

  console.log('Creating ConvertKit broadcast as draft (public but not sending email)...')
  const broadcast = await createTownHallBroadcast(broadcastSubject, formattedSummary, tagId, false)

  if (!broadcast) {
    throw new Error('Failed to create ConvertKit broadcast')
  }

  console.log(`✓ Broadcast created: ${broadcast.id}`)

  return {
    videoId,
    success: true,
    broadcastId: broadcast.id,
    title: videoMetadata.title,
  }
}

async function main() {
  const videoUrls = process.argv.slice(2)

  if (videoUrls.length === 0) {
    console.log('Usage: yarn townhall:retro <youtube-url-1> [youtube-url-2] ...')
    console.log('Example: yarn townhall:retro "https://youtube.com/watch?v=abc123"')
    process.exit(1)
  }

  console.log(`\n🚀 Processing ${videoUrls.length} town hall video(s)...\n`)

  const results = []

  for (const videoUrl of videoUrls) {
    try {
      const result = await processTownHall(videoUrl)
      results.push(result)
    } catch (error) {
      console.error(
        `\n✗ Error processing ${videoUrl}:`,
        error instanceof Error ? error.message : error
      )
      results.push({
        videoUrl,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  console.log('\n' + '='.repeat(50))
  console.log('Processing Complete')
  console.log('='.repeat(50))
  console.log(`Total: ${results.length}`)
  console.log(`Successful: ${results.filter((r) => r.success).length}`)
  console.log(`Failed: ${results.filter((r) => !r.success).length}`)

  if (results.some((r) => r.success)) {
    console.log('\n✓ Successfully processed videos are now available on /townhall')
  }

  process.exit(results.every((r) => r.success || r.error === 'Video already processed') ? 0 : 1)
}

main().catch((error) => {
  console.error('\nFatal error:', error)
  process.exit(1)
})
