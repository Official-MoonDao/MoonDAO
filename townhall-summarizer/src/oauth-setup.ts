/**
 * One-off: mint a YouTube OAuth refresh token for the channel owner.
 *
 *   yarn oauth:setup
 *
 * Run it on a laptop, signed into the Google account that owns
 * @officialmoondao. It opens a consent page, catches the redirect on
 * localhost, and prints the refresh token to paste into Cloud Run.
 *
 * The token it prints only stops working if it is revoked — *unless* the OAuth
 * consent screen is still in "Testing" status, in which case Google expires it
 * after 7 days no matter what. Set the consent screen to "In production"
 * before relying on this. See README.
 */

import 'dotenv/config'
import { createServer } from 'http'
import { AddressInfo } from 'net'

// captions.download needs full read/write scope; the read-only scope is not
// sufficient, which is a common and confusing dead end.
const SCOPE = 'https://www.googleapis.com/auth/youtube.force-ssl'

async function main() {
  const clientId = process.env.YOUTUBE_OAUTH_CLIENT_ID
  const clientSecret = process.env.YOUTUBE_OAUTH_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    console.error(
      'Missing YOUTUBE_OAUTH_CLIENT_ID / YOUTUBE_OAUTH_CLIENT_SECRET.\n\n' +
        'Create them in Google Cloud Console → APIs & Services → Credentials →\n' +
        'Create credentials → OAuth client ID → Application type: Web application.\n' +
        'Add http://localhost:8765 as an authorised redirect URI, then put the\n' +
        'client ID and secret in townhall-summarizer/.env.'
    )
    process.exit(1)
  }

  const port = Number(process.env.OAUTH_SETUP_PORT || 8765)
  const redirectUri = `http://localhost:${port}`

  const code = await new Promise<string>((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? '/', redirectUri)
      const received = url.searchParams.get('code')
      const error = url.searchParams.get('error')

      if (error) {
        res.writeHead(400, { 'Content-Type': 'text/plain' })
        res.end(`Authorization failed: ${error}`)
        server.close()
        reject(new Error(`Authorization failed: ${error}`))
        return
      }

      if (!received) {
        res.writeHead(404, { 'Content-Type': 'text/plain' })
        res.end('Waiting for the OAuth redirect...')
        return
      }

      res.writeHead(200, { 'Content-Type': 'text/plain' })
      res.end('Authorized. You can close this tab and return to the terminal.')
      server.close()
      resolve(received)
    })

    server.listen(port, () => {
      const actual = (server.address() as AddressInfo).port
      const authUrl =
        'https://accounts.google.com/o/oauth2/v2/auth?' +
        new URLSearchParams({
          client_id: clientId,
          redirect_uri: `http://localhost:${actual}`,
          response_type: 'code',
          scope: SCOPE,
          // offline + consent is what makes Google return a refresh_token at
          // all; without `prompt=consent` a re-authorisation returns only an
          // access token and the script appears to silently do nothing.
          access_type: 'offline',
          prompt: 'consent',
        }).toString()

      console.log('\nOpen this URL in a browser signed in as the channel owner:\n')
      console.log(authUrl)
      console.log('\nWaiting for the redirect...\n')
    })

    server.on('error', reject)
  })

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }),
  })

  const body = (await tokenResponse.json()) as {
    refresh_token?: string
    error?: string
    error_description?: string
  }

  if (!tokenResponse.ok || !body.refresh_token) {
    console.error(
      `Token exchange failed: ${body.error ?? tokenResponse.status} ${
        body.error_description ?? ''
      }`
    )
    if (!body.refresh_token && tokenResponse.ok) {
      console.error(
        'Google returned no refresh_token. That happens when this client has ' +
          'already been authorised for the account; re-run and make sure the ' +
          'consent screen actually appears.'
      )
    }
    process.exit(1)
  }

  console.log('\nRefresh token:\n')
  console.log(body.refresh_token)
  console.log(
    '\nSet it as YOUTUBE_OAUTH_REFRESH_TOKEN in the Cloud Run service (and in\n' +
      'townhall-summarizer/.env for local runs), then verify with:\n\n' +
      '  yarn captions:check <videoId>\n'
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
