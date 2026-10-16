type DiscordMessageLike = {
  content?: string
  embeds?: unknown[]
  attachments?: unknown[]
}

// Without the Message Content privileged intent, Discord returns every message
// with empty content, embeds, and attachments. One empty message is normal
// (an image-only post with no intent looks the same), so only a whole page of
// them counts as redacted.
export function isMessageContentRedacted(messages: unknown): boolean {
  if (!Array.isArray(messages) || messages.length === 0) return false
  return messages.every((message) => {
    if (!message || typeof message !== 'object') return false
    const { content, embeds, attachments } = message as DiscordMessageLike
    return !content && !(embeds || []).length && !(attachments || []).length
  })
}
