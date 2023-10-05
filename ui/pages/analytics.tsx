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
  const router = useRouter()

  const { t } = useTranslation('common')

  return (
    <div
      className={`animate-fadeIn relative lg:flex lg:flex-col lg:items-center xl:block
      `}
    >
      <Head title={t('analyticsTitle')} description={t('analyticsDesc')} />

      <div className="flex flex-col justify-center items-center w-full gap-16">
        <AnalyticsPage />
        <TreasuryPage />
      </div>
    </div>
  )
}

// add locales for Analytics title and desc
