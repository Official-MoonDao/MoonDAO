import { XMarkIcon } from '@heroicons/react/24/outline'
import { useAddress } from '@thirdweb-dev/react'
import { DEFAULT_CHAIN, TEAM_ADDRESSES } from 'const/config'
import { ethers } from 'ethers'
import { useRouter } from 'next/router'
import { useState } from 'react'
import { useHandleRead } from '@/lib/thirdweb/hooks'
import Modal from '../layout/Modal'
import { PrivyWeb3Button } from '../privy/PrivyWeb3Button'

export function SubscriptionModal({
  selectedChain,
  setEnabled,
  nft,
  subscriptionContract,
  validPass,
  expiresAt,
}: any) {
  const router = useRouter()
  const address = useAddress()
  const [isLoading, setIsLoading] = useState(false)

  const [years, setYears] = useState<number>(1)

  const { data: subscriptionCost } = useHandleRead(
    subscriptionContract,
    'getRenewalPrice',
    [address, years * 365 * 24 * 60 * 60]
  )

  return (
    <Modal id="subscription-modal" setEnabled={setEnabled}>
      <div className="w-full rounded-[2vmax] flex flex-col gap-2 items-start justify-start w-auto md:w-[500px] p-5 bg-gradient-to-b from-dark-cool to-darkest-cool h-screen md:h-auto">
        <div className="w-full flex items-center justify-between">
          <h2 className="font-GoodTimes">Extend Subscription</h2>
          <button
            type="button"
            className="flex h-10 w-10 border-2 items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
            onClick={() => setEnabled(false)}
          >
            <XMarkIcon className="h-6 w-6 text-white" aria-hidden="true" />
          </button>
        </div>
        <form
          className="w-full flex flex-col gap-4"
          onSubmit={async (e) => {
            e.preventDefault()

            if (!years || !subscriptionCost) return

            setIsLoading(true)

            try {
              const duration = years * 365 * 24 * 60 * 60
              const contractAddress = subscriptionContract.getAddress()

              if (contractAddress === TEAM_ADDRESSES[selectedChain.slug]) {
                await subscriptionContract.call(
                  'renewSubscription',
                  [address, nft.metadata.id, duration],
                  {
                    value: subscriptionCost.toString(),
                  }
                )
              } else {
                await subscriptionContract.call(
                  'renewSubscription',
                  [nft.metadata.id, duration],
                  {
                    value: subscriptionCost.toString(),
                  }
                )
              }
              setEnabled(false)
              router.reload()
            } catch (err) {
              console.log(err)
            }
            setIsLoading(false)
          }}
        >
          <div className="w-full flex gap-4">
            <p>
              {`Expiration Date: `}
              <span className={'text-moon-orange'}>
                {validPass
                  ? new Date(expiresAt?.toString() * 1000).toLocaleString()
                  : 'Expired'}
              </span>
            </p>
          </div>
          <p className="opacity-75">
            Select the number of years you would like to extend your
            subscription for from now.
          </p>
          <input
            className="w-[100px] p-2 border-2 dark:border-0 dark:bg-[#0f152f] rounded-sm"
            type="number"
            min={0}
            onChange={(e: any) => {
              setYears(parseInt(e.target.value))
            }}
            value={years}
          />
          <p>
            {`Subscription Cost: ${
              subscriptionCost
                ? ethers.utils.formatEther(subscriptionCost)
                : '0.00'
            } ETH`}
          </p>
          <PrivyWeb3Button
            requiredChain={DEFAULT_CHAIN}
            label="Extend Subscription"
            type="submit"
            action={() => {}}
            className="w-full gradient-2 rounded-[5vmax]"
            isDisabled={isLoading}
          />
        </form>
      </div>
    </Modal>
  )
}
