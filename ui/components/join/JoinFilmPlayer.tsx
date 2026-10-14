import { JOIN_FILM_VIMEO_ID, joinFilm } from 'const/joinPageContent'
import { useReducedMotion } from 'framer-motion'
import useTranslation from 'next-translate/useTranslation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { networkCard } from '@/lib/layout/styles'

const VIMEO_ORIGIN = 'https://player.vimeo.com'

function trackFilmEvent(action: string) {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return
  window.gtag('event', action, {
    event_category: 'join_film',
    video_title: joinFilm.name,
  })
}

// Talks to the Vimeo iframe over its postMessage API rather than loading
// player.js: the SDK is not in the CSP script-src, and everything we need
// (ready, play, timeupdate, ended, and the play command) works without it.
function postToVimeo(iframe: HTMLIFrameElement | null, method: string, value?: string) {
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

// The film's 16:9 frame for the /join hero. The silent loop plays as a live
// poster. The Vimeo player loads hidden underneath it once the page is idle,
// or as soon as the visitor shows intent (hover, focus, touch), so a click
// starts the film without waiting on Vimeo.
export default function JoinFilmPlayer({ className = '' }: { className?: string }) {
  const { t } = useTranslation('common')
  const reduceMotion = useReducedMotion()
  // 'preload': mounted early, waits for a play command. 'click': mounted by
  // the click itself, so it autoplays from its URL like a plain embed.
  const [mounted, setMounted] = useState<null | 'preload' | 'click'>(null)
  const [playing, setPlaying] = useState(false)
  const frameRef = useRef<HTMLDivElement>(null)
  const loopRef = useRef<HTMLVideoElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const readyRef = useRef(false)
  const pendingPlayRef = useRef(false)

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

  // Preload once the page has loaded and gone idle.
  useEffect(() => {
    if (!JOIN_FILM_VIMEO_ID || !canPreload()) return
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
  }, [preload])

  // Player messages: subscribe on ready, flush a queued play, and send the
  // play / 50% / complete analytics (each once per page view).
  useEffect(() => {
    if (!mounted) return
    readyRef.current = false
    const sent = new Set<string>()
    const once = (action: string) => {
      if (sent.has(action)) return
      sent.add(action)
      trackFilmEvent(action)
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
          once('join_film_play')
          break
        case 'timeupdate':
          if (msg.data?.percent >= 0.5) once('join_film_50')
          break
        case 'ended':
          once('join_film_complete')
          break
      }
    }

    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [mounted])

  // The loop is the film's live poster. The autoPlay attribute starts it
  // straight from the server HTML, without waiting for hydration. Once
  // hydrated, it pauses while off screen and stops under
  // prefers-reduced-motion (the poster frame shows instead).
  useEffect(() => {
    const video = loopRef.current
    const frame = frameRef.current
    if (playing || !video || !frame) return
    if (reduceMotion) {
      video.pause()
      return
    }
    video.muted = true
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          video.play().catch(() => {
            // Autoplay refused (e.g. low-power mode): the poster stays up.
          })
        } else {
          video.pause()
        }
      },
      { threshold: 0.25 }
    )
    observer.observe(frame)
    return () => observer.disconnect()
  }, [playing, reduceMotion])

  if (!JOIN_FILM_VIMEO_ID) return null

  const embedSrc = `${VIMEO_ORIGIN}/video/${JOIN_FILM_VIMEO_ID}?autoplay=${
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
            title={joinFilm.name}
            className="absolute inset-0 h-full w-full"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            // Kept out of the tab order and the accessibility tree while it
            // waits hidden under the loop.
            tabIndex={playing ? undefined : -1}
            aria-hidden={playing ? undefined : true}
          />
        )}
        {!playing && (
          <button
            type="button"
            onClick={play}
            onPointerEnter={preload}
            onTouchStart={preload}
            onFocus={preload}
            aria-label={`${t('joinFilmPlay')}: ${joinFilm.name} (${joinFilm.durationLabel})`}
            className="group absolute inset-0 z-10 h-full w-full cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
          >
            <video
              ref={loopRef}
              className="absolute inset-0 h-full w-full object-cover"
              poster={joinFilm.loopPoster}
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              aria-hidden="true"
              tabIndex={-1}
            >
              <source src={joinFilm.loopWebm} type="video/webm" />
              <source src={joinFilm.loopMp4} type="video/mp4" />
            </video>
            <span className="absolute inset-0 bg-black/15 transition-colors duration-300 group-hover:bg-black/5" />
            {/* Bottom-right is the one corner the loop's burned-in titles and
                  "Become a Citizen" end card never use. */}
            <span className="absolute bottom-3 right-3 flex min-h-[44px] items-center gap-2 rounded-full bg-white/90 py-1.5 pl-1.5 pr-4 text-[#010208] shadow-[0_8px_30px_rgba(0,0,0,0.45)] ring-1 ring-white/40 backdrop-blur-sm transition-transform duration-300 group-hover:scale-105 md:bottom-4 md:right-4">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#425EEB] text-white">
                <svg className="ml-0.5 h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </span>
              <span className="font-heading text-sm font-semibold">{t('joinFilmPlay')}</span>
              <span className="font-RobotoMono text-xs text-[#010208]/60">
                {joinFilm.durationLabel}
              </span>
            </span>
          </button>
        )}
      </div>
      <figcaption className="mt-3 text-center text-sm text-white/60 lg:text-left">
        <span className="font-semibold text-white/85">{t('joinFilmTitle')}</span> ·{' '}
        {t('joinFilmSub')}
      </figcaption>
    </figure>
  )
}
