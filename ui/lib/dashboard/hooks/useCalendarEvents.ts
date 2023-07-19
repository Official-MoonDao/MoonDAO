import { parseISO, isSameDay } from 'date-fns'
import { useEffect, useState } from 'react'

export function useCalendarEvents(calendarLink: string) {
  const [events, setEvents] = useState<any>()

  function getEventData() {
    let request = new XMLHttpRequest()
    request.open('GET', calendarLink, true)
    request.send(null)
    request.onreadystatechange = function () {
      if (request.readyState === 4 && request.status === 200) {
        let type: any = request.getResponseHeader('Content-Type')
        if (type.indexOf('text') !== 1) {
          let lines = request.responseText.split('\n')
          let events: any = {}
          let events_i = 0
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes('DTSTART')) {
              let date = lines[i].split(':')
              events[events_i] = { date: date[1] }
            } else if (lines[i].includes('SUMMARY')) {
              let title = lines[i].split(':')
              events[events_i]['title'] = title[1]
            } else if (lines[i].includes('END:VEVENT')) {
              events_i++
            }
          }
          setEvents(events)
        }
      }
    }
  }

  function getDayEvents(date: any) {
    /*
    Gets all events on the specified date.
    */
    if (events == null) return date

    date.events = []

    for (var i = 0; i < Object.keys(events).length; i++) {
      events[i].date = events[i].date.replace(/(\r\n|\n|\r)/gm, '')

      var eventDate = parseISO(events[i].date)

      if (isSameDay(eventDate, date)) {
        date.events.push(events[i])
      }
    }

    return date.events
  }

  useEffect(() => {
    getEventData()
  }, [])

  return { events, getDayEvents }
}
