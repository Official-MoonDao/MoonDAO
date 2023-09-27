import { Web3Button } from '@thirdweb-dev/react'
import { useRouter } from 'next/router'
import { toast } from 'react-hot-toast'
import toastStyle from '../../../lib/marketplace/marketplace-utils/toastConfig'
import { MARKETPLACE_ADDRESS } from '../../../const/config'

export default function CancelListing({
  listingId,
  type,
  expired = false,
}: {
  listingId: string | number
  type: string
  expired?: boolean
}) {
  const router = useRouter()
  return (
    <div>
      <Web3Button
        className="web3-button web3-button-secondary"
        contractAddress={MARKETPLACE_ADDRESS}
        action={(contract: any) =>
          type === 'auction'
            ? contract.englishAuctions.cancelAuction(listingId)
            : contract.directListings.cancelListing(listingId)
        }
        onSuccess={() => {
          router.reload()
          setTimeout(() => {
            toast.success('Successfully canceled!', { style: toastStyle })
          }, 1000)
        }}
      >
        {`Cancel Listing`}
      </Web3Button>
      <div className="text-[80%] text-moon-gold opacity-70">
        {type === 'auction' && expired ? (
          <p>This auction expired with no bids</p>
        ) : type === 'auction' ? (
          <p>This auction can be canceled until the first bid is made</p>
        ) : (
          ''
        )}
      </div>
    </div>
  )
}
