// Featured-market carousel at the top of /deprize. Every slide stays mounted
// so its market keeps reporting positions; `shown` turns true the first time
// a slide is visible, which is when it may start its chart's log scan.
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { useEffect, useState, type ReactNode } from 'react'
import { TOUCH } from '@/components/deprize/detail/primitives'

export type HeroSlide = { key: string; render: (shown: boolean) => ReactNode }

export default function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const [index, setIndex] = useState(0)
  const [seen, setSeen] = useState<Set<string>>(() => new Set())
  const count = slides.length
  const current = Math.min(index, Math.max(0, count - 1))
  const currentKey = slides[current]?.key

  useEffect(() => {
    if (!currentKey) return
    setSeen((prev) => (prev.has(currentKey) ? prev : new Set(prev).add(currentKey)))
  }, [currentKey])

  if (count === 0) return null
  const go = (delta: number) => setIndex((current + delta + count) % count)
  const arrow = `grid h-8 w-8 place-items-center rounded-lg text-gray-300 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 ${TOUCH}`

  return (
    <div
      aria-roledescription="carousel"
      aria-label="Featured markets"
      className="flex flex-col gap-3"
    >
      <div className="relative">
        {slides.map((slide, i) => (
          <div
            key={slide.key}
            className={i === current ? 'animate-fadeIn' : 'hidden'}
            aria-hidden={i !== current}
          >
            {slide.render(i === current || seen.has(slide.key))}
          </div>
        ))}
        {count > 1 && (
          <div className="absolute right-4 top-4 flex items-center gap-1 sm:right-5 sm:top-5">
            <button
              type="button"
              aria-label="Previous market"
              onClick={() => go(-1)}
              className={arrow}
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </button>
            <button type="button" aria-label="Next market" onClick={() => go(1)} className={arrow}>
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
      {count > 1 && (
        <div className="flex items-center justify-center gap-1.5">
          {slides.map((slide, i) => (
            <button
              key={slide.key}
              type="button"
              aria-label={`Show market ${i + 1} of ${count}`}
              aria-current={i === current}
              onClick={() => setIndex(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === current ? 'w-6 bg-white' : 'w-1.5 bg-white/25 hover:bg-white/50'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
