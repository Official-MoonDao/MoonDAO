import { LinkIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'
import toast from 'react-hot-toast'
import type { UpdateMeta } from '@/lib/updates/types'
import UpdateMetaLine from './UpdateMeta'

export default function UpdateHeader({ update }: { update: UpdateMeta }) {
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      toast.success('Link copied')
    } catch {
      toast.error('Could not copy link')
    }
  }

  return (
    <header className="mb-10">
      <Link href="/updates" className="text-sm font-medium text-blue-300 hover:text-blue-200">
        ← All updates
      </Link>
      <div className="mt-6">
        <UpdateMetaLine
          category={update.category}
          date={update.date}
          readingMinutes={update.readingMinutes}
        />
      </div>
      <h1 className="mt-4 font-GoodTimes text-3xl leading-tight text-white md:text-5xl">
        {update.title}
      </h1>
      <p className="mt-5 text-lg leading-relaxed text-slate-300 md:text-xl">{update.description}</p>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-y border-white/10 py-4">
        <p className="text-sm text-slate-300">
          <span className="text-white">{update.author}</span>
          {update.authorRole ? (
            <span className="text-slate-400"> · {update.authorRole}</span>
          ) : null}
        </p>
        <button
          type="button"
          onClick={copyLink}
          className="inline-flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-white"
        >
          <LinkIcon className="h-4 w-4" />
          Copy link
        </button>
      </div>
      {update.image && (
        // No fixed height: the natural aspect ratio never crops the artwork.
        <img src={update.image} alt="" className="mt-8 h-auto w-full rounded-2xl" />
      )}
    </header>
  )
}
