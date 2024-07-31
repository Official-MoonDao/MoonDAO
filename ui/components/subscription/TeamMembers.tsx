import { useNFT } from '@thirdweb-dev/react'
import { useEffect, useState } from 'react'
import { useHandleRead } from '@/lib/thirdweb/hooks'
import ProfileCard from '../layout/ProfileCard'

type TeamMemberProps = {
  address: string
  hatIds: string[]
  citizenContract: any
  hatsContract: any
}

type TeamMembersProps = {
  hatsContract: any
  citizenConract: any
  hats: any[]
}

type Wearer = {
  address: string
  hatIds: string[]
}

function TeamMember({
  address,
  hatIds,
  citizenContract,
  hatsContract,
}: TeamMemberProps) {
  //Hats Data
  const [hatNames, setHatNames] = useState<string[]>([])

  useEffect(() => {
    async function getAllHatNames() {
      try {
        const hatNamesPromises = hatIds.map(async (hatId: string) => {
          const hat = await hatsContract.call('viewHat', [hatId])
          const detailsIpfsHash = hat.details.split('ipfs://')[1]
          const hatDetailsRes = await fetch(
            `https://ipfs.io/ipfs/${detailsIpfsHash}`
          )
          const { data: hatDetails } = await hatDetailsRes.json()
          return hatDetails.name
        })

        const names = await Promise.all(hatNamesPromises)
        setHatNames(names)
      } catch (err) {
        console.error('Failed to fetch hat names:', err)
      }
    }
    if (hatIds.length > 0 && hatsContract) {
      getAllHatNames()
    }
  }, [hatIds, hatsContract])

  //Citizen Data
  const { data: ownedToken } = useHandleRead(citizenContract, 'getOwnedToken', [
    address,
  ])
  const { data: nft, isLoading: isLoadingNft } = useNFT(
    citizenContract,
    ownedToken?.toString() || 100000000
  )
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
    if (isLoadingNft) return
    if (
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
  }, [nft, isLoadingNft])

  return (
    <div className="w-[350px]">
      <ProfileCard
        inline
        metadata={metadata}
        owner={address}
        type="citizen"
        hovertext={metadata?.name && 'Explore Profile'}
        horizontalscroll
        subheader={
          <div className="flex flex-col h-[50px] overflow-auto">
            {hatNames?.map((hatName: any, i: number) => (
              <p key={`${address}-hat-name-${i}`}>{hatName}</p>
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
  citizenConract,
  hats,
}: TeamMembersProps) {
  const [wearers, setWearers] = useState<any>()

  useEffect(() => {
    async function hatsToUniqueWearers() {
      const uniqueWearers: Wearer[] = []
      hats.forEach((hat) => {
        hat.wearers.forEach((w: any) => {
          const existingWearer = uniqueWearers.find((u) => u.address === w.id)
          if (existingWearer) {
            existingWearer.hatIds.push(hat.id)
          } else {
            uniqueWearers.push({
              address: w.id,
              hatIds: [hat.id],
            })
          }
        })
      })
      setWearers(uniqueWearers)
    }

    if (hats) {
      hatsToUniqueWearers()
    }
  }, [hats])

  return (
    <>
      {wearers?.[0].address &&
        wearers.map((w: Wearer, i: number) => (
          <TeamMember
            key={`${w.address}-wearer-${i}`}
            hatIds={w.hatIds}
            address={w.address}
            citizenContract={citizenConract}
            hatsContract={hatsContract}
          />
        ))}
    </>
  )
}
