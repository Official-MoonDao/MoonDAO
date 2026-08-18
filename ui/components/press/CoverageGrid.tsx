import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline'
import React from 'react'
import formatPressDate, { pressYear } from '@/lib/press/formatPressDate'
import type { CoverageItem } from '@/lib/press/press-data'

function CoverageCard({ item }: { item: CoverageItem }) {
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col rounded-xl border border-slate-600/30 bg-gradient-to-b from-slate-700/20 to-slate-800/30 p-5 transition-all duration-200 hover:border-slate-500/50"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="font-RobotoMono text-xs uppercase leading-5 tracking-[0.2em] text-slate-400">
          {item.outlet}
        </span>
        <ArrowTopRightOnSquareIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-500 transition-colors group-hover:text-slate-300" />
      </div>
      <h3 className="mt-3 flex-1 font-semibold leading-snug text-white transition-colors group-hover:text-slate-200">
        {item.title}
      </h3>
      <time dateTime={item.date} className="mt-3 text-xs text-slate-400">
        {formatPressDate(item.date)}
      </time>
    </a>
  )
}

export default function CoverageGrid({ coverage }: { coverage: CoverageItem[] }) {
  const years = Array.from(new Set(coverage.map((item) => pressYear(item.date))))

  return (
    <div className="flex flex-col gap-8">
      {years.map((year) => (
        <div key={year}>
          <h3 className="mb-4 font-GoodTimes text-lg text-slate-400">{year}</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {coverage
              .filter((item) => pressYear(item.date) === year)
              .map((item) => (
                <CoverageCard key={item.url} item={item} />
              ))}
          </div>
        </div>
      ))}
    </div>
  )
}
