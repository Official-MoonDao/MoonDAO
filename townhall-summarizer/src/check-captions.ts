/**
 * Decide, in about ten seconds, whether the owner-captions path works.
 *
 *   yarn captions:check <videoId|url> [moreIds...]
 *
 * Each step is reported separately — credentials present, token exchange,
 * captions.list, captions.download — so a failure says which one broke rather
 * than "transcript unavailable". Exits non-zero if no video could be read,
 * which makes it usable as a go/no-go check before committing to this
 * approach.
 */

import 'dotenv/config'
import {
  OwnerCaptionsError,
  downloadCaptionTrack,
  getAccessToken,
  getOAuthConfig,
  listCaptionTracks,
  selectBestTrack,
  srtToPlainText,
} from './utils/youtube-oauth-captions'
import { extractVideoId } from './utils/youtube'

function report(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`  FAILED: ${message}`)
  if (error instanceof OwnerCaptionsError && error.hint) {
    console.error(`  HINT:   ${error.hint}`)
  }
}

async function main() {
  const inputs = process.argv.slice(2)
  if (inputs.length === 0) {
    console.error('Usage: yarn captions:check <videoId|url> [moreIds...]')
    process.exit(1)
  }

  console.log('1. OAuth credentials')
  const config = getOAuthConfig()
  if (!config) {
    console.error(
      '  FAILED: missing YOUTUBE_OAUTH_CLIENT_ID / YOUTUBE_OAUTH_CLIENT_SECRET / YOUTUBE_OAUTH_REFRESH_TOKEN'
    )
    console.error('  HINT:   run `yarn oauth:setup` to mint the refresh token.')
    process.exit(1)
  }
  console.log('  ok — client id, secret and refresh token are all present')

  console.log('\n2. Token exchange')
  let accessToken: string
  try {
    accessToken = await getAccessToken(config)
    console.log('  ok — refresh token is still valid')
  } catch (error) {
    report(error)
    process.exit(1)
  }

  let succeeded = 0
  for (const input of inputs) {
    const videoId = extractVideoId(input)
    console.log(`\n3. ${input}`)
    if (!videoId) {
      console.error('  FAILED: could not parse a video id out of that')
      continue
    }

    try {
      const tracks = await listCaptionTracks(videoId, accessToken)
      if (tracks.length === 0) {
        console.log('  no caption tracks yet (auto-captions appear a few hours after a stream)')
        continue
      }

      console.log(
        `  tracks: ${tracks
          .map((t) => `${t.trackKind || '?'}/${t.language || '?'}${t.isDraft ? ' (draft)' : ''}`)
          .join(', ')}`
      )

      const track = selectBestTrack(tracks)
      if (!track) {
        console.log('  every track is a draft; nothing downloadable')
        continue
      }

      const srt = await downloadCaptionTrack(track.id, accessToken)
      const transcript = srtToPlainText(srt)
      console.log(
        `  ok — downloaded ${track.trackKind}/${track.language}, ${srt.length} bytes of SRT -> ${transcript.length} chars of text`
      )
      console.log(`  preview: ${transcript.slice(0, 160)}...`)
      succeeded++
    } catch (error) {
      report(error)
    }
  }

  console.log(
    `\n${succeeded}/${inputs.length} video(s) produced a transcript through the owner API.`
  )
  if (succeeded === 0) {
    console.error('No video could be read. This path will not carry the pipeline.')
    process.exit(1)
  }
}

main().catch((error) => {
  report(error)
  process.exit(1)
})
