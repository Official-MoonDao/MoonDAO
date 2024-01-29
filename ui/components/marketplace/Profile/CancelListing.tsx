import { useRouter } from 'next/router'
import { toast } from 'react-hot-toast'
import toastStyle from '../../../lib/marketplace/marketplace-utils/toastConfig'
import { MARKETPLACE_ADDRESS } from '../../../const/config'
import { PrivyWeb3Button } from '../../privy/PrivyWeb3Button'

export default function CancelListing({
  marketplaceContract,
  listingId,
  type,
  expired = false,
}: {
  marketplaceContract: any
  listingId: string | number
  type: string
  expired?: boolean
}) {
  const router = useRouter()
  return (
    <div>
      <PrivyWeb3Button
        label="Cancel Listing"
        className={`hover:!text-title-light 
          bg-slate-300
          dark:!text-dark-text dark:!bg-slate-600 dark:hover:!bg-slate-700 dark:hover:!text-title-dark`}
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
      />
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
