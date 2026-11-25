import { ArrowLeftIcon, LinkIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'
import toast from 'react-hot-toast'
import formatUpdateDate from '@/lib/updates/formatUpdateDate'
import type { UpdateMeta } from '@/lib/updates/types'

const SHARE_BUTTON =
  'inline-flex h-10 items-center justify-center gap-2 rounded-full border border-white/10 px-3.5 text-[13px] sm:h-9 text-slate-300 transition-colors hover:border-white/25 hover:text-white'

export default function UpdateHeader({ update }: { update: UpdateMeta }) {
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      toast.success('Link copied')
    } catch {
      toast.error('Could not copy link')
    }
  }

  function shareOnX() {
    const url = encodeURIComponent(window.location.href)
    const text = encodeURIComponent(update.title)
    window.open(
      `https://x.com/intent/tweet?text=${text}&url=${url}`,
      '_blank',
      'noopener,noreferrer'
    )
  }

  return (
    <header>
      <Link
        href="/updates"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-400 transition-colors hover:text-white"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        All updates
      </Link>

      <div className="mt-6 max-w-[900px] md:mt-8">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-RobotoMono text-[11px] uppercase tracking-[0.22em]">
          <span className="rounded-full border border-blue-400/30 bg-blue-400/10 px-2.5 py-1 text-blue-200">
            {update.category}
          </span>
          {update.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="text-slate-500">
              #{tag}
            </span>
          ))}
        </p>
        <h1 className="mt-4 break-words font-heading text-[28px] font-semibold leading-[1.12] tracking-tight text-white sm:text-[34px] md:mt-5 md:text-[52px] md:leading-[1.08]">
          {update.title}
        </h1>
        {/* A newsletter issue's description is its opening lines, already in the body. */}
        {update.source !== 'newsletter' && (
          <p className="mt-4 max-w-[760px] text-base leading-relaxed text-slate-300 sm:text-lg md:mt-5 md:text-xl">
            {update.description}
          </p>
        )}
      </div>

      <div className="mt-6 flex flex-col gap-4 border-y border-white/10 py-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between md:mt-8">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 ring-1 ring-white/20">
            <img src="/assets/MoonDAO-Logo-White.svg" alt="" className="h-5 w-5" />
          </span>
          <div className="min-w-0 leading-tight">
            <p className="text-[15px] font-medium text-white">
              {update.author}
              {update.authorRole ? (
                <span className="font-normal text-slate-400"> · {update.authorRole}</span>
              ) : null}
            </p>
            <p className="mt-1 text-[13px] text-slate-400">
              <time dateTime={update.date}>{formatUpdateDate(update.date)}</time>
              <span aria-hidden className="mx-2 text-slate-600">
                ·
              </span>
              {update.readingMinutes} min read
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 items-center gap-2 sm:flex">
          <button type="button" onClick={shareOnX} className={SHARE_BUTTON}>
            <svg viewBox="0 0 24 24" aria-hidden className="h-3.5 w-3.5 fill-current">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            Share
          </button>
          <button type="button" onClick={copyLink} className={SHARE_BUTTON}>
            <LinkIcon className="h-4 w-4" />
            Copy link
          </button>
        </div>
      </div>

      {update.image && (
        <figure className="mt-6 md:mt-8">
          <div className="relative overflow-hidden rounded-2xl ring-1 ring-white/10">
            <img
              src={update.image}
              alt={update.imageAlt || ''}
              className="aspect-[1200/630] w-full object-cover object-center md:aspect-[2/1]"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#070b18]/40 via-transparent to-transparent"
            />
          </div>
          {update.imageCaption && (
            <figcaption className="mt-3 text-[13px] text-slate-500">
              {update.imageCaption}
            </figcaption>
          )}
        </figure>
      )}
    </header>
  )
}
