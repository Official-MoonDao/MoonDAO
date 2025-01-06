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
    <div className="justify-left flex w-full flex-col p-2 text-center border border-slate-950 dark:border-white border-opacity-20">
      <p className=" w-full tracking-wider leading-10  text-lg lg:text-2xl pt-2 uppercase font-RobotoMono opacity-60 title-text-colors block ">
        {text}
      </p>

      <div className="mt-3 mb-2 tracking-widest text-slate flex flex-col justify-center px-4 font-RobotoMono  text-center font-bold leading-10 title-text-colors md:items-center lg:flex-row text-xl lg:text-3xl xl:text-4xl 2xl:text-5xl">
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
        <h1 className="font-GoodTimes text-4xl text-center sm:text-left">
          {'Governance Power Over Time'}
        </h1>
        <div className="w-full">
          <BarChart holdersData={vMooneyData.holders} />
        </div>
      </SectionCard>
      <SectionCard>
        <div className="flex flex-col md:flex-row justify-between">
          <h1 className="font-GoodTimes text-4xl text-center sm:text-left">
            {'Voting Power Key Figures'}
          </h1>
          <div>
            <AnalyticsChainSelector
              analyticsChain={analyticsChain}
              setAnalyticsChain={setAnalyticsChain}
            />
          </div>
        </div>
        <div
          className="mt-6 flex flex-col  tems-center gap-5 2xl:grid 2xl:grid-cols-2 2xl:mt-10'>
"
        >
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
          <div className="justify-left flex w-full flex-col p-2 pb-4 text-center border border-slate-950 dark:border-white border-opacity-20">
            <p className=" w-full tracking-wider leading-10  text-lg lg:text-2xl pt-2 uppercase font-RobotoMono opacity-60 title-text-colors block ">
              Circulating MOONEY Staked
            </p>
            <div className="mt-3">
              <AnalyticsProgress value={circulatingMooneyStaked} />
            </div>
          </div>
        </div>
      </SectionCard>
    </>
  )
}
