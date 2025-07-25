import { ArrowDownIcon } from '@heroicons/react/24/outline'
import { Token, TradeType } from '@uniswap/sdk-core'
import { nativeOnChain, SwapRoute } from '@uniswap/smart-order-router'
import { CHAIN_TOKEN_NAMES, DAI_ADDRESSES } from 'const/config'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { useActiveAccount } from 'thirdweb/react'
import { useUniversalRouter } from '../../lib/uniswap/hooks/useUniversalRouter'
import { ethereum } from '@/lib/infura/infuraChains'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { useNativeBalance } from '@/lib/thirdweb/hooks/useNativeBalance'
import { pregenSwapRoute } from '@/lib/uniswap/pregenSwapRoute'
import GasIcon from '../assets/GasIcon'
import { PrivyWeb3Button } from '../privy/PrivyWeb3Button'

export default function NativeToMissionToken({
  selectedChain,
  tokenAddress,
  tokenSymbol,
  tokenImage = '/Original.png',
  tokenDecimals = 18,
}: any) {
  const chainSlug = getChainSlug(selectedChain)
  const nativeBalance = useNativeBalance()
  const account = useActiveAccount()
  const address = account?.address

  const [amount, setAmount] = useState<string>('')
  const [output, setOutput] = useState<number>()
  const [swapRoute, setSwapRoute] = useState<SwapRoute>()
  const [isGeneratingRoute, setIsGeneratingRoute] = useState(false)
  const [estimatedGasUsedUSD, setEstimatedGasUsedUSD] = useState<any>(0)
  const [usdCost, setUSDCost] = useState<string>()

  const outputToken = new Token(selectedChain.id, tokenAddress, tokenDecimals)

  const { generateRoute, executeRoute } = useUniversalRouter(
    parseFloat(amount) || 0,
    nativeOnChain(selectedChain.id),
    outputToken
  )

  useEffect(() => {
    const numAmount = parseFloat(amount) || 0
    if (numAmount > 0) {
      setIsGeneratingRoute(true)
      generateRoute(TradeType.EXACT_INPUT).then((route) => {
        setSwapRoute(route)
        setOutput(route?.route[0].rawQuote.toString() / 10 ** tokenDecimals || 0)
        const estimatedGasUSD = route?.estimatedGasUsedUSD.toFixed(2)
        if (estimatedGasUSD < 0.01) setEstimatedGasUsedUSD('<0.01')
        else setEstimatedGasUsedUSD(estimatedGasUSD || 0)
        setIsGeneratingRoute(false)
      })
    }
  }, [amount, selectedChain, address])

  useEffect(() => {
    async function getUSDCost() {
      try {
        const numAmount = parseFloat(amount) || 0
        let route
        if (chainSlug === 'polygon') {
          route = await pregenSwapRoute(
            selectedChain,
            numAmount,
            nativeOnChain(selectedChain.id),
            new Token(selectedChain.id, DAI_ADDRESSES[chainSlug], 18)
          )
        } else {
          route = await pregenSwapRoute(
            ethereum,
            numAmount,
            nativeOnChain(ethereum.id),
            new Token(ethereum.id, DAI_ADDRESSES['ethereum'], 18)
          )
        }
        const cost = route.route[0].rawQuote.toString() / 10 ** 18
        if (cost < 0.01) setUSDCost('<0.01')
        else if (cost < 1) setUSDCost(cost.toFixed(2))
        else setUSDCost(String(Math.ceil(cost)))
      } catch (err) {
        console.log(err)
        setUSDCost('0')
      }
    }
    const numAmount = parseFloat(amount) || 0
    if (numAmount > 0) {
      getUSDCost()
    }
  }, [amount, selectedChain, chainSlug])

  return (
    <div className="w-full max-w-2xl mt-6 px-4">
      <div className="text-sm font-RobotoMono rounded-2xl animate-fadeIn p-4 md:p-6 flex flex-col bg-gradient-to-br from-gray-900 via-blue-900/30 to-purple-900/20 backdrop-blur-xl border border-white/10 shadow-2xl text-white">
        <div className="mb-6">
          <h3 className="font-semibold text-xl text-white">Swap Tokens</h3>
          <p className="text-gray-300 text-sm">Get {tokenSymbol} on {selectedChain.name}</p>
        </div>
        <div className="space-y-4 mb-6">
          <div className="bg-black/20 rounded-2xl p-4 border border-white/5 hover:bg-black/30 hover:border-white/10 transition-all duration-200">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
                  <Image
                    src={`/icons/networks/${getChainSlug(selectedChain)}.svg`}
                    width={24}
                    height={24}
                    alt=""
                    className="object-contain"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement
                      const parent = target.parentElement
                      if (parent) {
                        parent.innerHTML = `<div class="text-white text-sm font-bold">${selectedChain.name?.charAt(0) || '?'}</div>`
                      }
                    }}
                  />
                </div>
                <div>
                  <p className="text-gray-400 text-xs font-medium uppercase tracking-wide">You Pay</p>
                  <p className="font-medium text-white text-base">{CHAIN_TOKEN_NAMES[selectedChain?.slug]}</p>
                </div>
              </div>
              <div className="text-right">
                {address && (
                  <p className="text-gray-400 text-xs">Balance: {Number(nativeBalance).toFixed(4)}</p>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between mb-2">
              <input
                className="text-white bg-transparent text-2xl lg:text-3xl font-RobotoMono placeholder-gray-500 focus:outline-none flex-1"
                placeholder="0.0"
                pattern="[0-9]*[.,]?[0-9]*"
                value={amount}
                onChange={({ target }) => {
                  let value = target.value.replace(/[^0-9.]/g, '')
                  if (parseFloat(value) < 0) {
                    value = '0'
                  }
                  const parts = value.split('.')
                  if (parts.length <= 2) {
                    setAmount(value)
                  }
                }}
              />
              {parseFloat(amount) > 0 && (
                <button
                  className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors px-3 py-1 bg-blue-400/10 hover:bg-blue-400/20 rounded-lg border border-blue-400/20"
                  onClick={() => setAmount(nativeBalance)}
                >
                  MAX
                </button>
              )}
            </div>
            <div className="mt-2">
              {usdCost && <p className="text-gray-400 text-sm">{`≈ $${usdCost.toLocaleString()} USD`}</p>}
            </div>
          </div>
          <div className="w-full flex justify-center">
            <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full shadow-lg transform hover:scale-110 transition-transform duration-200 cursor-pointer">
              <ArrowDownIcon width={14} height={14} className="text-white" />
            </div>
          </div>
          <div className="bg-black/20 rounded-2xl p-4 border border-white/5 hover:bg-black/30 hover:border-white/10 transition-all duration-200">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-full overflow-hidden bg-white/5 p-1">
                  <Image src={tokenImage} width={24} height={24} alt="" className="rounded-full" />
                </div>
                <div>
                  <p className="text-gray-400 text-xs font-medium uppercase tracking-wide">You Receive</p>
                  <p className="font-medium text-white text-base">{tokenSymbol}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-white text-2xl lg:text-3xl font-RobotoMono">
                {isGeneratingRoute ? <span className="text-gray-400 text-lg">Calculating...</span> : output?.toLocaleString() || '0.0'}
              </p>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-6">
          {(parseFloat(amount) > 0 || swapRoute) && (
            <div className="lg:col-span-2 space-y-3">
              <h4 className="text-gray-300 font-medium text-xs uppercase tracking-wide">Details</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-black/10 rounded-xl p-3 border border-white/5 hover:bg-black/20 transition-colors duration-200">
                  <div className="flex items-center justify-between">
                    <p className="text-gray-400 text-xs">Gas</p>
                    <div className="flex gap-1 items-center">
                      <GasIcon />
                      <p className="text-white text-xs font-medium">{`$${estimatedGasUsedUSD}`}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-black/10 rounded-xl p-3 border border-white/5 hover:bg-black/20 transition-colors duration-200">
                  <div className="flex items-center justify-between">
                    <p className="text-gray-400 text-xs">Impact</p>
                    <p className={`text-xs font-medium ${swapRoute && swapRoute.trade.priceImpact.toFixed(2) > '5' ? 'text-red-400' : 'text-orange-400'}`}>{swapRoute ? `${swapRoute.trade.priceImpact.toFixed(2)}%` : '0%'}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          <div className="flex flex-col justify-end">
            <PrivyWeb3Button
              v5
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white py-3 px-4 rounded-xl text-sm font-medium transition-all duration-200 transform hover:scale-[1.02] shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:from-gray-500 disabled:to-gray-600"
              label={
                isGeneratingRoute
                  ? 'Finding Route...'
                  : !amount || parseFloat(amount) === 0
                  ? 'Enter Amount'
                  : !swapRoute
                  ? 'No Route Available'
                  : 'Swap'
              }
              action={async () => {
                const numAmount = parseFloat(amount) || 0
                if (numAmount === 0) return toast.error('Enter an amount.')
                if (!swapRoute) return toast.error('No route found.')
                if (numAmount > +nativeBalance) {
                  return toast.error('Insufficient balance.')
                }
                await executeRoute(swapRoute)
              }}
              isDisabled={isGeneratingRoute || !amount || parseFloat(amount) === 0 || !swapRoute}
            />
            <div className="text-center mt-3">
              <p className="text-gray-400 text-xs">Powered by Uniswap</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
