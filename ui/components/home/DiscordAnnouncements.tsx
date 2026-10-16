import { DISCORD_GUILD_ID } from 'const/config'
import Image from 'next/image'
import { useMemo } from 'react'
import { useAnnouncements } from '@/lib/dashboard/hooks/useAnnouncements'
import { renderDiscordMessageContent } from '@/lib/discord/formatDiscordMessage'
import ExpandableText from '@/components/layout/ExpandableText'

const DISCORD_CDN_HOSTS = new Set(['cdn.discordapp.com', 'media.discordapp.net'])

function relativeTime(iso: string): string {
  const ms = new Date(iso).getTime()
  if (Number.isNaN(ms)) return ''
  const diff = Date.now() - ms
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function getAvatarUrl(author: any): string | null {
  if (!author) return null
  if (author.avatar) {
    const ext = String(author.avatar).startsWith('a_') ? 'gif' : 'png'
    return `https://cdn.discordapp.com/avatars/${author.id}/${author.avatar}.${ext}?size=64`
  }
  try {
    const defaultIndex = Number(BigInt(author.id ?? '0') >> 22n) % 6
    return `https://cdn.discordapp.com/embed/avatars/${defaultIndex}.png`
  } catch {
    return null
  }
}

function safeHttpUrl(url: unknown): string | null {
  if (typeof url !== 'string' || !url) return null
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null
    return parsed.toString()
  } catch {
    return null
  }
}

function isDiscordCdn(url: string): boolean {
  try {
    return DISCORD_CDN_HOSTS.has(new URL(url).hostname)
  } catch {
    return false
  }
}

function messageLink(message: { channel_id?: string; id?: string }): string {
  if (!message?.channel_id || !message?.id) return 'https://moondao.com/discord'
  return `https://discord.com/channels/${DISCORD_GUILD_ID}/${message.channel_id}/${message.id}`
}

function hasVisibleBody(message: any): boolean {
  if (typeof message?.content === 'string' && message.content.trim()) return true
  if (Array.isArray(message?.attachments) && message.attachments.length > 0) return true
  if (
    Array.isArray(message?.embeds) &&
    message.embeds.some(
      (embed: any) =>
        embed?.title || embed?.description || embed?.image?.url || embed?.thumbnail?.url
    )
  ) {
    return true
  }
  return false
}

function isImageAttachment(attachment: any): boolean {
  const url = safeHttpUrl(attachment?.url) || safeHttpUrl(attachment?.proxy_url)
  if (!url || !isDiscordCdn(url)) return false
  if (
    typeof attachment?.content_type === 'string' &&
    attachment.content_type.startsWith('image/')
  ) {
    return true
  }
  return /\.(png|jpe?g|gif|webp)(\?|$)/i.test(attachment?.filename || url)
}

function ReactionRow({ reactions }: { reactions?: any[] }) {
  if (!reactions?.length) return null
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {reactions.slice(0, 8).map((reaction, index) => {
        const emoji = reaction?.emoji
        const customUrl = emoji?.id
          ? `https://cdn.discordapp.com/emojis/${emoji.id}.${
              emoji.animated ? 'gif' : 'png'
            }?size=32`
          : null
        return (
          <span
            key={`${emoji?.id || emoji?.name || 'emoji'}-${index}`}
            className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-xs text-white/70"
          >
            {customUrl ? (
              <Image
                src={customUrl}
                alt={emoji?.name || ''}
                width={14}
                height={14}
                className="h-3.5 w-3.5"
                unoptimized
              />
            ) : (
              <span>{emoji?.name}</span>
            )}
            <span>{reaction?.count}</span>
          </span>
        )
      })}
    </div>
  )
}

function AttachmentList({ attachments }: { attachments?: any[] }) {
  if (!attachments?.length) return null
  return (
    <div className="mt-2 flex flex-col gap-2">
      {attachments.map((attachment, index) => {
        const url = safeHttpUrl(attachment?.url) || safeHttpUrl(attachment?.proxy_url)
        if (!url) return null
        if (isImageAttachment(attachment)) {
          return (
            <Image
              key={attachment.id || index}
              src={url}
              alt={attachment.filename || 'Announcement image'}
              width={attachment.width || 480}
              height={attachment.height || 270}
              className="h-auto max-h-64 w-auto max-w-full rounded-lg"
              unoptimized
            />
          )
        }
        return (
          <a
            key={attachment.id || index}
            href={url}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-indigo-300 underline hover:text-indigo-200"
          >
            {attachment.filename || 'Attachment'}
          </a>
        )
      })}
    </div>
  )
}

function EmbedList({ embeds, mentions }: { embeds?: any[]; mentions?: any[] }) {
  if (!embeds?.length) return null
  return (
    <div className="mt-2 flex flex-col gap-2">
      {embeds.map((embed, index) => {
        const title = typeof embed?.title === 'string' ? embed.title : ''
        const description = typeof embed?.description === 'string' ? embed.description : ''
        const href = safeHttpUrl(embed?.url)
        const imageUrl = safeHttpUrl(embed?.image?.url) || safeHttpUrl(embed?.thumbnail?.url)
        if (!title && !description && !imageUrl) return null
        return (
          <div key={index} className="border-l-2 border-indigo-400/40 pl-3">
            {title &&
              (href ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-semibold text-white hover:underline"
                >
                  {title}
                </a>
              ) : (
                <p className="text-sm font-semibold text-white">{title}</p>
              ))}
            {description && (
              <div className="text-sm leading-relaxed text-white/70">
                {renderDiscordMessageContent(description, mentions)}
              </div>
            )}
            {imageUrl && isDiscordCdn(imageUrl) && (
              <Image
                src={imageUrl}
                alt={title || 'Announcement embed'}
                width={embed.image?.width || embed.thumbnail?.width || 480}
                height={embed.image?.height || embed.thumbnail?.height || 270}
                className="mt-2 h-auto max-h-64 w-auto max-w-full rounded-lg"
                unoptimized
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

type DiscordAnnouncementsProps = {
  maxItems?: number
}

export default function DiscordAnnouncements({ maxItems = 5 }: DiscordAnnouncementsProps) {
  const { announcements, isLoading, error } = useAnnouncements()

  const messages = useMemo(
    () => (Array.isArray(announcements) ? announcements.slice(0, maxItems) : []),
    [announcements, maxItems]
  )
  const textUnavailable =
    messages.length > 0 && messages.every((message) => !hasVisibleBody(message))

  if (isLoading && messages.length === 0) {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white/60" />
      </div>
    )
  }

  if (error || (!isLoading && messages.length === 0)) {
    return (
      <div className="flex items-center justify-center py-10 text-center">
        <p className="text-white/50 text-sm">
          Couldn&apos;t load the latest Discord announcements right now.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {textUnavailable && (
        <p className="text-sm text-white/50">
          Announcement text isn&apos;t available in the dashboard right now. Open a post to read it
          on Discord.
        </p>
      )}
      {messages.map((message: any) => {
        const author = message.author
        const displayName = author?.global_name || author?.username || 'MoonDAO'
        const avatarUrl = getAvatarUrl(author)
        const href = messageLink(message)
        const visible = hasVisibleBody(message)

        return (
          <div
            key={message.id}
            className="flex gap-3 bg-black/20 hover:bg-black/30 border border-white/5 hover:border-white/10 rounded-xl p-3.5 transition-all"
          >
            <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 ring-2 ring-white/10">
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt={displayName}
                  width={36}
                  height={36}
                  className="w-full h-full object-cover"
                  unoptimized
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-600" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-white text-sm font-semibold truncate">{displayName}</p>
                <span className="text-white/30 text-xs flex-shrink-0">
                  {relativeTime(message.timestamp)}
                </span>
                {message.mention_everyone && (
                  <span className="text-xs font-medium text-yellow-300/90 flex-shrink-0">
                    @everyone
                  </span>
                )}
              </div>
              {visible ? (
                <>
                  {typeof message.content === 'string' && message.content.trim() && (
                    <div className="mt-0.5">
                      <ExpandableText
                        className="text-white/70 text-sm leading-relaxed whitespace-pre-line"
                        lines={4}
                      >
                        {renderDiscordMessageContent(message.content, message.mentions)}
                      </ExpandableText>
                    </div>
                  )}
                  <AttachmentList attachments={message.attachments} />
                  <EmbedList embeds={message.embeds} mentions={message.mentions} />
                </>
              ) : null}
              <ReactionRow reactions={message.reactions} />
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className="mt-1.5 inline-flex text-sm text-indigo-300 hover:text-indigo-200"
              >
                Open on Discord →
              </a>
            </div>
          </div>
        )
      })}
    </div>
  )
}
