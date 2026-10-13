import { HOME_FILM_VIMEO_ID, homeFilm, homePlate } from 'const/homePageContent'
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion'
import useTranslation from 'next-translate/useTranslation'
import { useRef } from 'react'
import { useAmbientVideo } from '@/lib/utils/hooks/useAmbientVideo'
import FilmPlayer from '@/components/layout/FilmPlayer'
import CountUp from './CountUp'
import CtaButton from './CtaButton'
import Starfield from './Starfield'

const EASE: [number, number, number, number] = [0.21, 0.47, 0.32, 0.98]

const container = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.14, delayChildren: 0.2 },
  },
}

// Animate position only (no opacity) so the SSR'd HTML — including the <h1>
// LCP/SEO heading — is visible before hydration instead of rendering at
// opacity:0 until JS runs.
const item = {
  hidden: { y: 30 },
  visible: { y: 0, transition: { duration: 0.9, ease: EASE } },
}

const stats = [
  { value: 8, prefix: '$', suffix: 'M+', label: 'Raised onchain' },
  { value: 12_000, suffix: '+', label: 'Token holders' },
  { value: 100, suffix: '+', label: 'Projects funded' },
  { value: 2, suffix: '', label: 'Astronauts sent to space' },
]

export default function LandingHero() {
  const { t } = useTranslation('common')
  const sectionRef = useRef<HTMLElement>(null)
  const plateRef = useRef<HTMLVideoElement>(null)
  const reduceMotion = useReducedMotion()
  // With the film live, the hero splits: copy on the left, the film's frame on
  // the right (stacked under the CTAs on mobile).
  const hasFilm = !!HOME_FILM_VIMEO_ID

  useAmbientVideo(plateRef, sectionRef)

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end start'],
  })
  // Keep the parallax travel within the background's scale headroom: scale-[1.2]
  // overflows ~10% per edge, so an 8% downward translate never drags the top
  // edge into view and exposes a gap.
  const bgY = useTransform(scrollYProgress, [0, 1], ['0%', reduceMotion ? '0%' : '8%'])
  const contentOpacity = useTransform(scrollYProgress, [0, 0.65], [1, 0])
  const contentY = useTransform(scrollYProgress, [0, 1], [0, reduceMotion ? 0 : -60])

  return (
    <>
      {/* Hero — exactly one viewport tall, no overflow */}
      <section
        ref={sectionRef}
        id="landing-hero"
        className={`relative flex w-full flex-col overflow-hidden bg-[#010208] ${
          hasFilm ? 'min-h-[70svh]' : 'h-[70svh] min-h-[520px]'
        }`}
      >
        {/* Parallax backdrop: the text-free plate (Earth's lit horizon low in
            frame, the Moon beyond). Its poster is the first paint; the H1 never
            waits on the video. */}
        <motion.div style={{ y: bgY }} className="absolute inset-0 scale-[1.2]">
          <video
            ref={plateRef}
            className="h-full w-full object-cover"
            style={{ objectPosition: 'center 70%' }}
            poster={homePlate.poster}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            aria-hidden="true"
          >
            <source src={homePlate.webm} type="video/webm" />
            <source src={homePlate.mp4} type="video/mp4" />
          </video>
        </motion.div>

        {/* Atmosphere: vignette + color wash + stars. The bottom stop stays
            light so the plate's lit horizon shows through. */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#010208]/85 via-[#010208]/35 to-[#010208]/70" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_-20%,rgba(66,94,235,0.16),transparent_55%)]" />
        <Starfield className="opacity-80" />

        {/* Content */}
        <motion.div
          // The scroll fade would fade a playing film out mid-watch, so it only
          // runs on the text-only hero.
          style={hasFilm ? undefined : { opacity: contentOpacity, y: contentY }}
          className={`relative z-10 mx-auto flex w-full max-w-[1400px] flex-1 flex-col items-center justify-center px-5 py-24 text-center md:px-10 ${
            hasFilm ? 'gap-12 lg:grid lg:grid-cols-2 lg:gap-14 lg:py-20 lg:text-left' : ''
          }`}
        >
          <motion.div variants={container} initial="hidden" animate="visible">
            <motion.h1
              variants={item}
              // One size for the whole line: "Internet's" is what sets MoonDAO
              // apart, so it carries the accent. The split hero's narrower
              // column takes a smaller cap.
              className={`font-heading font-semibold uppercase leading-[0.95] text-white text-[clamp(1.5rem,7.2vw,4.25rem)] ${
                hasFilm ? 'lg:text-[clamp(2rem,3.4vw,3.4rem)]' : ''
              }`}
            >
              <span className="block whitespace-nowrap">
                The <span className="text-moon-gold">Internet&apos;s</span>
              </span>
              <span className="block whitespace-nowrap">Space Program</span>
            </motion.h1>

            <motion.p
              variants={item}
              className={`mx-auto mt-6 max-w-xl text-base leading-relaxed text-white/70 md:text-lg ${
                hasFilm ? 'lg:mx-0' : ''
              }`}
            >
              MoonDAO is an open platform to fund, collaborate, and compete on challenges that get
              humanity closer to a permanent lunar settlement — governed by its members, transparent
              by design.
            </motion.p>

            <motion.div
              variants={item}
              className={`mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-6 ${
                hasFilm ? 'lg:justify-start' : ''
              }`}
            >
              <CtaButton href="/join" variant="primary">
                Join the Network
              </CtaButton>
              <CtaButton href="/launch" variant="quiet">
                Explore Missions
              </CtaButton>
            </motion.div>
          </motion.div>

          {hasFilm && (
            <motion.div
              initial={{ y: 30 }}
              animate={{ y: 0 }}
              transition={{ duration: 0.9, delay: 0.5, ease: EASE }}
              className="w-full max-w-2xl lg:max-w-none"
            >
              <FilmPlayer
                vimeoId={HOME_FILM_VIMEO_ID}
                film={homeFilm}
                playLabel={t('homeFilmPlay')}
                eventPrefix="home_film"
                caption={
                  <>
                    <span className="font-semibold text-white/85">{t('homeFilmTitle')}</span> ·{' '}
                    {t('homeFilmSub')}
                  </>
                }
              />
            </motion.div>
          )}
        </motion.div>
      </section>

      {/* Stats bar — lives outside the hero so it only appears on scroll */}
      <div className="relative z-10 border-t border-white/[0.08] bg-[#010208]">
        <div className="mx-auto grid w-full max-w-5xl grid-cols-2 gap-x-8 gap-y-8 px-6 py-10 md:grid-cols-4 md:py-12">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.7, delay: i * 0.08, ease: EASE }}
              className="flex flex-col items-center gap-2 text-center"
            >
              <CountUp
                to={stat.value}
                prefix={stat.prefix}
                suffix={stat.suffix}
                className="font-heading font-semibold text-2xl text-white md:text-3xl"
              />
              <span className="font-RobotoMono text-[10px] uppercase tracking-[0.18em] text-white/45 md:text-[11px]">
                {stat.label}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </>
  )
}
