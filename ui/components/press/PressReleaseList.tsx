import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline'
import React from 'react'
import formatPressDate from '@/lib/press/formatPressDate'
import type { PressRelease } from '@/lib/press/press-data'

function ReleaseMeta({ release }: { release: PressRelease }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-RobotoMono text-xs uppercase tracking-[0.2em] text-slate-400">
      <time dateTime={release.date}>{formatPressDate(release.date)}</time>
      <span aria-hidden className="text-slate-600">
        /
      </span>
      <span>{release.source}</span>
    </div>
  )
}

function FeaturedRelease({ release }: { release: PressRelease }) {
  return (
    <a
      href={release.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block rounded-2xl border border-blue-500/30 bg-gradient-to-r from-blue-600/20 to-purple-600/20 p-6 transition-all duration-200 hover:border-blue-400/50 md:p-8"
    >
      <ReleaseMeta release={release} />
      <h3 className="mt-3 font-GoodTimes text-xl leading-snug text-white transition-colors group-hover:text-slate-200 md:text-2xl">
        {release.title}
      </h3>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-300">{release.summary}</p>
      <span className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-blue-300 group-hover:text-blue-200">
        Read more
        <ArrowTopRightOnSquareIcon className="h-4 w-4" />
      </span>
    </a>
  )
}

function Release({ release }: { release: PressRelease }) {
  return (
    <a
      href={release.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block rounded-xl border border-slate-600/30 bg-gradient-to-b from-slate-700/20 to-slate-800/30 p-5 transition-all duration-200 hover:border-slate-500/50"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <ReleaseMeta release={release} />
          <h3 className="mt-2 font-semibold text-white transition-colors group-hover:text-slate-200">
            {release.title}
          </h3>
          <p className="mt-2 text-xs leading-relaxed text-slate-400">{release.summary}</p>
        </div>
        <ArrowTopRightOnSquareIcon className="mt-1 h-4 w-4 flex-shrink-0 text-slate-400 transition-colors group-hover:text-slate-300" />
      </div>
    </a>
  )
}

export default function PressReleaseList({ releases }: { releases: PressRelease[] }) {
  const [featured, ...rest] = releases

  return (
    <div className="flex flex-col gap-4">
      {featured && <FeaturedRelease release={featured} />}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {rest.map((release) => (
          <Release key={release.url} release={release} />
        ))}
      </div>
    </div>
  )
}
