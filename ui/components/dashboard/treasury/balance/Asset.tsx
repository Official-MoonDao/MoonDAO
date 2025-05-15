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
      className={`inner-container-background font-RobotoMono mt-5 flex w-[336px] flex-col items-start p-1  sm:w-[400px] xl:mt-6 2xl:w-full 2xl:flex-row 2xl:justify-between 2xl:px-3 2xl:py-2 ${
        loading && 'loading-component'
      }`}
    >
      <div className="relative mt-1 flex items-center">
        {loading ? (
          <div className="loading-line h-8 w-8 rounded-full"></div>
        ) : (
          <Image
            className="h-auto w-7 2xl:w-8"
            src={image}
            alt="Asset Logo."
            width={100}
            height={100}
          />
        )}
        <a
          href={assetLink}
          target="_blank"
          rel="noreferrer"
          className={`ml-3 tracking-wide text-moon-orange 2xl:ml-4 text-xl ${
            loading && 'loading-line'
          }`}
        >
          {name}
        </a>
      </div>

      <div className="mt-3 text-center 2xl:mt-0 2xl:text-right">
        <p
          className={`font-semibold text-2xl ${
            loading ? 'loading-line' : 'text-gray-900 dark:text-white'
          }`}
        >
          {amount}
        </p>
        <p
          className={`mt-2 text-gray-900 dark:text-white opacity-60 xl:mt-3 ${
            loading && 'loading-line'
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
