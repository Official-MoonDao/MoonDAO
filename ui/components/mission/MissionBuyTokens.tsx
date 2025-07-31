import { useState } from 'react'
import { useUniswapV4Router } from '@/lib/uniswap/hooks/useUniswapV4Router'
import StandardButton from '../layout/StandardButton'

export default function MissionBuyTokens({ token }: { token: any }) {
  const [amount, setAmount] = useState('')
  const { swapExactETHForTokens } = useUniswapV4Router()

  return (
    <div className="flex flex-col gap-2 p-4 bg-darkest-cool rounded-xl">
      <div className="flex items-center gap-2">
        <input
          className="flex-1 bg-transparent border p-2 rounded-md"
          placeholder="ETH amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
        />
        <span>ETH</span>
      </div>
      <StandardButton
        id="buy-mission-tokens"
        className="gradient-2 rounded-full"
        onClick={async () => {
          const num = parseFloat(amount) || 0
          if (num > 0) {
            await swapExactETHForTokens(num, token.tokenAddress)
          }
        }}
      >
        Buy Tokens
      </StandardButton>
    </div>
  )
}
