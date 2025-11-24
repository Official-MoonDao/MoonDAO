import { config } from 'dotenv'
import * as fs from 'fs'
import OpenAI from 'openai'
import * as path from 'path'
import { getTownHallSummaryPrompt } from '../lib/townhall/prompts'
import { extractVideoId, getVideoMetadata } from '../lib/townhall/youtube'

config({ path: '.env.local' })

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

async function transcribeYouTubeVideo(videoId: string): Promise<string> {
  const audioExtractionService = process.env.YOUTUBE_AUDIO_EXTRACTION_SERVICE_URL
  if (!audioExtractionService) {
    throw new Error('YOUTUBE_AUDIO_EXTRACTION_SERVICE_URL environment variable is required')
  }

  console.log('📥 Extracting audio URL from YouTube...')
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

  console.log('🎤 Transcribing audio with OpenAI Whisper...')
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
    const transcript = transcription as unknown as string
    console.log(`✓ Transcription complete (${transcript.length} characters)`)
    return transcript
  } catch (error) {
    throw new Error(
      `Failed to transcribe: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

async function summarizeTranscript(transcript: string): Promise<string> {
  console.log('📝 Generating summary with GPT-4...')

  try {
    const prompt = getTownHallSummaryPrompt(transcript)

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4',
      messages: [
        {
          role: 'system',
          content:
            'You are a helpful assistant that summarizes Town Hall meetings for the MoonDAO community. Provide clear, structured summaries with actionable information.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    })

    const summary = response.choices[0]?.message?.content
    if (!summary) {
      throw new Error('No summary generated')
    }

    console.log('✓ Summary generated')
    return summary
  } catch (error) {
    throw new Error(
      `Failed to summarize: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

async function main() {
  const videoUrl = process.argv[2]

  if (!videoUrl) {
    console.log('Usage: yarn townhall:test-local <youtube-url>')
    console.log('Example: yarn townhall:test-local "https://youtube.com/watch?v=abc123"')
    process.exit(1)
  }

  if (!process.env.OPENAI_API_KEY) {
    console.error('Error: OPENAI_API_KEY environment variable is required')
    process.exit(1)
  }

  if (!process.env.YOUTUBE_AUDIO_EXTRACTION_SERVICE_URL) {
    console.error('Error: YOUTUBE_AUDIO_EXTRACTION_SERVICE_URL environment variable is required')
    process.exit(1)
  }

  const youtubeApiKey = process.env.YOUTUBE_API_KEY

  try {
    console.log(`\n🚀 Testing Town Hall Summarization`)
    console.log(`Video: ${videoUrl}\n`)

    const videoId = extractVideoId(videoUrl)
    if (!videoId) {
      throw new Error('Invalid YouTube URL. Could not extract video ID.')
    }

    console.log(`Video ID: ${videoId}`)

    if (youtubeApiKey) {
      console.log('Fetching video metadata...')
      const videoMetadata = await getVideoMetadata(videoId, youtubeApiKey)
      if (videoMetadata) {
        console.log(`Title: ${videoMetadata.title}`)
        console.log(`Published: ${videoMetadata.publishedAt}\n`)
      }
    }

    const transcript = await transcribeYouTubeVideo(videoId)
    const summary = await summarizeTranscript(transcript)

    console.log('\n' + '='.repeat(80))
    console.log('SUMMARY')
    console.log('='.repeat(80))
    console.log(summary)
    console.log('='.repeat(80))

    const outputPath = path.join(process.cwd(), 'townhall-test-output.txt')
    fs.writeFileSync(
      outputPath,
      `Video URL: ${videoUrl}\n\n` + `TRANSCRIPT:\n${transcript}\n\n` + `SUMMARY:\n${summary}\n`
    )
    console.log(`\n✓ Full output saved to: ${outputPath}`)
    console.log('\nNote: This is a test run. Summary was NOT posted to ConvertKit.')
  } catch (error) {
    console.error('\n✗ Error:', error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

main()
