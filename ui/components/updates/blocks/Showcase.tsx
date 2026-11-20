import { ArrowRightIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'
import type { ReactNode } from 'react'
import type { CtaSpec, GraphicSpec, ScreensSpec, TimelineSpec } from '@/lib/updates/blocks'
import Figure from './Figure'

function SmartLink({
  href,
  className,
  children,
  label,
}: {
  href: string
  className?: string
  children: ReactNode
  label?: string
}) {
  if (href.startsWith('/') && !href.startsWith('//')) {
    return (
      <Link href={href} className={className} aria-label={label}>
        {children}
      </Link>
    )
  }
  return (
    <a
      href={href}
      className={className}
      aria-label={label}
      target={href.startsWith('#') ? undefined : '_blank'}
      rel={href.startsWith('#') ? undefined : 'noopener noreferrer'}
    >
      {children}
    </a>
  )
}

function BrowserFrame({ item }: { item: ScreensSpec['items'][number] }) {
  const shot = (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0b1020] shadow-[0_24px_60px_-28px_rgba(0,0,0,0.9)] transition-[border-color,transform] duration-300 group-hover:-translate-y-0.5 group-hover:border-blue-300/40">
      <div className="flex items-center gap-3 border-b border-white/[0.07] bg-white/[0.03] px-3 py-2">
        <span aria-hidden className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
        </span>
        {item.url && (
          <span className="min-w-0 flex-1 truncate rounded-md bg-black/40 px-2.5 py-1 text-center font-RobotoMono text-[11px] text-slate-400">
            {item.url}
          </span>
        )}
        {item.href && (
          <ArrowTopRightOnSquareIcon
            aria-hidden
            className="h-3.5 w-3.5 shrink-0 text-slate-500 transition-colors group-hover:text-blue-300"
          />
        )}
      </div>
      <img src={item.src} alt={item.alt} loading="lazy" className="block h-auto w-full" />
    </div>
  )
  return (
    <div>
      {item.href ? (
        <SmartLink href={item.href} className="group block" label={`Open ${item.url || item.alt}`}>
          {shot}
        </SmartLink>
      ) : (
        shot
      )}
      {item.caption && (
        <p className="mt-3 px-1 text-[13px] leading-relaxed text-slate-400">{item.caption}</p>
      )}
    </div>
  )
}

export function Screens({ spec }: { spec: ScreensSpec }) {
  const pair = spec.columns === 2 && spec.items.length > 1
  return (
    <Figure figure={spec.figure} title={spec.title} subtitle={spec.subtitle} source={spec.source}>
      <div
        className={`grid grid-cols-1 gap-6 px-1 pb-1 [&>*]:min-w-0 ${pair ? 'md:grid-cols-2' : ''}`}
      >
        {spec.items.map((item) => (
          <BrowserFrame key={item.src} item={item} />
        ))}
      </div>
    </Figure>
  )
}

export function Cta({ spec }: { spec: CtaSpec }) {
  return (
    <section className="relative my-14 overflow-hidden rounded-3xl border border-blue-300/20 bg-[radial-gradient(120%_120%_at_0%_0%,rgba(59,130,246,0.22),transparent_55%),radial-gradient(120%_120%_at_100%_100%,rgba(168,85,247,0.22),transparent_55%)] bg-[#070b18]">
      <span
        aria-hidden
        className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-blue-400/0 via-blue-300/70 to-purple-400/0"
      />
      <div className="p-6 md:p-10">
        {spec.eyebrow && (
          <p className="font-RobotoMono text-[11px] uppercase tracking-[0.22em] text-blue-300/90">
            {spec.eyebrow}
          </p>
        )}
        <p className="mt-3 max-w-[24ch] font-heading text-[26px] font-semibold leading-[1.15] tracking-tight text-white md:text-[34px]">
          {spec.title}
        </p>
        {spec.body && (
          <p className="mt-4 max-w-[60ch] text-[16px] leading-relaxed text-slate-300 md:text-[17px]">
            {spec.body}
          </p>
        )}
        {spec.image && (
          <SmartLink
            href={spec.actions[0].href}
            className="group mt-8 block"
            label={spec.actions[0].label}
          >
            <img
              src={spec.image.src}
              alt={spec.image.alt}
              loading="lazy"
              className="h-auto w-full rounded-2xl border border-white/10 shadow-[0_30px_80px_-30px_rgba(59,130,246,0.55)] transition-[border-color,transform] duration-300 group-hover:-translate-y-0.5 group-hover:border-blue-300/40"
            />
          </SmartLink>
        )}
        {spec.points && spec.points.length > 0 && (
          <ul className="mt-8 grid gap-3 md:grid-cols-3">
            {spec.points.map((point) => (
              <li
                key={point}
                className="flex gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-[15px] leading-snug text-slate-200"
              >
                <span
                  aria-hidden
                  className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-gradient-to-br from-blue-300 to-purple-300"
                />
                {point}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          {spec.actions.map((action) => (
            <SmartLink
              key={action.href}
              href={action.href}
              className={`inline-flex items-center justify-between gap-3 whitespace-nowrap rounded-full px-5 py-3 text-[15px] font-semibold no-underline transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/60 sm:justify-center sm:py-2.5 ${
                action.primary
                  ? 'bg-white text-slate-950 hover:bg-blue-100'
                  : 'border border-white/20 bg-white/[0.04] text-white hover:border-white/40 hover:bg-white/[0.08]'
              }`}
            >
              {action.label}
              <ArrowRightIcon aria-hidden className="h-4 w-4" />
            </SmartLink>
          ))}
        </div>
        {spec.note && (
          <p className="mt-5 text-[12px] leading-relaxed text-slate-500">{spec.note}</p>
        )}
      </div>
    </section>
  )
}

const MARKER = {
  done: 'border-blue-300 bg-blue-400',
  now: 'border-amber-100 bg-amber-300 shadow-[0_0_0_6px_rgba(252,211,77,0.15),0_0_24px_rgba(252,211,77,0.6)]',
  next: 'border-slate-500 bg-[#070b18]',
}

const DATE_TONE = {
  done: 'text-blue-300/90',
  now: 'text-amber-200',
  next: 'text-slate-500',
}

export function Timeline({ spec }: { spec: TimelineSpec }) {
  return (
    <Figure figure={spec.figure} title={spec.title} subtitle={spec.subtitle} source={spec.source}>
      <ol className="mx-2 mb-2 mt-1 md:mx-4">
        {spec.items.map((item, i) => {
          const status = item.status || 'done'
          const next = spec.items[i + 1]
          const solid = status === 'done' && (next?.status || 'done') !== 'next'
          return (
            <li
              key={`${item.date}-${item.title}`}
              className="relative grid grid-cols-[16px_1fr] gap-x-4 pb-7 last:pb-1 md:grid-cols-[128px_16px_1fr] md:gap-x-5"
            >
              <span
                aria-hidden
                className="relative col-start-1 row-span-2 row-start-1 md:col-start-2 md:row-span-1"
              >
                {next && (
                  <span
                    className={`absolute bottom-[-4px] left-1/2 top-[22px] -translate-x-1/2 ${
                      solid ? 'w-px bg-blue-400/45' : 'border-l border-dashed border-slate-600'
                    }`}
                  />
                )}
                <span
                  className={`absolute left-0 top-[3px] h-4 w-4 rounded-full border-2 ${MARKER[status]}`}
                />
              </span>
              <p
                className={`col-start-2 row-start-1 font-RobotoMono text-[11px] uppercase leading-[22px] tracking-[0.16em] md:col-start-1 md:text-right ${DATE_TONE[status]}`}
              >
                {item.date}
              </p>
              <div className="col-start-2 row-start-2 md:col-start-3 md:row-start-1">
                <p
                  className={`text-[16px] font-semibold leading-[22px] ${
                    status === 'next' ? 'text-slate-300' : 'text-white'
                  }`}
                >
                  {item.title}
                </p>
                {item.body && (
                  <p className="mt-1.5 text-[14px] leading-relaxed text-slate-400">{item.body}</p>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </Figure>
  )
}

export function Graphic({ spec }: { spec: GraphicSpec }) {
  const img = (
    <img src={spec.src} alt={spec.alt} loading="lazy" className="block h-auto w-full rounded-xl" />
  )
  return (
    <Figure figure={spec.figure} title={spec.title} subtitle={spec.subtitle} source={spec.source}>
      {spec.narrow ? (
        <picture>
          <source media="(max-width: 639px)" srcSet={spec.narrow} />
          {img}
        </picture>
      ) : (
        img
      )}
    </Figure>
  )
}
