import { Web3Button } from '@thirdweb-dev/react'
import { useRouter } from 'next/router'
import { toast } from 'react-hot-toast'
import toastStyle from '../../../lib/marketplace/marketplace-utils/toastConfig'
import { MARKETPLACE_ADDRESS } from '../../../const/config'

type ClaimAssetProps = {
  walletAddress: string
  auctionId: string | number
}

export default function ClaimAsset({
  walletAddress,
  auctionId,
}: ClaimAssetProps) {
  const router = useRouter()
  return (
    <Web3Button
      className="web3-button web3-button-primary"
      contractAddress={MARKETPLACE_ADDRESS}
      action={(marketplace) =>
        marketplace.englishAuctions.closeAuctionForBidder(
          auctionId,
          walletAddress
        )
      }
      onSuccess={() => {
        router.reload()
        setTimeout(() => {
          toast.success('Asset claimed!', { style: toastStyle })
        }, 1000)
      }}
    >
      {'Claim Asset'}
    </Web3Button>
  )
}
