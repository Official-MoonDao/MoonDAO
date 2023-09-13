import useTranslation from 'next-translate/useTranslation'
import { useRouter } from 'next/router'
import React, { useEffect, useState } from 'react'
import { useShallowQueryRoute } from '../lib/utils/hooks'
import AnalyticsPage from '../components/dashboard/analytics/AnalyticsPage'
import TreasuryPage from '../components/dashboard/treasury/TreasuryPage'
import Head from '../components/layout/Head'
import Header from '../components/layout/Header'
import Line from '../components/layout/Line'

export default function Analytics() {
  const [isTreasury, setIsTreasury] = useState(false)
  const shallowQueryRoute = useShallowQueryRoute()
  const router = useRouter()

  useEffect(() => {
    if (router.query.treasury) setIsTreasury(true)
  }, [router.query])

  const { t } = useTranslation('common')

  return (
    <div
      className={`animate-fadeIn relative ${
        isTreasury && 'lg:flex lg:flex-col lg:items-center xl:block'
      }`}
    >
      <Head title={t('analyticsTitle')} description={t('analyticsDesc')} />

      {/* Toggle for analytics (vmooney <=> treasury) */}
      <div
        className={`${
          !isTreasury ? 'md:ml-16' : 'lg:-ml-12 xl:ml-12 2xl:ml-16'
        } my-3 uppercase flex items-center justify-between rounded-full bg-gradient-to-r from-stronger-light to-moon-blue dark:from-amber-500 dark:to-stronger-dark py-2 px-4 w-[340px]`}
      >
        <p
          className={`text-sm tracking-wide ${
            !isTreasury
              ? 'text-white font-bold'
              : 'text-gray-300 dark:text-gray-200 font-semibold'
          }`}
        >
          Voting Power
        </p>
        {/*Toggle button*/}
        <div
          id="dashboard-analytics-toggle"
          onClick={() => {
            setIsTreasury(!isTreasury)
            shallowQueryRoute(isTreasury ? {} : { treasury: true })
          }}
          className="relative w-[100px] h-[28px] rounded-full bg-gray-300 dark:bg-slate-200"
        >
          <div
            className={`absolute -top-[3px] h-[33px] w-[33px] rounded-full bg-moon-blue dark:bg-stronger-dark duration-300 ease-in-out ${
              isTreasury && 'translate-x-[70px]'
            }`}
          />
        </div>
        <p
          className={`text-sm tracking-wide ${
            isTreasury
              ? 'text-white font-bold'
              : 'text-gray-300 dark:text-gray-200 font-semibold '
          }`}
        >
          Treasury
        </p>
      </div>

      <div className={`md:ml-16 ${isTreasury && 'hidden'}`}>
        <Header text={'Analytics'} />
        <Line />
      </div>

      {isTreasury ? <TreasuryPage /> : <AnalyticsPage />}
    </div>
  )
}

// add locales for Analytics title and desc
