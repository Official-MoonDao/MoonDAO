import { useWallets } from '@privy-io/react-auth'
import { ethers } from 'ethers'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import { useContext } from 'react'
import toast from 'react-hot-toast'
import { useActiveAccount } from 'thirdweb/react'
import { getChainSlug } from '@/lib/thirdweb/chain'
import ChainContextV5 from '@/lib/thirdweb/chain-context-v5'
import { useUniswapV4 } from '@/lib/uniswap/hooks/useUniswapV4'
import { PrivyWeb3Button } from '../privy/PrivyWeb3Button'

export default function MissionTokenSwapV4({ token }: { token: any }) {
  const { selectedChain } = useContext(ChainContextV5)
  const chainSlug = getChainSlug(selectedChain)
  const account = useActiveAccount()
  const address = account?.address
  const { wallets } = useWallets()
  //console.log('token', token)

  const [amountIn, setAmountIn] = useState('')
  const [amountOut, setAmountOut] = useState<string>()
  const { quote, swap } = useUniswapV4(token.tokenAddress, token.tokenDecimals)

  useEffect(() => {
    async function fetchQuote() {
      if (!amountIn) return
      try {
        const out = await quote(amountIn)
        setAmountOut(out)
      } catch (err) {
        console.error(err)
        setAmountOut(undefined)
      }
    }
    fetchQuote()
  }, [amountIn, quote])

  return (
    <div className="w-full max-w-md space-y-4">
      <div className="flex items-center justify-between bg-black/20 p-4 rounded-xl">
        <div className="flex items-center gap-2">
          <Image src="/icons/eth.svg" alt="ETH" width={24} height={24} />
          <span>ETH</span>
        </div>
        <input
          className="bg-transparent text-right flex-1 focus:outline-none"
          placeholder="0.0"
          value={amountIn}
          onChange={(e) => setAmountIn(e.target.value)}
        />
      </div>
      <div className="flex items-center justify-center">
        <Image src="/icons/down.svg" alt="" width={16} height={16} />
      </div>
      <div className="flex items-center justify-between bg-black/20 p-4 rounded-xl">
        <div className="flex items-center gap-2">
          <Image
            src="/Original.png"
            alt={token.tokenSymbol}
            width={24}
            height={24}
          />
          <span>{token.tokenSymbol}</span>
        </div>
        <span>{parseFloat(amountOut).toPrecision(3) || '0.0'}</span>
      </div>
      <PrivyWeb3Button
        className="w-full bg-moon-indigo rounded-xl py-2 text-white"
        label="Swap"
        action={async () => {
          if (!amountIn) return toast.error('Enter amount')
          try {
            await swap(amountIn, '0')
            toast.success('Swap submitted')
          } catch (err) {
            console.error(err)
            toast.error('Swap failed')
          }
        }}
      />
    </div>
  )
}
