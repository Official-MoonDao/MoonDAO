import { Menu, Transition } from '@headlessui/react'
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EllipsisHorizontalIcon,
  LinkIcon,
} from '@heroicons/react/20/solid'
import { addMonths, isToday, format, addWeeks } from 'date-fns'
import { Fragment } from 'react'

function classNames(...classes: any) {
  return classes.filter(Boolean).join(' ')
}

export default function CalendarHeader({
  selectedDate,
  setSelectedDate,
  isMonthlyView,
  setIsMonthlyView,
  calendarLink,
}: any) {
  const nextMonth = () => {
    setSelectedDate(addMonths(selectedDate, 1))
  }

  const prevMonth = () => {
    setSelectedDate(addMonths(selectedDate, -1))
  }

  const nextWeek = () => {
    setSelectedDate(addWeeks(selectedDate, 1))
  }

  const prevWeek = () => {
    setSelectedDate(addWeeks(selectedDate, -1))
  }

  return (
    <header className="flex items-center justify-between  py-2 lg:mx-10 lg:max-w-[1200px] lg:flex-none">
      <h1 className="font-GoodTimes text-lg text-blue-950 underline decoration-blue-400 dark:text-gray-100 dark:decoration-moon-gold lg:text-xl">
        <time dateTime="2022-01">{format(selectedDate, 'MMMM yyyy')}</time>
      </h1>
      <div className="flex items-center">
        <div className="flex items-center rounded-md border border-gray-300 bg-white shadow  dark:border-moon-gold dark:bg-slate-700 dark:shadow-yellow-100 lg:items-stretch ">
          <button
            type="button"
            className="flex items-center justify-center rounded-md py-2 pl-3 pr-4 text-gray-400 hover:bg-gray-200  hover:text-gray-500 focus:relative dark:hover:bg-slate-600 lg:w-9 lg:px-2"
          >
            <span className="sr-only">Previous month</span>
            <ChevronLeftIcon
              className="h-5 w-5 fill-current dark:text-moon-gold dark:hover:text-yellow-300"
              aria-hidden="true"
              onClick={() => {
                isMonthlyView ? prevMonth() : prevWeek()
              }}
            />
          </button>
          <button
            type="button"
            className="hidden  px-3.5 text-sm font-medium text-gray-700 hover:bg-gray-200 hover:text-gray-900 focus:relative dark:text-gray-100 dark:hover:bg-slate-600 dark:hover:text-white lg:block"
          >
            {isToday(selectedDate)
              ? 'Today'
              : format(selectedDate, 'iiii dd MMMM')}
          </button>
          <span className="relative -mx-px h-5 w-px bg-gray-300 lg:hidden" />
          <button
            type="button"
            className="flex items-center justify-center rounded-md py-2 pl-4 pr-3 text-gray-400 hover:bg-gray-200 hover:text-gray-500 focus:relative dark:hover:bg-slate-600 md:w-9 md:px-2"
          >
            <span className="sr-only">Next month</span>
            <ChevronRightIcon
              className="h-5 w-5 fill-current dark:text-moon-gold dark:hover:text-yellow-300"
              aria-hidden="true"
              onClick={() => {
                isMonthlyView ? nextMonth() : nextWeek()
              }}
            />
          </button>
        </div>

        <div className="hidden lg:ml-4 lg:flex lg:items-center">
          <Menu as="div" className="relative">
            <Menu.Button
              type="button"
              className="flex items-center rounded-md border border-gray-300 bg-white py-2 pl-3 pr-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-moon-gold dark:bg-slate-700 dark:text-gray-100 dark:shadow-yellow-100 hover:dark:bg-slate-600"
            >
              {isMonthlyView ? 'Month view' : 'Week View'}
              <ChevronDownIcon
                className="ml-2 h-5 w-5 fill-current text-gray-400 dark:text-moon-gold"
                aria-hidden="true"
              />
            </Menu.Button>

            <Transition
              as={Fragment}
              enter="transition ease-out duration-100"
              enterFrom="transform opacity-0 scale-95"
              enterTo="transform opacity-100 scale-100"
              leave="transition ease-in duration-75"
              leaveFrom="transform opacity-100 scale-100"
              leaveTo="transform opacity-0 scale-95"
            >
              <Menu.Items className="absolute right-0 z-10 mt-3 w-36 origin-top-right overflow-hidden rounded-md bg-white shadow-lg  ring-1 ring-black ring-opacity-5 focus:outline-none dark:bg-slate-700 dark:hover:bg-gray-600 dark:hover:text-white">
                <div>
                  <Menu.Item>
                    {({ active }) => (
                      <button
                        className={classNames(
                          active
                            ? 'bg-gray-100 text-gray-900 '
                            : 'text-gray-700 dark:text-gray-100',
                          'block w-full px-4 py-2 text-sm'
                        )}
                        onClick={() => setIsMonthlyView(false)}
                      >
                        Week view
                      </button>
                    )}
                  </Menu.Item>
                  <Menu.Item>
                    {({ active }) => (
                      <button
                        className={classNames(
                          active
                            ? 'bg-gray-100 text-gray-900'
                            : 'text-gray-700 dark:text-gray-100',
                          'block w-full px-4 py-2 text-sm'
                        )}
                        onClick={() => {
                          setIsMonthlyView(true)
                        }}
                      >
                        Month view
                      </button>
                    )}
                  </Menu.Item>
                </div>
              </Menu.Items>
            </Transition>
          </Menu>

          <div className="ml-6 h-6 w-px bg-gray-300" />
          <button
            type="button"
            className="ml-6 flex items-center rounded-md border border-transparent bg-moon-blue px-4  py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-950 focus:outline-none focus:ring-2 focus:ring-moon-blue focus:ring-offset-2 dark:bg-amber-500 dark:hover:bg-amber-600"
            onClick={() => {
              navigator.clipboard.writeText(calendarLink)
            }}
          >
            Copy calendar link
            <LinkIcon
              className="ml-2 h-5 w-5 text-gray-200"
              aria-hidden="true"
            />
          </button>
        </div>

        <Menu as="div" className="relative ml-6 lg:hidden">
          <Menu.Button className="-mx-2 flex items-center rounded-full border border-transparent p-2 text-gray-400 hover:text-gray-500">
            <span className="sr-only">Open menu</span>
            <EllipsisHorizontalIcon className="h-5 w-5" aria-hidden="true" />
          </Menu.Button>

          <Transition
            as={Fragment}
            enter="transition ease-out duration-100"
            enterFrom="transform opacity-0 scale-95"
            enterTo="transform opacity-100 scale-100"
            leave="transition ease-in duration-75"
            leaveFrom="transform opacity-100 scale-100"
            leaveTo="transform opacity-0 scale-95"
          >
            <Menu.Items className="absolute right-0 z-10 mt-3 w-36 origin-top-right divide-y divide-gray-100 overflow-hidden rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
              <div className="py-1">
                <Menu.Item>
                  {({ active }) => (
                    <button
                      className={classNames(
                        active ? 'bg-gray-100 text-gray-900' : 'text-gray-700',
                        'block w-full px-4 py-2 text-sm'
                      )}
                    >
                      Go to today
                    </button>
                  )}
                </Menu.Item>
              </div>
              <div className="py-1">
                <Menu.Item>
                  {({ active }) => (
                    <button
                      //@ts-ignore
                      href="#"
                      className={classNames(
                        active ? 'bg-gray-100 text-gray-900' : 'text-gray-700',
                        'block w-full px-4 py-2 text-sm'
                      )}
                      onClick={() => setIsMonthlyView(false)}
                    >
                      Day view
                    </button>
                  )}
                </Menu.Item>
                <Menu.Item>
                  {({ active }) => (
                    <button
                      //@ts-ignore
                      href="#"
                      className={classNames(
                        active ? 'bg-gray-100 text-gray-900' : 'text-gray-700',
                        'block w-full px-4 py-2 text-sm'
                      )}
                      onClick={() => setIsMonthlyView(true)}
                    >
                      Month view
                    </button>
                  )}
                </Menu.Item>
              </div>
            </Menu.Items>
          </Transition>
        </Menu>
      </div>
    </header>
  )
}
