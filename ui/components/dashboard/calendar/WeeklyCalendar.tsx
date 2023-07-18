import {
  addDays,
  getDay,
  getDate,
  startOfWeek,
  endOfWeek,
  isSameDay,
  parseISO,
  format,
  getHours,
  getMinutes,
} from 'date-fns'
import { useEffect, useRef, useState } from 'react'

function classNames(...classes: any) {
  return classes.filter(Boolean).join(' ')
}

export default function WeeklyCalendar({
  selectedDate,
  setSelectedDate,
  events,
  getDayEvents,
}: any) {
  const [weekDays, setWeekDays] = useState<any>([])

  const container = useRef(null)
  const containerNav = useRef(null)
  const containerOffset = useRef(null)

  function getWeekdaysEvents() {
    /*
    Gets all days of the selected week, with their respective events.
    */
    let startDate = startOfWeek(selectedDate, { weekStartsOn: 1 })
    let endDate = endOfWeek(selectedDate, { weekStartsOn: 1 })

    let day: any = startDate
    let days = []

    while (day <= endDate) {
      day.events = getDayEvents(day)
      days.push(day)
      day = addDays(day, 1)
    }
    return days
  }

  function getWeekEvents() {
    /*
    Returns array of events which occur on the selected week.
    */
    let weekevents = []
    for (var i = 0; i < weekDays.length; i++) {
      if (weekDays[i].events) {
        weekevents.push(...weekDays[i].events)
      }
    }

    return weekevents
  }

  useEffect(() => {
    setWeekDays(getWeekdaysEvents())
  }, [selectedDate, events])

  return (
    <div className="flex flex-col lg:mx-10 lg:max-w-[1200px] mt-8 rounded border border-blue-600 shadow-md shadow-blue-300 dark:border-amber-100 dark:shadow-amber-200">
      <div
        ref={container}
        className="isolate flex flex-auto flex-col overflow-auto rounded bg-white dark:bg-blue-950"
      >
        <div
          style={{ width: '165%' }}
          className="flex max-w-full flex-none flex-col sm:max-w-none lg:max-w-full"
        >
          <div
            ref={containerNav}
            className="sticky top-0 z-30 flex-none bg-white shadow ring-1 ring-black ring-opacity-5 dark:bg-blue-950"
          >
            <div className="grid grid-cols-7 text-sm leading-6 text-black dark:text-gray-200 sm:hidden">
              {weekDays.map((day: any) => (
                <button
                  key={day.toString()}
                  type="button"
                  className="flex flex-col items-center pt-2 pb-3"
                  onClick={() => {
                    setSelectedDate(day)
                  }}
                >
                  {format(day, 'EEEEE') + ' '}
                  <span
                    className={classNames(
                      isSameDay(day, selectedDate)
                        ? 'rounded-full bg-moon-blue font-semibold text-white'
                        : 'font-semibold text-gray-600 dark:text-gray-400',
                      'mt-1 flex h-8 w-8 items-center justify-center'
                    )}
                  >
                    {getDate(day)}
                  </span>
                </button>
              ))}
            </div>

            <div className="-mr-px hidden grid-cols-7 border-b border-gray-200 text-sm leading-6 text-gray-500 dark:border-gray-600 sm:grid">
              <div className="col-end-1 w-14" />

              {weekDays.map((day: any) => (
                <div
                  className="flex items-center justify-center py-3 text-black dark:text-moon-gold"
                  key={day.toString() + 'mobile'}
                  onClick={() => {
                    setSelectedDate(day)
                  }}
                >
                  <span
                    className={classNames(
                      isSameDay(day, selectedDate) ? 'flex items-baseline' : ''
                    )}
                  >
                    {format(day, 'EEE') + ' '}
                    <span
                      className={classNames(
                        isSameDay(day, selectedDate)
                          ? 'ml-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-moon-blue font-semibold text-white'
                          : 'items-center justify-center font-semibold text-gray-600 dark:text-gray-200'
                      )}
                    >
                      {getDate(day)}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-auto ">
            <div className="sticky left-0 z-10 w-14 flex-none bg-white ring-1 ring-gray-100 dark:bg-blue-950" />
            <div className="grid flex-auto grid-cols-1 grid-rows-1">
              {/* Horizontal lines */}
              <div
                className="col-start-1 col-end-2 row-start-1 grid divide-y divide-gray-200 dark:divide-gray-600"
                style={{ gridTemplateRows: 'repeat(48, minmax(3.5rem, 1fr))' }}
              >
                <div ref={containerOffset} className="row-end-1 h-7"></div>
                <div>
                  <div className="sticky left-0 z-20 -mt-2.5 -ml-14 w-14 pr-2 text-right text-xs leading-5 text-gray-400">
                    12AM
                  </div>
                </div>
                <div />
                <div>
                  <div className="sticky left-0 z-20 -mt-2.5 -ml-14 w-14 pr-2 text-right text-xs leading-5 text-gray-400">
                    1AM
                  </div>
                </div>
                <div />
                <div>
                  <div className="sticky left-0 z-20 -mt-2.5 -ml-14 w-14 pr-2 text-right text-xs leading-5 text-gray-400">
                    2AM
                  </div>
                </div>
                <div />
                <div>
                  <div className="sticky left-0 z-20 -mt-2.5 -ml-14 w-14 pr-2 text-right text-xs leading-5 text-gray-400">
                    3AM
                  </div>
                </div>
                <div />
                <div>
                  <div className="sticky left-0 z-20 -mt-2.5 -ml-14 w-14 pr-2 text-right text-xs leading-5 text-gray-400">
                    4AM
                  </div>
                </div>
                <div />
                <div>
                  <div className="sticky left-0 z-20 -mt-2.5 -ml-14 w-14 pr-2 text-right text-xs leading-5 text-gray-400">
                    5AM
                  </div>
                </div>
                <div />
                <div>
                  <div className="sticky left-0 z-20 -mt-2.5 -ml-14 w-14 pr-2 text-right text-xs leading-5 text-gray-400">
                    6AM
                  </div>
                </div>
                <div />
                <div>
                  <div className="sticky left-0 z-20 -mt-2.5 -ml-14 w-14 pr-2 text-right text-xs leading-5 text-gray-400">
                    7AM
                  </div>
                </div>
                <div />
                <div>
                  <div className="sticky left-0 z-20 -mt-2.5 -ml-14 w-14 pr-2 text-right text-xs leading-5 text-gray-400">
                    8AM
                  </div>
                </div>
                <div />
                <div>
                  <div className="sticky left-0 z-20 -mt-2.5 -ml-14 w-14 pr-2 text-right text-xs leading-5 text-gray-400">
                    9AM
                  </div>
                </div>
                <div />
                <div>
                  <div className="sticky left-0 z-20 -mt-2.5 -ml-14 w-14 pr-2 text-right text-xs leading-5 text-gray-400">
                    10AM
                  </div>
                </div>
                <div />
                <div>
                  <div className="sticky left-0 z-20 -mt-2.5 -ml-14 w-14 pr-2 text-right text-xs leading-5 text-gray-400">
                    11AM
                  </div>
                </div>
                <div />
                <div>
                  <div className="sticky left-0 z-20 -mt-2.5 -ml-14 w-14 pr-2 text-right text-xs leading-5 text-gray-400">
                    12PM
                  </div>
                </div>
                <div />
                <div>
                  <div className="sticky left-0 z-20 -mt-2.5 -ml-14 w-14 pr-2 text-right text-xs leading-5 text-gray-400">
                    1PM
                  </div>
                </div>
                <div />
                <div>
                  <div className="sticky left-0 z-20 -mt-2.5 -ml-14 w-14 pr-2 text-right text-xs leading-5 text-gray-400">
                    2PM
                  </div>
                </div>
                <div />
                <div>
                  <div className="sticky left-0 z-20 -mt-2.5 -ml-14 w-14 pr-2 text-right text-xs leading-5 text-gray-400">
                    3PM
                  </div>
                </div>
                <div />
                <div>
                  <div className="sticky left-0 z-20 -mt-2.5 -ml-14 w-14 pr-2 text-right text-xs leading-5 text-gray-400">
                    4PM
                  </div>
                </div>
                <div />
                <div>
                  <div className="sticky left-0 z-20 -mt-2.5 -ml-14 w-14 pr-2 text-right text-xs leading-5 text-gray-400">
                    5PM
                  </div>
                </div>
                <div />
                <div>
                  <div className="sticky left-0 z-20 -mt-2.5 -ml-14 w-14 pr-2 text-right text-xs leading-5 text-gray-400">
                    6PM
                  </div>
                </div>
                <div />
                <div>
                  <div className="sticky left-0 z-20 -mt-2.5 -ml-14 w-14 pr-2 text-right text-xs leading-5 text-gray-400">
                    7PM
                  </div>
                </div>
                <div />
                <div>
                  <div className="sticky left-0 z-20 -mt-2.5 -ml-14 w-14 pr-2 text-right text-xs leading-5 text-gray-400">
                    8PM
                  </div>
                </div>
                <div />
                <div>
                  <div className="sticky left-0 z-20 -mt-2.5 -ml-14 w-14 pr-2 text-right text-xs leading-5 text-gray-400">
                    9PM
                  </div>
                </div>
                <div />
                <div>
                  <div className="sticky left-0 z-20 -mt-2.5 -ml-14 w-14 pr-2 text-right text-xs leading-5 text-gray-400">
                    10PM
                  </div>
                </div>
                <div />
                <div>
                  <div className="sticky left-0 z-20 -mt-2.5 -ml-14 w-14 pr-2 text-right text-xs leading-5 text-gray-400">
                    11PM
                  </div>
                </div>
                <div />
              </div>

              {/* Vertical lines */}
              <div className="col-start-1 col-end-2 row-start-1 hidden grid-cols-7 grid-rows-1 divide-x divide-gray-200 dark:divide-gray-600 sm:grid sm:grid-cols-7">
                <div className="col-start-1 row-span-full" />
                <div className="col-start-2 row-span-full" />
                <div className="col-start-3 row-span-full" />
                <div className="col-start-4 row-span-full" />
                <div className="col-start-5 row-span-full" />
                <div className="col-start-6 row-span-full" />
                <div className="col-start-7 row-span-full" />
              </div>

              {/* Events */}
              <ol
                className="col-start-1 col-end-2 row-start-1 grid grid-cols-1 sm:grid-cols-7"
                style={{
                  gridTemplateRows: '1.75rem repeat(288, minmax(0, 1fr)) auto',
                }}
              >
                {getWeekEvents().map((event) => (
                  <li
                    key={event.date + event.title}
                    className={classNames(
                      isSameDay(selectedDate, parseISO(event.date))
                        ? ``
                        : `invisible sm:visible `,
                      `relative mt-px flex col-start-${
                        getDay(parseISO(event.date)) == 0
                          ? 7
                          : getDay(parseISO(event.date))
                      }`
                    )}
                    // style={{ gridRow: "2 / span 12" }}
                    style={{
                      gridRow: `${
                        getHours(parseISO(event.date)) * 12 +
                        getMinutes(parseISO(event.date)) * 0.1 +
                        2
                      } / span 12`,
                    }}
                  >
                    <a
                      href={event.href}
                      className="group absolute inset-1 flex flex-col overflow-y-auto rounded-lg bg-blue-50 p-2 text-xs leading-5 hover:bg-blue-100"
                    >
                      <p className="order-1 font-semibold text-blue-700">
                        {event.title}
                      </p>
                      <p className="text-blue-500 group-hover:text-blue-700">
                        <time dateTime="2022-01-12T06:00">
                          {format(parseISO(event.date), "hh:mm aaaaa'm")}{' '}
                        </time>
                      </p>
                    </a>
                  </li>
                ))}

                {getWeekEvents().map((event) => (
                  <li
                    key={event.date + event.title}
                    className={classNames(
                      isSameDay(selectedDate, parseISO(event.date))
                        ? `visible sm:invisible  col-start-1`
                        : `invisible`,
                      `relative mt-px flex`
                    )}
                    // style={{ gridRow: "2 / span 12" }}
                    style={{
                      gridRow: `${
                        getHours(parseISO(event.date)) * 12 +
                        getMinutes(parseISO(event.date)) * 0.1 +
                        2
                      } / span 12`,
                    }}
                  >
                    <a
                      href={event.href}
                      className="group absolute inset-1 flex flex-col overflow-y-auto rounded-lg bg-blue-50 p-2 text-xs leading-5 hover:bg-blue-100"
                    >
                      <p className="order-1 font-semibold text-blue-700">
                        {event.title}
                      </p>
                      <p className="text-blue-500 group-hover:text-blue-700">
                        <time dateTime="2022-01-12T06:00">
                          {format(parseISO(event.date), "hh:mm aaaaa'm")}{' '}
                        </time>
                      </p>
                    </a>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
