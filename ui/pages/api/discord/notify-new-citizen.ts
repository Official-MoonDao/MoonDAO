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
import {
  buildNewCitizenBody,
  buildNewCitizenContent,
  buildNewCitizenPayload,
  citizenImageFilename,
  citizenProfileUrl,
  CitizenAttachment,
  MAX_ATTACHMENT_BYTES,
} from '@/lib/discord/newCitizenNotification'
import { fetchImageFromIPFSWithFallback } from '@/lib/ipfs/gateway'
import queryTable from '@/lib/tableland/queryTable'
import { getChainSlug } from '@/lib/thirdweb/chain'

// Pages Router API routes read the timeout from `config.maxDuration`. The bare
// `export const maxDuration` form is App Router only and was silently ignored
// here, leaving this route on the ~10s platform default — so the Tableland poll
// below was killed long before it could finish.
export const config = {
  maxDuration: 60,
}

const CHANNEL_ID =
  process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? GENERAL_CHANNEL_ID : TEST_CHANNEL_ID

const MAX_POLL_ATTEMPTS = 12
const POLL_INTERVAL_MS = 3000

// All portrait downloads share this budget so the Discord call always happens
// inside `config.maxDuration`. Without it a dead portrait CID costs one full
// gateway cascade per attempted URI, the function is killed mid-retry, and
// nothing at all is announced — worse than announcing without an image.
const PORTRAIT_BUDGET_MS = 45000

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

// Waits for Tableland to index the new row so the profile link in the message
// resolves instead of 404ing. The portrait no longer depends on this — it is
// uploaded with the message — so a slow index only costs us the bio.
async function pollForCitizenRow(chain: any, tokenId: string) {
  const chainSlug = getChainSlug(chain)
  const statement = `SELECT id, name, description, image FROM ${
    CITIZEN_TABLE_NAMES[chainSlug]
  } WHERE id = ${Number(tokenId)} LIMIT 1`

  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    try {
      const rows = await queryTable(chain, statement)
      if (rows?.length > 0) {
        return rows[0]
      }
    } catch (err) {
      console.error(`[notify-new-citizen] Tableland poll attempt ${attempt + 1} failed:`, err)
    }

    if (attempt < MAX_POLL_ATTEMPTS - 1) {
      await sleep(POLL_INTERVAL_MS)
    }
  }

  return null
}

async function resolveCitizenImage(
  imageURI: string | undefined,
  deadline: number
): Promise<CitizenAttachment | null> {
  if (!imageURI) return null

  try {
    const { bytes, contentType, gateway } = await fetchImageFromIPFSWithFallback(imageURI, {
      deadline,
    })

    if (bytes.byteLength > MAX_ATTACHMENT_BYTES) {
      console.warn(
        `[notify-new-citizen] Portrait ${imageURI} is ${bytes.byteLength} bytes, above the ${MAX_ATTACHMENT_BYTES} upload limit`
      )
      return null
    }

    console.log(
      `[notify-new-citizen] Fetched portrait ${imageURI} from ${gateway} (${bytes.byteLength} bytes)`
    )
    return { bytes, contentType }
  } catch (err) {
    console.error(`[notify-new-citizen] Could not fetch portrait ${imageURI}:`, err)
    return null
  }
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { tokenId, citizenName, prettyLink, image, description } = req.body

  if (!tokenId || !citizenName || !prettyLink) {
    return res.status(400).json({ error: 'tokenId, citizenName and prettyLink are required' })
  }

  const chain = DEFAULT_CHAIN_V5

  const portraitDeadline = Date.now() + PORTRAIT_BUDGET_MS

  // The client already knows the `ipfs://` URI it wrote on-chain, so start
  // downloading the portrait immediately rather than waiting on Tableland.
  const rowPromise = pollForCitizenRow(chain, tokenId)
  const clientImagePromise = resolveCitizenImage(image, portraitDeadline)

  const row = await rowPromise
  let attachment = await clientImagePromise

  // Retrying is only worth it for a URI we have not already exhausted; the row
  // normally carries the very same `ipfs://` URI the client sent.
  if (!attachment && row?.image && row.image !== image) {
    attachment = await resolveCitizenImage(row.image, portraitDeadline)
  }

  const profileUrl = citizenProfileUrl(DEPLOYED_ORIGIN, prettyLink)
  const imageFilename = attachment
    ? citizenImageFilename(Number(tokenId), attachment.contentType)
    : undefined

  const payload = buildNewCitizenPayload({
    content: buildNewCitizenContent({
      citizenName,
      profileUrl,
      citizenRoleId: DISCORD_CITIZEN_ROLE_ID,
    }),
    profileUrl,
    description: description || row?.description,
    imageFilename,
  })

  if (!attachment) {
    console.warn(`[notify-new-citizen] Sending citizen ${tokenId} announcement without a portrait`)
  }

  const { headers, body } = buildNewCitizenBody(payload, imageFilename, attachment ?? undefined)

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
    console.error('[notify-new-citizen] Discord API error:', errorBody)
    return res.status(500).json({ error: 'Failed to send Discord message' })
  }

  return res.status(200).json({
    success: true,
    indexed: !!row,
    imageAttached: !!attachment,
  })
}

export default withMiddleware(handler, authMiddleware)
