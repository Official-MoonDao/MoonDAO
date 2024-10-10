import { TreasuryAndMobileLogo } from '../../../assets'
import Header from '../../../layout/Header'
import Line from '../../../layout/Line'

const TreasuryBalance = ({ balance, loading }: any) => {
  return (
    <>
      <div className="flex flex-col font-RobotoMono">
        <h2
          className={`truncate dark:text-white text-4xl xl:text-5xl font-bold text-black ${
            loading && 'loading-line'
          }`}
        >
          ${balance}
        </h2>
        {/*Disclaimer */}
        <p className="mt-10 inline-block w-[336px] dark:text-gray-50 text-gray-900 tracking-wider opacity-60  sm:w-[400px] lg:w-[336px] xl:w-full text-sm">
          The total doesn't include the value of $MOONEY.{' '}
        </p>
      </div>
    </>
  )
}

export default TreasuryBalance
