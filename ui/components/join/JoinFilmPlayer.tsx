import { JOIN_FILM_VIMEO_ID, joinFilm } from 'const/joinPageContent'
import { useReducedMotion } from 'framer-motion'
import useTranslation from 'next-translate/useTranslation'
import { useEffect, useRef, useState } from 'react'
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
// player.js: the SDK is not in the CSP script-src, and the events we need
// (play, timeupdate, ended) are all available without it.
function useVimeoAnalytics(iframeRef: React.RefObject<HTMLIFrameElement>, active: boolean) {
  useEffect(() => {
    if (!active) return
    const sent = new Set<string>()
    const once = (action: string) => {
      if (sent.has(action)) return
      sent.add(action)
      trackFilmEvent(action)
    }
    const post = (method: string, value?: string) =>
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify(value ? { method, value } : { method }),
        VIMEO_ORIGIN
      )

    const onMessage = (e: MessageEvent) => {
      if (e.origin !== VIMEO_ORIGIN || e.source !== iframeRef.current?.contentWindow) return
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
          post('addEventListener', 'play')
          post('addEventListener', 'timeupdate')
          post('addEventListener', 'ended')
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
  }, [active, iframeRef])
}

// The film's 16:9 frame for the /join hero. The silent loop plays as a live
// poster; clicking swaps it for the Vimeo player with sound.
export default function JoinFilmPlayer({ className = '' }: { className?: string }) {
  const { t } = useTranslation('common')
  const reduceMotion = useReducedMotion()
  const [playing, setPlaying] = useState(false)
  const frameRef = useRef<HTMLDivElement>(null)
  const loopRef = useRef<HTMLVideoElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useVimeoAnalytics(iframeRef, playing)

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

  const embedSrc = `${VIMEO_ORIGIN}/video/${JOIN_FILM_VIMEO_ID}?autoplay=1&muted=0&controls=1&loop=0&badge=0&autopause=0&byline=0&title=0&portrait=0&dnt=1`

  return (
    <figure className={className}>
      <div
        ref={frameRef}
        className={`relative aspect-video w-full overflow-hidden shadow-[0_20px_80px_rgba(0,0,0,0.55)] ${networkCard.base}`}
      >
        {playing ? (
          <iframe
            ref={iframeRef}
            src={embedSrc}
            title={joinFilm.name}
            className="absolute inset-0 h-full w-full"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            aria-label={`${t('joinFilmPlay')}: ${joinFilm.name} (${joinFilm.durationLabel})`}
            className="group absolute inset-0 h-full w-full cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
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
