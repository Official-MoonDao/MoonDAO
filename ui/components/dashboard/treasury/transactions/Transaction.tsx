import { ExclamationCircleIcon } from '@heroicons/react/24/outline'
import Image from 'next/image'
import { allowedAssets } from '../../../../lib/dashboard/dashboard-utils.ts/asset-config'
import { assetImageExtension } from '../../../../lib/dashboard/dashboard-utils.ts/asset-config'
import { getHumanTime } from '../../../../lib/dashboard/dashboard-utils.ts/getHumanTime'
import { ArrowDown, ArrowUp, GoldPaperArrow } from '../../../assets'

const MULTISIG_ADDRESS = '0xce4a1E86a5c47CD677338f53DA22A91d85cab2c9'

const Transaction = ({ data, loading }: any) => {
  const transactionLink = `https://etherscan.io/tx/${data.hash}`
  const timeStr = getHumanTime(
    (Math.floor(Date.now() / 1000) - data.timeStamp) * 1000
  )
  const token = data.value / 10 ** data.tokenDecimal
  const sent = data.from == MULTISIG_ADDRESS.toLocaleLowerCase()
  const value = `${token
    .toFixed(0)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',')} ${data.tokenSymbol}`

  const name = data.tokenSymbol
  const image = assetImageExtension[name]
    ? `/coins/${name}.${assetImageExtension[name]}`
    : '/coins/DEFAULT.png'

  return (
    <article className="relative w-full font-RobotoMono">
      {/*Warning circle*/}
      <div
        className={`${
          !loading && !Object.keys(allowedAssets).includes(data.tokenSymbol)
            ? 'absolute top-3 right-3 text-red-400 z-50'
            : 'hidden'
        }`}
      >
        <ExclamationCircleIcon className="h-5 w-5" />
      </div>
      {/*Main container*/}
      <div
        className={`${
          !loading && !Object.keys(allowedAssets).includes(data.tokenSymbol)
            ? 'opacity-60 bg-red-500/10 border-red-500/20'
            : 'bg-white/5 border-white/10 hover:bg-white/10 hover:shadow-lg'
        } backdrop-blur-md border rounded-xl p-4 mt-4 flex items-center transition-all duration-300 ${
          loading && 'animate-pulse'
        }`}
      >
        {/*Logo*/}
        {loading ? (
          <div className="h-12 w-12 bg-white/20 rounded-full"></div>
        ) : (
          <Image
            className="h-12 w-12 rounded-full"
            src={image}
            height={48}
            width={48}
            alt="Asset Logo."
          />
        )}

        {/*All the information */}
        <div className="ml-4 flex-1">
          {/*Sent or receive*/}
          <div className="flex items-center">
            <span className={`${loading && 'bg-white/20 rounded'}`}>
              {loading ? <div className="w-4 h-4 bg-white/20 rounded"></div> : sent ? <ArrowUp /> : <ArrowDown />}
            </span>
            <p
              className={`ml-2 text-base font-medium ${
                loading ? 'bg-white/20 text-transparent rounded' : sent ? 'text-red-300' : 'text-green-300'
              }`}
            >
              {sent ? 'Sent' : 'Received'}
            </p>
          </div>
          {/*Amount & asset name*/}
          <p
            className={`mt-2 font-bold text-lg text-white truncate ${
              loading && 'bg-white/20 text-transparent rounded'
            }`}
          >
            {value.length > 20 ? value.slice(0, 20) + '...' : value}
          </p>
          {/*Date and Etherscan Link*/}
          <div className="mt-1 flex items-center text-sm">
            <p
              className={`text-white/70 ${
                loading && 'bg-white/20 text-transparent rounded'
              }`}
            >
              {timeStr} ago
            </p>
            {!loading &&
              Object.keys(allowedAssets).includes(data.tokenSymbol) && (
                <a
                  aria-label="Link to transaction information on Etherscan"
                  className="ml-2 text-blue-300 hover:text-blue-200 transition-colors"
                  href={transactionLink}
                  target="_blank"
                  rel="noreferrer"
                >
                  <GoldPaperArrow loading={loading} />
                </a>
              )}
          </div>
        </div>
      </div>
    </article>
  )
}

export default Transaction
