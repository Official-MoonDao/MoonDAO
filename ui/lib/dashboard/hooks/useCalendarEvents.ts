import { useEffect, useState } from 'react'

const CALENDAR_LINK =
  'https://sesh.fyi/api/calendar/v2/1NtkbbR6C4pu9nfgPwPGQn.ics'

export function useCalendarEvents() {
  const [events, setEvents] = useState<any>()

  function getEventData() {
    let request = new XMLHttpRequest()
    request.open('GET', CALENDAR_LINK, true)
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

  useEffect(() => {
    getEventData()
  }, [])

  return events
}
