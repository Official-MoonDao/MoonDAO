import useTranslation from 'next-translate/useTranslation'
import React, { useMemo, useState } from 'react'
import { useAssets } from '../../../lib/dashboard/hooks'
import Card from '@/components/layout/Card'
import AnalyticsChainSelector from './AnalyticsChainSelector'
import { AnalyticsProgress } from './AnalyticsProgress'
import AnalyticsSkeleton from './AnalyticsSkeleton'
import BarChart from './BarChart'

function Data({ text, value }: any) {
  return (
    <div className="bg-gradient-to-b from-slate-700/20 to-slate-800/30 backdrop-blur-xl border border-white/10 rounded-lg p-6 flex flex-col items-center justify-center text-center min-h-[120px] transition-all duration-300 hover:bg-gradient-to-b hover:from-slate-600/30 hover:to-slate-700/40">
      <p className="text-white/70 text-sm lg:text-base font-medium uppercase tracking-wider mb-3">
        {text}
      </p>
      <div className="text-white font-bold text-2xl lg:text-3xl xl:text-4xl font-RobotoMono">
        {value.toLocaleString()}
      </div>
    </div>
  )
}

export default function AnalyticsPage({ vMooneyData }: any) {
  const [analyticsChain, setAnalyticsChain] = useState<string>('all')

  const { tokens } = useAssets()

  const circulatingSupply = 2618632244 - tokens[0]?.balance

  const circulatingMooneyStaked = useMemo(() => {
    return ((vMooneyData?.totals[analyticsChain].Mooney / circulatingSupply) * 100).toFixed(1)
  }, [vMooneyData, analyticsChain, circulatingSupply])

  const { t } = useTranslation('common')

  if (!vMooneyData) return <AnalyticsSkeleton />

  return (
    <div className="flex flex-col gap-6 md:gap-8 w-full">
      <Card className="w-full" variant="launchpad" maxWidthClassNames="max-w-full">
        <h2 className="font-GoodTimes text-3xl md:text-4xl text-center sm:text-left mb-6">
          Voting Power Over Time
        </h2>
        <div className="w-full overflow-x-auto">
          <BarChart
            holdersData={vMooneyData.holders}
            maxWidthClassNames="max-w-full"
            variant="launchpad"
          />
        </div>
      </Card>
      <Card className="!w-full" variant="launchpad" maxWidthClassNames="max-w-full" layout="wide">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <h2 className="font-GoodTimes text-3xl md:text-4xl text-center sm:text-left">
            $MOONEY Key Figures
          </h2>
          <div className="w-full md:w-auto flex-shrink-0">
            <AnalyticsChainSelector
              analyticsChain={analyticsChain}
              setAnalyticsChain={setAnalyticsChain}
            />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          <Data
            text={'Total Voting Power'}
            value={Math.round(vMooneyData.totals[analyticsChain].vMooney).toLocaleString('en-US')}
          />
          <Data
            text={'Locked $MOONEY'}
            value={Math.round(vMooneyData.totals[analyticsChain].Mooney).toLocaleString('en-US')}
          />
          <div className="bg-gradient-to-b from-slate-700/20 to-slate-800/30 backdrop-blur-xl border border-white/10 rounded-lg p-6 flex flex-col items-center justify-center text-center min-h-[120px] transition-all duration-300 hover:bg-gradient-to-b hover:from-slate-600/30 hover:to-slate-700/40">
            <p className="text-white/70 text-sm lg:text-base font-medium uppercase tracking-wider mb-4">
              Percent $MOONEY Locked
            </p>
            <div className="w-full max-w-md">
              <AnalyticsProgress value={circulatingMooneyStaked} />
            </div>
          </div>
          <Data text={'Total $MOONEY Supply'} value={'2,618,757,244'} />
        </div>
      </Card>
    </div>
  )
}
