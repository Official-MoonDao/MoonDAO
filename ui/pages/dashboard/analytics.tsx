import useTranslation from 'next-translate/useTranslation'
import Image from 'next/image'
import React, { useEffect, useState } from 'react'
import { useAssets } from '../../lib/dashboard/hooks'
import { getVMOONEYData } from '../../lib/tokens/ve-subgraph'
import AnalyticsSkeleton from '../../components/dashboard/analytics/AnalyticsSkeleton'
import HoldersList from '../../components/dashboard/analytics/HoldersList'
import Holders from '../../components/dashboard/analytics/charts/Holders'
import Pie from '../../components/dashboard/analytics/charts/Pie'
import Head from '../../components/layout/Head'
import flag from '../../public/Original.png'

function Frame(props: any) {
  return (
    <div className="component-background mt-6 flex w-[336px] sm:w-[400px] lg:w-[650px] xl:w-[800px] 2xl:w-[1080px]  min-h-[85vh] 2xl:max-w-[1080px] flex-col justify-center items-center rounded-2xl border-[0.5px] border-blue-500 shadow-md shadow-blue-500 dark:border-moon-gold dark:shadow-moon-gold ">
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
    <div className="justify-left flex w-full flex-col rounded-2xl p-4 lg:w-1/2">
      <div className=" w-full font-Montserrat font-bold leading-10 text-slate-800 hover:text-black dark:text-indigo-100 dark:hover:text-white lg:text-xl 2xl:text-2xl">
        <p className="min-h-[6vh]">{text}</p>
        <hr className="relative mt-1 h-1 w-full bg-gradient-to-r from-blue-500 to-blue-900 dark:from-moon-gold dark:to-yellow-100" />
      </div>
      <div className="text-slate flex flex-col justify-center px-4  text-center font-Montserrat leading-10 hover:text-[#6ca3e6] dark:text-indigo-100  dark:hover:text-[orange] md:items-center lg:my-4 lg:flex-row lg:text-2xl xl:text-3xl">
        {value}

        {mooney && <></>}
        {vmooney && <></>}
      </div>
    </div>
  )
}

function Label({ text }: { text: string }) {
  return (
    <div className="mt-4 flex w-full flex-col items-center justify-center text-center font-Montserrat font-bold leading-10 text-slate-800 hover:text-black dark:text-indigo-100 dark:hover:text-white lg:text-2xl 2xl:text-3xl">
      {text}
      <hr className="relative mt-1 h-1.5 w-[90%] bg-gradient-to-r from-blue-600 to-blue-400 dark:from-moon-gold dark:to-yellow-100" />
    </div>
  )
}

export default function Analytics() {
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
    <div className="animate-fadeIn">
      <Head title="Analytics" />
      <div className="flex flex-col max-w-3xl">
        <h1 className="card-title text-center text-3xl font-semibold font-GoodTimes mb-2">
          {t('analyticsTitle')}
          <Image src={flag} width={36} height={36} alt="" />
        </h1>

        <p className="mb-8 font-RobotoMono">{t('analyticsDesc')}</p>

        <div className="grid xl:grid-cols-1 mt-2 gap-8">
          <div className="component-background relative top-10 mb-12 flex w-[336px] flex-col justify-center gap-8 rounded-2xl border-[0.5px] border-blue-500 p-10 shadow-md shadow-blue-500 dark:border-moon-gold dark:shadow-moon-gold sm:w-[400px] lg:w-[650px] xl:w-[800px] 2xl:w-[1080px]">
            <Label text="vMooney Key Figures" />
            <div className="flex flex-col justify-around lg:flex-row">
              <Data
                text={'vMOONEY Balance'}
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
          <Frame>
            <div className="mt-2 flex flex-col items-center justify-center lg:mt-3">
              <div className="">
                <Label text="vMOONEY Distribution" />
              </div>

              <Pie data={analyticsData.distribution} lightMode={lightMode} />
            </div>
            <div className="flex flex-col items-center justify-center">
              <HoldersList
                itemsPerPage={window.innerHeight > 1080 ? 10 : 5}
                data={analyticsData.holdersByVMooney}
              />
            </div>
          </Frame>
          <Frame>
            <div className="flex flex-col">
              <Label text="vMOONEY Holders Over Time" />

              <Holders data={analyticsData.holders} lightMode={lightMode} />
            </div>
          </Frame>
        </div>
      </div>
    </div>
  )
}

// add locales for Analytics title and desc
