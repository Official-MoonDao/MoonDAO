import { useContractEvents } from '@thirdweb-dev/react'
import { SmartContract } from '@thirdweb-dev/sdk'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useCurrBlockNum } from '../../../lib/marketplace/marketplace-utils/hooks'

export const ETHERSCAN_URL: string = process.env.NEXT_PUBLIC_CHAIN
  ? 'https://polygonscan.com/' //Matic
  : 'https://mumbai.polygonscan.com/' //Mumbai

interface AssetHistoryProps {
  marketplace: SmartContract | undefined
  contract: any
  tokenId: string
}

export default function AssetHistory({ contract, tokenId }: AssetHistoryProps) {
  const currBlockNum: any = useCurrBlockNum()
  const [assetTransferEvents, setAssetTransferEvents] = useState<any[]>([])
  const { data: transferEvents, isLoading: loadingTransferEvents }: any =
    useContractEvents(contract, 'Transfer', {
      queryFilter: {
        filters: {
          tokenId: tokenId,
        },
        fromBlock: +currBlockNum - 19999,
        order: 'desc',
      },
    })

  //filter by token id (query filter doesn't always work)
  useEffect(() => {
    if (transferEvents) {
      setAssetTransferEvents(
        transferEvents.filter(
          (event: any) => event.data.tokenId.toString() === tokenId
        )
      )
    }
  }, [transferEvents])

  return (
    <>
      <h3 className="mt-8 mb-[15px] text-[23px] font-medium font-GoodTimes text-moon-gold">
        History
      </h3>
      <div className="flex flex-wrap gap-4 mt-3 bg-white bg-opacity-[0.13] border border-white border-opacity-20 max-h-[410px] overflow-y-scroll">
        {transferEvents &&
          assetTransferEvents[0] &&
          assetTransferEvents.map((event: any, index: number) => (
            <div
              key={event.transaction.transactionHash + index}
              className="flex justify-between items-center grow gap-1 py-2 px-3 min-w-[128px] rounded-2xl min-h-[32px]"
            >
              <div className="flex flex-col gap-1">
                <p className="m-0 text-white opacity-60">Event</p>
                {transferEvents && transferEvents[0] ? (
                  <p className="font-semibold m-0 text-white opacity-90">
                    {
                      // if last event in array, then it's a mint
                      'Transfer'
                    }
                  </p>
                ) : (
                  <p className="font-semibold m-0 text-white opacity-90">
                    {event.data}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-1">
                <p className="m-0 text-white opacity-60">From</p>
                <p className="font-semibold m-0 text-white opacity-90">
                  {event.data.from?.slice(0, 4)}...
                  {event.data.from?.slice(-2)}
                </p>
              </div>

              <div className="flex flex-col gap-1">
                <p className="m-0 text-white opacity-60">To</p>
                <p className="font-semibold m-0 text-white opacity-90">
                  {event.data.to?.slice(0, 4)}...
                  {event.data.to?.slice(-2)}
                </p>
              </div>

              <div className="flex flex-col gap-1">
                <Link
                  className="w-[34px] h-[34px] p-2 transition-all duration-150 hover:scale-[1.35]"
                  href={`${ETHERSCAN_URL}/tx/${event.transaction.transactionHash}`}
                  target="_blank"
                >
                  ↗
                </Link>
              </div>
            </div>
          ))}
      </div>
    </>
  )
}
