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

export default function SafeSendModal({ safeData, safeAddress, setEnabled }: SafeModalProps) {
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
          (b: SafeBalanceUsdResponse) => b.token?.symbol?.toLowerCase() === selectedToken
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
    <Modal id="safe-modal" setEnabled={setEnabled} title="Send Funds" size="lg">
      <div data-testid="safe-modal-content" className="space-y-6">
        <p className="text-gray-300 text-sm -mt-4">Safe Wallet</p>
        {isNetworkMismatch ? (
          <SafeNetworkMismatch />
        ) : (
          <>
            {/* Current Safe Info */}
            <div
              data-testid="safe-info"
              className="bg-black/20 border border-white/10 rounded-lg p-4"
            >
              <p className="text-gray-300 text-sm mb-2">Safe Address</p>
              <p data-testid="safe-address" className="text-white font-mono text-sm">
                <Link
                  className="hover:text-blue-400 transition-colors"
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
              {/* Token Selection */}
              <div className="space-y-2">
                <label className="text-gray-300 font-medium text-sm uppercase tracking-wide">
                  Token
                </label>
                <div className="flex flex-col gap-4">
                  <select
                    data-testid="token-select"
                    className="flex-1 bg-black/20 border border-white/10 rounded-lg p-3 text-white hover:bg-black/30 hover:border-white/20 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                    onChange={({ target }) => setSelectedToken(target.value)}
                    value={selectedToken}
                  >
                    {safeBalances?.map((balance: SafeBalanceUsdResponse) => (
                      <option
                        key={balance.tokenAddress || 'native'}
                        value={balance.token?.symbol?.toLowerCase() || 'native'}
                        className="bg-gray-900"
                      >
                        {balance.token?.symbol || 'ETH'}
                      </option>
                    ))}
                  </select>

                  {selectedToken === 'native' ? (
                    <SafeAsset
                      label={'ETH'}
                      balance={formatUnits(
                        safeBalances?.find((b: SafeBalanceUsdResponse) => !b.tokenAddress)
                          ?.balance || '0',
                        18
                      )}
                    />
                  ) : (
                    safeBalances?.map((balance: SafeBalanceUsdResponse) => {
                      if (balance.token?.symbol?.toLowerCase() === selectedToken) {
                        return (
                          <SafeAsset
                            key={balance.tokenAddress || 'native'}
                            label={balance.token?.symbol || 'ETH'}
                            balance={formatUnits(balance.balance, balance.token?.decimals || 18)}
                          />
                        )
                      }
                      return null
                    })
                  )}
                </div>
              </div>

              {/* Recipient Address */}
              <div className="space-y-2">
                <label className="text-gray-300 font-medium text-sm uppercase tracking-wide">
                  Recipient Address
                </label>
                <input
                  data-testid="recipient-address"
                  type="text"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  placeholder="0x..."
                  className="w-full bg-black/20 border border-white/10 rounded-lg p-4 text-white placeholder-gray-400 hover:bg-black/30 hover:border-white/20 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                />
              </div>

              {/* Amount */}
              <div className="space-y-2">
                <label className="text-gray-300 font-medium text-sm uppercase tracking-wide">
                  Amount
                </label>
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
                        ? safeBalances?.find((b: SafeBalanceUsdResponse) => !b.tokenAddress)
                        : safeBalances?.find(
                            (b: SafeBalanceUsdResponse) =>
                              b.token?.symbol?.toLowerCase() === selectedToken
                          )

                    const maxAmount = token?.balance
                      ? Number(formatUnits(token.balance, token.token?.decimals || 18))
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
                  placeholder="0.0"
                  className="w-full bg-black/20 border border-white/10 rounded-lg p-4 text-white placeholder-gray-400 hover:bg-black/30 hover:border-white/20 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                />
              </div>

              {/* Send Button */}
              <PrivyWeb3Button
                dataTestId="send-button"
                className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-700 text-white py-4 px-6 rounded-lg font-semibold transition-all duration-200 transform hover:scale-105 disabled:hover:scale-100 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                label="Send"
                type="button"
                action={handleSend}
                isDisabled={!isValid}
              />
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
