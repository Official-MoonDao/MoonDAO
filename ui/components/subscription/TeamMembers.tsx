import { useContext, useMemo } from 'react'
import Link from 'next/link'
import { CITIZEN_TABLE_NAMES } from 'const/config'
import { BLOCKED_CITIZENS } from 'const/whitelist'
import { getRoleLabel } from '@/lib/hats/teamRoles'
import useHatNames from '@/lib/hats/useHatNames'
import useUniqueHatWearers from '@/lib/hats/useUniqueHatWearers'
import { generatePrettyLinkWithId } from '@/lib/subscription/pretty-links'
import { citizenRowToNFT } from '@/lib/tableland/convertRow'
import { useTablelandQuery } from '@/lib/swr/useTablelandQuery'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import IPFSRenderer from '../layout/IPFSRenderer'

type TeamMemberProps = {
  address: string
  hatIds: string[]
  hatsContract: any
  citizenNft?: any
  managerHatId?: any
}

type TeamMembersProps = {
  hatsContract: any
  citizenContract: any
  hats: any[]
  managerHatId?: any
}

type Wearer = {
  address: string
  hatIds: string[]
}

function TeamMemberSkeleton() {
  return (
    <div className="w-full p-4 bg-slate-600/20 rounded-xl animate-pulse">
      <div className="flex flex-row items-start gap-4 w-full">
        <div className="w-[60px] h-[60px] bg-slate-700/50 rounded-xl flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="h-4 bg-slate-700/50 rounded w-3/4 mb-2" />
          <div className="h-3 bg-slate-700/50 rounded w-1/2 mb-2" />
          <div className="h-3 bg-slate-700/50 rounded w-full" />
        </div>
      </div>
    </div>
  )
}

function TeamMembersLoadingSkeleton({ count = 3 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <TeamMemberSkeleton key={`skeleton-${i}`} />
      ))}
    </>
  )
}

function TeamMember({
  address,
  hatIds,
  hatsContract,
  citizenNft,
  managerHatId,
}: TeamMemberProps) {
  const hatNames = useHatNames(hatsContract, hatIds)

  const metadata = citizenNft?.metadata
  const citizenName = metadata?.name || 'Anon'
  const citizenDescription =
    metadata?.description || 'This citizen has yet to add a profile'
  // Label roles deterministically: the manager hat is always shown as "Manager"
  // (via getRoleLabel) even if its IPFS metadata is missing/slow, so managers are
  // never silently downgraded to a generic member label.
  const roles =
    hatNames
      ?.map((hatName: any) =>
        getRoleLabel(hatName.hatId, {
          managerHatId,
          ipfsName: hatName.name,
        })
      )
      .join(', ') || 'Team Member'

  const link = metadata?.name
    ? `/citizen/${generatePrettyLinkWithId(metadata.name, metadata?.id || citizenNft?.id)}`
    : 'anon'

  return (
    <Link href={link} className="block w-full">
      <div className="w-full p-4 bg-slate-600/20 rounded-xl hover:bg-slate-600/30 transition-colors group">
        <div className="flex flex-row items-start gap-4 w-full">
          <div className="w-[60px] h-[60px] flex-shrink-0">
            <IPFSRenderer
              className="w-full h-full object-cover rounded-xl border-2 border-slate-500/50"
              src={metadata?.image || '/assets/citizen-default.png'}
              width={60}
              height={60}
              alt={citizenName}
              fallback="/assets/citizen-default.png"
            />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-white text-sm mb-1 group-hover:text-slate-200 transition-colors truncate">
              {citizenName}
            </h3>
            <p className="text-xs text-slate-400 mb-2 truncate">{roles}</p>
            <p className="text-xs text-slate-300 leading-relaxed line-clamp-2">
              {citizenDescription.length > 100
                ? citizenDescription.slice(0, 100) + '...'
                : citizenDescription}
            </p>
          </div>
        </div>
      </div>
    </Link>
  )
}

export default function TeamMembers({
  hatsContract,
  citizenContract: _citizenContract,
  hats,
  managerHatId,
}: TeamMembersProps) {
  const { selectedChain } = useContext(ChainContextV5)
  const chainSlug = getChainSlug(selectedChain)
  const wearers = useUniqueHatWearers(hats)

  const ownerAddressesKey = useMemo(() => {
    if (!wearers?.length) return ''
    return wearers
      .map((w: Wearer) => w.address?.toLowerCase())
      .filter(Boolean)
      .sort()
      .join(',')
  }, [wearers])

  const citizenLookupStatement = useMemo(() => {
    const table = CITIZEN_TABLE_NAMES[chainSlug]
    if (!table || !ownerAddressesKey) return null

    const addresses = ownerAddressesKey.split(',').filter(Boolean)
    if (addresses.length === 0) return null

    const inList = addresses.map((a) => `'${a}'`).join(',')
    const blocked = [...BLOCKED_CITIZENS]
    const blockedClause =
      blocked.length > 0 ? ` AND id NOT IN (${blocked.join(',')})` : ''

    return `SELECT id, name, description, image, owner FROM ${table} WHERE LOWER(owner) IN (${inList})${blockedClause}`
  }, [chainSlug, ownerAddressesKey])

  const { data: citizenRows, isLoading: isLoadingCitizens } = useTablelandQuery(
    citizenLookupStatement,
    { revalidateOnFocus: false }
  )

  const citizensByOwner = useMemo(() => {
    const map = new Map<string, any>()
    for (const row of citizenRows || []) {
      if (!row?.owner) continue
      map.set(String(row.owner).toLowerCase(), citizenRowToNFT(row))
    }
    return map
  }, [citizenRows])

  if (wearers === undefined) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TeamMembersLoadingSkeleton count={hats?.length || 3} />
      </div>
    )
  }

  if (wearers.length === 0) {
    return null
  }

  if (isLoadingCitizens && !citizenRows) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TeamMembersLoadingSkeleton count={wearers.length} />
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {wearers.map((w: Wearer, i: number) => (
        <TeamMember
          key={`${w.address}-wearer-${i}`}
          hatIds={w.hatIds}
          address={w.address}
          hatsContract={hatsContract}
          citizenNft={citizensByOwner.get(w.address.toLowerCase())}
          managerHatId={managerHatId}
        />
      ))}
    </div>
  )
}
