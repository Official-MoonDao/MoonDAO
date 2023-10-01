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
      className={`component-background mt-5 flex w-[336px] flex-col items-center rounded border-[0.5px] border-detail-light py-1 shadow shadow-detail-light dark:border-detail-dark dark:shadow-detail-dark sm:w-[400px] xl:mt-6 2xl:w-full 2xl:flex-row 2xl:justify-between 2xl:px-3 2xl:py-2  ${
        loading && 'loading-component'
      }`}
    >
      <div className="relative mt-1 flex items-center">
        {loading ? (
          <div className="loading-line h-8 w-8 rounded-full"></div>
        ) : (
          <img className="h-auto w-7 2xl:w-8" src={image} alt="Asset Logo." />
        )}
        <a
          href={assetLink}
          className={`ml-3 font-Montserrat text-lg font-semibold tracking-wide text-stronger-light hover:text-title-light hover:dark:text-stronger-dark dark:text-moon-gold 2xl:ml-4 2xl:text-xl ${
            loading && 'loading-line'
          }`}
        >
          {name}
        </a>
      </div>

      <div className="mt-3 text-center 2xl:mt-0 2xl:text-right">
        <p
          className={`text-xl font-semibold md:text-2xl ${
            loading ? 'loading-line' : 'text-light-text dark:text-dark-text'
          }`}
        >
          {amount}
        </p>
        <p
          className={`mt-2 text-stronger-light dark:text-moon-gold opacity-90 xl:mt-3 ${
            loading && 'loading-line'
          }`}
        >
          {name === 'MOONEY' ? 'Governance Token' : `$${usd}`}
        </p>
      </div>
    </div>
  )
}

export default Asset
