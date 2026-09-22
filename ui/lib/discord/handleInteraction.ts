import type { NextApiRequest, NextApiResponse } from 'next'
import { DEPLOYED_ORIGIN } from 'const/config'
import { DEPRIZE_AVAILABILITY_LEGEND, UNIT } from '@/lib/deprize/constants'
import { getDePrizeCompetition, resolveLiveDePrizeId } from '@/lib/deprize/competitions'
import { readServerMarket } from '@/lib/deprize/serverMarket'
import { DePrizeState } from '@/lib/deprize/constants'
import { ODDS_ACK_BUDGET_MS } from '@/lib/deprize/oddsWire'
import { escapeDiscordUserText } from '@/lib/discord/escapeUserText'
import { discordGuildThrottleKey, getOddsWireRedis } from '@/lib/discord/oddsWireStore'
import { deprizeOutcomeLabels } from '@/lib/discord/outcomeLabels'
import { DEFAULT_DEPRIZE_CHAIN, parsePrizeArg } from '@/lib/discord/prizeArg'
import { verifyDiscordRequest } from '@/lib/discord/verifyInteraction'
import { forecastChainId } from '@/lib/forecasts/constants'

const GUILD_THROTTLE_PER_MIN = 30
const SKEW_SEC = 300

function readRawBody(req: NextApiRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function ephemeral(content: string) {
  return {
    type: 4,
    data: {
      content,
      flags: 64,
      allowed_mentions: { parse: [] },
    },
  }
}

function message(content: string, embeds?: unknown[]) {
  return {
    type: 4,
    data: {
      content,
      embeds,
      allowed_mentions: { parse: [] },
    },
  }
}

function optionValue(body: any, name: string): string | undefined {
  const opts = body?.data?.options
  if (!Array.isArray(opts)) return undefined
  const hit = opts.find((o: any) => o?.name === name)
  return typeof hit?.value === 'string' ? hit.value : undefined
}

function siteOrigin(): string {
  return String(DEPLOYED_ORIGIN || 'https://moondao.com').replace(/\/$/, '')
}

export const config = {
  api: {
    bodyParser: false as const,
  },
}

export type InteractionDeps = {
  readMarket?: typeof readServerMarket
  nowMs?: () => number
  redis?: ReturnType<typeof getOddsWireRedis>
}

export async function handleDiscordInteraction(
  req: NextApiRequest,
  res: NextApiResponse,
  deps: InteractionDeps = {}
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const publicKey = process.env.DISCORD_PUBLIC_KEY
  if (!publicKey) return res.status(503).json({ error: 'DISCORD_PUBLIC_KEY unset' })

  let raw: Buffer
  try {
    raw = await readRawBody(req)
  } catch {
    return res.status(401).end()
  }
  const rawBody = raw.toString('utf8')
  const signature = String(req.headers['x-signature-ed25519'] || '')
  const timestamp = String(req.headers['x-signature-timestamp'] || '')

  const verified = await verifyDiscordRequest({
    publicKeyHex: publicKey,
    signature,
    timestamp,
    rawBody,
  })
  if (!verified) return res.status(401).end()

  const ts = Number(timestamp)
  const nowSec = Math.floor((deps.nowMs ?? Date.now)() / 1000)
  if (!Number.isFinite(ts) || Math.abs(nowSec - ts) > SKEW_SEC) {
    return res.status(401).end()
  }

  let body: any
  try {
    body = JSON.parse(rawBody)
  } catch {
    return res.status(401).end()
  }

  if (body?.type === 1) {
    return res.status(200).json({ type: 1 })
  }

  const guildId =
    String(body?.guild_id || body?.member?.user?.id || body?.user?.id || 'unknown')
  const redis = deps.redis ?? getOddsWireRedis()
  if (redis) {
    const key = discordGuildThrottleKey(guildId)
    const n = Number(await redis.incr(key))
    if (n === 1) await redis.expire(key, 60)
    if (n > GUILD_THROTTLE_PER_MIN) {
      return res.status(200).json(
        ephemeral("MoonDAO's bot is busy in this server — try again in a minute.")
      )
    }
  }

  const command = String(body?.data?.name || '')
  const prizeRaw = optionValue(body, 'prize')
  const parsed = parsePrizeArg(command === 'bet' ? prizeRaw ?? '22' : prizeRaw)
  if (!parsed.ok) {
    return res.status(200).json(ephemeral('Try /odds 22 or /odds touchdown'))
  }
  const deprizeId = parsed.id
  const chainSlug = DEFAULT_DEPRIZE_CHAIN
  const site = siteOrigin()

  if (command === 'bet') {
    return res.status(200).json(
      message(`${site}/deprize/${deprizeId}\n${DEPRIZE_AVAILABILITY_LEGEND}`)
    )
  }

  if (command !== 'odds' && command !== 'pool') {
    return res.status(200).json(ephemeral('Unknown command.'))
  }

  const labels = deprizeOutcomeLabels(chainSlug, deprizeId)
  const chainId = forecastChainId(chainSlug) ?? 11155111
  const readMarket = deps.readMarket ?? readServerMarket
  const work = readMarket({
    chainSlug,
    chainId,
    deprizeId,
    numOutcomes: Math.max(labels.length, 2),
    registryState: DePrizeState.OPEN,
  }).catch(() => null)

  const raced = await Promise.race([
    work,
    new Promise<'timeout'>((resolve) =>
      setTimeout(() => resolve('timeout'), ODDS_ACK_BUDGET_MS)
    ),
  ])
  work.catch(() => {})

  if (raced === 'timeout') {
    return res.status(200).json(
      ephemeral(`Odds are taking longer than usual to read — they're live at ${site}/deprize/${deprizeId}`)
    )
  }
  if (!raced) {
    return res.status(200).json(
      ephemeral(`Couldn't read the market — try ${site}/deprize/${deprizeId}`)
    )
  }

  const competition = getDePrizeCompetition(chainSlug, deprizeId)
  const title = escapeDiscordUserText(competition.title || `DePrize #${deprizeId}`)

  if (command === 'pool') {
    const eth = Number(raced.poolWei) / Number(UNIT)
    return res.status(200).json(
      message('', [
        {
          title: `${title} prize pool`,
          description: `${eth.toFixed(4)} ETH`,
          url: `${site}/deprize/${deprizeId}`,
        },
      ])
    )
  }

  if (raced.shouldSurfaceResolution) {
    const den = Number(raced.payoutDenominator || 1n)
    const lines = labels.map((label, i) => {
      const share = den > 0 ? Number(raced.payoutNumerators[i] ?? 0n) / den : 0
      return `${escapeDiscordUserText(label)}  ${(share * 100).toFixed(1)}%`
    })
    return res.status(200).json(
      message('', [
        {
          title: `${title} — resolved`,
          description: `${lines.join('\n')}\n${site}/deprize/${deprizeId}`,
        },
      ])
    )
  }

  const liveTip = resolveLiveDePrizeId(chainSlug, deprizeId)
  if (liveTip != null && liveTip !== deprizeId) {
    return res.status(200).json(
      ephemeral(`Forecasts and live odds are on the live generation: ${site}/deprize/${liveTip}`)
    )
  }

  const prices = raced.probabilitiesNormalized
  const lines = labels.map((label, i) => {
    const p = prices[i] ?? 0
    const implied = p > 0 ? (100 / p).toFixed(2) : '—'
    return `${escapeDiscordUserText(label)}  ${p.toFixed(1)}%  (1 in ${implied})`
  })
  return res.status(200).json(
    message('', [
      {
        title,
        description: `${lines.join('\n')}\n${site}/deprize/${deprizeId}`,
      },
    ])
  )
}
