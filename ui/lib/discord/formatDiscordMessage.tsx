import React from 'react'
import {
  discordChannelDictionary,
  discordRoleDictionary,
} from '@/lib/dashboard/dashboard-utils.ts/discord-config'

// Matches Discord's raw mention/markdown syntax so announcement messages
// pulled from the API render close to how they look in the Discord client,
// instead of showing raw `<@&123>` / `**bold**` tokens.
const TOKEN_REGEX =
  /(<@&(\d+)>)|(<#(\d+)>)|(<@!?(\d+)>)|(\*\*([^*]+)\*\*)|(~~([^~]+)~~)|(`([^`]+)`)|(\[([^\]]+)\]\(<?(https?:\/\/[^\s)>]+)>?\))|<?(https?:\/\/[^\s<>]+)>?|(\n)|(<t:(-?\d+)(?::([tTdDfFR]))?>)|(<(a?):(\w+):(\d+)>)/g

function formatDiscordTimestamp(seconds: number, style = 'f'): string {
  const date = new Date(seconds * 1000)
  if (Number.isNaN(date.getTime())) return ''
  switch (style) {
    case 't':
      return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    case 'T':
      return date.toLocaleTimeString()
    case 'd':
      return date.toLocaleDateString()
    case 'D':
      return date.toLocaleDateString(undefined, { dateStyle: 'long' })
    case 'F':
      return date.toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'short' })
    case 'R': {
      const diffSeconds = Math.round((date.getTime() - Date.now()) / 1000)
      const units: [Intl.RelativeTimeFormatUnit, number][] = [
        ['year', 31_536_000],
        ['month', 2_592_000],
        ['day', 86_400],
        ['hour', 3_600],
        ['minute', 60],
      ]
      const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
      for (const [unit, size] of units) {
        if (Math.abs(diffSeconds) >= size) return rtf.format(Math.round(diffSeconds / size), unit)
      }
      return rtf.format(diffSeconds, 'second')
    }
    default:
      return date.toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short' })
  }
}

interface DiscordMention {
  id: string
  username?: string
  global_name?: string
}

// Renders raw Discord message content (mentions + a small subset of
// markdown) as React nodes. Not a full markdown parser — just enough to
// make announcement messages readable outside of Discord itself.
export function renderDiscordMessageContent(
  content: string,
  mentions: DiscordMention[] = []
): React.ReactNode {
  if (!content) return null

  const mentionMap = new Map(mentions.map((m) => [m.id, m.global_name || m.username || 'member']))

  const nodes: React.ReactNode[] = []
  let lastIndex = 0
  let key = 0
  let match: RegExpExecArray | null

  const tokenRegex = new RegExp(TOKEN_REGEX.source, 'g')
  while ((match = tokenRegex.exec(content))) {
    if (match.index > lastIndex) {
      nodes.push(content.slice(lastIndex, match.index))
    }

    const [
      full,
      ,
      roleId,
      ,
      channelId,
      ,
      userId,
      ,
      boldText,
      ,
      strikeText,
      ,
      codeText,
      ,
      linkText,
      linkUrl,
      bareUrl,
      newline,
      ,
      timestampSeconds,
      timestampStyle,
      ,
      emojiAnimated,
      emojiName,
      emojiId,
    ] = match

    if (roleId) {
      const [colorClass, name] = discordRoleDictionary[roleId] || ['text-blue-400', 'role']
      nodes.push(
        <span key={key++} className={`font-medium ${colorClass}`}>
          @{name}
        </span>
      )
    } else if (channelId) {
      const [colorClass, name] = discordChannelDictionary[channelId] || ['text-blue-400', 'channel']
      nodes.push(
        <span key={key++} className={`font-medium ${colorClass}`}>
          #{name}
        </span>
      )
    } else if (userId) {
      nodes.push(
        <span key={key++} className="font-medium text-blue-400">
          @{mentionMap.get(userId) || 'member'}
        </span>
      )
    } else if (boldText !== undefined) {
      nodes.push(
        <strong key={key++} className="font-semibold text-white">
          {renderDiscordMessageContent(boldText, mentions)}
        </strong>
      )
    } else if (strikeText !== undefined) {
      nodes.push(
        <span key={key++} className="line-through opacity-70">
          {renderDiscordMessageContent(strikeText, mentions)}
        </span>
      )
    } else if (codeText !== undefined) {
      nodes.push(
        <code key={key++} className="px-1 py-0.5 rounded bg-white/10 text-xs font-RobotoMono">
          {codeText}
        </code>
      )
    } else if (linkUrl) {
      nodes.push(
        <a
          key={key++}
          href={linkUrl}
          target="_blank"
          rel="noreferrer"
          className="text-blue-400 underline hover:text-blue-300"
        >
          {linkText}
        </a>
      )
    } else if (bareUrl) {
      nodes.push(
        <a
          key={key++}
          href={bareUrl}
          target="_blank"
          rel="noreferrer"
          className="text-blue-400 underline hover:text-blue-300 break-all"
        >
          {bareUrl}
        </a>
      )
    } else if (newline) {
      nodes.push(<br key={key++} />)
    } else if (timestampSeconds) {
      const date = new Date(Number(timestampSeconds) * 1000)
      nodes.push(
        <time
          key={key++}
          dateTime={Number.isNaN(date.getTime()) ? undefined : date.toISOString()}
          title={Number.isNaN(date.getTime()) ? undefined : date.toLocaleString()}
          className="rounded bg-white/10 px-1"
        >
          {formatDiscordTimestamp(Number(timestampSeconds), timestampStyle)}
        </time>
      )
    } else if (emojiId) {
      nodes.push(
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={key++}
          src={`https://cdn.discordapp.com/emojis/${emojiId}.${
            emojiAnimated ? 'gif' : 'png'
          }?size=32`}
          alt={`:${emojiName}:`}
          title={`:${emojiName}:`}
          className="inline-block h-[1.2em] w-[1.2em] align-text-bottom"
        />
      )
    }

    lastIndex = match.index + full.length
  }

  if (lastIndex < content.length) {
    nodes.push(content.slice(lastIndex))
  }

  return nodes
}
