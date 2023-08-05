import useTranslation from 'next-translate/useTranslation'
import { useRouter } from 'next/router'
import React, { useEffect, useState } from 'react'
import VMooneyPage from '../../components/dashboard/analytics/VMooneyPage'
import TreasuryPage from '../../components/dashboard/treasury/TreasuryPage'
import Head from '../../components/layout/Head'

export default function Analytics() {
  const [isTreasury, setIsTreasury] = useState(false)

  const { t } = useTranslation('common')

  return (
    <div className="animate-fadeIn relative">
      <Head title={t('analyticsTitle')} description={t('analyticsDesc')} />
      {/* Toggle for analytics (vmooney <=> treasury) */}
      <div
        className={`${
          !isTreasury ? 'md:ml-16' : 'xl:ml-12 2xl:ml-16'
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
          onClick={() => setIsTreasury(!isTreasury)}
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

      {isTreasury ? <TreasuryPage /> : <VMooneyPage />}
    </div>
  )
}

// add locales for Analytics title and desc
