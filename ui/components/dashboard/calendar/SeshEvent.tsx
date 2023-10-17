//@ts-nocheck
import { parseISO } from 'date-fns'

export function SeshEvent({ seshEvent }: any) {
  const formattedISODate = parseISO(
    seshEvent.date.replace(/(\r\n|\n|\r)/gm, '')
  )
  const date =
    new Date(formattedISODate).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }) +
    ' @ ' +
    new Date(formattedISODate).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: 'numeric',
      hour12: true,
    })


  return (
    <div className="flex flex-col w-full items-center gap-2 p-2 font-RobotoMono border dark:border-white dark:border-opacity-20 text-center lg:text-left lg:items-start lg:px-4">
      <h1 className="text-indigo-500 dark:text-moon-orange lg:text-lg xl:text-[20px]">{seshEvent.title}</h1>
      <p className="text-gray-900 dark:text-white text-sm lg:text-base xl:text-lg">{date}</p>
    </div>
  )
}
