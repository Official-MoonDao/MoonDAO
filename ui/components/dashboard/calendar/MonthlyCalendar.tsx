import { ClockIcon } from '@heroicons/react/20/solid'
import {
  addDays,
  subDays,
  getDay,
  getDate,
  startOfWeek,
  endOfWeek,
  lastDayOfMonth,
  startOfMonth,
  isSameMonth,
  isToday,
  isSameDay,
  parseISO,
  format,
} from 'date-fns'
import { useEffect } from 'react'
import { useState } from 'react'

function classNames(...classes: any) {
  return classes.filter(Boolean).join(' ')
}

function getLastMonday(date: any) {
  while (getDay(date) != 1) {
    date = subDays(date, 1)
  }
  return date
}

function getNextSunday(date: any) {
  while (getDay(date) != 0) {
    date = addDays(date, 1)
  }
  return date
}

export default function MonthlyCalendar({
  selectedDate,
  setSelectedDate,
  events,
  getDayEvents,
}: any) {
  const [monthEvents, setMonthEvents] = useState([])
  const [hover, setHover] = useState('')
  function getMonthEvents() {
    /*
    Gets all days of the selected month, with their respective events.
    */

    let startDate = getLastMonday(
      startOfWeek(startOfMonth(selectedDate), { weekStartsOn: 1 })
    )
    let endDate = getNextSunday(
      endOfWeek(lastDayOfMonth(selectedDate), { weekStartsOn: 1 })
    )

    let day = startDate
    let days = []

    while (day <= endDate) {
      day.events = getDayEvents(day)
      days.push(day)
      day = addDays(day, 1)
    }

    return days
  }

  useEffect(() => {
    setMonthEvents(getMonthEvents() as any)
  }, [selectedDate, events])

  return (
    <div className="mt-8 overflow-hidden rounded border border-blue-600 shadow-md shadow-blue-300 dark:border-amber-100 dark:shadow-amber-200 lg:mx-10 lg:max-w-[1200px] ">
      <div className="shadow ring-1 ring-black ring-opacity-5 lg:flex lg:flex-auto lg:flex-col">
        <div className="grid grid-cols-7 gap-px border-b border-gray-300 bg-white text-center text-xs font-semibold leading-6 text-moon-blue dark:border-gray-600 dark:bg-blue-950 dark:text-moon-gold lg:flex-none">
          <div className="bw-white py-2 dark:bg-blue-950">
            M<span className="sr-only sm:not-sr-only">on</span>
          </div>
          <div className="bw-white py-2 dark:bg-blue-950">
            T<span className="sr-only sm:not-sr-only">ue</span>
          </div>
          <div className="bw-white py-2 dark:bg-blue-950">
            W<span className="sr-only sm:not-sr-only">ed</span>
          </div>
          <div className="bw-white py-2 dark:bg-blue-950">
            T<span className="sr-only sm:not-sr-only">hu</span>
          </div>
          <div className="bw-white py-2 dark:bg-blue-950">
            F<span className="sr-only sm:not-sr-only">ri</span>
          </div>
          <div className="bw-white py-2 dark:bg-blue-950">
            S<span className="sr-only sm:not-sr-only">at</span>
          </div>
          <div className="bw-white py-2 dark:bg-blue-950">
            S<span className="sr-only sm:not-sr-only">un</span>
          </div>
        </div>
        <div className="flex bg-gray-300 text-xs leading-6 text-gray-200 dark:bg-gray-600 lg:flex-auto">
          <div className="hidden w-full lg:grid lg:grid-cols-7 lg:grid-rows-4 lg:gap-px">
            {monthEvents.map((day: any) => (
              <div
                key={day.toString()}
                className={classNames(
                  isSameMonth(day, selectedDate)
                    ? 'bg-white dark:bg-blue-950'
                    : 'bg-gray-50 dark:bg-stronger-light dark:text-gray-200 ',
                  'relative px-3 py-2'
                )}
                onClick={() => {
                  setSelectedDate(day)
                }}
                onPointerEnter={() => setHover(day.toString())}
                onPointerLeave={() => setHover('')}
              >
                {hover === day.toString() && day.events.length > 0 && (
                  <div
                    className={`order-b pr-8 fixed right-0 bottom-0 z-10 flex min-h-[50%] min-w-[200px] animate-fadeIn 
                  flex-col rounded-tl-2xl rounded-bl-2xl bg-gray-50 text-center text-sm font-semibold leading-6 text-moon-blue translate-x-0  drop-shadow-[0_15px_15px_rgba(128,237,235,0.25)] dark:border-gray-600 dark:bg-blue-950 dark:text-moon-gold dark:drop-shadow-[0_15px_15px_rgba(255,242,122,0.25)]`}
                  >
                    {day.events.map((event: any, i: number) => (
                      <div
                        key={event.title + i}
                        className="justify-left flex w-full items-center p-2"
                      >
                        <div className="dark:dark-glass absolute left-0 top-0 z-10 h-full w-full rounded-2xl " />
                        <p className="ont-medium group z-20 flex w-full text-left text-black group-hover:text-moon-blue dark:text-gray-400">
                          {event.title}
                        </p>
                        <time
                          dateTime={event.date}
                          className="z-20 ml-3 flex-none text-black group-hover:text-moon-blue dark:text-gray-500 xl:block"
                        >
                          {format(parseISO(event.date), "hh:mm aaaaa'm'")}
                        </time>
                      </div>
                    ))}
                  </div>
                )}
                <time
                  dateTime={day.toString()}
                  className={
                    isSameDay(day, selectedDate)
                      ? 'flex h-6 w-6 items-center justify-center rounded-full bg-moon-blue font-semibold text-white'
                      : 'text-black dark:text-gray-200'
                  }
                >
                  {getDate(day)}
                </time>
                {day.events.length > 0 ? (
                  <ol className="mt-2">
                    {day.events.slice(0, 2).map((event: any) => (
                      <li key={event.date + event.title}>
                        <a href={event.href} className="group flex">
                          <p className="flex-auto truncate font-medium text-black group-hover:text-moon-blue dark:text-gray-400">
                            {event.title}
                          </p>
                          <time
                            dateTime={event.date}
                            className="ml-3 hidden flex-none text-black group-hover:text-moon-blue dark:text-gray-500 xl:block"
                          >
                            {format(parseISO(event.date), "hh:mm aaaaa'm'")}
                          </time>
                        </a>
                      </li>
                    ))}
                    {day.events.length > 2 && (
                      <li className="text-gray-200">
                        + {day.events.length - 2} more
                      </li>
                    )}
                  </ol>
                ) : (
                  <div className="py-10" />
                )}
              </div>
            ))}
          </div>
          <div className="isolate grid w-full grid-cols-7 grid-rows-4 gap-px lg:hidden">
            {monthEvents.map((day: any) => (
              <button
                key={day.toString()}
                type="button"
                className={classNames(
                  isSameMonth(day, selectedDate)
                    ? 'bg-white dark:bg-blue-950'
                    : 'bg-gray-50 dark:bg-stronger-light',
                  'flex h-14 flex-col px-3 py-2 text-black focus:z-10 dark:text-gray-200 dark:hover:bg-stronger-light'
                )}
                onClick={() => {
                  setSelectedDate(day)
                }}
              >
                <time
                  dateTime={day.toString()}
                  className={classNames(
                    isSameDay(day, selectedDate)
                      ? 'flex h-6 w-6 items-center justify-center rounded-full bg-moon-blue font-semibold text-white'
                      : 'flex h-6 w-6 items-center justify-center rounded-full',
                    'ml-auto'
                  )}
                >
                  {getDate(day)}
                </time>
                <span className="sr-only">{day.events.length} events</span>
                {day.events.length > 0 && (
                  <span className="-mx-0.5 mt-auto flex flex-wrap-reverse">
                    {day.events.map((event: any) => (
                      <span
                        key={event.date + event.title}
                        className="w-5.5 h-1.55 mx-0.5 mb-1 rounded-full bg-moon-blue dark:bg-gray-400"
                      />
                    ))}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {getDayEvents(selectedDate)?.length > 0 && (
        <div className="px-4 py-10 sm:px-6 lg:hidden">
          <ol className="divide-y divide-gray-100 overflow-hidden rounded-lg bg-white text-sm shadow ring-1 ring-black ring-opacity-5">
            {getDayEvents(selectedDate).map((event: any) => (
              <li
                key={event.date + event.title}
                className="group flex p-4 pr-6 focus-within:bg-gray-50 hover:bg-gray-50"
              >
                <div className="flex-auto">
                  <p className="font-semibold text-gray-900">{event.title}</p>
                  <time
                    dateTime={event.date}
                    className="mt-2 flex items-center text-gray-700"
                  >
                    <ClockIcon
                      className="mr-2 h-5 w-5 text-gray-400"
                      aria-hidden="true"
                    />
                    {format(parseISO(event.date), "hh:mm aaaaa'm'")}
                  </time>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}
