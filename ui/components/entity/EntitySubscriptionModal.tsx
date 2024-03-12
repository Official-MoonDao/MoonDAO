import { sub } from 'date-fns'
import { ethers } from 'ethers'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { useHandleRead } from '@/lib/thirdweb/hooks'

export function EntitySubscriptionModal({
  setEnabled,
  nft,
  entityContract,
  validPass,
  expiresAt,
}: any) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const [years, setYears] = useState<number>(0)
  const [subscriptionCost, setSubscriptionCost] = useState<string>()

  const { data: pricePerSecond } = useHandleRead(
    entityContract,
    'pricePerSecond'
  )

  //calc duration and sub cost
  useEffect(() => {
    if (years && years > 0) {
      console.log(years)
      const duration = years * 365 * 24 * 60 * 60
      setSubscriptionCost(
        pricePerSecond.mul(ethers.BigNumber.from(duration)).toString()
      )
      console.log(subscriptionCost)
    } else {
      setSubscriptionCost('0')
    }

    // console.log(expiresAt.toString(), duration)
  }, [years])

  return (
    <div
      onMouseDown={(e: any) => {
        if (e.target.id === 'entity-subscription-modal-backdrop')
          setEnabled(false)
      }}
      id="entity-subscription-modal-backdrop"
      className="fixed top-0 left-0 w-screen h-screen bg-[#00000080] backdrop-blur-sm flex justify-center items-center z-[1000]"
    >
      <div className="flex flex-col gap-2 items-start justify-start w-auto md:w-[500px] p-4 md:p-8 bg-[#080C20] rounded-md">
        <h1 className="text-2xl font-bold">Extend Subscription</h1>
        <div className="w-full flex flex-col gap-4">
          <div className="w-full flex gap-4">
            <p>
              {`Expiration Date: `}
              <span
                className={validPass ? 'text-moon-green' : 'text-moon-orange'}
              >
                {validPass
                  ? new Date(expiresAt?.toString() * 1000).toLocaleString()
                  : 'Expired'}
              </span>
            </p>
          </div>
          <p>
            Select the number of years you would like to extend your
            subscription for from now.
          </p>
          <input
            className="px-2 text-black w-[75px]"
            type="number"
            min={0}
            onChange={(e: any) => {
              setYears(parseInt(e.target.value))
            }}
          />
          <p>
            {`Subscription Cost: ${
              subscriptionCost
                ? ethers.utils.formatEther(subscriptionCost)
                : '0.00'
            } ETH`}
          </p>
          <button
            className="border-2 px-4 py-2"
            onClick={async () => {
              if (!years || !subscriptionCost) return

              setIsLoading(true)

              try {
                const duration = years * 365 * 24 * 60 * 60

                await entityContract.call(
                  'renewSubscription',
                  [nft.metadata.id, duration],
                  {
                    value: subscriptionCost.toString(),
                  }
                )
              } catch (err) {
                console.log(err)
              }

              setIsLoading(false)
              setEnabled(false)
              router.reload()
            }}
          >
            {isLoading ? 'Loading...' : 'Extend Subscription'}
          </button>
        </div>
      </div>
    </div>
  )
}
