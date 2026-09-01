import {
  DEFAULT_CHAIN_V5,
  DEPLOYED_ORIGIN,
  DISCORD_CITIZEN_ROLE_ID,
  GENERAL_CHANNEL_ID,
  TEAM_TABLE_NAMES,
  TEST_CHANNEL_ID,
} from 'const/config'
import { authMiddleware } from 'middleware/authMiddleware'
import withMiddleware from 'middleware/withMiddleware'
import { NextApiRequest, NextApiResponse } from 'next'
import {
  buildNewTeamBody,
  buildNewTeamContent,
  buildNewTeamPayload,
  MAX_ATTACHMENT_BYTES,
  teamImageFilename,
  teamProfileUrl,
  TeamAttachment,
} from '@/lib/discord/newTeamNotification'
import { fetchImageFromIPFSWithFallback } from '@/lib/ipfs/gateway'
import queryTable from '@/lib/tableland/queryTable'
import { getChainSlug } from '@/lib/thirdweb/chain'

// Pages Router API routes read the timeout from `config.maxDuration`. The bare
// `export const maxDuration` form is App Router only and is silently ignored.
export const config = {
  maxDuration: 60,
}

const CHANNEL_ID =
  process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? GENERAL_CHANNEL_ID : TEST_CHANNEL_ID

const MAX_POLL_ATTEMPTS = 12
const POLL_INTERVAL_MS = 3000

// All logo downloads share this budget so the Discord call always happens
// inside `config.maxDuration`. Without it a dead image CID costs one full
// gateway cascade per attempted URI, the function is killed mid-retry, and
// nothing at all is announced — worse than announcing without an image.
const IMAGE_BUDGET_MS = 45000

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

// Waits for Tableland to index the new row so the profile link in the message
// resolves instead of 404ing. The logo no longer depends on this — it is
// uploaded with the message — so a slow index only costs us the bio.
async function pollForTeamRow(chain: any, tokenId: string) {
  const chainSlug = getChainSlug(chain)
  const statement = `SELECT id, name, description, image FROM ${
    TEAM_TABLE_NAMES[chainSlug]
  } WHERE id = ${Number(tokenId)} LIMIT 1`

  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    try {
      const rows = await queryTable(chain, statement)
      if (rows?.length > 0) {
        return rows[0]
      }
    } catch (err) {
      console.error(`[notify-new-team] Tableland poll attempt ${attempt + 1} failed:`, err)
    }

    if (attempt < MAX_POLL_ATTEMPTS - 1) {
      await sleep(POLL_INTERVAL_MS)
    }
  }

  return null
}

async function resolveTeamImage(
  imageURI: string | undefined,
  deadline: number
): Promise<TeamAttachment | null> {
  if (!imageURI) return null

  try {
    const { bytes, contentType, gateway } = await fetchImageFromIPFSWithFallback(imageURI, {
      deadline,
    })

    if (bytes.byteLength > MAX_ATTACHMENT_BYTES) {
      console.warn(
        `[notify-new-team] Logo ${imageURI} is ${bytes.byteLength} bytes, above the ${MAX_ATTACHMENT_BYTES} upload limit`
      )
      return null
    }

    console.log(
      `[notify-new-team] Fetched logo ${imageURI} from ${gateway} (${bytes.byteLength} bytes)`
    )
    return { bytes, contentType }
  } catch (err) {
    console.error(`[notify-new-team] Could not fetch logo ${imageURI}:`, err)
    return null
  }
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { tokenId, teamName, prettyLink, image, description } = req.body

  if (!tokenId || !teamName || !prettyLink) {
    return res.status(400).json({ error: 'tokenId, teamName and prettyLink are required' })
  }

  const chain = DEFAULT_CHAIN_V5

  const imageDeadline = Date.now() + IMAGE_BUDGET_MS

  // The client already knows the `ipfs://` URI it wrote on-chain, so start
  // downloading the logo immediately rather than waiting on Tableland.
  const rowPromise = pollForTeamRow(chain, tokenId)
  const clientImagePromise = resolveTeamImage(image, imageDeadline)

  const row = await rowPromise
  let attachment = await clientImagePromise

  // Retrying is only worth it for a URI we have not already exhausted; the row
  // normally carries the very same `ipfs://` URI the client sent.
  if (!attachment && row?.image && row.image !== image) {
    attachment = await resolveTeamImage(row.image, imageDeadline)
  }

  const profileUrl = teamProfileUrl(DEPLOYED_ORIGIN, prettyLink)
  const imageFilename = attachment
    ? teamImageFilename(Number(tokenId), attachment.contentType)
    : undefined

  const payload = buildNewTeamPayload({
    content: buildNewTeamContent({
      teamName,
      profileUrl,
      citizenRoleId: DISCORD_CITIZEN_ROLE_ID,
    }),
    profileUrl,
    description: description || row?.description,
    imageFilename,
  })

  if (!attachment) {
    console.warn(`[notify-new-team] Sending team ${tokenId} announcement without a logo`)
  }

  const { headers, body } = buildNewTeamBody(payload, imageFilename, attachment ?? undefined)

  const discordRes = await fetch(`https://discord.com/api/v10/channels/${CHANNEL_ID}/messages`, {
    method: 'POST',
    headers: {
      ...headers,
      Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
    },
    body: body as any,
  })

  if (!discordRes.ok) {
    const errorBody = await discordRes.text()
    console.error('[notify-new-team] Discord API error:', errorBody)
    return res.status(500).json({ error: 'Failed to send Discord message' })
  }

  return res.status(200).json({
    success: true,
    indexed: !!row,
    imageAttached: !!attachment,
  })
}

export default withMiddleware(handler, authMiddleware)
