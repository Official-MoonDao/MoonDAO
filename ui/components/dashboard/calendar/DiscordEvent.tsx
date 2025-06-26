//@ts-nocheck
import { parseISO } from 'd    <div className="bg-gradient-to-b from-slate-700/20 to-slate-800/30 backdrop-blur-xl border border-white/10 rounded-xl p-6 shadow-lg min-h-[140px] flex flex-col transition-all duration-300 hover:bg-gradient-to-b hover:from-slate-600/30 hover:to-slate-700/40 hover:shadow-xl">{te-fns'
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
    <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-6 shadow-lg min-h-[140px] flex flex-col transition-all duration-300 hover:bg-white/10 hover:shadow-xl">
      {/* Event Image */}
      {eventImageUrl && (
        <div className="w-full mb-4 relative h-32 rounded-lg overflow-hidden">
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
      <div className="flex-1 flex flex-col">
        <h1 className="font-bold text-white text-lg xl:text-xl mb-2 line-clamp-2">
          {discordEvent.name}
        </h1>
        <p className="text-blue-200 text-sm lg:text-base mb-3 font-medium">
          {formattedDate + ' @ ' + formattedTime}
        </p>
        
        {/* Event Description */}
        {discordEvent.description && (
          <p className="text-white/70 text-sm flex-1 line-clamp-3 leading-relaxed">
            {discordEvent.description}
          </p>
        )}
      </div>
    </div>
  )
}
