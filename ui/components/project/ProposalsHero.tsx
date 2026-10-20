import { PROPOSALS_FILM_VIMEO_ID, proposalsFilm } from 'const/proposalsPageContent'
import useTranslation from 'next-translate/useTranslation'
import { ReactNode } from 'react'
import Starfield from '@/components/home/landing/Starfield'
import FilmPlayer from '@/components/layout/FilmPlayer'

type ProposalsHeroProps = {
  title: string
  /** The cycle status card and budget tiles, moved up from the page body. */
  stats: ReactNode
}

/**
 * The /proposals hero: the heading and cycle stats on the left, the "Idea to
 * funded" film on the right. On mobile it stacks heading → film → stats. The
 * page only renders it while the film is live.
 */
export default function ProposalsHero({ title, stats }: ProposalsHeroProps) {
  const { t } = useTranslation('common')

  return (
    <section
      data-cta-location="hero"
      className="relative w-full overflow-hidden bg-[#010208] border-b border-white/10"
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_-20%,rgba(66,94,235,0.28),transparent_60%)]" />
      <Starfield className="opacity-70" />

      {/* Desktop (xl, so the stats have room beside the film): the film spans
          every row of the right column; the 1fr rows above and below centre
          the left column's content against it. */}
      <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-12 sm:px-6 md:px-10 md:py-16 xl:grid xl:max-w-[1400px] xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] xl:grid-rows-[1fr_auto_auto_1fr] xl:gap-x-12 xl:gap-y-0 xl:py-20">
        <div className="xl:col-start-1 xl:row-start-2">
          <h1 className="font-heading font-semibold leading-[1.1] text-white text-3xl md:text-5xl drop-shadow-lg">
            {title}
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-white/85 md:text-xl">
            Go from idea to funding in weeks, not months.
          </p>
        </div>

        <FilmPlayer
          className="w-full xl:col-start-2 xl:row-span-full xl:row-start-1 xl:self-center"
          vimeoId={PROPOSALS_FILM_VIMEO_ID}
          film={proposalsFilm}
          playLabel={t('proposalsFilmPlay')}
          eventPrefix="proposals_film"
          endCard={{
            title: t('proposalsFilmEndTitle'),
            ctaLabel: t('proposalsFilmEndCta'),
            ctaHref: '/proposal-template',
            replayLabel: t('filmReplay'),
          }}
          caption={
            <>
              <span className="font-semibold text-white/85">{t('proposalsFilmTitle')}</span> ·{' '}
              {t('proposalsFilmSub')}
            </>
          }
        />

        <div className="flex flex-col gap-3 md:gap-4 xl:col-start-1 xl:row-start-3 xl:mt-8">
          {stats}
        </div>
      </div>
    </section>
  )
}
