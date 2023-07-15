import useTranslation from 'next-translate/useTranslation'
import Image from 'next/image'
import React, { useEffect, useState } from 'react'
import { getVMOONEYData } from '../../lib/tokens/ve-subgraph'
import Head from '../../components/layout/Head'
import flag from '../../public/Original.png'

export default function Analytics() {
  const [analyticsData, setAnalyticsData] = useState<any>()

  useEffect(() => {
    getVMOONEYData().then((data) => {
      setAnalyticsData(data)
    })
  }, [])

  const { t } = useTranslation('common')
  return (
    <div className="animate-fadeIn">
      <Head title="Analytics" />
      <div className="flex flex-col max-w-3xl">
        <h1 className="card-title text-center text-3xl font-semibold font-GoodTimes mb-2">
          {t('analyticsTitle')}
          <Image src={flag} width={36} height={36} />
        </h1>

        <p className="mb-8 font-RobotoMono">{t('analyticsDesc')}</p>

        <div className="grid xl:grid-cols-1 mt-2 gap-8"></div>
      </div>
    </div>
  )
}

// add locales for Analytics title and desc
