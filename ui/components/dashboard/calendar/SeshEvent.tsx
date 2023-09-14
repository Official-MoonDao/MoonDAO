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

  console.log(date)

  return (
    <div className="flex flex-col w-full items-center gap-2 py-2">
      <h1 className="text-indigo-500 dark:text-moon-gold">{seshEvent.title}</h1>
      <p className="text-black dark:text-white">{date}</p>
    </div>
  )
}
