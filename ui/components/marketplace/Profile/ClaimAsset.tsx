import { Web3Button, useContract } from '@thirdweb-dev/react'
import { useRouter } from 'next/router'
import { toast } from 'react-hot-toast'
import toastStyle from '../../../lib/marketplace/marketplace-utils/toastConfig'
import { MARKETPLACE_ADDRESS } from '../../../const/config'
import { PrivyWeb3Button } from '../../privy/PrivyWeb3Button'

type ClaimAssetProps = {
  marketplaceContract: any
  walletAddress: string
  auctionId: string | number
}

export default function ClaimAsset({
  marketplaceContract,
  walletAddress,
  auctionId,
}: ClaimAssetProps) {
  const router = useRouter()

  return (
    <PrivyWeb3Button
      label="Claim Asset"
      className={`hover:!text-title-light 
    bg-slate-300
    dark:!text-dark-text dark:!bg-slate-600 dark:hover:!bg-slate-700 dark:hover:!text-title-dark`}
      action={() =>
        marketplaceContract?.englishAuctions.closeAuctionForBidder(
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
    />
  )
}
