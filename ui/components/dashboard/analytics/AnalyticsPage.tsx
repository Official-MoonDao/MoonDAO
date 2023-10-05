import useTranslation from 'next-translate/useTranslation'
import React, { useEffect, useState } from 'react'
import { useAssets } from '../../../lib/dashboard/hooks'
import { useMarketFeeSplitStats } from '../../../lib/thirdweb/hooks/useMarketFeeSplitStats'
import { getVMOONEYData } from '../../../lib/tokens/ve-subgraph'
import Header from '../../layout/Header'
import Line from '../../layout/Line'
import { AnalyticsProgress } from './AnalyticsProgress'
import AnalyticsSkeleton from './AnalyticsSkeleton'

function Frame(props: any) {
  return (
    <div className="mt-3 px-5 lg:px-10 xl:px-10 py-6 xl:pt-16 component-background w-[336px] rounded-2xl sm:w-[400px] lg:mt-10 lg:w-full lg:max-w-[1080px] border-detail-light dark:border-detail-dark border shadow-md shadow-detail-light dark:shadow-detail-dark flex flex-col items-center">
      {props.children}
    </div>
  )
}

function Data({ text, value }: any) {
  return (
    <div className="justify-left flex w-full flex-col rounded-2xl p-2 text-center">
      <div className="w-full xl:flex xl:flex-col xl:items-center font-Montserrat font-bold tracking-wider leading-10 text-gray-800 dark:text-gray-200  text-lg lg:text-2xl 2xl:text-32xl">
        <p className="pt-2 uppercase">{text}</p>
        <hr className="relative mt-1 lg:mt-3 h-1 w-full xl:w-3/4 bg-gradient-to-r from-blue-500 to-blue-900 dark:from-moon-gold dark:to-amber-300" />
      </div>
      <div className="mt-3 mb-2 tracking-widest text-slate flex flex-col justify-center px-4 font-RobotoMono  text-center  leading-10 text-gray-700 dark:text-gray-300 md:items-center lg:flex-row text-lg lg:text-xl xl:text-2xl">
        {value.toLocaleString()}
      </div>
    </div>
  )
}

function Label({ text }: { text: string }) {
  return (
    <div className="my-4 leading-relaxed flex w-full flex-col items-center justify-center text-center font-Montserrat font-bold tracking-wide text-stronger-light dark:text-moon-gold text-xl lg:text-2xl 2xl:text-3xl">
      {text}
    </div>
  )
}

export default function AnalyticsPage() {
  const [analyticsData, setAnalyticsData] = useState<any>()
  const [lightMode] = useState(false)
  const { tokens } = useAssets()
  const {
    balance,
    released,
    isLoading: isLoadingSplit,
  } = useMarketFeeSplitStats()

  const circulatingSupply = 2618632244 - tokens[0]?.balance

  useEffect(() => {
    getVMOONEYData().then((data) => {
      setAnalyticsData(data)
    })
  }, [])

  const { t } = useTranslation('common')

  if (!analyticsData) return <AnalyticsSkeleton />

  return (
    <div
      id="#dashboard-analytics-page"
      className="grid gap-4 lg:gap-0 xl:grid-cols-1 mt-2 md:pl-16 lg:mt-10 lg:w-full lg:max-w-[1380px] items-center justify-center"
    >
      <Header text={'Analytics'} />
      <Line />
      {/*Stats frame*/}
      <Frame>
        <div className="flex flex-col gap-4 w-3/4">
          <Label text="Voting Power Key Figures" />

          <Data
            text={'Total Voting Power'}
            value={Math.round(analyticsData.totals.vMooney).toLocaleString(
              'en-US'
            )}
          />
          <Data
            text={'Locked $MOONEY'}
            value={Math.round(analyticsData.totals.Mooney).toLocaleString(
              'en-US'
            )}
          />

          <Data text="Circulating MOONEY Staked" value="" />
          <AnalyticsProgress
            value={(
              (analyticsData.totals.Mooney / circulatingSupply) *
              100
            ).toFixed(1)}
          />
        </div>
      </Frame>
      {/* Marketplace Platform Fee Split */}
      <Frame>
        {!isLoadingSplit && (
          <div className="flex flex-col items-center w-3/4">
            <Label text={'Marketplace Platform Fee Split (L2 $MOONEY)'} />
            <Data text="Current Balance" value={balance} />
            <Data text="Sent to Treasury" value={released.treasury} />
            <Data text="Burned" value={released.burn} />
          </div>
        )}
      </Frame>
    </div>
  )
}
