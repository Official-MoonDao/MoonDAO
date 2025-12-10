import { useEffect, useState } from 'react'
import Link from 'next/link'
import { readContract } from 'thirdweb'
import { getNFT } from 'thirdweb/extensions/erc721'
import useHatNames from '@/lib/hats/useHatNames'
import useUniqueHatWearers from '@/lib/hats/useUniqueHatWearers'
import { generatePrettyLinkWithId } from '@/lib/subscription/pretty-links'
import IPFSRenderer from '../layout/IPFSRenderer'

type TeamMemberProps = {
  address: string
  hatIds: string[]
  citizenContract: any
  hatsContract: any
}

type TeamMembersProps = {
  hatsContract: any
  citizenContract: any
  hats: any[]
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
  citizenContract,
  hatsContract,
}: TeamMemberProps) {
  //Hats Data
  const hatNames = useHatNames(hatsContract, hatIds)

  //Citizen Data
  const [ownedToken, setOwnedToken] = useState<any>()
  const [nft, setNft] = useState<any>()
  const [isLoadingNFT, setIsLoadingNFT] = useState<boolean>(false)

  const [metadata, setMetadata] = useState<any>({
    name: undefined,
    description: undefined,
    image: undefined,
    attributes: [
      {
        trait_type: '',
        value: '',
      },
    ],
  })

  useEffect(() => {
    async function getOwnedNFT() {
      setIsLoadingNFT(true)
      try {
        const ownedToken = await readContract({
          contract: citizenContract,
          method: 'getOwnedToken' as string,
          params: [address],
        })
        setOwnedToken(ownedToken)

        const nft = await getNFT({
          contract: citizenContract,
          tokenId: BigInt(ownedToken.toString()),
        })

        setNft(nft)
      } catch (err) {}
      setIsLoadingNFT(false)
    }
    if (address && citizenContract) getOwnedNFT()
  }, [address, citizenContract])

  useEffect(() => {
    if (isLoadingNFT) {
      setMetadata(undefined)
    } else if (
      nft?.metadata &&
      nft?.metadata?.name !== 'Failed to load NFT metadata'
    ) {
      setMetadata(nft.metadata)
    } else {
      setMetadata({
        name: undefined,
        description: undefined,
        image: '/assets/citizen-default.png',
        attributes: [
          {
            trait_type: '',
            value: '',
          },
        ],
      })
    }
  }, [nft, isLoadingNFT])

  // Show skeleton while loading NFT data
  if (isLoadingNFT) {
    return <TeamMemberSkeleton />
  }

  const citizenName = metadata?.name || 'Anon'
  const citizenDescription = metadata?.description || 'This citizen has yet to add a profile'
  const roles = hatNames?.map((hatName: any) => hatName.name || '...').join(', ') || 'Team Member'

  const link = `/citizen/${metadata?.name ? generatePrettyLinkWithId(metadata.name, metadata?.id || nft?.id) : 'anon'}`

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
            <p className="text-xs text-slate-400 mb-2 truncate">
              {roles}
            </p>
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
  citizenContract,
  hats,
}: TeamMembersProps) {
  const wearers = useUniqueHatWearers(hats)

  // Show loading skeletons while wearers data is loading
  if (!wearers || !wearers?.[0]?.address) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TeamMembersLoadingSkeleton count={hats?.length || 3} />
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
          citizenContract={citizenContract}
          hatsContract={hatsContract}
        />
      ))}
    </div>
  )
}
