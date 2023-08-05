import useTranslation from 'next-translate/useTranslation'
import React, { useEffect, useState } from 'react'
import { useAssets } from '../../../lib/dashboard/hooks'
import { getVMOONEYData } from '../../../lib/tokens/ve-subgraph'
import AnalyticsSkeleton from '../../../components/dashboard/analytics/AnalyticsSkeleton'
import HoldersList from '../../../components/dashboard/analytics/HoldersList'
import HoldersChart from '../../../components/dashboard/analytics/charts/HoldersChart'
import Pie from '../../../components/dashboard/analytics/charts/PieChart'
import Header from '../../layout/Header'

function Frame(props: any) {
  return (
    <div className="component-background mt-8 flex w-[336px] sm:w-[400px] min-h-[50vh] lg:w-full lg:max-w-[1380px] flex-col justify-center items-center rounded-2xl border-[0.5px] border-blue-500 shadow-md shadow-blue-500 dark:border-moon-gold dark:shadow-moon-gold ">
      {props.children}
    </div>
  )
}

function LoadingSpinner() {
  return (
    <div className="m-4 flex items-center justify-center">
      <span className="absolute h-[50px] w-[50px] animate-rotation rounded-full border-4 border-orange-200 border-b-transparent" />
      <span className="h-[30px] w-[30px] animate-[rotation_1s_reverse_infinite] rounded-full border-4 border-orange-300 border-t-transparent" />
    </div>
  )
}

function Data({ text, value, mooney, vmooney }: any) {
  return (
    <div className="justify-left flex w-full flex-col rounded-2xl p-4 lg:w-1/2 text-center">
      <div className=" w-full font-Montserrat font-bold leading-10 text-slate-800 hover:text-black dark:text-indigo-100 dark:hover:text-white lg:text-xl 2xl:text-2xl">
        <p className="min-h-[6vh]">{text}</p>
        <hr className="relative mt-1 h-1 w-full bg-gradient-to-r from-blue-500 to-blue-900 dark:from-moon-gold dark:to-yellow-100" />
      </div>
      <div className="text-slate flex flex-col justify-center px-4  text-center font-Montserrat leading-10 hover:text-[#6ca3e6] text-black dark:text-indigo-100  dark:hover:text-[orange] md:items-center lg:my-4 lg:flex-row lg:text-2xl xl:text-3xl">
        {value}

        {mooney && <></>}
        {vmooney && <></>}
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

export default function VMooneyPage() {
  const [analyticsData, setAnalyticsData] = useState<any>()
  const [lightMode, setLightMode] = useState(false)
  const { tokens } = useAssets()

  const circulatingSupply = 2618632244 - tokens[0]?.balance

  useEffect(() => {
    getVMOONEYData().then((data) => {
      setLightMode(localStorage.getItem('lightMode') === 'true' ? true : false)
      setAnalyticsData(data)
    })
  }, [])

  const { t } = useTranslation('common')

  if (!analyticsData?.holders) return <AnalyticsSkeleton />
  return (
    <>
      <div className="">
        <div className="grid xl:grid-cols-1 mt-2 md:pl-16 lg:mt-10 lg:w-full lg:max-w-[1380px] w-full items-center justify-center ">
          {/*Stats frame*/}

          <div className="component-background mt-8 relative mb-12 flex w-[336px] flex-col justify-center gap-8 rounded-2xl border-[0.5px] border-blue-500 p-10 shadow-md shadow-blue-500 dark:border-moon-gold dark:shadow-moon-gold sm:w-[400px] lg:w-full lg:max-w-[1380px]">
            <Label text="Voting Power Key Figures" />
            <div className="flex flex-col justify-around lg:flex-row">
              <Data
                text={'Voting Power Balance'}
                value={Math.round(analyticsData.totals.vMooney).toLocaleString(
                  'en-US'
                )}
                vmooney
              />
              <Data
                text={'Locked MOONEY'}
                value={Math.round(analyticsData.totals.Mooney).toLocaleString(
                  'en-US'
                )}
                mooney
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
              <Data
                text={'Average Staking Period'}
                value={analyticsData.totals.AvgStakingPeriod}
              />
            </div>
          </div>
          {/*V-Mooney distribution frame*/}
          <Frame>
            <div className="w-full mt-2 flex flex-col items-center justify-center lg:mt-3">
              <div className="">
                <Label text="Voting Power %" />
              </div>
            </div>
            <div>
              <Pie data={analyticsData.distribution} lightMode={lightMode} />
            </div>
            <div
              id="dashboard-analytics-holders-list"
              className="flex items-center justify-center"
            >
              <HoldersList
                itemsPerPage={window.innerHeight > 1080 ? 10 : 5}
                data={analyticsData.holdersByVMooney}
              />
            </div>
          </Frame>
          {/*Holders frame*/}
          <Frame>
            <div className="w-full h-full flex flex-col">
              <Label text="Stakers Over Time" />

              <HoldersChart
                data={analyticsData.holders}
                lightMode={lightMode}
              />
            </div>
          </Frame>
        </div>
      </div>
    </>
  )
}
