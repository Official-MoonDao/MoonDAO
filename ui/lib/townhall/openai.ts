import OpenAI from 'openai'
import { getTownHallSummaryPrompt } from './prompts'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function transcribeVideo(
  videoUrl: string,
  model: string = 'whisper-1'
): Promise<string> {
  try {
    if (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')) {
      throw new Error(
        'Direct YouTube URL transcription not supported. Use a service to extract audio first.'
      )
    }

    const response = await fetch(videoUrl)
    if (!response.ok) {
      throw new Error(`Failed to fetch audio: ${response.statusText}`)
    }

    const audioBuffer = await response.arrayBuffer()
    const audioFile = new File([audioBuffer], 'audio.mp3', { type: 'audio/mpeg' })

    const transcription = await openai.audio.transcriptions.create({
      file: audioFile as any,
      model: model,
      response_format: 'text',
    })

    return transcription as unknown as string
  } catch (error) {
    console.error('Error transcribing video:', error)
    throw error
  }
}

export async function transcribeYouTubeVideo(
  videoId: string,
  model: string = 'whisper-1'
): Promise<string> {
  try {
    const audioExtractionService = process.env.YOUTUBE_AUDIO_EXTRACTION_SERVICE_URL

    if (!audioExtractionService) {
      throw new Error(
        'YOUTUBE_AUDIO_EXTRACTION_SERVICE_URL must be configured. This service extracts audio from YouTube videos for transcription.'
      )
    }

    const response = await fetch(`${audioExtractionService}?videoId=${videoId}`)
    if (!response.ok) {
      throw new Error(`Failed to extract audio: ${response.statusText}`)
    }
    const audioUrl = await response.text()
    return await transcribeVideo(audioUrl, model)
  } catch (error) {
    console.error('Error transcribing YouTube video:', error)
    throw error
  }
}

export async function transcribeVideoFromFile(
  audioFile: File | Buffer,
  model: string = 'whisper-1'
): Promise<string> {
  try {
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile as any,
      model: model,
      response_format: 'text',
    })

    return transcription as unknown as string
  } catch (error) {
    console.error('Error transcribing video from file:', error)
    throw error
  }
}

export async function summarizeTranscript(
  transcript: string,
  model: string = 'gpt-4'
): Promise<string> {
  try {
    const prompt = getTownHallSummaryPrompt(transcript)

    const response = await openai.chat.completions.create({
      model: model,
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
      throw new Error('No summary generated from OpenAI')
    }

    return summary
  } catch (error) {
    console.error('Error summarizing transcript:', error)
    throw error
  }
}
