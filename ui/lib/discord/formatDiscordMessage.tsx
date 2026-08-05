import React from 'react'
import {
  discordChannelDictionary,
  discordRoleDictionary,
} from '@/lib/dashboard/dashboard-utils.ts/discord-config'

// Matches Discord's raw mention/markdown syntax so announcement messages
// pulled from the API render close to how they look in the Discord client,
// instead of showing raw `<@&123>` / `**bold**` tokens.
const TOKEN_REGEX =
  /(<@&(\d+)>)|(<#(\d+)>)|(<@!?(\d+)>)|(\*\*([^*]+)\*\*)|(~~([^~]+)~~)|(`([^`]+)`)|(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\))|(https?:\/\/[^\s<]+)|(\n)/g

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

  const mentionMap = new Map(
    mentions.map((m) => [m.id, m.global_name || m.username || 'member'])
  )

  const nodes: React.ReactNode[] = []
  let lastIndex = 0
  let key = 0
  let match: RegExpExecArray | null

  TOKEN_REGEX.lastIndex = 0
  while ((match = TOKEN_REGEX.exec(content))) {
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
    ] = match

    if (roleId) {
      const [colorClass, name] = discordRoleDictionary[roleId] || [
        'text-blue-400',
        'role',
      ]
      nodes.push(
        <span key={key++} className={`font-medium ${colorClass}`}>
          @{name}
        </span>
      )
    } else if (channelId) {
      const [colorClass, name] = discordChannelDictionary[channelId] || [
        'text-blue-400',
        'channel',
      ]
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
          {boldText}
        </strong>
      )
    } else if (strikeText !== undefined) {
      nodes.push(
        <span key={key++} className="line-through opacity-70">
          {strikeText}
        </span>
      )
    } else if (codeText !== undefined) {
      nodes.push(
        <code
          key={key++}
          className="px-1 py-0.5 rounded bg-white/10 text-xs font-RobotoMono"
        >
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
    }

    lastIndex = match.index + full.length
  }

  if (lastIndex < content.length) {
    nodes.push(content.slice(lastIndex))
  }

  return nodes
}
