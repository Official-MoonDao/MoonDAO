import useTranslation from 'next-translate/useTranslation'
import Image from 'next/image'
import React, { useState } from 'react'
import { useCalendarEvents } from '../../lib/dashboard/hooks/useCalendarEvents'
import CalendarHeader from '../../components/dashboard/calendar/CalendarHeader'
import MonthlyCalendar from '../../components/dashboard/calendar/MonthlyCalendar'
import WeeklyCalendar from '../../components/dashboard/calendar/WeeklyCalendar'
import Head from '../../components/layout/Head'
import flag from '../../public/Original.png'

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
      <div className="flex flex-col max-w-3xl">
        <h1 className="card-title text-center text-3xl font-semibold font-GoodTimes mb-2">
          {t('calendarTitle')}
          <Image src={flag} width={36} height={36} alt="" />
        </h1>

        <p className="mb-8 font-RobotoMono">{t('calendarDesc')}</p>

        <div className="grid xl:grid-cols-1 mt-2 gap-8">
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
