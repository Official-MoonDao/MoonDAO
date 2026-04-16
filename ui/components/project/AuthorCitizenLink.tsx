import { getNFT } from 'thirdweb/extensions/erc721'
import { readContract } from 'thirdweb'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useENS } from '@/lib/utils/hooks/useENS'
import { generatePrettyLinkWithId } from '@/lib/subscription/pretty-links'

type AuthorCitizenLinkProps = {
  authorAddress: string
  citizenContract: any
  authorName?: string | null
  compact?: boolean
}

export default function AuthorCitizenLink({
  authorAddress,
  citizenContract,
  authorName,
  compact = false,
}: AuthorCitizenLinkProps) {
  const [citizenMeta, setCitizenMeta] = useState<any>(null)
  const { data: ensData } = useENS(authorAddress)
  const shortAddress = `${authorAddress.slice(0, 6)}...${authorAddress.slice(-4)}`

  useEffect(() => {
    async function resolve() {
      if (!authorAddress || !citizenContract?.address) return
      try {
        const tokenId = await readContract({
          contract: citizenContract,
          method: 'getOwnedToken' as string,
          params: [authorAddress],
        })
        const nft = await getNFT({
          contract: citizenContract,
          tokenId: BigInt(tokenId.toString()),
        })
        if (
          nft?.metadata?.name &&
          nft.metadata.name !== 'Failed to load NFT metadata'
        ) {
          setCitizenMeta({ ...nft.metadata, id: nft.id.toString() })
        }
      } catch {
        // Not a citizen or contract call failed
      }
    }
    resolve()
  }, [authorAddress, citizenContract])

  const displayName = citizenMeta?.name || authorName || null
  const addressLabel = ensData?.name || shortAddress
  const avatarSrc =
    citizenMeta?.image || `https://cdn.stamp.fyi/avatar/${authorAddress}`
  const href = citizenMeta
    ? `/citizen/${generatePrettyLinkWithId(citizenMeta.name, citizenMeta.id)}`
    : undefined

  const explorerBaseUrl =
    citizenContract?.chain?.blockExplorers?.[0]?.url?.replace(/\/$/, '') ||
    'https://arbiscan.io'
  const explorerAddressUrl = `${explorerBaseUrl}/address/${authorAddress}`
  const linkHref = href || explorerAddressUrl
  const linkProps = href
    ? {}
    : { target: '_blank' as const, rel: 'noopener noreferrer' }

  const containerClasses = compact
    ? 'flex items-center gap-1.5 h-7 bg-white/5 border border-white/10 rounded-lg px-2 hover:bg-white/10 transition-colors group min-w-0'
    : 'flex items-center gap-2 h-7 sm:h-9 bg-white/5 border border-white/10 rounded-lg px-2 sm:px-3 hover:bg-white/10 transition-colors group min-w-0'

  const avatarWrapperClasses = compact
    ? 'w-5 h-5 rounded-full overflow-hidden flex-shrink-0'
    : 'w-5 h-5 sm:w-6 sm:h-6 rounded-full overflow-hidden flex-shrink-0'

  const displayNameClasses = compact
    ? 'text-xs text-gray-300 group-hover:text-white transition-colors truncate'
    : 'text-xs sm:text-sm text-gray-300 group-hover:text-white transition-colors truncate'

  const addressClasses = compact
    ? 'text-[11px] font-mono text-gray-500 group-hover:text-gray-300 transition-colors hidden md:inline'
    : 'text-xs sm:text-sm font-mono text-gray-500 group-hover:text-gray-300 transition-colors hidden sm:inline'

  return (
    <Link
      href={linkHref}
      {...linkProps}
      className="no-underline"
      onClick={(e) => e.stopPropagation()}
    >
      <div className={containerClasses}>
        <div className={avatarWrapperClasses}>
          <img
            src={
              avatarSrc.startsWith('ipfs://')
                ? `https://ipfs.io/ipfs/${avatarSrc.replace('ipfs://', '')}`
                : avatarSrc
            }
            alt={displayName || addressLabel}
            width={24}
            height={24}
            className="w-full h-full object-cover"
          />
        </div>
        {displayName && <span className={displayNameClasses}>{displayName}</span>}
        <span className={addressClasses}>{addressLabel}</span>
      </div>
    </Link>
  )
}
