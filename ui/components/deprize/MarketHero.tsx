// Shell for a slide in the /deprize hero carousel: breadcrumb and title on
// top, outcomes and the prize on the left, the odds chart on the right.
import type { ReactNode } from 'react'

export default function MarketHero({
  eyebrow,
  title,
  subtitle,
  href,
  rows,
  chart,
  pool,
  footer,
  notice,
}: {
  eyebrow: ReactNode
  title: string
  subtitle?: string
  href: string
  rows: ReactNode
  chart: ReactNode
  pool?: ReactNode
  footer?: ReactNode
  notice?: ReactNode
}) {
  return (
    <article className="h-full rounded-2xl border border-white/[0.08] bg-white/[0.035] p-5 sm:p-6">
      {/* Right padding clears the carousel arrows drawn over this corner. */}
      <div className="pr-20">
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-gray-400">
          {eyebrow}
        </div>
        <a
          href={href}
          className="mt-1 block rounded-lg font-heading text-xl font-semibold leading-snug text-white hover:underline underline-offset-4 decoration-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 sm:text-2xl"
        >
          {title}
        </a>
        {subtitle && <p className="mt-1 line-clamp-2 text-sm text-gray-400">{subtitle}</p>}
      </div>

      <div className="mt-5 grid gap-6 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <div className="flex min-w-0 flex-col">
          <div className="flex flex-col">{rows}</div>
          {(pool || footer) && (
            <div className="mt-auto flex flex-wrap items-end justify-between gap-3 pt-5">
              {pool}
              {footer}
            </div>
          )}
          {notice}
        </div>
        <div className="min-w-0">{chart}</div>
      </div>
    </article>
  )
}
