import useTranslation from 'next-translate/useTranslation'
import React, { useEffect } from 'react'
import { useCalendarEvents } from '../lib/dashboard/hooks'
import { SeshEvent } from '../components/dashboard/calendar/SeshEvent'
import Head from '../components/layout/Head'

const SESH_LINK = 'https://sesh.fyi/api/calendar/v2/hfwjLhfVoutWs65KegtbP7.ics'

export default function Calendar() {
  const { events } = useCalendarEvents(SESH_LINK)

  const { t } = useTranslation('common')
  return (
    <div className="animate-fadeIn">
      <Head title={t('calendarTitle')} description={t('calendarDesc')} />
      <div className="mt-3 px-5 py-12 component-background w-[336px] rounded-2xl sm:w-[400px] lg:mt-10 lg:w-full lg:max-w-[1080px] border-detail-light dark:border-detail-dark border lg:border-2 shadow-md shadow-detail-light dark:shadow-detail-dark xl:flex xl:flex-col xl:items-center">
        <h1
          className={`font-GoodTimes font-semibold tracking-wide leading-relaxed text-center text-3xl xl:text-4xl mb-2 text-title-light dark:text-title-dark`}
        >
          {t('calendarTitle')}
        </h1>

        <p className="my-6 xl:my-10 text-lg xl:text-xl leading-8 text-center text-light-text dark:text-dark-text dark:text-opacity-80">
          {t('calendarDesc')}
        </p>

        <div>
          <div
            id="dashboard-calendar"
            className="flex flex-col gap-2 divide-y-2 divide-slate-300 items-center"
          >
            {!events?.[0] ? (
              <>
                {Array(6)
                  .fill(0)
                  .map((_, i) => (
                    <div
                      className="flex flex-col text-black dark:text-moon-gold items-center h-12 w-full animate-pulse"
                      key={'seshEvent' + i}
                    >
                      ...loading
                    </div>
                  ))}
              </>
            ) : (
              <>
                {events.map((event: any) => (
                  <SeshEvent key={event.id} seshEvent={event} />
                ))}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// add locales for Calendar title and desc
