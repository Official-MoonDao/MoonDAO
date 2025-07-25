import { useState } from 'react'
import { useV4Router } from '@/lib/uniswap/hooks/useV4Router'
import { PrivyWeb3Button } from '../privy/PrivyWeb3Button'

export default function MissionTokenPoolBuy({ tokenAddress }: { tokenAddress: string }) {
  const [amount, setAmount] = useState('')
  const { swap } = useV4Router(parseFloat(amount) || 0, tokenAddress)

  return (
    <div className="w-full max-w-md p-4 rounded-xl bg-black/20 border border-white/10">
      <h3 className="text-white mb-2">Buy from Pool</h3>
      <input
        className="w-full p-2 mb-4 rounded bg-black text-white"
        placeholder="Amount ETH"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      <PrivyWeb3Button
        label="Swap"
        className="w-full bg-blue-600 text-white py-2 rounded"
        action={swap}
        isDisabled={!amount || parseFloat(amount) <= 0}
      />
    </div>
  )
}
