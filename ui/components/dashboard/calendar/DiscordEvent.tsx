//@ts-nocheck
import { parseISO } from 'date-fns'
import { useEffect, useState } from 'react'

export function DiscordEvent({ discordEvent }: any) {
  const [formattedDate, setFormattedDate] = useState('')
  const [formattedTime, setFormattedTime] = useState('')

  useEffect(() => {
    const date = new Date(discordEvent.scheduled_start_time)
    const userLocale = navigator.language

    const localDate = date.toLocaleDateString(userLocale, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })

    const localTime = date.toLocaleTimeString(userLocale, {
      hour: 'numeric',
      minute: 'numeric',
      hour12: true,
    })

    setFormattedDate(localDate)
    setFormattedTime(localTime)
  }, [discordEvent.scheduled_start_time])

  return (
    <div className="p-4 bg-darkest-cool flex flex-col w-full items-center gap-2 font-RobotoMono text-center lg:text-left lg:items-start lg:px-4">
      <h1 className="font-bold text-light-warm lg:text-lg xl:text-[20px]">
        {discordEvent.name}
      </h1>
      <p className="text-gray-900 dark:text-white text-sm lg:text-base xl:text-lg">
        {formattedDate + ' @ ' + formattedTime}
      </p>
    </div>
  )
}
