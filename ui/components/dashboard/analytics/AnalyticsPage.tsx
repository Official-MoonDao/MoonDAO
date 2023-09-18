import useTranslation from 'next-translate/useTranslation'
import React, { useEffect, useState } from 'react'
import { useAssets } from '../../../lib/dashboard/hooks'
import { useMarketFeeSplitStats } from '../../../lib/thirdweb/hooks/useMarketFeeSplitStats'
import { getVMOONEYData } from '../../../lib/tokens/ve-subgraph'
import AnalyticsSkeleton from './AnalyticsSkeleton'
import HoldersList from './HoldersList'
import HoldersChart from './charts/HoldersChart'
import Pie from './charts/PieChart'

function Frame(props: any) {
  return (
    <div className="component-background mt-8 flex w-[336px] sm:w-[400px] py-4 lg:w-full lg:max-w-[1380px] flex-col justify-center items-center rounded-2xl border-[0.5px] border-blue-500 shadow-md shadow-blue-500 dark:border-moon-gold dark:shadow-moon-gold ">
      {props.children}
    </div>
  )
}

function Data({ text, value }: any) {
  return (
    <div className="justify-left flex w-full flex-col rounded-2xl p-2 lg:w-1/2 text-center">
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
      <hr className="relative mt-1 h-1.5 w-[90%] bg-gradient-to-r from-blue-600 to-blue-400 dark:from-moon-gold dark:to-yellow-100" />
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
      className="grid xl:grid-cols-1 mt-2 md:pl-16 lg:mt-10 lg:w-full lg:max-w-[1380px] w-full items-center justify-center "
    >
      {/*Stats frame*/}
      <Frame>
        <div className="flex flex-col gap-4 w-3/4">
          <Label text="Voting Power Key Figures" />
          <div className="flex flex-col justify-around lg:flex-row">
            <Data
              text={'Voting Power Balance'}
              value={Math.round(analyticsData.totals.vMooney).toLocaleString(
                'en-US'
              )}
            />
            <Data
              text={'Locked MOONEY'}
              value={Math.round(analyticsData.totals.Mooney).toLocaleString(
                'en-US'
              )}
            />
          </div>
          <div className="flex flex-col justify-around lg:flex-row">
            <Data
              text={'Circulating MOONEY Staked'}
              value={
                tokens[0] &&
                (
                  (analyticsData.totals.Mooney / circulatingSupply) *
                  100
                ).toFixed(2) + '%'
              }
            />
            <Data text={'Holders'} value={analyticsData.holders.length} />
          </div>
        </div>

        {/*V-Mooney distribution frame*/}

        <div className="w-full mt-2 flex flex-col items-center justify-center lg:mt-3">
          <div className="">
            <Label text="Voting Power" />
          </div>
        </div>
        <div>
          <Pie data={analyticsData.holdersByVMooney} lightMode={lightMode} />
        </div>
        <div
          id="dashboard-analytics-holders-list"
          className="flex items-center justify-center"
        >
          <HoldersList itemsPerPage={5} data={analyticsData.holdersByVMooney} />
        </div>

        {/*Holders frame*/}
        {/* DISABLED :  avg l1 and l2 locktime ?*/}
        {/* <div className="w-full h-full flex flex-col px-4">
          <Label text="Stakers Over Time" />

          <HoldersChart data={analyticsData.holders} lightMode={lightMode} />
        </div> */}
      </Frame>
      {/* Marketplace Platform Fee Split */}
      <Frame>
        <Label text="Marketplace Platform Fee Split" />
        {!isLoadingSplit && (
          <>
            <Data text="Current Balance" value={balance} />
            <Data text="Sent to Treasury" value={released.treasury} />
            <Data text="Burned" value={released.burn} />
          </>
        )}
      </Frame>
    </div>
  )
}
