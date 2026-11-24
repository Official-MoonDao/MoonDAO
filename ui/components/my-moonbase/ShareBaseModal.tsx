import { ArrowDownTrayIcon, LinkIcon, ShareIcon } from '@heroicons/react/24/outline'
import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import toastStyle from '@/lib/marketplace/marketplace-utils/toastConfig'
import { baseSharePath, baseShareText, baseShareUrl, racesLine } from '@/lib/my-moonbase/share'
import { canvasToBlob, composeBaseCard, shareBase } from '@/lib/my-moonbase/shareCard'
import type { BaseSyncStatus } from '@/lib/my-moonbase/useMoonbaseSync'
import Modal from '@/components/layout/Modal'

type Stage = 'preparing' | 'ready' | 'failed'

const BUTTON =
  'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50'
const SECONDARY = `${BUTTON} flex-1 border border-white/10 bg-white/5 text-white hover:bg-white/10`

function nextFrames(count: number): Promise<void> {
  return new Promise((resolve) => {
    const step = (left: number) =>
      left <= 0 ? resolve() : requestAnimationFrame(() => step(left - 1))
    step(count)
  })
}

/**
 * The share window: saves anything outstanding so the link shows what is on
 * screen, takes a picture of the plot for the post, and offers the link.
 */
export default function ShareBaseModal({
  name,
  predicted,
  total,
  status,
  touch,
  capture,
  saveNow,
  onSignIn,
  onClose,
}: {
  name: string
  /** Races the visitor has predicted, and how many there are. */
  predicted: number
  total: number
  status: BaseSyncStatus
  touch: boolean
  /** The plot as it stands, or null when there is no picture to take. */
  capture: () => HTMLCanvasElement | null
  /** Saves the base and resolves to its share id. */
  saveNow: () => Promise<string | null>
  onSignIn: () => void
  onClose: () => void
}) {
  const [stage, setStage] = useState<Stage>('preparing')
  const [id, setId] = useState<string | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [attempt, setAttempt] = useState(0)
  const blobRef = useRef<Blob | null>(null)
  const inputs = useRef({ name, predicted, total, capture, saveNow })
  inputs.current = { name, predicted, total, capture, saveNow }

  // Nothing to link to until the base is saved to an account, and nothing to
  // prepare while the account's own copy is still being read or chosen.
  const waiting = status === 'checking'
  const blocked =
    status === 'local' || status === 'unavailable' || status === 'conflict' ? status : null

  useEffect(() => {
    if (blocked || waiting) return
    let cancelled = false
    setStage('preparing')
    void (async () => {
      // Two frames, so the selection outline cleared on the way in is gone from the picture.
      await nextFrames(2)
      if (cancelled) return
      const current = inputs.current
      const frame = current.capture()
      const savedId = await current.saveNow()
      if (cancelled) return
      if (!savedId) {
        setStage('failed')
        return
      }
      setId(savedId)
      if (frame) {
        await document.fonts?.ready.catch(() => undefined)
        const card = composeBaseCard({
          frame,
          name: current.name,
          detail:
            racesLine(current.predicted, current.total) || 'Predict the winners. Build the base.',
        })
        const blob = await canvasToBlob(card)
        if (cancelled) return
        blobRef.current = blob
        if (blob) setImageUrl(URL.createObjectURL(blob))
      }
      setStage('ready')
    })()
    return () => {
      cancelled = true
    }
  }, [blocked, waiting, attempt])

  useEffect(
    () => () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl)
    },
    [imageUrl]
  )

  const link = id ? `${window.location.origin}${baseSharePath(id)}` : ''

  const share = async () => {
    if (!id) return
    const result = await shareBase({
      blob: blobRef.current,
      text: baseShareText(name, predicted, total),
      url: baseShareUrl(window.location.origin, id, touch ? 'sheet' : 'x'),
      preferSheet: touch,
    })
    setNote(
      result === 'clipboard' ? 'Image copied. Press Ctrl+V (⌘V) in the post to attach it.' : ''
    )
  }

  const copyLink = async () => {
    if (!id) return
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable')
      await navigator.clipboard.writeText(baseShareUrl(window.location.origin, id, 'copy'))
      toast.success('Link copied', { style: toastStyle })
    } catch {
      toast.error('Could not copy the link. Select it and copy it by hand.', { style: toastStyle })
    }
  }

  return (
    <Modal id="share-base-modal" setEnabled={onClose} title="Share your base" size="md">
      <div className="space-y-4 text-sm text-white/80" data-testid="share-base">
        {blocked === 'local' && (
          <>
            <p>
              Your base is saved in this browser only, so there is no link to it yet. Predict a race
              or sign in and it is saved to your account, with a link anyone can open.
            </p>
            <button
              type="button"
              onClick={() => {
                onClose()
                onSignIn()
              }}
              className={`${BUTTON} w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-500 hover:to-purple-500`}
            >
              Sign in
            </button>
          </>
        )}
        {blocked === 'unavailable' && (
          <p>Bases cannot be saved to an account on this server, so there is no link to share.</p>
        )}
        {blocked === 'conflict' && (
          <p>
            Your account already holds a different base. Choose which one to keep, in the panel
            behind this window, then share it.
          </p>
        )}

        {!blocked && (waiting || stage === 'preparing') && (
          <div className="flex items-center gap-3 py-6 text-white/60">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white/70" />
            Saving your base and taking its picture…
          </div>
        )}

        {!blocked && !waiting && stage === 'failed' && (
          <>
            <p className="text-amber-200/90">
              Your base could not be saved to your account, so there is no link yet. Nothing is
              lost: it is still in this browser.
            </p>
            <button type="button" onClick={() => setAttempt((n) => n + 1)} className={SECONDARY}>
              Try again
            </button>
          </>
        )}

        {!blocked && !waiting && stage === 'ready' && id && (
          <>
            {imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt={`A picture of the base ${name}`}
                className="w-full rounded-xl border border-white/10"
              />
            )}
            <p>
              Anyone with this link can look around your base and see which hardware you predicted.
              It always shows the base as you last left it.
            </p>
            <input
              readOnly
              value={link}
              aria-label="Link to your base"
              onFocus={(e) => e.currentTarget.select()}
              className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-white/80 outline-none focus:border-cyan-300/50"
            />
            <button
              type="button"
              onClick={() => void share()}
              className={`${BUTTON} w-full bg-gradient-to-r from-amber-300 via-orange-400 to-rose-400 text-base font-extrabold text-black hover:brightness-110`}
            >
              <ShareIcon className="h-5 w-5" />
              Share your base
            </button>
            {note && <p className="text-xs font-semibold text-emerald-300">{note}</p>}
            <div className="flex gap-2">
              <button type="button" onClick={() => void copyLink()} className={SECONDARY}>
                <LinkIcon className="h-4 w-4" />
                Copy link
              </button>
              {imageUrl && (
                <a href={imageUrl} download="my-moonbase.png" className={SECONDARY}>
                  <ArrowDownTrayIcon className="h-4 w-4" />
                  Save image
                </a>
              )}
            </div>
            <a
              href={baseSharePath(id)}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-center text-xs text-white/50 underline-offset-2 hover:text-white hover:underline"
            >
              See what visitors see
            </a>
          </>
        )}
      </div>
    </Modal>
  )
}
