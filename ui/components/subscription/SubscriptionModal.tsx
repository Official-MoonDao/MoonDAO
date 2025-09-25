import { XMarkIcon } from '@heroicons/react/24/outline'
import { DEFAULT_CHAIN_V5 } from 'const/config'
import { ethers } from 'ethers'
import { useRouter } from 'next/router'
import { useState } from 'react'
import { prepareContractCall, sendAndConfirmTransaction } from 'thirdweb'
import { useActiveAccount } from 'thirdweb/react'
import useRead from '@/lib/thirdweb/hooks/useRead'
import { LoadingSpinner } from '../layout/LoadingSpinner'
import Modal from '../layout/Modal'
import { PrivyWeb3Button } from '../privy/PrivyWeb3Button'

export function SubscriptionModal({
  selectedChain,
  setEnabled,
  nft,
  subscriptionContract,
  validPass,
  expiresAt,
  type = 'citizen',
}: any) {
  const router = useRouter()
  const account = useActiveAccount()
  const address = account?.address
  const [isLoading, setIsLoading] = useState(false)
  const [years, setYears] = useState<number>(1)

  const { data: subscriptionCost, isLoading: isLoadingSubscriptionCost } =
    useRead({
      contract: subscriptionContract,
      method: 'getRenewalPrice',
      params: [address, years * 365 * 24 * 60 * 60],
      deps: [years, address],
    })

  async function extendSubscription() {
    if (!years || subscriptionCost === undefined) return

    setIsLoading(true)

    try {
      if (!account) throw new Error('No account found')

      const duration = years * 365 * 24 * 60 * 60

      let receipt
      if (type === 'team') {
        const transaction = prepareContractCall({
          contract: subscriptionContract,
          method: 'renewSubscription',
          params: [address, nft.metadata.id, duration],
          options: {
            value: subscriptionCost.toString(),
          },
        } as any)
        receipt = await sendAndConfirmTransaction({
          transaction,
          account,
        })
      } else {
        const transaction = prepareContractCall({
          contract: subscriptionContract,
          method: 'renewSubscription',
          params: [nft.metadata.id, duration],
          options: {
            value: subscriptionCost.toString(),
          },
        } as any)
        receipt = await sendAndConfirmTransaction({
          transaction,
          account,
        })
      }
      setEnabled(false)
      router.reload()
    } catch (err) {
      console.log(err)
    }
    setIsLoading(false)
  }

  return (
    <Modal id="subscription-modal" setEnabled={setEnabled}>
      <div
        data-testid="subscription-modal-content"
        className="bg-dark-cool rounded-[2vmax] p-8 max-w-2xl min-w-[350px] w-full relative md:min-w-[600px]"
      >
        <div
          data-testid="subscription-modal-header"
          className="w-full flex items-center justify-between"
        >
          <h1
            data-testid="subscription-modal-title"
            className="text-2xl font-GoodTimes"
          >
            Extend Subscription
          </h1>
          <button
            data-testid="subscription-modal-close"
            id="close-modal"
            type="button"
            className="flex h-10 w-10 border-2 items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
            onClick={() => setEnabled(false)}
          >
            <XMarkIcon className="h-6 w-6 text-white" aria-hidden="true" />
          </button>
        </div>

        {/* Current Subscription Info */}
        <div data-testid="subscription-info" className="mb-8">
          <p data-testid="expiration-date" className="text-gray-400 mb-2">
            {'Expiration Date: '}
            <span className="text-moon-orange">
              {validPass
                ? new Date(expiresAt?.toString() * 1000).toLocaleString()
                : 'Expired'}
            </span>
          </p>
        </div>

        {/* Subscription Extension */}
        <div data-testid="extension-section" className="mb-8">
          <h3
            data-testid="extension-title"
            className="text-xl font-GoodTimes mb-4"
          >
            Extension Details
          </h3>
          <p className="text-gray-300 mb-4">
            Select the number of years you would like to extend your
            subscription for from now.
          </p>

          <div className="space-y-6">
            <div
              data-testid="years-input-section"
              className="bg-darkest-cool p-4 rounded-lg"
            >
              <label
                data-testid="years-label"
                className="block text-sm font-medium text-gray-300 mb-2"
              >
                Years to Extend
              </label>
              <input
                data-testid="years-input"
                className="w-full bg-dark-cool text-white px-4 py-2 rounded-lg border border-gray-600 focus:border-moon-orange focus:outline-none"
                type="number"
                min={1}
                onChange={(e: any) => {
                  setYears(parseInt(e.target.value))
                }}
                value={years}
              />
            </div>

            <div
              data-testid="cost-section"
              className="bg-darkest-cool p-4 rounded-lg"
            >
              <p
                data-testid="subscription-cost"
                className="text-gray-300 flex items-center space-x-2 gap-2"
              >
                {`Subscription Cost: `}
                {isLoadingSubscriptionCost ? (
                  <div className="flex items-center justify-center space-x-2">
                    <LoadingSpinner width="w-4" height="h-4" />
                  </div>
                ) : (
                  <span className="text-white font-medium">
                    {subscriptionCost
                      ? ethers.utils.formatEther(subscriptionCost)
                      : '0.00'}{' '}
                    ETH
                  </span>
                )}
              </p>
            </div>

            <PrivyWeb3Button
              dataTestId="extend-subscription-button"
              requiredChain={DEFAULT_CHAIN_V5}
              label="Extend Subscription"
              action={async () => {
                await extendSubscription()
              }}
              className="w-full rounded-full"
              isDisabled={isLoading || !years || years < 1}
            />
          </div>
        </div>
      </div>
    </Modal>
  )
}
