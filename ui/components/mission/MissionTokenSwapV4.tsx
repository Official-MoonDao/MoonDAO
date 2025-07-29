import { useEffect, useState } from 'react'
import { ethers } from 'ethers'
import { useUniswapV4 } from '@/lib/uniswap/hooks/useUniswapV4'
import { useNativeBalance } from '@/lib/thirdweb/hooks/useNativeBalance'
import { getChainSlug } from '@/lib/thirdweb/chain'
import { useContext } from 'react'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import { SwapExactInSingle } from '@uniswap/v4-sdk'
import { UNISWAP_V4_QUOTER_ADDRESSES } from '@/const/config'

export default function MissionTokenSwapV4({ token }: { token: any }) {
  const { selectedChain } = useContext(ChainContextV5)
  const chainSlug = getChainSlug(selectedChain)
  const nativeBalance = useNativeBalance()

  const poolKey = {
    currency0: ethers.constants.AddressZero,
    currency1: token.tokenAddress,
    fee: 500,
    tickSpacing: 10,
    hooks: ethers.constants.AddressZero,
  }

  const { getQuote, executeSwap } = useUniswapV4(poolKey)

  const [amountIn, setAmountIn] = useState('')
  const [quote, setQuote] = useState<string>('0')

  useEffect(() => {
    async function fetchQuote() {
      if (!amountIn) return setQuote('0')
      try {
        const amt = ethers.utils.parseEther(amountIn).toString()
        const result = await getQuote(amt)
        setQuote(ethers.utils.formatUnits(result, token.decimals))
      } catch (err) {
        setQuote('0')
      }
    }
    fetchQuote()
  }, [amountIn, token.tokenAddress, chainSlug])

  async function handleSwap() {
    const amt = ethers.utils.parseEther(amountIn).toString()
    const config: SwapExactInSingle = {
      poolKey,
      zeroForOne: true,
      amountIn: amt,
      amountOutMinimum: '0',
      hookData: '0x00',
    }
    await executeSwap(config)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-between items-center">
        <input
          className="bg-transparent border px-3 py-2 rounded-md"
          placeholder="Amount ETH"
          value={amountIn}
          onChange={(e) => setAmountIn(e.target.value)}
        />
        <span className="text-sm text-gray-400 ml-2">Balance: {Number(nativeBalance).toFixed(4)}</span>
      </div>
      <div>
        <p className="text-sm text-gray-400">You receive: {quote} {token.tokenSymbol}</p>
      </div>
      <button
        className="px-4 py-2 rounded-md bg-blue-600 text-white"
        onClick={handleSwap}
        disabled={!amountIn}
      >
        Buy with Uniswap v4
      </button>
    </div>
  )
}
