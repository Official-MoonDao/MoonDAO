import { TreasuryAndMobileLogo } from '../../../assets'
import Header from '../../../layout/Header'
import Line from '../../../layout/Line'

const TreasuryBalance = ({ balance, loading }: any) => {
  return (
    <div className="bg-gradient-to-b from-slate-700/20 to-slate-800/30 backdrop-blur-xl border border-white/10 rounded-xl p-6 mt-4">
      <div className="flex flex-col font-RobotoMono">
        <h2
          className={`text-white text-4xl xl:text-5xl font-bold ${
            loading && 'animate-pulse bg-white/20 text-transparent rounded'
          }`}
        >
          ${balance}
        </h2>
        {/*Disclaimer */}
        <p className="mt-4 text-white/70 text-sm leading-relaxed">
          The total doesn't include Layer 2 holdings or the value of $MOONEY.{' '}
        </p>
      </div>
    </div>
  )
}

export default TreasuryBalance
