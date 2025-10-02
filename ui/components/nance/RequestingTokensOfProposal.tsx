import { BanknotesIcon } from '@heroicons/react/24/outline'
import { Action, RequestBudget } from '@nance/nance-sdk'
import { formatNumberUSStyle } from '@/lib/nance'
import { TokenSymbol } from './TokenSymbol'

export default function RequestingTokensOfProposal({
  actions,
}: {
  actions: Action[]
}) {
  const transferMap: { [key: string]: number } = {}
  actions
    ?.filter((action) => action.type === 'Request Budget')
    .flatMap((action) => (action.payload as RequestBudget).budget)
    .forEach(
      (transfer) =>
        (transferMap[transfer.token] =
          (transferMap[transfer.token] || 0) + Number(transfer.amount))
    )

  if (Object.entries(transferMap).length === 0) return null

  return (
    <div className="flex items-center gap-x-1">
      <BanknotesIcon className="h-6 w-6 flex-none rounded-full text-gray-900 dark:text-white" />
      <div>
        <p className="text-gray-500 dark:text-gray-400">Requesting</p>
        <div className="text-center">
          <TokensOfProposal actions={actions} />
        </div>
      </div>
    </div>
  )
}

export function TokensOfProposal({ actions }: { actions: Action[] }) {
  // we only parse RequestBudget action here
  const transferMap: { [key: string]: number } = {}
  actions
    ?.filter((action) => action.type === 'Request Budget')
    .flatMap((action) => (action.payload as RequestBudget).budget)
    .forEach(
      (transfer) =>
        (transferMap[transfer.token] =
          (transferMap[transfer.token] || 0) + Number(transfer.amount))
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
