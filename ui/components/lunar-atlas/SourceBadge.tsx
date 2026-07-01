import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline'
import type { SourceRef } from '@/lib/lunar-atlas/types'

// A small external-link chip for a cited public source. Every stated goal in
// the atlas is backed by one of these.
export default function SourceBadge({ source }: { source: SourceRef }) {
  return (
    <a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      title={source.retrievedAt ? `Retrieved ${source.retrievedAt}` : source.url}
      className="inline-flex max-w-full items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/70 transition hover:border-cyan-400/40 hover:text-cyan-200"
    >
      <span className="truncate">{source.label}</span>
      <ArrowTopRightOnSquareIcon className="h-3 w-3 shrink-0 opacity-70" />
    </a>
  )
}
