export interface LumaEvent {
  id: string
  name: string
  description?: string
  start_at: string
  end_at?: string
  timezone: string
  url: string
  cover_url?: string
}

export interface LumaEventsResponse {
  events: LumaEvent[]
}

// Fetches the next townhall event from Luma calendar
export async function getNextTownHallEvent(): Promise<LumaEvent | null> {
  const calendarId = 'cal-7mKdy93TZVlA0Xh'
  const apiKey = process.env.LUMA_API_KEY

  if (!apiKey) {
    return null
  }

  try {
    const response = await fetch(`https://api.lu.ma/api/v1/calendars/${calendarId}/events`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-luma-api-key': apiKey,
      },
    })

    if (!response.ok) {
      console.error(`[luma] API error: ${response.status} ${response.statusText}`)
      return null
    }

    const data: LumaEventsResponse = await response.json()
    const events = data.events || []

    if (events.length === 0) {
      return null
    }

    // Filter for upcoming events and get the next one
    const now = new Date()
    const upcomingEvents = events
      .filter((event) => {
        const startTime = new Date(event.start_at)
        return startTime > now
      })
      .sort((a, b) => {
        const dateA = new Date(a.start_at).getTime()
        const dateB = new Date(b.start_at).getTime()
        return dateA - dateB
      })

    return upcomingEvents.length > 0 ? upcomingEvents[0] : null
  } catch (error) {
    console.error('[luma] Error fetching event:', error)
    return null
  }
}

export interface LumaCalendarEvent {
  id: string
  name: string
  startAt: string
  url: string
  coverUrl?: string
  guestCount?: number
}

const LUMA_CALENDAR_URL = 'https://lu.ma/moondao'
const GENERIC_TOWN_HALL = /^\s*moondao\s+town\s+hall\s*$/i

/**
 * Upcoming events from the embedded __NEXT_DATA__ JSON of the public Luma
 * calendar page. Pure, so it can be tested with saved HTML. Plain recurring
 * "MoonDAO Town Hall" events are kept only when they're the soonest, so
 * special sessions aren't crowded out by the weekly default.
 */
export function parseLumaCalendarPage(
  html: string,
  now: Date,
  limit = 3
): LumaCalendarEvent[] {
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/)
  if (!match) return []

  let data: any
  try {
    data = JSON.parse(match[1])?.props?.pageProps?.initialData?.data
  } catch {
    return []
  }
  if (!data) return []

  const items: any[] = [
    ...(data.featured_items || []),
    ...(data.upcoming?.entries || []),
    ...(data.event_items || []),
    ...(data.items || []),
  ]

  const byId = new Map<string, LumaCalendarEvent>()
  for (const item of items) {
    const event = item?.event ?? item
    const id = event?.api_id
    const startAt = event?.start_at
    if (!id || !startAt || byId.has(id)) continue
    if (!(new Date(startAt).getTime() > now.getTime())) continue
    if (typeof event.name !== 'string' || !event.name.trim()) continue
    const guestCount = Number(item?.guest_count)
    byId.set(id, {
      id,
      name: event.name.trim(),
      startAt,
      url: event.url ? `https://lu.ma/${encodeURIComponent(event.url)}` : LUMA_CALENDAR_URL,
      coverUrl:
        typeof event.cover_url === 'string' && event.cover_url.startsWith('https://')
          ? event.cover_url
          : undefined,
      guestCount: Number.isFinite(guestCount) && guestCount > 0 ? guestCount : undefined,
    })
  }

  const sorted = Array.from(byId.values()).sort(
    (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
  )
  const [first, ...rest] = sorted
  if (!first) return []
  return [first, ...rest.filter((e) => !GENERIC_TOWN_HALL.test(e.name))].slice(0, limit)
}

// Scrapes the public calendar page, so no LUMA_API_KEY is needed.
export async function getUpcomingLumaEvents(limit = 3): Promise<LumaCalendarEvent[]> {
  const res = await fetch(LUMA_CALENDAR_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; moondao-site/1.0)',
      Accept: 'text/html,application/xhtml+xml',
    },
    redirect: 'follow',
  })
  if (!res.ok) throw new Error(`Luma calendar page returned ${res.status}`)
  return parseLumaCalendarPage(await res.text(), new Date(), limit)
}

//Generates a calendar add URL for Google Calendar
export function generateGoogleCalendarUrl(event: {
  title: string
  startTime: string
  endTime?: string
  description?: string
  location?: string
  timeZone?: string
}): string {
  const startDate = new Date(event.startTime)
  const endDate = event.endTime
    ? new Date(event.endTime)
    : new Date(startDate.getTime() + 60 * 60 * 1000)

  const start = startDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  const end = endDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${start}/${end}`,
    details: event.description || '',
    location: event.location || '',
  })

  if (event.timeZone) {
    params.append('ctz', event.timeZone)
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

//Generates a calendar add URL for iCal/Outlook
export function generateICalUrl(event: {
  title: string
  startTime: string
  endTime?: string
  description?: string
  location?: string
  timeZone?: string
}): string {
  const startDate = new Date(event.startTime)
  const endDate = event.endTime
    ? new Date(event.endTime)
    : new Date(startDate.getTime() + 60 * 60 * 1000)

  const start = startDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  const end = endDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'

  const ical = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//MoonDAO//Town Hall//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
    `SUMMARY:${event.title}`,
    `DESCRIPTION:${(event.description || '').replace(/\n/g, '\\n')}`,
    `LOCATION:${event.location || ''}`,
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')

  return `data:text/calendar;charset=utf8,${encodeURIComponent(ical)}`
}
