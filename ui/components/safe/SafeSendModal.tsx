import { XMarkIcon } from '@heroicons/react/20/solid'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { useSafeBalances } from '@/lib/nance/SafeHooks'
import { SafeData } from '@/lib/safe/useSafe'
import useNetworkMismatch from '@/lib/thirdweb/hooks/useNetworkMismatch'
import { formatUnits } from 'ethers/lib/utils'
import Modal from '../layout/Modal'
import { PrivyWeb3Button } from '../privy/PrivyWeb3Button'
import { SafeAsset } from './SafeBalances'
import SafeNetworkMismatch from './SafeNetworkMismatch'

type SafeModalProps = {
  safeData: SafeData
  safeAddress: string
  setEnabled: (enabled: boolean) => void
}

type SafeBalanceUsdResponse = {
  tokenAddress: string | null
  token: {
    symbol: string
    decimals: number
  } | null
  balance: string
}

type SafeModalTabType = 'signers' | 'transactions' | 'send'

export default function SafeSendModal({
  safeData,
  safeAddress,
  setEnabled,
}: SafeModalProps) {
  const [tab, setTab] = useState<SafeModalTabType>('send')
  const [amount, setAmount] = useState('')
  const [to, setTo] = useState('')
  const [selectedToken, setSelectedToken] = useState<string>('native')
  const [isValid, setIsValid] = useState(false)
  const isNetworkMismatch = useNetworkMismatch()

  const { data: safeBalances, isLoading } = useSafeBalances(
    safeAddress,
    !!safeAddress,
    process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? 'arbitrum' : 'sepolia'
  )

  useEffect(() => {
    setAmount('')
  }, [selectedToken])

  useEffect(() => {
    // Validate inputs
    const isAddressValid = to.length === 42 && to.startsWith('0x')
    const isAmountValid = Number(amount) > 0
    setIsValid(isAddressValid && isAmountValid)
  }, [to, amount])

  const handleSend = async () => {
    if (!to || !amount) {
      return toast.error('Please fill in all fields.')
    } else if (to.length !== 42 || !to.startsWith('0x')) {
      return toast.error('Invalid address.')
    } else if (Number(amount) <= 0) {
      return toast.error('Invalid amount.')
    }

    try {
      if (selectedToken === 'native') {
        await safeData.sendFunds(to, (Number(amount) * 1e18).toString())
      } else {
        const token = safeBalances?.find(
          (b: SafeBalanceUsdResponse) =>
            b.token?.symbol?.toLowerCase() === selectedToken
        )
        if (!token) {
          return toast.error('Token not found.')
        }
        await safeData.sendFunds(
          to,
          (Number(amount) * 10 ** (token?.token?.decimals || 18)).toString(),
          token?.tokenAddress || ''
        )
      }
      setTo('')
      setAmount('')
      setEnabled(false)
    } catch (error: any) {
      console.error(error?.message)
      if (error?.message?.startsWith('Insufficient')) {
        toast.error('Insufficient balance.')
      }
    }
  }

  return (
    <Modal id="safe-modal" setEnabled={setEnabled}>
      <div
        data-testid="safe-modal-content"
        className="bg-dark-cool rounded-[2vmax] p-8 max-w-2xl min-w-[350px] w-full relative md:min-w-[600px]"
      >
        <div
          data-testid="safe-modal-header"
          className="w-full flex items-center justify-between"
        >
          <h1
            data-testid="safe-modal-title"
            className="text-2xl font-GoodTimes"
          >
            Safe
          </h1>
          <button
            data-testid="safe-modal-close"
            id="close-modal"
            type="button"
            className="flex h-10 w-10 border-2 items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
            onClick={() => setEnabled(false)}
          >
            <XMarkIcon className="h-6 w-6 text-white" aria-hidden="true" />
          </button>
        </div>

        {isNetworkMismatch ? (
          <SafeNetworkMismatch />
        ) : (
          <div>
            {/* Current Safe Info */}
            <div data-testid="safe-info" className="mb-4">
              <p data-testid="safe-address" className="text-gray-400 mb-2">
                {'Address: '}
                <Link
                  className="hover:underline"
                  href={`https://app.safe.global/home?safe=${
                    process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? 'arb1' : 'sep'
                  }:${safeAddress}`}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  {safeAddress.slice(0, 6)}...{safeAddress.slice(-4)}
                </Link>
              </p>
            </div>

            <div className="flex flex-col gap-4" data-testid="safe-send-form">
              <div className="flex gap-4 items-center">
                <select
                  data-testid="token-select"
                  className="max-w-[200px] p-2 border-2 dark:border-0 dark:bg-[#0f152f] rounded-sm"
                  onChange={({ target }) => setSelectedToken(target.value)}
                  value={selectedToken}
                >
                  {safeBalances?.map((balance: SafeBalanceUsdResponse) => (
                    <option
                      key={balance.tokenAddress || 'native'}
                      value={balance.token?.symbol?.toLowerCase() || 'native'}
                    >
                      {balance.token?.symbol || 'ETH'}
                    </option>
                  ))}
                </select>

                {selectedToken === 'native' ? (
                  <SafeAsset
                    label={'ETH'}
                    balance={formatUnits(
                      safeBalances?.find(
                        (b: SafeBalanceUsdResponse) => !b.tokenAddress
                      )?.balance || '0',
                      18
                    )}
                  />
                ) : (
                  safeBalances?.map((balance: SafeBalanceUsdResponse) => {
                    if (
                      balance.token?.symbol?.toLowerCase() === selectedToken
                    ) {
                      return (
                        <SafeAsset
                          key={balance.tokenAddress || 'native'}
                          label={balance.token?.symbol || 'ETH'}
                          balance={formatUnits(
                            balance.balance,
                            balance.token?.decimals || 18
                          )}
                        />
                      )
                    }
                    return null
                  })
                )}
              </div>

              <input
                data-testid="recipient-address"
                type="text"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="To address"
                className="flex-1 bg-darkest-cool text-white px-4 py-2 rounded-lg"
              />
              <input
                data-testid="amount-input"
                type="text"
                value={amount}
                onChange={({ target }) => {
                  const value = target.value

                  // Allow empty input for backspacing
                  if (value === '') {
                    setAmount('')
                    return
                  }

                  // Only allow numbers and decimal point
                  if (!/^\d*\.?\d*$/.test(value)) {
                    return
                  }

                  const token =
                    selectedToken === 'native'
                      ? safeBalances?.find(
                          (b: SafeBalanceUsdResponse) => !b.tokenAddress
                        )
                      : safeBalances?.find(
                          (b: SafeBalanceUsdResponse) =>
                            b.token?.symbol?.toLowerCase() === selectedToken
                        )

                  const maxAmount = token?.balance
                    ? Number(
                        formatUnits(token.balance, token.token?.decimals || 18)
                      )
                    : 0

                  // If there's no balance (maxAmount is 0), allow any amount
                  if (maxAmount === 0) {
                    setAmount(value)
                    return
                  }

                  // Otherwise, validate against maxAmount
                  if (Number(value) <= maxAmount) {
                    setAmount(value)
                  } else {
                    setAmount(maxAmount.toString())
                  }
                }}
                placeholder="Amount"
                className="flex-1 bg-darkest-cool text-white px-4 py-2 rounded-lg"
              />
              <PrivyWeb3Button
                dataTestId="send-button"
                className="w-full rounded-full"
                label="Send"
                type="button"
                action={handleSend}
                isDisabled={!isValid}
              />
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
