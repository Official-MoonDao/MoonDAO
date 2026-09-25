import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'

type AmbientVideoProps = {
  /** Ambient clip. Omit it and the poster still renders on its own. */
  src?: string
  /** Existing still. Also the clip's first frame, so the swap is invisible. */
  poster: string
  alt?: string
  className?: string
  objectPosition?: string
  sizes?: string
  /** Set on the hero only — its poster is the LCP element. */
  priority?: boolean
  /** Dims the clip so foreground copy keeps its contrast. */
  opacity?: number
}

/**
 * Renders a still, then fades a looping clip over it once the section scrolls
 * into view. The clip is a pure enhancement: it is never downloaded until it is
 * needed, never mounted when the user prefers reduced motion, and never
 * required for the section to look finished.
 */
export default function AmbientVideo({
  src,
  poster,
  alt = '',
  className = '',
  objectPosition = 'center',
  sizes = '100vw',
  priority = false,
  opacity = 1,
}: AmbientVideoProps) {
  // Gate the <video> behind intersection so a page with five ambient clips
  // fetches only the one or two the visitor actually reaches.
  const [shouldLoad, setShouldLoad] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (!src) return
    const el = containerRef.current
    if (!el) return

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (motionQuery.matches) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldLoad(true)
          videoRef.current?.play().catch(() => {
            // Autoplay can still be refused (iOS Low Power Mode, data saver).
            // The poster is already correct, so there is nothing to recover.
          })
        } else {
          videoRef.current?.pause()
        }
      },
      { rootMargin: '200px 0px', threshold: 0 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [src])

  return (
    <div ref={containerRef} className={`absolute inset-0 ${className}`}>
      <Image
        src={poster}
        alt={alt}
        fill
        priority={priority}
        sizes={sizes}
        className="object-cover"
        style={{ objectPosition, opacity }}
      />

      {shouldLoad && src && (
        <video
          ref={videoRef}
          muted
          loop
          playsInline
          autoPlay
          preload="none"
          aria-hidden
          onPlaying={() => setIsPlaying(true)}
          className="absolute inset-0 h-full w-full object-cover transition-opacity duration-[1200ms] ease-out"
          style={{ objectPosition, opacity: isPlaying ? opacity : 0 }}
        >
          <source src={src} type="video/mp4" />
        </video>
      )}
    </div>
  )
}
