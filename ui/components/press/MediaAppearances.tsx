import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline'
import React from 'react'
import formatPressDate from '@/lib/press/formatPressDate'
import type { MediaAppearance } from '@/lib/press/press-data'

function AppearanceList({ title, appearances }: { title: string; appearances: MediaAppearance[] }) {
  return (
    <div>
      <h3 className="mb-4 font-GoodTimes text-lg text-slate-400">{title}</h3>
      <ul className="flex flex-col gap-2">
        {appearances.map((appearance) => (
          <li key={appearance.url}>
            <a
              href={appearance.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-start justify-between gap-3 rounded-xl border border-slate-600/30 bg-gradient-to-b from-slate-700/20 to-slate-800/30 px-4 py-3 transition-all duration-200 hover:border-slate-500/50"
            >
              <div className="min-w-0">
                <span className="block font-RobotoMono text-xs uppercase leading-5 tracking-[0.2em] text-slate-400">
                  {appearance.program}
                </span>
                <span className="mt-1 block text-sm text-white transition-colors group-hover:text-slate-200">
                  {appearance.title}
                </span>
                {appearance.date && (
                  <time dateTime={appearance.date} className="mt-1 block text-xs text-slate-500">
                    {formatPressDate(appearance.date)}
                  </time>
                )}
              </div>
              <ArrowTopRightOnSquareIcon className="mt-1 h-4 w-4 flex-shrink-0 text-slate-500 transition-colors group-hover:text-slate-300" />
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function MediaAppearances({
  podcasts,
  videos,
}: {
  podcasts: MediaAppearance[]
  videos: MediaAppearance[]
}) {
  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
      <AppearanceList title="Podcasts" appearances={podcasts} />
      <AppearanceList title="Video" appearances={videos} />
    </div>
  )
}
