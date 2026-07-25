import { useEffect, useState } from 'react'
import { getNFT } from 'thirdweb/extensions/erc721'
import { useReadContract } from 'thirdweb/react'
import { getIPFSGateway } from '@/lib/ipfs/gateway'

type DePrizeTeamLinkProps = {
  teamId: bigint
  teamContract: any
  /** Accent color for the avatar monogram / ring. */
  color?: string
  className?: string
  /** When true, only render name (no avatar). */
  nameOnly?: boolean
  size?: number
}

/** Two-letter monogram from a team name (falls back to the numeric id). */
function initials(name: string, teamId: bigint): string {
  // First alphanumeric char of each word, so "Team #301" -> "T3", not "T#".
  const marks = name
    .trim()
    .split(/\s+/)
    .map((w) => w.replace(/[^a-zA-Z0-9]/g, '')[0])
    .filter(Boolean)
  if (marks.length === 0) return `#${teamId.toString()}`
  if (marks.length === 1) {
    const solo = name.replace(/[^a-zA-Z0-9]/g, '')
    return solo.slice(0, 2).toUpperCase()
  }
  return (marks[0] + marks[1]).toUpperCase()
}

/**
 * Circular team avatar with a graceful fallback. Unlike the generic IPFS
 * renderer, a missing/broken image collapses to an initials monogram (never the
 * raw team name), and the container is a fixed square so rows stay aligned.
 */
function TeamAvatar({
  name,
  image,
  color,
  size,
  teamId,
}: {
  name: string
  image: string
  color: string
  size: number
  teamId: bigint
}) {
  const [errored, setErrored] = useState(false)
  // Reset the error flag if the resolved image changes (e.g. metadata arrives).
  useEffect(() => setErrored(false), [image])

  const src = image ? getIPFSGateway(image) : ''
  const showImage = !!src && !errored

  return (
    <span
      className="relative shrink-0 rounded-full overflow-hidden border border-white/10 flex items-center justify-center"
      style={{ width: size, height: size, background: `${color}33` }}
    >
      {showImage ? (
        // Plain <img>: avatars are tiny and IPFS-hosted; next/image's optimizer
        // adds no value here and its wrapper breaks the fixed-square layout.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={name}
          width={size}
          height={size}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={() => setErrored(true)}
        />
      ) : (
        <span
          className="font-semibold text-white/90 leading-none select-none"
          style={{ fontSize: Math.max(9, Math.round(size * 0.38)) }}
        >
          {initials(name, teamId)}
        </span>
      )}
    </span>
  )
}

/**
 * Team identity that navigates to `/team/{id}`. Used anywhere DePrize lists
 * competing providers so the profile is one click away.
 */
export default function DePrizeTeamLink({
  teamId,
  teamContract,
  color = '#3b82f6',
  className = '',
  nameOnly = false,
  size = 28,
}: DePrizeTeamLinkProps) {
  const { data: teamNFT } = useReadContract(getNFT, {
    contract: teamContract,
    tokenId: BigInt(teamId),
    queryOptions: { enabled: !!teamContract && teamId > 0n },
  })
  const name = (teamNFT as any)?.metadata?.name || `Team #${teamId.toString()}`
  const image = (teamNFT as any)?.metadata?.image || ''
  const href = `/team/${teamId.toString()}`

  return (
    <a
      href={href}
      className={`group inline-flex items-center gap-2 min-w-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50 transition-opacity hover:opacity-90 ${className}`}
      title={`View ${name} profile`}
      onClick={(e) => e.stopPropagation()}
    >
      {!nameOnly && (
        <TeamAvatar
          name={name}
          image={image}
          color={color}
          size={size}
          teamId={teamId}
        />
      )}
      <span className="text-sm font-medium truncate underline-offset-2 group-hover:underline text-white/90 group-hover:text-indigo-200">
        {name}
      </span>
    </a>
  )
}

/** Resolve display name for a team id (for banners / claim copy). */
export function useDePrizeTeamName(teamId: bigint | undefined, teamContract: any): string {
  const { data: teamNFT } = useReadContract(getNFT, {
    contract: teamContract,
    tokenId: BigInt(teamId ?? 0n),
    queryOptions: { enabled: !!teamContract && !!teamId && teamId > 0n },
  })
  if (!teamId || teamId <= 0n) return ''
  return (teamNFT as any)?.metadata?.name || `Team #${teamId.toString()}`
}
