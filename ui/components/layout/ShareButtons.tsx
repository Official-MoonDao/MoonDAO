import { LinkIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

type ShareButtonsProps = {
  url: string
  /** Tweet body; the URL is appended by X. */
  text: string
  className?: string
  shareLabel?: string
  copyLabel?: string
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

/** Share-to-X plus copy-link pair, shared by job and marketplace listing pages. */
export default function ShareButtons({
  url,
  text,
  className = '',
  shareLabel = 'Share',
  copyLabel = 'Copy link',
}: ShareButtonsProps) {
  const xShareHref = `https://x.com/intent/tweet?text=${encodeURIComponent(
    text,
  )}&url=${encodeURIComponent(url)}`

  async function copyLink() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable')
      await navigator.clipboard.writeText(url)
      toast.success('Link copied')
    } catch {
      toast.error('Could not copy the link')
    }
  }

  return (
    <div className={`flex gap-2 ${className}`}>
      <a
        id="share-on-x-button"
        href={xShareHref}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white hover:bg-white/10 transition-colors"
      >
        <XIcon className="h-4 w-4" />
        {shareLabel}
      </a>
      <button
        id="copy-link-button"
        type="button"
        onClick={copyLink}
        className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white hover:bg-white/10 transition-colors"
      >
        <LinkIcon className="h-4 w-4" />
        {copyLabel}
      </button>
    </div>
  )
}
