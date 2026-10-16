import { ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { networkCard } from '@/lib/layout/styles'
import { useAmbientVideo } from '@/lib/utils/hooks/useAmbientVideo'
import CtaButton from '@/components/home/landing/CtaButton'

export const VIMEO_ORIGIN = 'https://player.vimeo.com'

export type Film = {
  /** Shown as the iframe title and in the play button's accessible name. */
  name: string
  /** e.g. '1:35' */
  durationLabel: string
  /** The silent teaser loop that plays as the film's live poster. */
  loopPoster: string
  loopWebm: string
  loopMp4: string
}

/** Shown over the player when the film ends: the next step in the funnel. */
export type FilmEndCard = {
  title: string
  ctaLabel: string
  ctaHref: string
  replayLabel: string
}

type FilmPlayerProps = {
  vimeoId: string
  film: Film
  playLabel: string
  /**
   * GA event prefix: sends `<prefix>_play`, `<prefix>_50`, `<prefix>_complete`,
   * and `<prefix>_cta_click` from the end card.
   */
  eventPrefix: string
  endCard?: FilmEndCard
  caption?: ReactNode
  className?: string
}

// Talks to the Vimeo iframe over its postMessage API rather than loading
// player.js: the SDK is not in the CSP script-src, and everything we need
// (ready, play, timeupdate, ended, and the play command) works without it.
export function postToVimeo(iframe: HTMLIFrameElement | null, method: string, value?: string | number) {
  iframe?.contentWindow?.postMessage(
    JSON.stringify(value === undefined ? { method } : { method, value }),
    VIMEO_ORIGIN
  )
}

// Skip the background preload for visitors on Data Saver or a slow link.
function canPreload() {
  const conn = (navigator as any).connection
  if (!conn) return true
  return !conn.saveData && !/(^|-)2g$|^3g$/.test(conn.effectiveType ?? '')
}

/**
 * A 16:9 film frame. A silent teaser loop plays as the film's live poster.
 * The Vimeo player loads hidden underneath it once the page is idle, or as
 * soon as the visitor shows intent (hover, focus, touch), so a click starts
 * the film with sound without waiting on Vimeo. Renders nothing without a
 * `vimeoId`.
 */
export default function FilmPlayer({
  vimeoId,
  film,
  playLabel,
  eventPrefix,
  endCard,
  caption,
  className = '',
}: FilmPlayerProps) {
  // 'preload': mounted early, waits for a play command. 'click': mounted by
  // the click itself, so it autoplays from its URL like a plain embed.
  const [mounted, setMounted] = useState<null | 'preload' | 'click'>(null)
  const [playing, setPlaying] = useState(false)
  const [ended, setEnded] = useState(false)
  const frameRef = useRef<HTMLDivElement>(null)
  const loopRef = useRef<HTMLVideoElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const readyRef = useRef(false)
  const pendingPlayRef = useRef(false)
  const endCardRef = useRef<HTMLDivElement>(null)

  useAmbientVideo(loopRef, frameRef, !playing)

  const preload = useCallback(() => {
    setMounted((m) => m ?? 'preload')
  }, [])

  const play = () => {
    setPlaying(true)
    if (!mounted) {
      setMounted('click')
    } else if (readyRef.current) {
      postToVimeo(iframeRef.current, 'play')
    } else {
      pendingPlayRef.current = true
    }
  }

  const sendEvent = useCallback(
    (step: string) => {
      if (typeof window.gtag !== 'function') return
      window.gtag('event', `${eventPrefix}_${step}`, {
        event_category: eventPrefix,
        video_title: film.name,
      })
    },
    [eventPrefix, film.name]
  )

  const replay = () => {
    setEnded(false)
    // setCurrentTime is the current API's name, seekTo the legacy one.
    postToVimeo(iframeRef.current, 'setCurrentTime', 0)
    postToVimeo(iframeRef.current, 'seekTo', 0)
    postToVimeo(iframeRef.current, 'play')
  }

  // Move focus to the end card's CTA so keyboard users land on it.
  useEffect(() => {
    if (ended) endCardRef.current?.querySelector('a')?.focus()
  }, [ended])

  // Preload once the page has loaded and gone idle.
  useEffect(() => {
    if (!vimeoId || !canPreload()) return
    let idleId: number | undefined
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    const schedule = () => {
      if ('requestIdleCallback' in window) {
        idleId = window.requestIdleCallback(preload, { timeout: 4000 })
      } else {
        timeoutId = setTimeout(preload, 2000)
      }
    }
    if (document.readyState === 'complete') schedule()
    else window.addEventListener('load', schedule, { once: true })
    return () => {
      window.removeEventListener('load', schedule)
      if (idleId !== undefined) window.cancelIdleCallback(idleId)
      if (timeoutId !== undefined) clearTimeout(timeoutId)
    }
  }, [vimeoId, preload])

  // Player messages: subscribe on ready, flush a queued play, and send the
  // play / 50% / complete analytics (each once per page view).
  useEffect(() => {
    if (!mounted) return
    readyRef.current = false
    const sent = new Set<string>()
    const track = (step: string) => {
      if (sent.has(step)) return
      sent.add(step)
      sendEvent(step)
    }

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
      // We message the player with JSON strings, and it replies with the
      // legacy event names (playProgress, finish), so accept both forms.
      switch (msg?.event) {
        case 'ready':
          readyRef.current = true
          postToVimeo(iframe, 'addEventListener', 'play')
          postToVimeo(iframe, 'addEventListener', 'timeupdate')
          postToVimeo(iframe, 'addEventListener', 'ended')
          if (pendingPlayRef.current) {
            pendingPlayRef.current = false
            postToVimeo(iframe, 'play')
          }
          break
        case 'play':
          setEnded(false)
          track('play')
          break
        case 'timeupdate':
        case 'playProgress':
          if (msg.data?.percent >= 0.5) track('50')
          break
        case 'ended':
        case 'finish':
          track('complete')
          setEnded(true)
          break
      }
    }

    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [mounted, sendEvent])

  if (!vimeoId) return null

  const embedSrc = `${VIMEO_ORIGIN}/video/${vimeoId}?autoplay=${
    mounted === 'click' ? 1 : 0
  }&muted=0&controls=1&loop=0&badge=0&autopause=0&byline=0&title=0&portrait=0&dnt=1`

  return (
    <figure className={className}>
      <div
        ref={frameRef}
        className={`relative aspect-video w-full overflow-hidden shadow-[0_20px_80px_rgba(0,0,0,0.55)] ${networkCard.base}`}
      >
        {mounted && (
          <iframe
            ref={iframeRef}
            src={embedSrc}
            title={film.name}
            className="absolute inset-0 h-full w-full"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            // Kept out of the tab order and the accessibility tree while it
            // waits hidden under the loop.
            tabIndex={playing ? undefined : -1}
            aria-hidden={playing ? undefined : true}
          />
        )}
        {ended && endCard && (
          // Covers Vimeo's own end screen ("more videos") with the next step.
          <div
            ref={endCardRef}
            className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-[#010208]/80 p-4 text-center backdrop-blur-sm md:gap-6"
          >
            <p className="font-heading text-lg font-semibold text-white md:text-2xl">
              {endCard.title}
            </p>
            <div className="flex flex-col items-center gap-2 sm:flex-row sm:gap-5">
              <div onClickCapture={() => sendEvent('cta_click')}>
                <CtaButton href={endCard.ctaHref} variant="primary">
                  {endCard.ctaLabel}
                </CtaButton>
              </div>
              <button
                type="button"
                onClick={replay}
                className="inline-flex min-h-[44px] items-center gap-1.5 px-2 text-sm font-medium tracking-wide text-white/60 transition-colors duration-200 hover:text-white"
              >
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M3 12a9 9 0 1 0 3-6.7" />
                  <path d="M3 4v5h5" />
                </svg>
                {endCard.replayLabel}
              </button>
            </div>
          </div>
        )}
        {!playing && (
          <button
            type="button"
            onClick={play}
            onPointerEnter={preload}
            onTouchStart={preload}
            onFocus={preload}
            aria-label={`${playLabel}: ${film.name} (${film.durationLabel})`}
            className="group absolute inset-0 z-10 h-full w-full cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
          >
            <video
              ref={loopRef}
              className="ambient-video absolute inset-0 h-full w-full object-cover"
              poster={film.loopPoster}
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              aria-hidden="true"
              tabIndex={-1}
            >
              <source src={film.loopWebm} type="video/webm" />
              <source src={film.loopMp4} type="video/mp4" />
            </video>
            <span className="absolute inset-0 bg-black/15 transition-colors duration-300 group-hover:bg-black/5" />
            {/* Bottom-right: the teaser loops keep their burned-in titles and
                end cards clear of this corner. */}
            <span className="absolute bottom-3 right-3 flex min-h-[44px] items-center gap-2 rounded-full bg-white/90 py-1.5 pl-1.5 pr-3 sm:pr-4 text-[#010208] shadow-[0_8px_30px_rgba(0,0,0,0.45)] ring-1 ring-white/40 backdrop-blur-sm transition-transform duration-300 group-hover:scale-105 md:bottom-4 md:right-4">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#425EEB] text-white">
                <svg className="ml-0.5 h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </span>
              {/* On phones the frame is narrow enough that the full label would
                  run into the loop's centred titles: icon + duration only. */}
              <span className="hidden font-heading text-sm font-semibold sm:inline">
                {playLabel}
              </span>
              <span className="font-RobotoMono text-xs text-[#010208]/60">
                {film.durationLabel}
              </span>
            </span>
          </button>
        )}
      </div>
      {caption && (
        <figcaption className="mt-3 text-center text-sm text-white/60 lg:text-left">
          {caption}
        </figcaption>
      )}
    </figure>
  )
}
