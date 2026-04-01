import { BanknotesIcon } from '@heroicons/react/24/outline'
import { formatNumberUSStyle } from '@/lib/nance'
import { TokenSymbol } from './TokenSymbol'

export default function RequestingTokensOfProposal({
  budget,
  variant = 'default',
}: {
  budget: any[]
  /** Dashboard feed cards: left-aligned, no icon — matches title/description indent. */
  variant?: 'default' | 'feed'
}) {
  if (variant === 'feed') {
    return (
      <div className="text-left">
        <p className="text-gray-500 dark:text-gray-400 text-sm">Requesting</p>
        <div className="text-sm text-gray-300 text-left">
          <TokensOfProposal budget={budget} />
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-x-1">
      <BanknotesIcon className="h-6 w-6 flex-none rounded-full text-gray-900 dark:text-white" />
      <div>
        <p className="text-gray-500 dark:text-gray-400">Requesting</p>
        <div className="text-center">
          <TokensOfProposal budget={budget} />
        </div>
      </div>
    </div>
  )
}

export function TokensOfProposal({ budget }: { budget: any[] }) {
  const transferMap: { [key: string]: number } = {}
  budget.forEach(
    (transfer) =>
      (transferMap[transfer.token] = (transferMap[transfer.token] || 0) + Number(transfer.amount))
  )

  if (Object.entries(transferMap).length === 0) return null

  const tokens: (JSX.Element | string)[] = []
  Object.entries(transferMap).forEach((val) => {
    const [contractOrSymbol, amount] = val
    if (tokens.length > 0) tokens.push(' + ')
    tokens.push(
      <span key={'proposal-token-' + contractOrSymbol}>
        {formatNumberUSStyle(amount)}{' '}
        {contractOrSymbol.startsWith('0x') ? (
          <TokenSymbol address={contractOrSymbol} />
        ) : (
          contractOrSymbol.toUpperCase()
        )}
      </span>
    )
  })

  return <>{tokens}</>
}
