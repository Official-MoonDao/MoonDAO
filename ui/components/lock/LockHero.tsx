import { LockClosedIcon, ScaleIcon, ShieldCheckIcon } from '@heroicons/react/24/outline'
import { LOCK_FILM_VIMEO_ID, lockFilm } from 'const/lockPageContent'
import useTranslation from 'next-translate/useTranslation'
import CtaButton from '@/components/home/landing/CtaButton'
import Starfield from '@/components/home/landing/Starfield'
import FilmPlayer from '@/components/layout/FilmPlayer'

const FACTS = [
  { Icon: LockClosedIcon, text: 'Lock for up to 4 years. Longer locks get more voting power.' },
  {
    Icon: ScaleIcon,
    text: 'Voting power is the square root of your vMOONEY, so smaller holders still count.',
  },
  {
    Icon: ShieldCheckIcon,
    text: 'Voting power winds down as your unlock date nears. Extend anytime.',
  },
]

/**
 * The /lock hero: the heading, facts and CTAs on the left, the "How to lock
 * MOONEY" film on the right. On mobile it stacks heading → film → facts → CTAs.
 * The page only renders it while the film is live.
 */
export default function LockHero() {
  const { t } = useTranslation('common')

  return (
    <section
      data-cta-location="hero"
      className="relative w-full overflow-hidden bg-[#010208] border-b border-white/10"
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_-20%,rgba(66,94,235,0.28),transparent_60%)]" />
      <Starfield className="opacity-70" />

      {/* Desktop (xl): the film spans every row of the right column; the 1fr
          rows above and below centre the left column's content against it. */}
      <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-12 sm:px-6 md:px-10 md:py-16 xl:grid xl:max-w-[1400px] xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] xl:grid-rows-[1fr_auto_auto_1fr] xl:gap-x-12 xl:gap-y-0 xl:py-20">
        <div className="xl:col-start-1 xl:row-start-2">
          <h1 className="font-heading font-semibold leading-[1.1] text-white text-3xl md:text-5xl drop-shadow-lg">
            Lock $MOONEY
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-white/85 md:text-xl">
            Lock MOONEY to get voting power. The longer you lock, the more say you have.
          </p>
        </div>

        <FilmPlayer
          className="w-full xl:col-start-2 xl:row-span-full xl:row-start-1 xl:self-center"
          vimeoId={LOCK_FILM_VIMEO_ID}
          film={lockFilm}
          playLabel={t('lockFilmPlay')}
          eventPrefix="lock_film"
          endCard={{
            title: t('lockFilmEndTitle'),
            ctaLabel: t('lockFilmEndCta'),
            ctaHref: '#lock-card',
            replayLabel: t('filmReplay'),
          }}
          caption={
            <>
              <span className="font-semibold text-white/85">{t('lockFilmTitle')}</span> ·{' '}
              {t('lockFilmSub')}
            </>
          }
        />

        <div className="flex flex-col gap-6 xl:col-start-1 xl:row-start-3 xl:mt-8">
          <ul className="flex max-w-xl flex-col gap-3">
            {FACTS.map(({ Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-sm text-white/75 md:text-base">
                <Icon className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-300" aria-hidden />
                <span>{text}</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <CtaButton href="#lock-card" variant="primary">
              Lock MOONEY
            </CtaButton>
            <CtaButton href="/get-mooney" variant="secondary">
              Get MOONEY
            </CtaButton>
          </div>
        </div>
      </div>
    </section>
  )
}
