import { useRouter } from 'next/router'
import { useContext, useEffect, useState } from 'react'
import { getNFT } from 'thirdweb/extensions/erc721'
import CitizenContext from '@/lib/citizen/citizen-context'
import { generatePrettyLink } from '@/lib/subscription/pretty-links'
import StandardDetailCard from '@/components/layout/StandardDetailCard'
import BuyTeamListingModal from '@/components/subscription/BuyTeamListingModal'
import { TeamListing } from '@/components/subscription/TeamListing'

type MarketplaceListingProps = {
  listing: TeamListing
  teamContract: any
  selectedChain: any
}

export default function MarketplaceListing({
  listing,
  teamContract,
  selectedChain,
}: MarketplaceListingProps) {
  const { citizen } = useContext(CitizenContext)
  const router = useRouter()

  const [teamNFT, setTeamNFT] = useState<any>()
  const [isLoadingNFT, setIsLoadingNFT] = useState(false)
  const [nftError, setNftError] = useState<string | null>(null)
  const [enabledBuyListingModal, setEnabledBuyListingModal] = useState(false)

  useEffect(() => {
    async function fetchTeamNFT() {
      if (!teamContract || !listing.teamId) return

      setIsLoadingNFT(true)
      setNftError(null)

      try {
        const nft = await getNFT({
          contract: teamContract,
          tokenId: BigInt(listing.teamId),
          includeOwner: true,
        })
        setTeamNFT(nft)
      } catch (error) {
        console.error('Error fetching team NFT:', error)
        setNftError('Failed to fetch team NFT data')
      } finally {
        setIsLoadingNFT(false)
      }
    }

    fetchTeamNFT()
  }, [teamContract, listing.teamId])

  const handleListingClick = () => {
    if (isLoadingNFT) {
      return
    }

    if (nftError) {
      router.push(`/team/${listing.teamId}?listing=${listing.id}`)
      return
    }

    setEnabledBuyListingModal(true)
  }

  const handleTeamClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    router.push(
      `/team/${
        teamNFT?.metadata?.name
          ? generatePrettyLink(teamNFT.metadata.name)
          : listing.teamId
      }`
    )
  }

  return (
    <>
      <div className="h-full">
        <StandardDetailCard
          title={listing.title}
          subheader={
            <button
              className="text-slate-300 hover:underline transition-colors text-left text-sm"
              onClick={handleTeamClick}
            >
              {teamNFT?.metadata?.name || `Team ${listing.teamId}`}
            </button>
          }
          paragraph={listing.description}
          image={listing.image}
          price={listing.price}
          currency={listing.currency}
          isCitizen={!!citizen}
          onClick={handleListingClick}
        />
      </div>

      {/* Buy Listing Modal */}
      {enabledBuyListingModal && (
        <BuyTeamListingModal
          selectedChain={selectedChain}
          listing={listing}
          recipient={teamNFT?.owner}
          setEnabled={setEnabledBuyListingModal}
        />
      )}
    </>
  )
}
