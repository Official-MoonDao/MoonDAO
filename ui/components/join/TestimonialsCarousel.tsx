import { motion, useReducedMotion } from 'framer-motion'
import { useEffect, useState } from 'react'
import AdaptiveImage from '@/components/layout/AdaptiveImage'
import Reveal from '@/components/home/landing/Reveal'
import SectionHeading from '@/components/home/landing/SectionHeading'
import type { TestimonialWithPhoto } from 'const/joinPageContent'

function getInitials(name: string) {
  return name
    .replace(/'.*'/, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

const AUTOPLAY_MS = 7000

function Slide({
  testimonial,
  active,
}: {
  testimonial: TestimonialWithPhoto
  active: boolean
}) {
  const reduceMotion = useReducedMotion()
  return (
    <motion.div
      // All slides share the same grid cell (see the parent's `grid` +
      // `[grid-area:1/1]` below) so the container's height is always the
      // tallest slide, and switching the active one never shifts layout.
      className={`[grid-area:1/1] flex flex-col items-center gap-8 text-center ${
        active ? '' : 'pointer-events-none'
      }`}
      aria-hidden={!active}
      animate={{ opacity: active ? 1 : 0, y: reduceMotion ? 0 : active ? 0 : 8 }}
      transition={{ duration: 0.5, ease: [0.21, 0.47, 0.32, 0.98] }}
    >
      <div className="relative">
        <div className="absolute -inset-2 rounded-full bg-gradient-to-br from-[#425EEB]/30 to-[#6C407D]/30 blur-xl" />
        {testimonial.image ? (
          <div className="relative rounded-full bg-gradient-to-br from-[#3044A9] to-[#743F72] p-[3px]">
            <AdaptiveImage
              src={testimonial.image}
              alt={testimonial.name}
              width={320}
              height={320}
              className="h-32 w-32 rounded-full object-cover md:h-40 md:w-40"
            />
          </div>
        ) : (
          <div className="relative flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-br from-[#3044A9] to-[#743F72] font-GoodTimes text-3xl text-white md:h-40 md:w-40">
            {getInitials(testimonial.name)}
          </div>
        )}
      </div>

      <svg
        className="h-8 w-8 text-[#7c8cff]/50"
        viewBox="0 0 32 24"
        fill="currentColor"
        aria-hidden
      >
        <path d="M9.5 0C4.3 3 0 8.6 0 14.8 0 20 3.6 24 8.6 24c4.3 0 7.4-3.3 7.4-7.4 0-3.9-2.8-6.8-6.4-6.8-.7 0-1.4.1-1.9.3C8.4 6 11 2.8 14.6 1.1L9.5 0Zm17 0C21.3 3 17 8.6 17 14.8 17 20 20.6 24 25.6 24c4.3 0 7.4-3.3 7.4-7.4 0-3.9-2.8-6.8-6.4-6.8-.7 0-1.4.1-1.9.3C25.4 6 28 2.8 31.6 1.1L26.5 0Z" />
      </svg>

      <p className="max-w-2xl text-lg leading-relaxed text-white/85 md:text-xl">
        &ldquo;{testimonial.quote}&rdquo;
      </p>

      <div>
        <p className="font-GoodTimes text-base text-white">{testimonial.name}</p>
        <p className="mt-1 text-sm text-white/55">{testimonial.affiliation}</p>
      </div>
    </motion.div>
  )
}

export default function TestimonialsCarousel({
  testimonials,
}: {
  testimonials: TestimonialWithPhoto[]
}) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    if (paused || reduceMotion || testimonials.length <= 1) return
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % testimonials.length)
    }, AUTOPLAY_MS)
    return () => clearInterval(timer)
  }, [paused, reduceMotion, testimonials.length])

  if (!testimonials.length) return null

  const goTo = (i: number) => setIndex(((i % testimonials.length) + testimonials.length) % testimonials.length)

  return (
    <section className="relative overflow-hidden bg-[#010208] py-24 md:py-36">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(108,64,125,0.16),transparent_55%)]" />

      <div className="relative z-10 mx-auto w-full max-w-[1000px] px-5 md:px-10">
        <SectionHeading
          eyebrow="Voices of MoonDAO"
          title={
            <>
              Don&apos;t Take Our{' '}
              <span className="bg-gradient-to-r from-[#7c8cff] to-[#22d3ee] bg-clip-text text-transparent">
                Word for It
              </span>
            </>
          }
          description="Citizens, teams, and astronauts on what joining the network actually made possible."
        />

        <div
          className="relative mt-14"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          <div className="grid">
            {testimonials.map((testimonial, i) => (
              <Slide key={testimonial.name} testimonial={testimonial} active={i === index} />
            ))}
          </div>

          {testimonials.length > 1 && (
            <>
              <button
                type="button"
                aria-label="Previous testimonial"
                onClick={() => goTo(index - 1)}
                className="absolute left-0 top-1/2 hidden -translate-y-1/2 rounded-full border border-white/15 bg-white/5 p-2 text-white/60 backdrop-blur-md transition-all hover:border-white/30 hover:text-white md:block"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="m15 18-6-6 6-6" />
                </svg>
              </button>
              <button
                type="button"
                aria-label="Next testimonial"
                onClick={() => goTo(index + 1)}
                className="absolute right-0 top-1/2 hidden -translate-y-1/2 rounded-full border border-white/15 bg-white/5 p-2 text-white/60 backdrop-blur-md transition-all hover:border-white/30 hover:text-white md:block"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </button>

              <div className="mt-10 flex items-center justify-center gap-2">
                {testimonials.map((t, i) => (
                  <button
                    key={t.name}
                    type="button"
                    aria-label={`Show testimonial from ${t.name}`}
                    onClick={() => goTo(i)}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      i === index ? 'w-6 bg-white' : 'w-2 bg-white/25 hover:bg-white/50'
                    }`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
