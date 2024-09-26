import useTranslation from 'next-translate/useTranslation'
import React, { useEffect, useState } from 'react'
import { useAssets } from '../../../lib/dashboard/hooks'
import { useMarketFeeSplitStats } from '../../../lib/thirdweb/hooks/useMarketFeeSplitStats'
import { getVMOONEYData } from '../../../lib/tokens/ve-subgraph'
import { AnalyticsProgress } from './AnalyticsProgress'
import AnalyticsSkeleton from './AnalyticsSkeleton'

function Frame(props: any) {
  return (
    <div className="mt-3 px-5 lg:px-10 xl:px-10 py-5 inner-container-background w-[336px] sm:w-[400px] lg:mt-10 lg:w-full lg:max-w-[1080px] flex flex-col items-center">
      {props.children}
    </div>
  )
}

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

function Label({ text }: { text: string }) {
  return (
    <div className="my-4 leading-relaxed flex w-full flex-col items-center justify-center text-center title-text-colors font-semibold text-xl lg:text-3xl 2xl:text-4xl font-RobotoMono">
      {text}
    </div>
  )
}

export default function AnalyticsPage() {
  const [analyticsData, setAnalyticsData] = useState<any>()
  const [lightMode] = useState(false)
  const [dateUpdated, setDateUpdated] = useState<string>("")
  const { tokens } = useAssets()
  const {
    balance,
    released,
    isLoading: isLoadingSplit,
  } = useMarketFeeSplitStats()

  const circulatingSupply = 2618632244 - tokens[0]?.balance

  useEffect(() => {
    getVMOONEYData().then((data) => {
      const today = new Date()
      const formattedDate = `${today.getFullYear()}-${(today.getMonth() + 1)
        .toString()
        .padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`
      setDateUpdated(formattedDate)
      setAnalyticsData(data)
    })
  }, [])

  const { t } = useTranslation('common')

  if (!analyticsData) return <AnalyticsSkeleton />

  return (
    <div
      id="analytics-page"
      className="grid gap-4 lg:gap-0 xl:grid-cols-1 mt-6 lg:px-16 lg:mt-10 lg:w-full lg:max-w-[1380px] items-center justify-center"
    >
      <p className="sub-title">Figures current as of: {dateUpdated}</p>
      {/*Stats frame*/}
      <Frame>
        <Label text="Voting Power Key Figures" />
        <div
          className="flex flex-col  tems-center gap-5 2xl:grid 2xl:grid-cols-2 2xl:mt-10'>
"
        >
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
          {/*Pie chart*/}
          <div className="justify-left flex w-full flex-col p-2 pb-4 text-center border border-slate-950 dark:border-white border-opacity-20">
            <p className=" w-full tracking-wider leading-10  text-lg lg:text-2xl pt-2 uppercase font-RobotoMono opacity-60 title-text-colors block ">
              Circulating MOONEY Staked
            </p>
            <div className="mt-3">
              <AnalyticsProgress
                value={(
                  (analyticsData.totals.Mooney / circulatingSupply) *
                  100
                ).toFixed(1)}
              />
            </div>
          </div>
        </div>
      </Frame>
      {/* Marketplace Platform Fee Split */}
      <Frame>
        {!isLoadingSplit && (
          <div className="w-3/4 2xl:w-full">
            <Label text={'Marketplace Platform Fee Split (L2 $MOONEY)'} />
            <div className="flex flex-col items-center gap-5 2xl:grid 2xl:grid-cols-2 2xl:mt-10">
              <Data text="Current Balance" value={balance} />
              <Data text="Sent to Treasury" value={released.treasury} />
              <Data text="Burned" value={released.burn} />
            </div>
          </div>
        )}
      </Frame>
    </div>
  )
}
