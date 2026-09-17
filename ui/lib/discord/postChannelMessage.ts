import { sanitizeDiscordEmbeds, type DiscordEmbed } from '@/lib/og/preview'

export type DiscordPostResult =
  | { ok: true; messageId: string }
  | { ok: false; status: number; code?: number; retryable: boolean; reason: string }

const CHANNEL_ID_RE = /^\d{17,20}$/

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function postDiscordChannelMessage(opts: {
  channelId: string
  content?: string
  embeds?: DiscordEmbed[]
  botToken?: string
  timeoutMs?: number
  sleep?: (ms: number) => Promise<void>
  fetchImpl?: typeof fetch
}): Promise<DiscordPostResult> {
  if (typeof window !== 'undefined') {
    throw new Error('postDiscordChannelMessage is server-only')
  }
  if (!CHANNEL_ID_RE.test(opts.channelId)) {
    return { ok: false, status: 0, retryable: false, reason: 'invalid-channel-id' }
  }
  const embeds = sanitizeDiscordEmbeds(opts.embeds)
  const content = opts.content?.trim() ?? ''
  if (!content && !embeds?.length) {
    return { ok: false, status: 0, retryable: false, reason: 'empty-message' }
  }
  const token = opts.botToken ?? process.env.DISCORD_BOT_TOKEN
  if (!token) {
    return { ok: false, status: 0, retryable: false, reason: 'missing-bot-token' }
  }

  const body = JSON.stringify({
    content: content || undefined,
    embeds,
    allowed_mentions: { parse: [] },
  })

  const doFetch = opts.fetchImpl ?? fetch
  const wait = opts.sleep ?? sleep

  const attempt = async (): Promise<DiscordPostResult> => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 10_000)
    try {
      const response = await doFetch(
        `https://discord.com/api/v10/channels/${opts.channelId}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bot ${token}`,
          },
          body,
          signal: controller.signal,
        }
      )
      const json = await response.json().catch(() => ({}))
      if (response.ok) {
        return { ok: true, messageId: String(json.id ?? '') }
      }
      const retryAfter = Number(response.headers.get('retry-after') ?? json.retry_after ?? 0)
      const code = typeof json.code === 'number' ? json.code : undefined
      const retryable = response.status === 429 || response.status >= 500
      console.error('[discord] channel post failed', {
        channelIdTail: opts.channelId.slice(-4),
        status: response.status,
        code,
      })
      return {
        ok: false,
        status: response.status,
        code,
        retryable,
        reason: retryable ? 'discord-retryable' : 'discord-rejected',
        ...(Number.isFinite(retryAfter) ? { retryAfter } : {}),
      } as DiscordPostResult & { retryAfter?: number }
    } catch (err: any) {
      const aborted = err?.name === 'AbortError'
      console.error('[discord] channel post failed', {
        channelIdTail: opts.channelId.slice(-4),
        status: 0,
        code: aborted ? 'timeout' : 'network',
      })
      return {
        ok: false,
        status: 0,
        retryable: true,
        reason: aborted ? 'timeout' : 'network',
      }
    } finally {
      clearTimeout(timer)
    }
  }

  const first = (await attempt()) as DiscordPostResult & { retryAfter?: number }
  if (first.ok) return first
  if (first.status === 429) {
    const retryAfter = first.retryAfter ?? 30
    if (retryAfter <= 5) {
      await wait(retryAfter * 1000)
      return attempt()
    }
    return { ok: false, status: 429, retryable: true, reason: 'discord-retryable' }
  }
  return first
}
