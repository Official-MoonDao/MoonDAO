import { assetImageExtension } from '@/lib/dashboard/dashboard-utils.ts/asset-config'
import Image from 'next/image'

function formatValueForDisplay(value: string | number): {
  full: string
  abbreviated: string
} {
  const numValue = typeof value === 'string' ? parseFloat(value.replace(/,/g, '')) : value

  if (isNaN(numValue)) {
    return { full: value.toString(), abbreviated: value.toString() }
  }

  const full = numValue.toLocaleString()

  // Create abbreviated version for very large numbers
  if (numValue >= 1000000) {
    const millions = numValue / 1000000
    const abbreviated = `${millions.toFixed(2)}M`
    return { full, abbreviated }
  } else if (numValue >= 1000) {
    const thousands = numValue / 1000
    const abbreviated = `${thousands.toFixed(1)} K`
    return { full, abbreviated }
  }

  return { full, abbreviated: full }
}

export type RewardAssetProps = {
  name: string
  value: string | number
  usdValue: string | number
  approximateUSD?: boolean
}

export default function RewardAsset({ name, value, usdValue, approximateUSD }: RewardAssetProps) {
  const image = assetImageExtension[name]
    ? `/coins/${name}.${assetImageExtension[name]}`
    : '/coins/DEFAULT.png'
  const usd = Number(usdValue)

  const formattedValue = formatValueForDisplay(value)

  return (
    <div className="flex gap-3 items-center">
      <Image
        className="scale-[0.55] filter drop-shadow-lg"
        src={image}
        alt={name}
        width={name === 'ETH' ? 42 : 50}
        height={name === 'ETH' ? 42 : 50}
      />
      <div className="flex flex-col min-w-0 flex-1">
        <div className="flex gap-2 font-GoodTimes text-lg text-white">
          <p className="text-white/80">{name}</p>
          {/* Show abbreviated on small screens, full on larger screens */}
          <p className="text-white font-bold whitespace-nowrap">
            <span className="sm:hidden">{formattedValue.abbreviated}</span>
            <span className="hidden sm:inline">{formattedValue.full}</span>
          </p>
        </div>
        {usd > 0 && (
          <p className="text-gray-400 text-xs">{`(${
            approximateUSD ? '~' : ''
          }$${usd.toLocaleString()})`}</p>
        )}
      </div>
    </div>
  )
}
