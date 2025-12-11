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
