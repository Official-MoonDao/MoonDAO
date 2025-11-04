import { COIN_ICONS } from 'const/icons'
import Image from 'next/image'
import { formatUnits } from 'ethers/lib/utils'

// Helper function to format balance with max 5 decimals, removing trailing zeros
function formatBalance(balance: string): string {
  const num = parseFloat(balance)
  if (isNaN(num)) return balance

  // Format to 5 decimals max, then remove trailing zeros
  const formatted = num.toFixed(5)
  // Remove trailing zeros but keep at least one digit after decimal if there are any
  return formatted.replace(/\.?0+$/, '') || '0'
}

export function SafeAsset({
  label,
  balance,
}: {
  label: string
  balance: string
}) {
  return (
    <div className="flex gap-4 items-center text-lg justify-between">
      <Image
        src={COIN_ICONS[label as keyof typeof COIN_ICONS] || '/coins/ETH.svg'}
        alt={label}
        width={20}
        height={20}
      />
      <div className="flex gap-2 w-full">
        <p className="pl-6 font-GoodTimes">{formatBalance(balance)}</p>
        <p className="font-GoodTimes">{`${label}`}</p>
      </div>
    </div>
  )
}

export default function SafeBalances({
  safeBalances,
  isLoading,
}: {
  safeBalances: any
  isLoading: boolean
}) {
  return (
    <div className="w-fit p-4 flex flex-col gap-4">
      {isLoading ? (
        <div>Loading balances...</div>
      ) : (
        safeBalances?.map((balance: any) => (
          <SafeAsset
            key={balance.tokenAddress || 'native'}
            label={balance.token?.symbol || 'ETH'}
            balance={formatUnits(
              balance.balance,
              balance.token?.decimals || 18
            )}
          />
        ))
      )}
    </div>
  )
}
