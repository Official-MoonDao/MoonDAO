import useTranslation from 'next-translate/useTranslation'
import React, { useState } from 'react'
import { useCalendarEvents } from '../../lib/dashboard/hooks/useCalendarEvents'
import CalendarHeader from '../../components/dashboard/calendar/CalendarHeader'
import MonthlyCalendar from '../../components/dashboard/calendar/MonthlyCalendar'
import WeeklyCalendar from '../../components/dashboard/calendar/WeeklyCalendar'
import Head from '../../components/layout/Head'

const calendarLink =
  'https://sesh.fyi/api/calendar/v2/1NtkbbR6C4pu9nfgPwPGQn.ics'

export default function Calendar() {
  const { events: calendarEvents, getDayEvents } =
    useCalendarEvents(calendarLink)
  const [isMonthlyView, setIsMonthlyView] = useState<boolean>(true)
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())

  const { t } = useTranslation('common')
  return (
    <div className="animate-fadeIn">
      <Head title="Calendar" />
      <div className="mt-3 px-5 py-12 component-background w-[336px] rounded-2xl sm:w-[400px] lg:mt-10 lg:w-full lg:max-w-[1080px] border-detail-light dark:border-detail-dark border lg:border-2 shadow-md shadow-detail-light dark:shadow-detail-dark xl:flex xl:flex-col xl:items-center">

      <h1
          className={`font-GoodTimes font-semibold tracking-wide leading-relaxed text-center text-3xl xl:text-4xl mb-2 text-title-light dark:text-title-dark`}
        >
          {t('calendarTitle')}
        </h1>

        <p className="my-6 xl:my-10 text-lg xl:text-xl leading-8 text-center text-light-text dark:text-dark-text dark:text-opacity-80">{t('calendarDesc')}</p>

        <div id="dashboard-calendar" className="grid w-full xl:grid-cols-1 mt-2 gap-8">
          <CalendarHeader
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            isMonthlyView={isMonthlyView}
            setIsMonthlyView={setIsMonthlyView}
            calendarLink={calendarLink}
          />
          {isMonthlyView ? (
            <MonthlyCalendar
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              events={calendarEvents}
              getDayEvents={getDayEvents}
            />
          ) : (
            <WeeklyCalendar
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              events={calendarEvents}
              getDayEvents={getDayEvents}
            />
          )}
        </div>
      </div>


    </div>
  )
}

// add locales for Calendar title and desc
