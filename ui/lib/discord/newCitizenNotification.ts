import { imageExtensionForContentType } from '@/lib/ipfs/gateway'

// Discord rejects uploads above the guild limit (10 MB for an unboosted
// server). Citizen portraits are ~2 MB, so anything near the cap is unexpected
// and better handled by falling back to a message without an attachment than
// by having Discord reject the whole notification.
export const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024

export const EMBED_COLOR = 0x425eeb

const MAX_EMBED_DESCRIPTION = 300

export type CitizenAttachment = {
  bytes: Uint8Array
  contentType: string
}

export function citizenImageFilename(tokenId: string | number, contentType?: string) {
  return `citizen-${tokenId}.${imageExtensionForContentType(contentType)}`
}

export function citizenProfileUrl(origin: string, prettyLink: string) {
  return `${origin}/citizen/${prettyLink}`
}

/**
 * The announcement line.
 *
 * The profile URL is wrapped in angle brackets so Discord does not generate its
 * own link preview. Discord's preview is built by crawling the profile page and
 * then fetching whatever `og:image` points at, and it abandons the image after a
 * couple of seconds — which is why these announcements so often arrived with no
 * portrait. We suppress it and attach the portrait ourselves instead.
 */
export function buildNewCitizenContent({
  citizenName,
  profileUrl,
  citizenRoleId,
}: {
  citizenName: string
  profileUrl: string
  citizenRoleId: string
}) {
  return `## [**${citizenName}**](<${profileUrl}>) has just become a <@&${citizenRoleId}> of the Space Acceleration Network!`
}

export function buildNewCitizenPayload({
  content,
  profileUrl,
  description,
  imageFilename,
}: {
  content: string
  profileUrl: string
  description?: string
  imageFilename?: string
}) {
  const embed: Record<string, any> = { url: profileUrl, color: EMBED_COLOR }

  const trimmedDescription = description?.trim()
  if (trimmedDescription) {
    embed.description =
      trimmedDescription.length > MAX_EMBED_DESCRIPTION
        ? `${trimmedDescription.slice(0, MAX_EMBED_DESCRIPTION)}...`
        : trimmedDescription
  }

  if (imageFilename) {
    embed.image = { url: `attachment://${imageFilename}` }
  }

  const payload: Record<string, any> = {
    content,
    // Only the Citizen role should ping; a bio containing an @mention must not
    // turn into a notification for everyone.
    allowed_mentions: { parse: ['roles'] },
  }

  // An embed with neither an image nor a description would render as an empty
  // grey bar, so send a plain message in that case.
  if (embed.image || embed.description) {
    payload.embeds = [embed]
  }

  if (imageFilename) {
    payload.attachments = [{ id: 0, filename: imageFilename }]
  }

  return payload
}

export function buildNewCitizenBody(
  payload: Record<string, any>,
  imageFilename?: string,
  attachment?: CitizenAttachment
) {
  if (!imageFilename || !attachment) {
    return {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  }

  const form = new FormData()
  form.append('payload_json', JSON.stringify(payload))
  form.append(
    'files[0]',
    new Blob([attachment.bytes as any], { type: attachment.contentType }),
    imageFilename
  )

  // fetch sets the multipart Content-Type (with its boundary) from the FormData.
  return { headers: {}, body: form }
}
