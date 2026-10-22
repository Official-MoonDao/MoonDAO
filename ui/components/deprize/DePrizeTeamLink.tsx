import Link from 'next/link'
import { useEffect, useState, type MouseEvent } from 'react'
import { getIPFSGateway } from '@/lib/ipfs/gateway'
import { loadOwnerNft, loadTeamNames } from '@/lib/tableland/tableNft'

type DePrizeTeamLinkProps = {
  teamId: bigint
  teamContract: any
  /** Accent color for the avatar monogram / ring. */
  color?: string
  className?: string
  /** When true, only render name (no avatar). */
  nameOnly?: boolean
  size?: number
  /** Atlas / external display name — skips NFT name when set with imageOverride. */
  nameOverride?: string
  /** Atlas / external logo URI — skips NFT image when set with nameOverride. */
  imageOverride?: string
  /** Override link target (e.g. `/moonbase/{projectId}`). Defaults to `/team/{id}`. */
  hrefOverride?: string
  /**
   * Competitor has not claimed its listing: render the name but never a logo,
   * so we don't imply endorsement by displaying someone's mark. Forces the
   * neutral monogram and suppresses both `imageOverride` and the NFT image.
   * A `nameOverride` alone then counts as complete identity, so we also skip
   * the doomed NFT read.
   */
  unclaimed?: boolean
  /**
   * Render the name and mark as plain text. The parent card is the control
   * (click to predict), so a nested profile link would swallow that click.
   */
  plain?: boolean
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

function isInternalHref(href: string): boolean {
  return href.startsWith('/') && !href.startsWith('//')
}

function TeamIdentity({
  teamId,
  name,
  image,
  color,
  className,
  nameOnly,
  size,
  href,
  plain = false,
}: {
  teamId: bigint
  name: string
  image: string
  color: string
  className: string
  nameOnly: boolean
  size: number
  href: string
  plain?: boolean
}) {
  const linkClassName = `group inline-flex items-center gap-2 min-w-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50 transition-opacity hover:opacity-90 ${className}`
  const title = `View ${name} profile`
  const onClick = (e: MouseEvent) => e.stopPropagation()

  const body = (
    <>
      {!nameOnly && (
        <TeamAvatar name={name} image={image} color={color} size={size} teamId={teamId} />
      )}
      <span
        className={`text-sm font-medium truncate text-white/90 ${
          plain ? '' : 'underline-offset-2 group-hover:underline group-hover:text-indigo-200'
        }`}
      >
        {name}
      </span>
    </>
  )

  if (plain) {
    return <span className={`inline-flex items-center gap-2 min-w-0 ${className}`}>{body}</span>
  }

  if (isInternalHref(href)) {
    return (
      <Link href={href} className={linkClassName} title={title} onClick={onClick}>
        {body}
      </Link>
    )
  }

  return (
    <a href={href} className={linkClassName} title={title} onClick={onClick}>
      {body}
    </a>
  )
}

/**
 * Team identity that navigates to `/team/{id}` by default. Optional overrides
 * let Moon Base Zero feed atlas org name/logo and link to `/moonbase/{projectId}`
 * for competitors that will never hold a Team NFT.
 *
 * The profile read lives in a child that only mounts when a team contract is
 * present, so Atlas / demo rows (no Team NFT) skip it entirely.
 */
export default function DePrizeTeamLink({
  teamId,
  teamContract,
  color = '#3b82f6',
  className = '',
  nameOnly = false,
  size = 28,
  nameOverride,
  imageOverride,
  hrefOverride,
  unclaimed = false,
  plain = false,
}: DePrizeTeamLinkProps) {
  // Only skip the NFT read when neither name nor image would come from it. An
  // unclaimed competitor shows no logo at all, so a name is the whole identity.
  const identityOverridden = !!nameOverride && (!!imageOverride || unclaimed)
  const canReadNft = !!teamContract && teamId > 0n && !identityOverridden
  const href = hrefOverride || `/team/${teamId.toString()}`

  if (!canReadNft) {
    return (
      <TeamIdentity
        teamId={teamId}
        name={nameOverride || `Team #${teamId.toString()}`}
        image={unclaimed ? '' : imageOverride || ''}
        color={color}
        className={className}
        nameOnly={nameOnly}
        size={size}
        href={href}
        plain={plain}
      />
    )
  }

  return (
    <DePrizeTeamLinkFromChain
      teamId={teamId}
      teamContract={teamContract}
      color={color}
      className={className}
      nameOnly={nameOnly}
      size={size}
      nameOverride={nameOverride}
      imageOverride={imageOverride}
      href={href}
      unclaimed={unclaimed}
      plain={plain}
    />
  )
}

function DePrizeTeamLinkFromChain({
  teamId,
  teamContract,
  color,
  className,
  nameOnly,
  size,
  nameOverride,
  imageOverride,
  href,
  unclaimed,
  plain,
}: {
  teamId: bigint
  teamContract: any
  color: string
  className: string
  nameOnly: boolean
  size: number
  nameOverride?: string
  imageOverride?: string
  href: string
  unclaimed: boolean
  plain: boolean
}) {
  const [teamNFT, setTeamNFT] = useState<any>()

  useEffect(() => {
    const chain = teamContract?.chain
    if (!chain) return
    let cancelled = false
    loadOwnerNft(chain, teamId).then((nft) => {
      if (!cancelled) setTeamNFT(nft)
    })
    return () => {
      cancelled = true
    }
  }, [teamContract, teamId])

  // `||` (not `??`): an empty metadata name must still fall back to the id,
  // and an empty override must not blank the row.
  const name = nameOverride || teamNFT?.metadata?.name || `Team #${teamId.toString()}`
  const image = unclaimed ? '' : imageOverride || teamNFT?.metadata?.image || ''

  return (
    <TeamIdentity
      teamId={teamId}
      name={name}
      image={image}
      color={color}
      className={className}
      nameOnly={nameOnly}
      size={size}
      href={href}
      plain={plain}
    />
  )
}

/** Resolve display name for a team id (for banners / claim copy). */
export function useDePrizeTeamName(teamId: bigint | undefined, teamContract: any): string {
  const [name, setName] = useState('')

  useEffect(() => {
    const chain = teamContract?.chain
    if (!chain || !teamId || teamId <= 0n) return
    let cancelled = false
    loadTeamNames(chain, [teamId]).then((names) => {
      if (!cancelled) setName(names.get(teamId.toString()) || '')
    })
    return () => {
      cancelled = true
    }
  }, [teamContract, teamId])

  if (!teamId || teamId <= 0n) return ''
  return name || `Team #${teamId.toString()}`
}

/** Resolve all roster names in one pass (chart legend / tooltips). */
export function useDePrizeTeamNames(
  teamIds: readonly bigint[] | undefined,
  teamContract: any
): string[] {
  const key = (teamIds ?? []).map((id) => id.toString()).join(',')
  const [names, setNames] = useState<string[]>(() =>
    (teamIds ?? []).map((id, i) => (id > 0n ? `Team #${id.toString()}` : `Team #${i + 1}`))
  )

  useEffect(() => {
    const chain = teamContract?.chain
    if (!chain || !teamIds?.length) return
    let cancelled = false
    ;(async () => {
      const namesById = await loadTeamNames(chain, teamIds)
      const resolved = teamIds.map((id, i) => {
        if (!id || id <= 0n) return `Team #${i + 1}`
        return namesById.get(id.toString()) || `Team #${id.toString()}`
      })
      if (!cancelled) setNames(resolved)
    })()
    return () => {
      cancelled = true
    }
    // `key` is the joined id list, so a new array with the same ids does not refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamContract, key])

  return names
}
