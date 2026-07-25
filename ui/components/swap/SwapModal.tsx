import { ArrowsUpDownIcon, ChevronDownIcon } from '@heroicons/react/24/outline'
import Image from 'next/image'
import { useContext, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { useActiveAccount } from 'thirdweb/react'
import { LoadingSpinner } from '@/components/layout/LoadingSpinner'
import Modal from '@/components/layout/Modal'
import { usePrivySwap } from '@/lib/privy/hooks/usePrivySwap'
import {
  ARBITRUM_CHAIN_ID,
  baseUnitsToHumanAmount,
  DEFAULT_SLIPPAGE_BPS,
  getDefaultSwapTokens,
  getSwapToken,
  SwapTokenConfig,
  SwapTokenKey,
} from '@/lib/privy/swapTokens'
import { arbitrum } from '@/lib/rpc/chains'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'

type SwapModalProps = {
  enabled: boolean
  setEnabled: (enabled: boolean) => void
  onSuccess?: () => void
}

function TokenButton({
  token,
  onClick,
}: {
  token: SwapTokenConfig
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 rounded-lg bg-white/10 hover:bg-white/20 px-3 py-2 transition-colors"
    >
      <Image
        src={token.icon}
        width={20}
        height={20}
        alt={token.symbol}
        className="rounded-full object-contain"
      />
      <span className="text-white text-sm font-semibold">{token.symbol}</span>
      <ChevronDownIcon className="w-4 h-4 text-gray-400" />
    </button>
  )
}

export default function SwapModal({ enabled, setEnabled, onSuccess }: SwapModalProps) {
  const account = useActiveAccount()
  const address = account?.address
  const { selectedChain, setSelectedChain }: any = useContext(ChainContextV5)
  const isArbitrum = selectedChain?.id === ARBITRUM_CHAIN_ID

  const tokens = useMemo(() => getDefaultSwapTokens(), [])

  const [fromKey, setFromKey] = useState<SwapTokenKey>('ETH')
  const [toKey, setToKey] = useState<SwapTokenKey>('USDC')
  const [amount, setAmount] = useState('')
  const [slippageBps, setSlippageBps] = useState(DEFAULT_SLIPPAGE_BPS)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [pickerOpen, setPickerOpen] = useState<null | 'from' | 'to'>(null)

  const { phase, quote, error, failureReason, fetchQuote, executeSwap, reset } =
    usePrivySwap()

  const fromToken = getSwapToken(fromKey)
  const toToken = getSwapToken(toKey)

  // Surface server/Privy errors as toasts (matching app conventions) without
  // losing the inline state shown in the modal.
  useEffect(() => {
    if ((phase === 'error' || phase === 'rejected' || phase === 'failed') && error) {
      toast.error(error)
    }
  }, [phase, error])

  useEffect(() => {
    if (phase === 'succeeded') {
      toast.success('Swap complete!')
      onSuccess?.()
    }
  }, [phase, onSuccess])

  const handleClose = () => {
    reset()
    setAmount('')
    setEnabled(false)
  }

  const swapDirection = () => {
    setFromKey(toKey)
    setToKey(fromKey)
    if (phase !== 'idle') reset()
  }

  const selectToken = (side: 'from' | 'to', key: SwapTokenKey) => {
    if (side === 'from') {
      if (key === toKey) setToKey(fromKey)
      setFromKey(key)
    } else {
      if (key === fromKey) setFromKey(toKey)
      setToKey(key)
    }
    setPickerOpen(null)
    if (phase !== 'idle') reset()
  }

  const handleReview = async () => {
    if (!address) {
      toast.error('No wallet selected.')
      return
    }
    if (!amount || Number(amount) <= 0) {
      toast.error('Enter an amount to swap.')
      return
    }
    await fetchQuote({
      address,
      fromToken: fromKey,
      toToken: toKey,
      amount,
      chainId: ARBITRUM_CHAIN_ID,
    })
  }

  const handleConfirm = async () => {
    if (!address) return
    await executeSwap({
      address,
      fromToken: fromKey,
      toToken: toKey,
      amount,
      chainId: ARBITRUM_CHAIN_ID,
      slippageBps,
    })
  }

  const estOutputDisplay =
    quote?.estOutputAmount != null
      ? baseUnitsToHumanAmount(quote.estOutputAmount, toToken.decimals, 6)
      : null
  const minOutputDisplay =
    quote?.minimumOutputAmount != null
      ? baseUnitsToHumanAmount(quote.minimumOutputAmount, toToken.decimals, 6)
      : null

  const isBusy = phase === 'quoting' || phase === 'executing' || phase === 'pending'

  if (!enabled) return null

  return (
    <Modal
      id="swap-modal"
      setEnabled={handleClose}
      className="fixed top-0 left-0 w-screen h-screen bg-[#00000080] backdrop-blur-sm flex flex-col justify-start items-center z-[9999] overflow-y-auto bg-gradient-to-t from-[#3F3FA690] via-[#00000080] to-transparent animate-fadeIn py-6 px-4"
      showCloseButton={false}
    >
      <div className="my-auto w-full max-w-md">
        <div className="bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl text-white overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-white/10">
            <h2 className="text-lg font-semibold">Swap tokens</h2>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-white transition-colors text-sm"
            >
              Close
            </button>
          </div>

          {/* Arbitrum guard */}
          {!isArbitrum ? (
            <div className="p-6 space-y-4">
              <p className="text-gray-300 text-sm">
                Swaps are currently supported on Arbitrum only.
              </p>
              <button
                onClick={() => setSelectedChain(arbitrum)}
                className="w-full py-2.5 rounded-lg bg-blue-600/30 hover:bg-blue-600/50 text-blue-200 text-sm font-medium transition-all"
              >
                Switch to Arbitrum
              </button>
            </div>
          ) : phase === 'succeeded' ? (
            <div className="p-6 text-center space-y-3">
              <div className="mx-auto w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
              </div>
              <p className="text-white font-semibold">Swap complete</p>
              <p className="text-gray-400 text-xs">
                Balances may take a moment to update.
              </p>
              <button
                onClick={handleClose}
                className="w-full py-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-all"
              >
                Done
              </button>
            </div>
          ) : phase === 'failed' || phase === 'rejected' ? (
            <div className="p-6 text-center space-y-3">
              <div className="mx-auto w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </div>
              <p className="text-white font-semibold">
                {phase === 'rejected' ? 'Swap rejected' : 'Swap failed'}
              </p>
              <p className="text-gray-400 text-xs break-words">
                {failureReason || error || 'Please try again.'}
              </p>
              <button
                onClick={reset}
                className="w-full py-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-all"
              >
                Try again
              </button>
            </div>
          ) : (
            <div className="p-5 space-y-3">
              {/* From */}
              <div className="bg-black/30 rounded-xl p-4 border border-white/5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-400">From</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0.0"
                    value={amount}
                    disabled={isBusy}
                    onChange={(e) => {
                      const v = e.target.value
                      if (v === '' || /^\d*\.?\d*$/.test(v)) {
                        setAmount(v)
                        if (phase === 'quoted' || phase === 'error') reset()
                      }
                    }}
                    className="bg-transparent text-2xl font-semibold text-white outline-none w-full min-w-0"
                  />
                  <div className="relative flex-shrink-0">
                    <TokenButton
                      token={fromToken}
                      onClick={() => setPickerOpen(pickerOpen === 'from' ? null : 'from')}
                    />
                    {pickerOpen === 'from' && (
                      <div className="absolute right-0 top-full mt-2 w-40 bg-gray-900 border border-white/20 rounded-lg shadow-2xl z-50 overflow-hidden">
                        {tokens.map((t) => (
                          <button
                            key={t.key}
                            type="button"
                            onClick={() => selectToken('from', t.key)}
                            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/10 text-left text-sm text-white"
                          >
                            <Image src={t.icon} width={18} height={18} alt={t.symbol} className="rounded-full object-contain" />
                            {t.symbol}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Direction toggle */}
              <div className="flex justify-center -my-1">
                <button
                  type="button"
                  onClick={swapDirection}
                  disabled={isBusy}
                  className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 flex items-center justify-center transition-colors disabled:opacity-50"
                  aria-label="Swap direction"
                >
                  <ArrowsUpDownIcon className="w-4 h-4 text-blue-300" />
                </button>
              </div>

              {/* To */}
              <div className="bg-black/30 rounded-xl p-4 border border-white/5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-400">To (estimated)</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-2xl font-semibold text-white truncate">
                    {estOutputDisplay ?? '0.0'}
                  </span>
                  <div className="relative flex-shrink-0">
                    <TokenButton
                      token={toToken}
                      onClick={() => setPickerOpen(pickerOpen === 'to' ? null : 'to')}
                    />
                    {pickerOpen === 'to' && (
                      <div className="absolute right-0 top-full mt-2 w-40 bg-gray-900 border border-white/20 rounded-lg shadow-2xl z-50 overflow-hidden">
                        {tokens.map((t) => (
                          <button
                            key={t.key}
                            type="button"
                            onClick={() => selectToken('to', t.key)}
                            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/10 text-left text-sm text-white"
                          >
                            <Image src={t.icon} width={18} height={18} alt={t.symbol} className="rounded-full object-contain" />
                            {t.symbol}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Quote details */}
              {phase === 'quoted' && quote && (
                <div className="bg-black/20 rounded-lg p-3 border border-white/5 space-y-1.5 text-xs">
                  <div className="flex justify-between text-gray-400">
                    <span>Minimum received</span>
                    <span className="text-white">
                      {minOutputDisplay ?? '—'} {toToken.symbol}
                    </span>
                  </div>
                  <div className="flex justify-between text-gray-400">
                    <span>Slippage</span>
                    <span className="text-white">{(slippageBps / 100).toFixed(2)}%</span>
                  </div>
                  {quote.gasEstimate && (
                    <div className="flex justify-between text-gray-400">
                      <span>Gas</span>
                      <span className="text-white">Sponsored by MoonDAO</span>
                    </div>
                  )}
                </div>
              )}

              {/* Advanced slippage */}
              <button
                type="button"
                onClick={() => setShowAdvanced((s) => !s)}
                className="text-xs text-gray-400 hover:text-white transition-colors"
              >
                {showAdvanced ? 'Hide' : 'Advanced'} settings
              </button>
              {showAdvanced && (
                <div className="bg-black/20 rounded-lg p-3 border border-white/5">
                  <label className="block text-xs text-gray-400 mb-1">
                    Slippage tolerance (bps)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={10000}
                    value={slippageBps}
                    disabled={isBusy}
                    onChange={(e) => {
                      const v = Math.round(Number(e.target.value))
                      if (!Number.isNaN(v)) setSlippageBps(Math.min(10000, Math.max(0, v)))
                    }}
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none"
                  />
                </div>
              )}

              {/* Inline error */}
              {phase === 'error' && error && (
                <p className="text-red-400 text-xs">{error}</p>
              )}

              {/* Primary action */}
              {phase === 'quoted' ? (
                <button
                  onClick={handleConfirm}
                  disabled={isBusy}
                  className="w-full py-3 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-sm transition-all flex items-center justify-center gap-2"
                >
                  Confirm swap
                </button>
              ) : (
                <button
                  onClick={handleReview}
                  disabled={isBusy || !amount}
                  className="w-full py-3 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-sm transition-all flex items-center justify-center gap-2"
                >
                  {phase === 'quoting' ? (
                    <>
                      <LoadingSpinner width="w-4" height="h-4" />
                      Getting quote…
                    </>
                  ) : (
                    'Review swap'
                  )}
                </button>
              )}

              {phase === 'executing' || phase === 'pending' ? (
                <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
                  <LoadingSpinner width="w-4" height="h-4" />
                  {phase === 'executing' ? 'Submitting swap…' : 'Waiting for confirmation…'}
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
