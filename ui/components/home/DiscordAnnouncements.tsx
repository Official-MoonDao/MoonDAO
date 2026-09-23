import Image from 'next/image'
import { useMemo } from 'react'
import { useAnnouncements } from '@/lib/dashboard/hooks/useAnnouncements'
import { renderDiscordMessageContent } from '@/lib/discord/formatDiscordMessage'
import ExpandableText from '@/components/layout/ExpandableText'

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
    return `https://cdn.discordapp.com/avatars/${author.id}/${author.avatar}.png?size=64`
  }
  // Discord's default avatar bucket (5 options), keyed off the user id.
  const defaultIndex = Number(BigInt(author.id ?? '0') % 5n)
  return `https://cdn.discordapp.com/embed/avatars/${defaultIndex}.png`
}

type DiscordAnnouncementsProps = {
  maxItems?: number
}

export default function DiscordAnnouncements({
  maxItems = 5,
}: DiscordAnnouncementsProps) {
  const { announcements, isLoading, error } = useAnnouncements()

  const messages = useMemo(
    () => (Array.isArray(announcements) ? announcements.slice(0, maxItems) : []),
    [announcements, maxItems]
  )

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
      {messages.map((message: any) => {
        const author = message.author
        const displayName =
          author?.global_name || author?.username || 'MoonDAO'
        const avatarUrl = getAvatarUrl(author)

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
                <p className="text-white text-sm font-semibold truncate">
                  {displayName}
                </p>
                <span className="text-white/30 text-xs flex-shrink-0">
                  {relativeTime(message.timestamp)}
                </span>
              </div>
              <div className="mt-0.5">
                <ExpandableText
                  className="text-white/70 text-sm leading-relaxed whitespace-pre-line"
                  lines={4}
                >
                  {renderDiscordMessageContent(message.content, message.mentions)}
                </ExpandableText>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
