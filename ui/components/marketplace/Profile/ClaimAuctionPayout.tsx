import { Web3Button, useContract } from '@thirdweb-dev/react'
import { useRouter } from 'next/router'
import { toast } from 'react-hot-toast'
import toastStyle from '../../../lib/marketplace/marketplace-utils/toastConfig'
import { MARKETPLACE_ADDRESS } from '../../../const/config'
import { PrivyWeb3Button } from '../../privy/PrivyWeb3Button'

interface ClaimAuctionPayoutProps {
  marketplaceContract: any
  claimable: boolean
  auctionId: number
}

export default function ClaimAuctionPayout({
  marketplaceContract,
  claimable,
  auctionId,
}: ClaimAuctionPayoutProps) {
  const router = useRouter()

  return (
    <PrivyWeb3Button
      label={claimable ? 'Claim Payout' : 'No Payout'}
      className={`hover:!text-title-light 
    bg-slate-300
    dark:!text-dark-text dark:!bg-slate-600 dark:hover:!bg-slate-700 dark:hover:!text-title-dark`}
      action={() =>
        marketplaceContract?.call('collectAuctionPayout', [+auctionId])
      }
      onSuccess={() => {
        router.reload()
        setTimeout(() => {
          toast.success('Successfully claimed!', { style: toastStyle })
        }, 1000)
      }}
      isDisabled={!claimable}
    />
  )
}
