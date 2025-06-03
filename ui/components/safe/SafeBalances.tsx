import { COIN_ICONS } from 'const/icons'
import Image from 'next/image'
import { formatUnits } from 'ethers/lib/utils'

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
        <p className="pl-6 font-GoodTimes">{balance}</p>
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
