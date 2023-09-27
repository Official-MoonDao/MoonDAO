import {
  MediaRenderer,
  ThirdwebNftMedia,
  Web3Button,
} from '@thirdweb-dev/react'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { toast } from 'react-hot-toast'
import toastStyle from '../../../../lib/marketplace/marketplace-utils/toastConfig'
import { MARKETPLACE_ADDRESS } from '../../../../const/config'

type ManageBatchProps = {
  batchType: 'direct' | 'auction' | undefined
  setBatchType: Function
  batch: any
  setBatch: Function
  listingBatch: any
  auctionBatch: any
}

export default function ManageBatch({
  batchType,
  setBatchType,
  batch,
  setBatch,
  listingBatch,
  auctionBatch,
}: ManageBatchProps) {
  const router = useRouter()
  const [enabled, setEnabled] = useState<boolean>(false)

  useEffect(() => {
    if (batchType === 'direct') {
      setBatch(listingBatch.data.listings)
    } else if (batchType === 'auction') {
      setBatch(auctionBatch.data.auctions)
    }
  }, [batchType, listingBatch.data?.listings, auctionBatch.data?.auctions])

  function CreateBatch() {
    return (
      <Web3Button
        className="!bg-moon-secondary !text-white !px-3 py-1 !rounded-sm !shadow !shadow-white hover:scale-[1.03] transition-all duration-150 font-medium"
        contractAddress={MARKETPLACE_ADDRESS}
        action={async () => {
          if (!batchType)
            return toast('Add 2 or more listings to create a batch', {
              icon: '✨',
              style: toastStyle,
              duration: 5000,
            })
          if (batchType === 'direct') {
            await listingBatch.listAll()
          } else if (batchType === 'auction') {
            await auctionBatch.listAll()
          }
          router.reload()
        }}
      >
        Submit Batch
      </Web3Button>
    )
  }

  return (
    <>
      {/* Manage and submit*/}
      <div className="flex gap-5 mt-5 items-center justify-center md:justify-start">
        <button
          onClick={() =>
            !batch || batch?.length <= 1
              ? toast('Add 2 or more listings to create a batch', {
                  icon: '✨',
                  style: toastStyle,
                  duration: 5000,
                })
              : setEnabled(!enabled)
          }
          className="bg-indigo-600 px-3 py-2.5 rounded-sm shadow shadow-white hover:scale-[1.03] transition-all duration-150 font-medium"
        >
          {!enabled ? 'Manage Batch' : 'Finish Managing'}
        </button>
        <CreateBatch />
      </div>
      {/*Manage batch*/}
      {enabled && batchType && (
        <div className="backdrop-blur-[50px] mt-6 flex flex-col justify-center items-center md:items-start z-[100]">
          <h6 className="text-lg">
            Type of Batch:{' '}
            <span className="text-xl uppercase tracking-widest text-moon-gold">
              {batchType}
            </span>
          </h6>
          <div className="mt-10 flex flex-col gap-10 md:grid md:grid-cols-2 md:grid-flow-row md:gap-12 xl:grid-cols-3 xl:gap-14">
            {batch &&
              batch.map((item: any, i: number) => (
                <div
                  key={'batch-listing-' + i}
                  className="hover:ring-1 ring-moon-gold bg-gradient-to-br from-indigo-900 via-black to-indigo-900 rounded-sm w-full h-[300px] px-3 pl-4 flex items-center relative"
                >
                  {/*Replace for IMAGE here, add 120px Width and Height, 'rounded-2xl' and 'object-cover' to the image*/}
                  {item && batchType ? (
                    <MediaRenderer
                      className="object-cover rounded-2xl"
                      src={
                        batchType === 'direct'
                          ? listingBatch.data.nfts?.[i]?.metadata?.image
                          : auctionBatch.data.nfts?.[i]?.metadata?.image
                      }
                      width={'200px'}
                    />
                  ) : (
                    <div className="h-[120px] w-[120px] bg-gradient-to-br from-slate-900 to-indigo-900 rounded-2xl"></div>
                  )}

                  <div className="ml-5 text-sm font-mono flex flex-col items-center gap-3 text-center px-1">
                    <p className="absolute z-50 left-2 top-2 text-lg tracking-widest font-extrabold px-1 py-1">
                      {'#' + Number(i + 1)}
                    </p>
                    <button
                      className="absolute top-4 right-4 text-gray-100 h-8 w-8 font-bold bg-red-600 rounded-full hover:scale-110 transition-all duration-150"
                      onClick={() =>
                        batchType === 'direct'
                          ? listingBatch.removeListing(i)
                          : auctionBatch.removeAuction(i)
                      }
                    >
                      ✖
                    </button>
                    <p className="uppercase">
                      {'Token ID'}
                      <span className="block truncate max-w-[110px] text-moon-gold font-bold">
                        {item.tokenId}
                      </span>
                    </p>

                    {/* quantity */}
                    <p className="uppercase">
                      {'Quantity'}
                      <span className="block truncate max-w-[110px] text-moon-gold font-bold">
                        {item.quantity}
                      </span>
                    </p>

                    {batchType === 'direct' ? (
                      <p className="uppercase">
                        {'Price Per NFT'}
                        <span className="block truncate max-w-[110px] text-moon-gold font-bold">
                          {item.pricePerToken}
                        </span>
                      </p>
                    ) : (
                      <p className="uppercase">
                        {'Reserve Price'}
                        <span className="block truncate max-w-[110px] text-moon-gold font-bold">
                          {item.buyoutBidAmount}
                        </span>
                      </p>
                    )}
                  </div>
                </div>
              ))}
          </div>
          <div className="mt-5 flex gap-3">
            <button
              className="px-3 py-1 bg-red-600 rounded-lg transition-all hover:scale-[1.03] duration-150"
              onClick={() => {
                setBatch(undefined)
                setBatchType(undefined)
                listingBatch.clearAll()
                auctionBatch.clearAll()
                setEnabled(false)
              }}
            >
              Clear All
            </button>
          </div>
        </div>
      )}
    </>
  )
}
