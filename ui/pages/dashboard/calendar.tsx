import useTranslation from 'next-translate/useTranslation'
import Image from 'next/image'
import React from 'react'
import { useCalendarEvents } from '../../lib/dashboard/hooks/useCalendarEvents'
import { useGQLQuery } from '../../lib/utils/hooks/useGQLQuery'
import Head from '../../components/layout/Head'
import flag from '../../public/Original.png'

export default function Calendar() {
  const calendarEvents = useCalendarEvents()

  const { t } = useTranslation('common')
  return (
    <div className="animate-fadeIn">
      <Head title="Calendar" />
      <div className="flex flex-col max-w-3xl">
        <h1 className="card-title text-center text-3xl font-semibold font-GoodTimes mb-2">
          {t('calendarTitle')}
          <Image src={flag} width={36} height={36} />
        </h1>

        <p className="mb-8 font-RobotoMono">{t('calendarDesc')}</p>

        <div className="grid xl:grid-cols-1 mt-2 gap-8"></div>
      </div>
    </div>
  )
}

// add locales for Calendar title and desc
