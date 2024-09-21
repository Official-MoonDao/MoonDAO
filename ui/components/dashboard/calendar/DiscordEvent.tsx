//@ts-nocheck
import { parseISO } from 'date-fns'

export function DiscordEvent({ discordEvent }: any) {
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

  return (
    <div className="bg-dark-cool rounded-[20px] flex flex-col w-full gap-2 p-5 font-RobotoMono text-left items-start lg:px-5">
      <h1 className="font-GoodTimes text-lg">
        {discordEvent.name}
      </h1>
      <p className="text-gray-900 dark:text-white text-sm lg:text-base xl:text-lg">
        {localDate + ' @ ' + localTime}
      </p>
    </div>
  )
}
