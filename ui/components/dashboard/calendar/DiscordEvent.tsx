//@ts-nocheck
import { parseISO } from 'date-fns'
import Image from 'next/image'
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

  // Construct Discord CDN image URL if image hash exists
  const getEventImageUrl = () => {
    if (discordEvent.image) {
      return `https://cdn.discordapp.com/guild-events/${discordEvent.id}/${discordEvent.image}.png?size=512`
    }
    return null
  }

  const eventImageUrl = getEventImageUrl()

  return (
    <div className="p-4 bg-darkest-cool flex flex-col w-full items-center gap-2 font-RobotoMono text-center lg:text-left lg:items-start lg:px-4 overflow-hidden rounded-lg">
      {/* Event Image */}
      {eventImageUrl && (
        <div className="w-full mb-3 relative h-48 rounded-lg overflow-hidden">
          <Image
            src={eventImageUrl}
            alt={`${discordEvent.name} event image`}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        </div>
      )}
      
      {/* Event Details */}
      <h1 className="font-bold text-light-warm lg:text-lg xl:text-[20px]">
        {discordEvent.name}
      </h1>
      <p className="text-gray-900 dark:text-white text-sm lg:text-base xl:text-lg">
        {formattedDate + ' @ ' + formattedTime}
      </p>
      
      {/* Event Description */}
      {discordEvent.description && (
        <p className="text-gray-600 dark:text-gray-300 text-xs lg:text-sm mt-2 overflow-hidden" style={{
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
        }}>
          {discordEvent.description}
        </p>
      )}
    </div>
  )
}
