import Image from 'next/image'
import { assetImageExtension } from '../../../../lib/dashboard/dashboard-utils.ts/asset-config'

type AssetProps = {
  name: string
  amount: string
  usd: string
  address?: string
  loading?: boolean
}

const Asset = ({ name, amount, usd, address, loading }: AssetProps) => {
  const assetLink = address ? `https://etherscan.io/address/${address}` : ''
  const image = assetImageExtension[name]
    ? `/coins/${name}.${assetImageExtension[name]}`
    : '/coins/DEFAULT.png'

  return (
    <div
      className={`bg-gradient-to-b from-slate-700/20 to-slate-800/30 backdrop-blur-xl border border-white/10 rounded-xl p-4 mt-4 flex items-center justify-between font-RobotoMono transition-all duration-300 hover:bg-gradient-to-b hover:from-slate-600/30 hover:to-slate-700/40 hover:shadow-lg ${
        loading && 'animate-pulse'
      }`}
    >
      <div className="flex items-center">
        {loading ? (
          <div className="h-8 w-8 bg-white/20 rounded-full"></div>
        ) : (
          <Image
            className="h-8 w-8"
            src={image}
            alt="Asset Logo."
            width={32}
            height={32}
          />
        )}
        <a
          href={assetLink}
          target="_blank"
          rel="noreferrer"
          className={`ml-3 tracking-wide text-blue-300 hover:text-blue-200 text-lg font-medium transition-colors ${
            loading && 'bg-white/20 text-transparent rounded'
          }`}
        >
          {name}
        </a>
      </div>

      <div className="text-right">
        <p
          className={`font-semibold text-lg ${
            loading ? 'bg-white/20 text-transparent rounded' : 'text-white'
          }`}
        >
          {amount}
        </p>
        <p
          className={`mt-1 text-white/70 text-sm ${
            loading && 'bg-white/20 text-transparent rounded'
          }`}
        >
          {name === 'MOONEY' || name === 'vMOONEY'
            ? 'Governance Token'
            : `$${usd}`}
        </p>
      </div>
    </div>
  )
}

export default Asset
