import { useEffect, useState } from 'react'
import { readContract } from 'thirdweb'
import { getNFT } from 'thirdweb/extensions/erc721'
import useHatNames from '@/lib/hats/useHatNames'
import useUniqueHatWearers from '@/lib/hats/useUniqueHatWearers'
import ProfileCard from '../layout/ProfileCard'

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
    <div className="w-[350px]">
      <div className="animate-pulse bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl w-full h-full min-h-[500px]">
        <div className="h-full p-[20px] md:pb-10 rounded-[20px] overflow-hidden flex flex-col justify-between">
          <div className="flex flex-col">
            {/* Image skeleton */}
            <div className="w-full h-[275px] bg-gray-700/50 mb-4 animate-pulse rounded-2xl rounded-tr-[5vmax] rounded-bl-[5vmax] rounded-br-[5vmax]" />

            {/* Title section skeleton */}
            <div className="flex pb-5 flex-row items-center pr-5 justify-start">
              {/* Icon skeleton */}
              <div className="pt-[20px] w-[50px] h-[50px] bg-gray-700/50 rounded-full animate-pulse" />
              {/* Name skeleton */}
              <div className="pt-[20px] ml-4 flex-1">
                <div className="h-6 bg-gray-700/50 rounded animate-pulse w-3/4" />
              </div>
            </div>

            {/* Description skeleton */}
            <div className="mt-4 space-y-2">
              <div className="h-4 bg-gray-700/50 rounded animate-pulse w-full" />
              <div className="h-4 bg-gray-700/50 rounded animate-pulse w-3/4" />
            </div>
          </div>
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
        image: '/assets/citizen_image.png',
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

  return (
    <div className="w-[350px]">
      <ProfileCard
        inline
        metadata={{ id: metadata?.id || nft?.id, ...metadata }}
        owner={address}
        type="citizen"
        hovertext={metadata?.name && 'Explore Profile'}
        horizontalscroll
        subheader={
          <div className="flex flex-col h-[50px] overflow-auto">
            {hatNames?.map((hatName: any, i: number) => (
              <p key={`${address}-hat-name-${i}`}>{hatName.name || '...'}</p>
            ))}
          </div>
        }
        profile
      />
    </div>
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
    return <TeamMembersLoadingSkeleton count={hats?.length || 3} />
  }

  return (
    <>
      {wearers.map((w: Wearer, i: number) => (
        <TeamMember
          key={`${w.address}-wearer-${i}`}
          hatIds={w.hatIds}
          address={w.address}
          citizenContract={citizenContract}
          hatsContract={hatsContract}
        />
      ))}
    </>
  )
}
