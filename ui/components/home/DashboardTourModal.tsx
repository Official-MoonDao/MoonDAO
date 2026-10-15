import { XMarkIcon } from '@heroicons/react/24/outline'
import { DASHBOARD_TOUR_VIMEO_URL } from 'const/config'
import { useCallback, useEffect, useRef, useState } from 'react'
import { networkCard } from '@/lib/layout/styles'
import CtaButton from '@/components/home/landing/CtaButton'
import { VIMEO_ORIGIN, postToVimeo } from '@/components/layout/FilmPlayer'
import Modal from '@/components/layout/Modal'

export type DashboardTourSource = 'mint' | 'header'

type DashboardTourModalProps = {
  source: DashboardTourSource
  profileEditHref: string
  onClose: () => void
}

const PROGRESS_STEPS = [25, 50, 75]

function sendEvent(name: string, params: Record<string, unknown> = {}) {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return
  window.gtag('event', name, { event_category: 'dashboard_tour', ...params })
}

/**
 * The "Welcome, Citizen" dashboard tour in a modal. The iframe mounts with the
 * modal and unmounts on close, so nothing from Vimeo loads on a normal
 * dashboard visit and the audio stops the moment it closes. It autoplays with
 * sound; if the browser blocks that, Vimeo shows its own play button.
 */
export default function DashboardTourModal({
  source,
  profileEditHref,
  onClose,
}: DashboardTourModalProps) {
  const [ended, setEnded] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const secondsRef = useRef(0)

  const close = useCallback(() => {
    sendEvent('dashboard_tour_close', {
      source,
      seconds: Math.round(secondsRef.current),
      completed: ended,
    })
    onClose()
  }, [source, ended, onClose])

  useEffect(() => {
    sendEvent('dashboard_tour_open', { source })
    closeRef.current?.focus()
  }, [source])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [close])

  // Player messages: progress at 25/50/75% and completion, each once.
  useEffect(() => {
    const sent = new Set<number>()
    const onMessage = (e: MessageEvent) => {
      const iframe = iframeRef.current
      if (e.origin !== VIMEO_ORIGIN || !iframe || e.source !== iframe.contentWindow) return
      let msg: any = e.data
      if (typeof msg === 'string') {
        try {
          msg = JSON.parse(msg)
        } catch {
          return
        }
      }
      // The player replies with the legacy event names (playProgress, finish)
      // when messaged with JSON strings, so accept both forms.
      switch (msg?.event) {
        case 'ready':
          postToVimeo(iframe, 'addEventListener', 'timeupdate')
          postToVimeo(iframe, 'addEventListener', 'ended')
          break
        case 'timeupdate':
        case 'playProgress': {
          if (typeof msg.data?.seconds === 'number') secondsRef.current = msg.data.seconds
          const percent = (msg.data?.percent ?? 0) * 100
          for (const step of PROGRESS_STEPS) {
            if (percent >= step && !sent.has(step)) {
              sent.add(step)
              sendEvent('dashboard_tour_progress', { source, percent: step })
            }
          }
          break
        }
        case 'ended':
        case 'finish':
          sendEvent('dashboard_tour_complete', { source })
          setEnded(true)
          break
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [source])

  if (!DASHBOARD_TOUR_VIMEO_URL) return null

  const sep = DASHBOARD_TOUR_VIMEO_URL.includes('?') ? '&' : '?'
  const src = `${DASHBOARD_TOUR_VIMEO_URL}${sep}autoplay=1&title=0&byline=0&portrait=0&dnt=1`

  return (
    <Modal
      id="dashboard-tour-modal"
      setEnabled={(enabled) => {
        if (!enabled) close()
      }}
      showCloseButton={false}
      showToaster={false}
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-auto bg-black/80 backdrop-blur-sm p-4 animate-fadeIn"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dashboard-tour-title"
        className="w-[92vw] max-w-5xl"
      >
        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            <p className="text-white/40 text-xs font-semibold uppercase tracking-widest">
              Welcome, Citizen
            </p>
            <h2
              id="dashboard-tour-title"
              className="font-heading text-white text-lg sm:text-2xl font-semibold"
            >
              Your dashboard in 90 seconds
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={close}
            aria-label="Close tour"
            className="p-2 -mr-2 text-white/60 hover:text-white transition-colors rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>
        <div className={`relative aspect-video w-full overflow-hidden ${networkCard.base}`}>
          {ended ? (
            // Matches the film's last beat: the two next steps.
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#010208] p-4 text-center md:gap-6">
              <p className="font-heading text-lg font-semibold text-white md:text-2xl">
                You're all set. See you in Discord.
              </p>
              <div className="flex flex-col items-center gap-3 sm:flex-row sm:gap-4">
                <CtaButton href={profileEditHref} variant="primary">
                  Complete your profile
                </CtaButton>
                <CtaButton href="https://moondao.com/discord" target="_blank" variant="secondary">
                  Join Discord
                </CtaButton>
              </div>
              <button
                type="button"
                onClick={close}
                className="min-h-[44px] px-2 text-sm font-medium text-white/55 hover:text-white transition-colors"
              >
                Close
              </button>
            </div>
          ) : (
            <iframe
              ref={iframeRef}
              src={src}
              title="Welcome, Citizen: a tour of your dashboard"
              className="absolute inset-0 h-full w-full"
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
            />
          )}
        </div>
      </div>
    </Modal>
  )
}
