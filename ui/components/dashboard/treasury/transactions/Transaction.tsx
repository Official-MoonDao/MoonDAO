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
    <article className="relative w-[336px] sm:w-[400px] xl:w-full font-RobotoMono">
      {/*Warning circle*/}
      <div
        className={`${
          !loading && !Object.keys(allowedAssets).includes(data.tokenSymbol)
            ? 'absolute top-1 right-3 text-red-300 opacity-50 z-50'
            : 'hidden'
        }`}
      >
        <ExclamationCircleIcon className="h-8 w-8" />
      </div>
      {/*Main container*/}
      <div
        className={`${
          !loading && !Object.keys(allowedAssets).includes(data.tokenSymbol)
            ? 'opacity-80 bg-gray-200 dark:bg-slate-800'
            : 'hover:scale-105'
        } inner-container-background relative mt-5 flex items-center w-[336px] sm:w-[400px] xl:w-full py-[10px] px-3 ${
          loading && 'loading-component'
        } transition-all duration-150`}
      >
        {/*Logo*/}
        <Image
          className="h-[60px] w-[60px] "
          src={image}
          height={60}
          width={60}
          alt="Asset Logo."
        />

        {/*All the information */}
        <div className="ml-5 2xl:ml-7 flex flex-col">
          {/*Sent or receive*/}
          <div className="relative right-3 flex items-center">
            <span className={`${loading && 'loading-line'}`}>
              {loading ? '' : sent ? <ArrowUp /> : <ArrowDown />}
            </span>
            <p
              className={`text ml-3 text-xl text-moon-orange ${
                loading && 'loading-line'
              }`}
            >
              {sent ? 'Sent' : 'Received'}
            </p>
          </div>
          {/*Amount & asset name*/}
          <p
            className={`mt-2 block truncate font-bold tracking-wide title-text-colors text-xl xl:text-2xl hover:overflow-hidden hover:whitespace-nowrap hover:overflow-ellipsis`}
          >
            <span className={`${loading && 'loading-line'}`}>
              {value.length > 16 ? value.slice(0, 16) + '...' : value}
            </span>
          </p>
          {/*Date and Etherscan Link*/}
          <div className="mt-2 flex items-center text-sm">
            <p
              className={`text-gray-900 opacity-70 dark:text-white ${
                loading && 'loading-line'
              }`}
            >
              {timeStr} ago
            </p>
            {!loading &&
              Object.keys(allowedAssets).includes(data.tokenSymbol) && (
                <a
                  aria-label="Link to transaction information on Etherscan"
                  className={`ml-2 block`}
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
