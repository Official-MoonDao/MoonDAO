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
    <div className="bg-white dark:bg-slate-900 flex flex-col w-full items-center gap-2 p-2 font-RobotoMono border dark:border-white dark:border-opacity-20 text-center lg:text-left lg:items-start lg:px-4">
      <h1 className="text-orange-500 dark:text-moon-orange lg:text-lg xl:text-[20px]">
        {discordEvent.name}
      </h1>
      <p className="text-gray-900 dark:text-white text-sm lg:text-base xl:text-lg">
        {localDate + ' @ ' + localTime}
      </p>
    </div>
  )
}
