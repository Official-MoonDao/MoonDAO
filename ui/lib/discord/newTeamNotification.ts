import {
  buildNewCitizenBody,
  buildNewCitizenPayload,
  MAX_ATTACHMENT_BYTES,
  type CitizenAttachment,
} from '@/lib/discord/newCitizenNotification'
import { imageExtensionForContentType } from '@/lib/ipfs/gateway'

export { MAX_ATTACHMENT_BYTES }
export type TeamAttachment = CitizenAttachment

export function teamImageFilename(tokenId: string | number, contentType?: string) {
  return `team-${tokenId}.${imageExtensionForContentType(contentType)}`
}

export function teamProfileUrl(origin: string, prettyLink: string) {
  return `${origin}/team/${prettyLink}`
}

/**
 * The announcement line.
 *
 * The profile URL is wrapped in angle brackets so Discord does not generate its
 * own link preview. Discord's preview is built by crawling the team page and
 * then fetching whatever `og:image` points at — which 404s until Tableland has
 * indexed the new row, and which is why team sign-ups were announced with no
 * image (or not at all, when the client never reached the Discord call).
 */
export function buildNewTeamContent({
  teamName,
  profileUrl,
  citizenRoleId,
}: {
  teamName: string
  profileUrl: string
  citizenRoleId: string
}) {
  return `## [**${teamName}**](<${profileUrl}>) has created a team in the Space Acceleration Network! <@&${citizenRoleId}>`
}

export function buildNewTeamPayload(args: {
  content: string
  profileUrl: string
  description?: string
  imageFilename?: string
}) {
  return buildNewCitizenPayload(args)
}

export function buildNewTeamBody(
  payload: Record<string, any>,
  imageFilename?: string,
  attachment?: TeamAttachment
) {
  return buildNewCitizenBody(payload, imageFilename, attachment)
}
