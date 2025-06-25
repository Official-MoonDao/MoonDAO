import useTranslation from 'next-translate/useTranslation'
import React, { useMemo, useState } from 'react'
import { useAssets } from '../../../lib/dashboard/hooks'
import SectionCard from '@/components/layout/SectionCard'
import AnalyticsChainSelector from './AnalyticsChainSelector'
import { AnalyticsProgress } from './AnalyticsProgress'
import AnalyticsSkeleton from './AnalyticsSkeleton'
import BarChart from './BarChart'

function Data({ text, value }: any) {
  return (
    <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-lg p-6 flex flex-col items-center justify-center text-center min-h-[120px] transition-all duration-300 hover:bg-white/10">
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
    return (
      (vMooneyData?.totals[analyticsChain].Mooney / circulatingSupply) *
      100
    ).toFixed(1)
  }, [vMooneyData, analyticsChain, circulatingSupply])

  const { t } = useTranslation('common')

  if (!vMooneyData) return <AnalyticsSkeleton />

  return (
    <>
      <SectionCard>
        <h2 className="font-GoodTimes text-4xl text-center sm:text-left">
          {'Voting Power Over Time'}
        </h2>
        <div className="w-full">
          <BarChart holdersData={vMooneyData.holders} />
        </div>
      </SectionCard>
      <SectionCard>
        <div className="flex flex-col md:flex-row justify-between">
          <h2 className="font-GoodTimes text-4xl text-center sm:text-left">
            {'$MOONEY Key Figures'}
          </h2>
          <div>
            <AnalyticsChainSelector
              analyticsChain={analyticsChain}
              setAnalyticsChain={setAnalyticsChain}
            />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <Data
            text={'Total Voting Power'}
            value={Math.round(
              vMooneyData.totals[analyticsChain].vMooney
            ).toLocaleString('en-US')}
          />
          <Data
            text={'Locked $MOONEY'}
            value={Math.round(
              vMooneyData.totals[analyticsChain].Mooney
            ).toLocaleString('en-US')}
          />
          {/*Pie chart*/}
          <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-lg p-6 flex flex-col items-center justify-center text-center min-h-[120px] transition-all duration-300 hover:bg-white/10">
            <p className="text-white/70 text-sm lg:text-base font-medium uppercase tracking-wider mb-4">
              Percent $MOONEY Locked
            </p>
            <div className="w-full">
              <AnalyticsProgress value={circulatingMooneyStaked} />
            </div>
          </div>
          <Data
            text={'Total $MOONEY Supply'}
            value={'2,618,757,244'}
          />
        </div>
      </SectionCard>
    </>
  )
}
