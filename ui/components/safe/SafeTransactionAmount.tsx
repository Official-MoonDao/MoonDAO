import ERC20ABI from 'const/abis/ERC20.json'
import { DEFAULT_CHAIN_V5 } from 'const/defaultChain'
import { useRef } from 'react'
import {
  getTransactionDisplayValue,
  isTokenTransfer,
  resolveTokenHint,
  SafeTxLike,
  TokenBalanceHint,
} from '@/lib/safe/safeTransactionActions'
import useContract from '@/lib/thirdweb/hooks/useContract'
import useRead from '@/lib/thirdweb/hooks/useRead'

type SafeTransactionAmountProps = {
  transaction: SafeTxLike & { safeTxHash?: string }
  tokenBalances?: TokenBalanceHint[] | null
}

function useErc20Meta(address: string | undefined, enabled: boolean) {
  const tokenContract = useContract({
    address: enabled && address ? address : '',
    chain: DEFAULT_CHAIN_V5,
    abi: ERC20ABI,
  })
  const { data: symbol, isLoading: symbolLoading } = useRead({
    contract: enabled ? tokenContract : undefined,
    method: 'symbol',
    params: [],
  })
  const { data: decimals, isLoading: decimalsLoading } = useRead({
    contract: enabled ? tokenContract : undefined,
    method: 'decimals',
    params: [],
  })

  // useRead starts with isLoading=false, then flips true once the contract
  // exists. Only treat a missing result as "read finished" after that flip,
  // so we never flash an 18-decimal guess for a 6-decimal token.
  const sawLoading = useRef(false)
  if (symbolLoading || decimalsLoading) sawLoading.current = true
  const settled = sawLoading.current && !symbolLoading && !decimalsLoading

  return {
    symbol: typeof symbol === 'string' && symbol ? symbol : undefined,
    decimals: decimals != null ? Number(decimals) : undefined,
    settled,
  }
}

export default function SafeTransactionAmount({
  transaction,
  tokenBalances,
}: SafeTransactionAmountProps) {
  const tokenTransfer = isTokenTransfer(transaction)
  const hint = resolveTokenHint(transaction, tokenBalances)
  const chain = useErc20Meta(transaction.to, tokenTransfer && !hint)

  const decimals = hint?.decimals ?? chain.decimals ?? (chain.settled ? 18 : undefined)
  const symbol = hint?.symbol || chain.symbol || (chain.settled ? 'tokens' : undefined)
  const display = getTransactionDisplayValue(
    transaction,
    decimals != null ? { decimals, symbol } : undefined
  )

  if (!display) {
    if (!tokenTransfer || hint || chain.settled) return null
    return (
      <div className="flex items-center justify-between gap-4 text-sm">
        <span className="text-slate-500 shrink-0">Amount</span>
        <span className="text-slate-500" aria-hidden="true">
          …
        </span>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-slate-500 shrink-0">{tokenTransfer ? 'Amount' : 'Value'}</span>
      <span
        data-testid={
          transaction.safeTxHash
            ? `transaction-value-${transaction.safeTxHash}`
            : 'transaction-value'
        }
        className="font-semibold text-white"
      >
        {display.amount} {display.symbol}
      </span>
    </div>
  )
}
