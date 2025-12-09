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

export function SafeAsset({ label, balance }: { label: string; balance: string }) {
  // Format large numbers with commas
  const formattedBalance = formatBalance(balance)
  const numBalance = parseFloat(formattedBalance)
  const displayBalance = numBalance.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 5,
  })

  return (
    <div className="flex items-center justify-between p-4 bg-slate-600/20 rounded-xl hover:bg-slate-600/30 transition-colors">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-slate-700/50 flex items-center justify-center">
          <Image
            src={COIN_ICONS[label as keyof typeof COIN_ICONS] || '/coins/ETH.svg'}
            alt={label}
            width={24}
            height={24}
          />
        </div>
        <div>
          <p className="font-GoodTimes text-white text-sm">{label}</p>
          <p className="text-xs text-slate-400">Available Balance</p>
        </div>
      </div>
      <div className="text-right">
        <p className="font-GoodTimes text-white text-lg">{displayBalance}</p>
        <p className="text-xs text-slate-400">{label}</p>
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
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-4 bg-slate-600/20 rounded-xl animate-pulse h-20" />
        ))}
      </div>
    )
  }

  if (!safeBalances || !Array.isArray(safeBalances) || safeBalances.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400">
        <p>No balances found</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {safeBalances.map((balance: any) => (
        <SafeAsset
          key={balance.tokenAddress || 'native'}
          label={balance.token?.symbol || 'ETH'}
          balance={formatUnits(balance.balance, balance.token?.decimals || 18)}
        />
      ))}
    </div>
  )
}
