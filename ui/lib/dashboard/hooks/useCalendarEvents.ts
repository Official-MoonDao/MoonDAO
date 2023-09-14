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
          //get current date and format the same as "20220427T010000Z"
          let currentDate = new Date()
          let currentYear = currentDate.getFullYear()
          let currentMonth = currentDate.getMonth() + 1
          let currentDay = currentDate.getDate()
          let currentHour = currentDate.getHours()
          let currentMinute = currentDate.getMinutes()
          let currentSecond = currentDate.getSeconds()
          let currentMonthString = currentMonth.toString()
          let currentDayString = currentDay.toString()
          let currentHourString = currentHour.toString()
          let currentMinuteString = currentMinute.toString()
          let currentSecondString = currentSecond.toString()
          if (currentMonth < 10) {
            currentMonthString = '0' + currentMonthString
          }
          if (currentDay < 10) {
            currentDayString = '0' + currentDayString
          }
          if (currentHour < 10) {
            currentHourString = '0' + currentHourString
          }
          if (currentMinute < 10) {
            currentMinuteString = '0' + currentMinuteString
          }
          if (currentSecond < 10) {
            currentSecondString = '0' + currentSecondString
          }
          let currentDateString =
            currentYear +
            currentMonthString +
            currentDayString +
            'T' +
            currentHourString +
            currentMinuteString +
            currentSecondString +
            'Z'
          //filter out events that have already passed
          let filteredEvents: any = {}
          let filteredEvents_i = 0
          for (let i = 0; i < Object.keys(events).length; i++) {
            if (events[i].date > currentDateString) {
              filteredEvents[filteredEvents_i] = events[i]
              filteredEvents_i++
            }
          }

          setEvents([...Object.values(filteredEvents)])
        }
      }
    }
  }

  useEffect(() => {
    getEventData()
  }, [])

  return { events }
}
