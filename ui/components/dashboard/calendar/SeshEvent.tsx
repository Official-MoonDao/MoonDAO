//@ts-nocheck
import { parseISO } from 'date-fns'

export function SeshEvent({ seshEvent }: any) {
  const formattedISODate = parseISO(
    seshEvent.date.replace(/(\r\n|\n|\r)/gm, '')
  )

  const date = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: true,
    timeZone: 'America/Chicago',
  }).format(formattedISODate)

  return (
    <div className="bg-[#0a0f12] border border-[rgba(0,255,200,0.12)] flex flex-col w-full items-center gap-2 p-2 font-RobotoMono text-center lg:text-left lg:items-start lg:px-4">
      <h1 className="text-[#ff9f1c] lg:text-lg xl:text-[20px]">
        {seshEvent.title}
      </h1>
      <p className="text-[#e0fff0] text-sm lg:text-base xl:text-lg">
        {date}
      </p>
    </div>
  )
}
