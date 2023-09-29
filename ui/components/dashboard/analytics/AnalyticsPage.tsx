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
    <div className="mt-3 px-5 lg:px-10 xl:px-10 py-12 xl:pt-16 component-background w-[336px] rounded-2xl sm:w-[400px] lg:mt-10 lg:w-full border-detail-light dark:border-detail-dark border lg:border-2 shadow-md shadow-detail-light dark:shadow-detail-dark xl:flex xl:flex-col xl:items-center">
      {props.children}
    </div>
  )
}

function Data({ text, value }: any) {
  return (
    <div className="justify-left flex w-full flex-col rounded-2xl p-2 text-center">
      <div className=" w-full font-Montserrat font-bold leading-10 text-slate-800 hover:text-black dark:text-indigo-100 dark:hover:text-white lg:text-xl 2xl:text-2xl">
        <p className="py-2">{text}</p>
        <hr className="relative mt-1 h-1 w-full bg-gradient-to-r from-blue-500 to-blue-900 dark:from-moon-gold dark:to-yellow-100" />
      </div>
      <div className="text-slate flex flex-col justify-center px-4  text-center font-Montserrat leading-10 text-black dark:text-indigo-100 md:items-center lg:my-2 lg:flex-row lg:text-2xl xl:text-3xl">
        {value.toLocaleString()}
      </div>
    </div>
  )
}

function Label({ text }: { text: string }) {
  return (
    <div className="my-4 flex w-full flex-col items-center justify-center text-center font-Montserrat font-bold tracking-wide text-slate-800 hover:text-black dark:text-indigo-100 dark:hover:text-white text-lg lg:text-2xl 2xl:text-3xl">
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
      className="grid xl:grid-cols-1 mt-2 md:pl-16 lg:mt-10 lg:w-full lg:max-w-[1380px] items-center justify-center "
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
