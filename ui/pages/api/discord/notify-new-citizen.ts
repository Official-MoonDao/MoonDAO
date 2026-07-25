import {
  CITIZEN_TABLE_NAMES,
  DEFAULT_CHAIN_V5,
  DEPLOYED_ORIGIN,
  DISCORD_CITIZEN_ROLE_ID,
  GENERAL_CHANNEL_ID,
  TEST_CHANNEL_ID,
} from 'const/config'
import { authMiddleware } from 'middleware/authMiddleware'
import withMiddleware from 'middleware/withMiddleware'
import { NextApiRequest, NextApiResponse } from 'next'
import queryTable from '@/lib/tableland/queryTable'
import { getChainSlug } from '@/lib/thirdweb/chain'

// Allow up to 75 seconds so Tableland has time to index the new citizen before
// the Discord message is sent. Discord scrapes the profile URL immediately on
// receiving the message, so if the citizen row isn't in Tableland yet the page
// returns 404 and Discord shows no preview image.
export const maxDuration = 75

const CHANNEL_ID =
  process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? GENERAL_CHANNEL_ID : TEST_CHANNEL_ID

const MAX_POLL_ATTEMPTS = 12
const POLL_INTERVAL_MS = 5000

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { tokenId, citizenName, prettyLink } = req.body

  if (!tokenId || !citizenName || !prettyLink) {
    return res.status(400).json({ error: 'tokenId, citizenName and prettyLink are required' })
  }

  const chain = DEFAULT_CHAIN_V5
  const chainSlug = getChainSlug(chain)
  const statement = `SELECT id FROM ${CITIZEN_TABLE_NAMES[chainSlug]} WHERE id = ${Number(tokenId)} LIMIT 1`

  // Poll Tableland until the citizen row is indexed so that when Discord
  // scrapes the profile URL the SSR page actually has data to render.
  let indexed = false
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    try {
      const rows = await queryTable(chain, statement)
      if (rows?.length > 0) {
        indexed = true
        break
      }
    } catch (err) {
      console.error(`[notify-new-citizen] Tableland poll attempt ${attempt + 1} failed:`, err)
    }

    if (attempt < MAX_POLL_ATTEMPTS - 1) {
      await new Promise<void>((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
    }
  }

  if (!indexed) {
    console.warn(
      `[notify-new-citizen] Citizen ${tokenId} still not in Tableland after ${MAX_POLL_ATTEMPTS} attempts — sending notification anyway`
    )
  }

  const message = `## [**${citizenName}**](${DEPLOYED_ORIGIN}/citizen/${prettyLink}) has just become a <@&${DISCORD_CITIZEN_ROLE_ID}> of the Space Acceleration Network!`

  const discordRes = await fetch(
    `https://discord.com/api/v10/channels/${CHANNEL_ID}/messages`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
      },
      body: JSON.stringify({ content: message }),
    }
  )

  if (!discordRes.ok) {
    const body = await discordRes.text()
    console.error('[notify-new-citizen] Discord API error:', body)
    return res.status(500).json({ error: 'Failed to send Discord message' })
  }

  return res.status(200).json({ success: true, indexed })
}

export default withMiddleware(handler, authMiddleware)
