import { DEFAULT_CHAIN_V5 } from 'const/config'
import { ethers } from 'ethers'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useCallback, useState } from 'react'
import toast from 'react-hot-toast'
import { prepareContractCall, sendAndConfirmTransaction } from 'thirdweb'
import { eth_getBalance, getRpcClient } from 'thirdweb/rpc'
import { useActiveAccount } from 'thirdweb/react'
import useETHPrice from '@/lib/etherscan/useETHPrice'
import { useGasPrice } from '@/lib/rpc/useGasPrice'
import {
  SECONDS_PER_YEAR,
  buildRenewSubscriptionCall,
} from '@/lib/subscription/renewSubscription'
import client from '@/lib/thirdweb/client'
import useRead from '@/lib/thirdweb/hooks/useRead'
import Input from '../layout/Input'
import { LoadingSpinner } from '../layout/LoadingSpinner'
import Modal from '../layout/Modal'
import { FundOnrampModal } from '../onramp/FundOnrampModal'
import { PrivyWeb3Button } from '../privy/PrivyWeb3Button'

// Generous upper bound for the renew call's gas; on Arbitrum this is a
// fraction of a cent, so over-reserving is cheaper than a failed tx.
const RENEW_GAS_LIMIT = BigInt(500000)

/**
 * Round up to 4 decimals and drop trailing zeros (0.0110999 -> 0.0111), so the
 * displayed price is never below what's actually charged.
 */
function formatEthCeil(eth: number): string {
  if (!Number.isFinite(eth) || eth <= 0) return '0'
  return (Math.ceil(eth * 1e4) / 1e4).toFixed(4).replace(/\.?0+$/, '')
}

function isInsufficientFundsError(err: any) {
  return /insufficient funds/i.test(err?.message ?? String(err))
}

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
  const [onrampModalOpen, setOnrampModalOpen] = useState(false)
  const [requiredEthAmount, setRequiredEthAmount] = useState(0)

  const { data: subscriptionCost, isLoading: isLoadingSubscriptionCost } = useRead({
    contract: subscriptionContract,
    method: 'getRenewalPrice',
    params: [address, (Number.isFinite(years) && years >= 1 ? years : 1) * SECONDS_PER_YEAR],
    deps: [years, address],
  })

  const { effectiveGasPrice } = useGasPrice(DEFAULT_CHAIN_V5)

  const costEth =
    subscriptionCost != null ? Number(ethers.utils.formatEther(subscriptionCost)) : 0
  const { data: costUsd } = useETHPrice(costEth, 'ETH_TO_USD')

  // Renewal is paid on Arbitrum only, so check the Arbitrum balance directly
  // rather than whatever chain the wallet happens to be on.
  const getShortfallWei = useCallback(async () => {
    if (!address || subscriptionCost == null) return BigInt(0)
    const balance = await eth_getBalance(getRpcClient({ client, chain: DEFAULT_CHAIN_V5 }), {
      address,
    })
    const needed = BigInt(subscriptionCost) + (effectiveGasPrice ?? BigInt(0)) * RENEW_GAS_LIMIT
    return needed > balance ? needed - balance : BigInt(0)
  }, [address, subscriptionCost, effectiveGasPrice])

  const openOnramp = useCallback((shortfallWei: bigint) => {
    setRequiredEthAmount((Number(shortfallWei) / 1e18) * 1.15)
    setOnrampModalOpen(true)
  }, [])

  async function extendSubscription() {
    setIsLoading(true)

    try {
      if (!account) throw new Error('No account found')

      const shortfall = await getShortfallWei()
      if (shortfall > BigInt(0)) {
        openOnramp(shortfall)
        setIsLoading(false)
        return
      }

      const call = buildRenewSubscriptionCall({
        type: type === 'team' ? 'team' : 'citizen',
        address,
        tokenId: nft?.metadata?.id ?? nft?.id,
        years,
        cost: subscriptionCost,
      })

      const transaction = prepareContractCall({
        contract: subscriptionContract,
        method: call.method as string,
        params: call.params,
        value: call.value,
      })
      await sendAndConfirmTransaction({
        transaction,
        account,
      })
      setEnabled(false)
      router.reload()
    } catch (err: any) {
      console.error(err)
      if (isInsufficientFundsError(err)) {
        // Our estimate was short (e.g. a gas spike) — fall back to the
        // funding flow instead of surfacing the raw RPC error.
        const shortfall = await getShortfallWei().catch(() => BigInt(0))
        openOnramp(shortfall > BigInt(0) ? shortfall : BigInt(subscriptionCost ?? 0) / BigInt(10))
      } else {
        toast.error(err?.message || 'Failed to extend subscription. Please try again.')
      }
    }
    setIsLoading(false)
  }

  return (
    <Modal id="subscription-modal" setEnabled={setEnabled} title="Extend Subscription" size="2xl">
      <div data-testid="subscription-modal-content">
        {/* Current Subscription Info */}
        <div data-testid="subscription-info" className="mb-8">
          <p data-testid="expiration-date" className="text-gray-400 mb-2">
            {'Expiration Date: '}
            <span className="text-moon-orange">
              {validPass ? new Date(expiresAt?.toString() * 1000).toLocaleString() : 'Expired'}
            </span>
          </p>
        </div>

        {/* Subscription Extension */}
        <div data-testid="extension-section" className="mb-8">
          <h3 data-testid="extension-title" className="text-xl font-GoodTimes mb-4">
            Extension Details
          </h3>
          <p className="text-gray-300 mb-4">
            Select the number of years you would like to extend your subscription for from now.
          </p>

          <div className="space-y-6">
            <div data-testid="years-input-section" className="bg-darkest-cool p-4 rounded-lg">
              <label
                data-testid="years-label"
                className="block text-sm font-medium text-gray-300 mb-2"
              >
                Years to Extend
              </label>
              <Input
                data-testid="years-input"
                type="number"
                variant="dark"
                className="w-full"
                min={1}
                onChange={(e: any) => {
                  setYears(parseInt(e.target.value))
                }}
                value={years}
                formatNumbers={false}
              />
            </div>

            <div data-testid="cost-section" className="bg-darkest-cool p-4 rounded-lg">
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
                    {subscriptionCost != null ? formatEthCeil(costEth) : '0.00'} ETH
                    {costUsd > 0 && (
                      <span className="text-gray-400 font-normal">
                        {' '}
                        (~${costUsd.toFixed(2)})
                      </span>
                    )}
                  </span>
                )}
              </p>
              <p className="text-xs text-gray-400 mt-2">
                Paid in ETH on Arbitrum. Have ETH on Ethereum mainnet?{' '}
                <Link href="/bridge" className="text-moon-orange hover:underline">
                  Bridge it to Arbitrum
                </Link>
                .
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
              isDisabled={isLoading}
              actionDisabled={
                isLoadingSubscriptionCost ||
                subscriptionCost === undefined ||
                !years ||
                years < 1
              }
            />
          </div>
        </div>
      </div>
      {address && (
        <FundOnrampModal
          enabled={onrampModalOpen}
          setEnabled={setOnrampModalOpen}
          address={address}
          selectedChain={DEFAULT_CHAIN_V5}
          ethAmount={requiredEthAmount}
          context={type === 'team' ? 'team-renewal' : 'citizen-renewal'}
          onExit={() => setIsLoading(false)}
          checkBalanceSufficient={async () => (await getShortfallWei()) === BigInt(0)}
          onBalanceSufficient={() => {
            setOnrampModalOpen(false)
            extendSubscription()
          }}
        />
      )}
    </Modal>
  )
}
