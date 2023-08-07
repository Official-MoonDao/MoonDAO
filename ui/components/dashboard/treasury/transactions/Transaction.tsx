import { ExclamationCircleIcon } from '@heroicons/react/24/outline'
import { allowedAssets } from '../../../../lib/dashboard/dashboard-utils.ts/asset-config'
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

  return (
    <div
      className={`${
        !loading && !Object.keys(allowedAssets).includes(data.tokenSymbol)
          ? 'opacity-80 bg-gray-200 dark:bg-slate-800'
          : 'border-[0.5px] component-background border-detail-light shadow shadow-detail-light hover:scale-105 dark:border-detail-dark dark:shadow-detail-dark '
      } rounded-[15px] relative mt-5 flex w-[336px] flex-col items-center sm:w-[400px] 2xl:w-full 2xl:flex-row 2xl:justify-between py-2 2xl:px-5 2xl:py-3 ${
        loading && 'loading-component'
      } transition-all duration-150`}
    >
      <div
        className={`${
          !loading && !Object.keys(allowedAssets).includes(data.tokenSymbol)
            ? 'absolute top-1 right-3 opacity-100 text-red-500 animate-pulse xl:-top-3 xl:-right-3 z-50'
            : 'hidden'
        }`}
      >
        <ExclamationCircleIcon className="h-8 w-8" />
      </div>

      {/*Sent or receive*/}
      <div className="relative right-3 flex items-center">
        <span className={`${loading && 'loading-line'}`}>
          {loading ? '' : sent ? <ArrowUp /> : <ArrowDown />}
        </span>
        <p
          className={`text ml-3 font-mono text-xl font-bold text-moon-blue dark:text-moon-gold ${
            loading && 'loading-line'
          }`}
        >
          {sent ? 'Sent' : 'Received'}
        </p>
      </div>
      {/*Amount*/}
      <p
        className={`mt-2 block truncate text-lg font-bold tracking-wide  text-title-light dark:text-dark-highlight xl:hover:text-center 2xl:mt-0 2xl:max-w-[43%] 2xl:tracking-wider 2xl:hover:overflow-visible 2xl:hover:whitespace-pre`}
      >
        <span className={`${loading && 'loading-line'}`}>{value}</span>
      </p>
      {/*Date and Etherscan Link*/}
      <div className="mt-2 flex items-center 2xl:mt-0">
        <p
          className={`font-semibold text-faded dark:text-dark-text dark:opacity-70 ${
            loading && 'loading-line'
          }`}
        >
          {timeStr} ago
        </p>
        {!loading && (
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
  )
}

export default Transaction
