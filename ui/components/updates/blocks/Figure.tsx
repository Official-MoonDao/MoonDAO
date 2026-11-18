import type { ReactNode } from 'react'

export type LegendItem = {
  name: string
  color?: string
  shape?: 'dot' | 'tick' | 'square' | 'dash'
}

export function Legend({ items }: { items: LegendItem[] }) {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-slate-300">
      {items.map((item) => (
        <li key={item.name} className="flex items-center gap-2">
          {item.shape === 'tick' ? (
            <span aria-hidden className="h-3.5 w-[3px] rounded-full bg-white" />
          ) : item.shape === 'dash' ? (
            <span
              aria-hidden
              className="w-4 border-t-2 border-dashed"
              style={{ borderColor: item.color }}
            />
          ) : (
            <span
              aria-hidden
              className={`h-2.5 w-2.5 ${item.shape === 'square' ? 'rounded-sm' : 'rounded-full'}`}
              style={{ background: item.color }}
            />
          )}
          {item.name}
        </li>
      ))}
    </ul>
  )
}

export default function Figure({
  figure,
  title,
  subtitle,
  source,
  legend,
  children,
}: {
  figure?: string
  title?: string
  subtitle?: string
  source?: string
  legend?: LegendItem[]
  children: ReactNode
}) {
  return (
    <figure className="my-12 overflow-hidden rounded-2xl border border-white/10 bg-[#070b18]/70 shadow-[0_20px_60px_-30px_rgba(59,130,246,0.35)]">
      <div className="px-5 pt-6 md:px-7">
        {figure && (
          <p className="font-RobotoMono text-[11px] uppercase tracking-[0.22em] text-blue-300/80">
            {figure}
          </p>
        )}
        {title && (
          <p className="mt-2 font-heading text-lg font-semibold leading-snug text-white md:text-xl">
            {title}
          </p>
        )}
        {subtitle && (
          <p className="mt-2 max-w-[62ch] text-[14px] leading-relaxed text-slate-400">{subtitle}</p>
        )}
        {legend && legend.length > 0 && (
          <div className="mt-4">
            <Legend items={legend} />
          </div>
        )}
      </div>
      <div className="px-3 pb-4 pt-4 md:px-5">{children}</div>
      {source && (
        <figcaption className="border-t border-white/5 bg-white/[0.015] px-5 py-3 text-[12px] leading-relaxed text-slate-500 md:px-7">
          {source}
        </figcaption>
      )}
    </figure>
  )
}
