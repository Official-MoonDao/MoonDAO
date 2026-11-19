import { JOIN_FILM_VIMEO_ID, joinFilm } from 'const/joinPageContent'
import { motion } from 'framer-motion'
import useTranslation from 'next-translate/useTranslation'
import Image from 'next/image'
import { CitizenOffer } from '@/lib/citizen/useCitizenOffer'
import CountUp from '@/components/home/landing/CountUp'
import CtaButton from '@/components/home/landing/CtaButton'
import Starfield from '@/components/home/landing/Starfield'
import FilmPlayer from '@/components/layout/FilmPlayer'

const EASE: [number, number, number, number] = [0.21, 0.47, 0.32, 0.98]

const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
}

// Position only, no opacity: the SSR'd H1 stays visible before hydration.
const item = {
  hidden: { y: 28 },
  visible: { y: 0, transition: { duration: 0.8, ease: EASE } },
}

type DudePerfectHeroProps = {
  offer: CitizenOffer
  citizenCount: number
}

export default function DudePerfectHero({ offer, citizenCount }: DudePerfectHeroProps) {
  const { t } = useTranslation('common')
  const hasFilm = !!JOIN_FILM_VIMEO_ID

  const stats = [
    { value: citizenCount, suffix: '+', label: 'Citizens worldwide' },
    { value: 8, prefix: '$', suffix: 'M+', label: 'Raised onchain' },
    { value: 100, suffix: '+', label: 'Projects funded' },
    { value: 2, suffix: '', label: 'Astronauts launched' },
  ]

  return (
    <>
      <section
        id="dp-hero"
        data-cta-location="dp_hero"
        className="relative flex w-full flex-col overflow-hidden bg-[#010208]"
      >
        <div className="absolute inset-0">
          <Image
            src="/assets/NetworkHero.webp"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover opacity-80"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-[#010208]/85 via-[#010208]/45 to-[#010208]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_-20%,rgba(66,94,235,0.28),transparent_60%)]" />
        <Starfield className="opacity-70" />

        <div
          className={`relative z-10 mx-auto flex w-full max-w-[1400px] flex-1 flex-col items-center justify-center px-5 pb-16 pt-24 text-center md:px-10 md:pb-20 ${
            hasFilm
              ? 'gap-12 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-14 lg:text-left'
              : 'max-w-4xl'
          }`}
        >
          <motion.div variants={container} initial="hidden" animate="visible">
            <motion.span
              variants={item}
              className="inline-flex items-center gap-3 font-RobotoMono text-[11px] uppercase tracking-[0.28em] text-moon-gold"
            >
              <span className="h-px w-6 bg-moon-gold/70" />
              For Dude Perfect fans
            </motion.span>

            <motion.h1
              variants={item}
              className="mt-5 font-heading font-semibold leading-[1.08] text-white text-[clamp(1.9rem,5.2vw,3.6rem)]"
            >
              You watched Coby go to space.{' '}
              <span className="bg-gradient-to-r from-[#7c8cff] to-[#22d3ee] bg-clip-text text-transparent">
                Now help us build a lunar base.
              </span>
            </motion.h1>

            <motion.p
              variants={item}
              className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-white/80 md:text-lg lg:mx-0"
            >
              MoonDAO is the internet&apos;s space program. Our community voted to send Coby Cotton
              to space on Blue Origin, then sent a second astronaut after him. Citizens fund
              missions, train for flight, and vote on what we do next.
            </motion.p>

            <motion.div
              variants={item}
              className="mt-9 flex flex-col items-center gap-3 sm:flex-row sm:gap-6 lg:items-center lg:justify-start"
            >
              <CtaButton href={offer.ctaHref} variant="primary">
                {offer.ctaLabel}
              </CtaButton>
              <CtaButton href="#the-story" variant="quiet">
                See how it works
              </CtaButton>
            </motion.div>

            {!offer.isCitizen && (
              <motion.p
                variants={item}
                className="mt-5 font-RobotoMono text-[11px] uppercase tracking-[0.16em] text-white/50"
              >
                12-month passport · {offer.yearLabel}
                {offer.cardCheckoutLive ? ' · Apple Pay, Google Pay & cards accepted' : ''}
              </motion.p>
            )}
          </motion.div>

          {hasFilm && (
            <motion.div
              initial={{ y: 28 }}
              animate={{ y: 0 }}
              transition={{ duration: 0.9, delay: 0.4, ease: EASE }}
              className="w-full max-w-2xl lg:max-w-none"
            >
              <FilmPlayer
                vimeoId={JOIN_FILM_VIMEO_ID}
                film={joinFilm}
                playLabel={t('joinFilmPlay')}
                eventPrefix="dp_join_film"
                endCard={{
                  title: t('joinFilmEndTitle'),
                  ctaLabel: t('joinFilmEndCta'),
                  ctaHref: offer.ctaHref,
                  replayLabel: t('filmReplay'),
                }}
                caption={
                  <>
                    <span className="font-semibold text-white/85">{t('joinFilmTitle')}</span> ·{' '}
                    {t('joinFilmSub')}
                  </>
                }
              />
            </motion.div>
          )}
        </div>
      </section>

      <div className="relative z-10 border-t border-white/10 bg-[#010208]">
        <div className="mx-auto grid w-full max-w-[1400px] grid-cols-2 divide-x divide-white/10 lg:grid-cols-4">
          {stats.map((stat, i) => (
            <div
              key={stat.label}
              className={`flex flex-col items-center gap-1 px-4 py-5 md:py-7 ${
                i >= 2 ? 'border-t border-white/10 lg:border-t-0' : ''
              }`}
            >
              <CountUp
                to={stat.value}
                prefix={stat.prefix}
                suffix={stat.suffix}
                className="font-heading font-semibold text-2xl text-white md:text-4xl"
              />
              <span className="font-RobotoMono text-[10px] uppercase tracking-[0.2em] text-white/50 md:text-xs">
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
