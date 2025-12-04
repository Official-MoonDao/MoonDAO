import { CalendarIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { generateGoogleCalendarUrl, generateICalUrl } from '../../lib/townhall/luma'

const TOWN_HALL_TIME = {
  hour: 14,
  minute: 0,
  timezone: 'America/Chicago',
}

function getNextTownHallDate(): Date {
  const now = new Date()

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: TOWN_HALL_TIME.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  const parts = formatter.formatToParts(now)
  const cstNow = {
    year: parseInt(parts.find((p) => p.type === 'year')?.value || '0'),
    month: parseInt(parts.find((p) => p.type === 'month')?.value || '0'),
    day: parseInt(parts.find((p) => p.type === 'day')?.value || '0'),
    hour: parseInt(parts.find((p) => p.type === 'hour')?.value || '0'),
    minute: parseInt(parts.find((p) => p.type === 'minute')?.value || '0'),
  }

  let targetDay = cstNow.day
  let targetMonth = cstNow.month
  let targetYear = cstNow.year

  if (
    cstNow.hour > TOWN_HALL_TIME.hour ||
    (cstNow.hour === TOWN_HALL_TIME.hour && cstNow.minute >= TOWN_HALL_TIME.minute)
  ) {
    const nextWeek = new Date(cstNow.year, cstNow.month - 1, cstNow.day)
    nextWeek.setDate(nextWeek.getDate() + 7)
    targetDay = nextWeek.getDate()
    targetMonth = nextWeek.getMonth() + 1
    targetYear = nextWeek.getFullYear()
  }

  const cstDateStr = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(
    targetDay
  ).padStart(2, '0')}`
  const cstTimeStr = `${String(TOWN_HALL_TIME.hour).padStart(2, '0')}:${String(
    TOWN_HALL_TIME.minute
  ).padStart(2, '0')}:00`

  const tempDate = new Date(`${cstDateStr}T${cstTimeStr}`)
  const cstOffset = getCSTOffsetMinutes(tempDate)
  const cstDateTimeStr = `${cstDateStr}T${cstTimeStr}${formatOffset(cstOffset)}`

  const cstDate = new Date(cstDateTimeStr)

  return cstDate
}

function getCSTOffsetMinutes(date: Date): number {
  const year = date.getFullYear()
  const marchSecondSunday = getNthSundayOfMonth(year, 2, 2)
  const novemberFirstSunday = getNthSundayOfMonth(year, 10, 1)

  const isDST = date >= marchSecondSunday && date < novemberFirstSunday

  return isDST ? -300 : -360
}

function getNthSundayOfMonth(year: number, month: number, n: number): Date {
  const firstDay = new Date(year, month, 1)
  const firstSunday = new Date(firstDay)
  firstSunday.setDate(1 + ((7 - firstDay.getDay()) % 7))
  firstSunday.setDate(firstSunday.getDate() + (n - 1) * 7)
  return firstSunday
}

function formatOffset(minutes: number): string {
  const absMinutes = Math.abs(minutes)
  const hours = Math.floor(absMinutes / 60)
  const mins = absMinutes % 60
  const sign = minutes < 0 ? '-' : '+'
  return `${sign}${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
}

function formatTimeRemaining(ms: number): {
  days: number
  hours: number
  minutes: number
  seconds: number
} {
  const days = Math.floor(ms / (1000 * 60 * 60 * 24))
  const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((ms % (1000 * 60)) / 1000)

  return { days, hours, minutes, seconds }
}

export default function NextTownHall() {
  const [nextTownHall, setNextTownHall] = useState<Date>(getNextTownHallDate())
  const [timeRemaining, setTimeRemaining] = useState<{
    days: number
    hours: number
    minutes: number
    seconds: number
  }>({ days: 0, hours: 0, minutes: 0, seconds: 0 })

  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date()
      const next = getNextTownHallDate()
      setNextTownHall(next)

      const diff = next.getTime() - now.getTime()
      setTimeRemaining(formatTimeRemaining(diff))
    }

    updateCountdown()
    const interval = setInterval(updateCountdown, 1000)

    return () => clearInterval(interval)
  }, [])

  const formattedDate = nextTownHall.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: TOWN_HALL_TIME.timezone,
  })

  const formattedTime = nextTownHall.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: TOWN_HALL_TIME.timezone,
  })

  const eventTitle = 'MoonDAO Town Hall'
  const eventDescriptionPlain = `Weekly Town Hall meeting where we discuss proposals, make decisions, share updates, and coordinate on projects.

Watch Live Stream:
LinkedIn: https://www.linkedin.com/company/moondao
YouTube: https://www.youtube.com/@officialmoondao
X (Twitter): https://x.com/OfficialMoonDAO
Discord: https://discord.com/channels/914720248140279868/917498630510878821

View on Luma: https://lu.ma/moondao`

  const eventDescriptionHTML = `Weekly Town Hall meeting where we discuss proposals, make decisions, share updates, and coordinate on projects.<br><br><strong>Watch Live Stream:</strong><br><a href="https://www.linkedin.com/company/moondao">LinkedIn</a><br><a href="https://www.youtube.com/@officialmoondao">YouTube</a><br><a href="https://x.com/OfficialMoonDAO">X (Twitter)</a><br><a href="https://discord.com/channels/914720248140279868/917498630510878821">Discord</a><br><br><a href="https://lu.ma/moondao">View on Luma</a>`

  const eventLocation = 'MoonDAO'

  const googleCalendarUrl = generateGoogleCalendarUrl({
    title: eventTitle,
    startTime: nextTownHall.toISOString(),
    endTime: new Date(nextTownHall.getTime() + 60 * 60 * 1000).toISOString(),
    description: eventDescriptionHTML,
    location: eventLocation,
    timeZone: TOWN_HALL_TIME.timezone,
  })

  const icalUrl = generateICalUrl({
    title: eventTitle,
    startTime: nextTownHall.toISOString(),
    endTime: new Date(nextTownHall.getTime() + 60 * 60 * 1000).toISOString(),
    description: eventDescriptionPlain,
    location: eventLocation,
    timeZone: TOWN_HALL_TIME.timezone,
  })

  return (
    <div className="bg-gradient-to-r from-purple-600/20 to-blue-600/20 border border-purple-500/30 rounded-xl p-4 mb-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4 flex-1">
          <CalendarIcon className="w-5 h-5 text-purple-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm mb-1">
              {formattedDate} at {formattedTime} CST
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              {timeRemaining.days > 0 && (
                <div className="flex items-baseline gap-1">
                  <span className="text-lg font-bold text-white">{timeRemaining.days}</span>
                  <span className="text-xs text-slate-400">d</span>
                </div>
              )}
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-bold text-white">
                  {String(timeRemaining.hours).padStart(2, '0')}
                </span>
                <span className="text-xs text-slate-400">h</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-bold text-white">
                  {String(timeRemaining.minutes).padStart(2, '0')}
                </span>
                <span className="text-xs text-slate-400">m</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-bold text-white">
                  {String(timeRemaining.seconds).padStart(2, '0')}
                </span>
                <span className="text-xs text-slate-400">s</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0 w-full sm:w-auto">
          <Link
            href={googleCalendarUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-slate-700/60 hover:bg-slate-700/80 border border-slate-600/60 hover:border-slate-500/80 text-white font-medium rounded-lg transition-all duration-200 text-sm whitespace-nowrap text-center shadow-sm hover:shadow-md hover:scale-[1.02]"
          >
            Google Calendar
          </Link>
          <a
            href={icalUrl}
            download="moondao-townhall.ics"
            className="px-4 py-2 bg-slate-700/60 hover:bg-slate-700/80 border border-slate-600/60 hover:border-slate-500/80 text-white font-medium rounded-lg transition-all duration-200 text-sm whitespace-nowrap text-center shadow-sm hover:shadow-md hover:scale-[1.02]"
          >
            iCal/Outlook
          </a>
          <Link
            href="https://lu.ma/moondao"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-gradient-to-r from-purple-600/60 to-blue-600/60 hover:from-purple-600/80 hover:to-blue-600/80 border border-purple-500/60 hover:border-purple-400/80 text-white font-medium rounded-lg transition-all duration-200 text-sm whitespace-nowrap text-center shadow-sm hover:shadow-md hover:scale-[1.02]"
          >
            View on Luma
          </Link>
        </div>
      </div>
    </div>
  )
}
