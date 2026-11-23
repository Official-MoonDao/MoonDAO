import { ChevronDownIcon } from '@heroicons/react/24/outline'
import Router from 'next/router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { DEPRIZE_AVAILABILITY_LEGEND } from '@/lib/deprize/constants'
import { TOUR_STOPS, type TourStopId } from '@/lib/moonbase-tour/stops'
import {
  BetScene,
  OddsRaceScene,
  PredictScene,
  PrizeScene,
  ResolveScene,
} from '@/components/deprize/howItWorks/scenes'
import CtaButton from '@/components/home/landing/CtaButton'
import Container from '@/components/layout/Container'
import { ExpandedFooter } from '@/components/layout/ExpandedFooter'
import WebsiteHead from '@/components/layout/Head'
import LadderCard from './LadderCard'
import TourCard from './TourCard'
import TourChapter from './TourChapter'
import TourRail from './TourRail'
import TourScene from './TourScene'
import { scrollToStop, stopFromHash } from './scrollToStop'
import useActiveStop from './useActiveStop'
import useTourRenderMode from './useTourRenderMode'

export default function MoonbaseTour() {
  const activeId = useActiveStop<TourStopId>('arrival')
  // Past the last stop the scene fades out, but it keeps the stop it was on so
  // scrolling back up does not fly it in from somewhere else.
  const lastId = useRef<TourStopId>('arrival')
  if (activeId) lastId.current = activeId
  const stop = TOUR_STOPS[lastId.current]

  const [ladderBuild, setLadderBuild] = useState(0)
  const onBuildChange = useCallback((b: number) => setLadderBuild(b), [])
  const build = activeId === 'ladder' ? ladderBuild : null

  const mode = useTourRenderMode()

  // Deep links: /moonbase/tour#power opens the tour on that stop. Undefined
  // until the hash has been read; while a jump is in flight it holds the stop
  // being jumped to, so the hash is not rewritten by the stops scrolled past.
  const jumpTarget = useRef<TourStopId | null | undefined>(undefined)

  useEffect(() => {
    const target = stopFromHash(window.location.hash)
    jumpTarget.current = target
    const jumpNow = () => {
      if (target && jumpTarget.current === target) scrollToStop(target, 'auto')
    }
    // Arriving by a client-side link, the router resets the scroll as the
    // route change finishes, so jump again once it has.
    const jump = target ? setTimeout(jumpNow, 50) : undefined
    const giveUp = target ? setTimeout(() => (jumpTarget.current = null), 3000) : undefined

    const onHashChange = () => {
      const next = stopFromHash(window.location.hash)
      if (next) scrollToStop(next)
    }
    window.addEventListener('hashchange', onHashChange)
    Router.events.on('routeChangeComplete', jumpNow)
    return () => {
      clearTimeout(jump)
      clearTimeout(giveUp)
      window.removeEventListener('hashchange', onHashChange)
      Router.events.off('routeChangeComplete', jumpNow)
    }
  }, [])

  // Keep the address bar on the stop in view, so a copied link opens there.
  useEffect(() => {
    if (jumpTarget.current === undefined) return
    if (jumpTarget.current && activeId !== jumpTarget.current) return
    jumpTarget.current = null
    if (!activeId) return
    const hash = activeId === 'arrival' ? '' : `#${activeId}`
    if (window.location.hash === hash) return
    const { pathname, search } = window.location
    window.history.replaceState(window.history.state, '', `${pathname}${search}${hash}`)
  }, [activeId])

  // A nudge at the bottom of the screen until the visitor scrolls, on
  // whichever stop they land: a deep link skips the first card and its prompt.
  // Measured from where the page settles, so the deep-link jump itself does
  // not count as scrolling.
  const [showHint, setShowHint] = useState(true)
  useEffect(() => {
    let settledAt: number | null = null
    const onScroll = () => {
      if (jumpTarget.current !== null) return
      if (settledAt === null) settledAt = window.scrollY
      else if (Math.abs(window.scrollY - settledAt) > 40) setShowHint(false)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <Container>
      <WebsiteHead
        title="Moon Base Zero tour"
        description="A walkthrough of Moon Base Zero and DePrize: the districts of the base, how one race becomes a market, how predictions and bets work, how a winner is decided and where the prize goes."
      />
      <div className="relative bg-[#010208]">
        <TourScene stop={stop} build={build} visible={activeId !== null} mode={mode} />
        <TourRail active={activeId} />
        {/* On phones the first card already ends in the same prompt as a
            button, right where this would sit. */}
        <div
          aria-hidden
          className={`pointer-events-none fixed inset-x-0 bottom-2 z-20 flex justify-center transition-opacity duration-500 md:bottom-6 ${
            activeId === 'arrival' ? 'max-md:hidden' : ''
          } ${showHint && activeId !== null ? 'opacity-100' : 'opacity-0'}`}
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-[#22d3ee]/50 bg-[#010208]/70 px-4 py-2 font-RobotoMono text-[10px] uppercase tracking-[0.2em] text-white backdrop-blur-sm md:text-[11px]">
            Scroll down to take the tour
            <ChevronDownIcon className="h-4 w-4 animate-bounce text-[#22d3ee]" />
          </span>
        </div>

        <div className="relative z-10">
          <TourChapter id="arrival" heightSvh={150} fadeIn={false}>
            <TourCard
              as="h1"
              location="Moon Base Zero · Lunar south pole"
              title="How Moon Base Zero works"
              actions={
                <>
                  <CtaButton href="/moonbase" variant="primary">
                    Open Moon Base Zero
                  </CtaButton>
                  <CtaButton href="/deprize" variant="quiet">
                    Browse DePrizes
                  </CtaButton>
                </>
              }
            >
              A model of the first lunar base, built from real hardware. Every lander, rover and
              habitat here is a real project from a real company or space agency, gathered on the
              Shackleton ridge where NASA&apos;s first Moon Base landing is aimed. No base site has
              been chosen yet. First a walk down the base, then one of its races from first bet to
              payout.
            </TourCard>
            <button
              type="button"
              onClick={() => scrollToStop('power')}
              className="mt-8 inline-flex items-center gap-3 rounded-full border border-[#22d3ee]/50 bg-[#22d3ee]/10 px-5 py-2.5 font-RobotoMono text-xs uppercase tracking-[0.2em] text-white transition hover:border-[#22d3ee] hover:bg-[#22d3ee]/20"
            >
              Scroll down to take the tour
              <ChevronDownIcon className="h-4 w-4 animate-bounce text-[#22d3ee]" />
            </button>
          </TourChapter>

          <TourChapter id="power">
            <TourCard location={TOUR_STOPS.power.label} title="Every district is a race.">
              The base is laid out along one road, a district for each thing the Moon needs. Each
              district holds the teams racing to deliver it. Out here at the east end is power. On
              this ridge the sun never climbs more than a couple of degrees above the horizon, and
              for long stretches of the year it drops below it, so the base has to ride out the
              dark. Working through a lunar night is a race of its own, called Night Shift.
            </TourCard>
          </TourChapter>

          <TourChapter id="comms">
            <TourCard location={TOUR_STOPS.comms.label} title="A line home.">
              Relays and beacons that keep the base talking to Earth and let everything on the
              surface know where it is. Like every machine on this map, each one is a real mission
              from a real team.
            </TourCard>
          </TourChapter>

          <TourChapter id="habitat">
            <TourCard location={TOUR_STOPS.habitat.label} title="Where people will live.">
              The heart of the base. Pressurized modules, from single habitats up to flagship
              programs like NASA&apos;s Moon Base and ILRS, stand here side by side, racing to keep
              people living on the Moon.
            </TourCard>
          </TourChapter>

          <TourChapter id="rover">
            <TourCard location={TOUR_STOPS.rover.label} title="First Tracks.">
              The rovers driving the base road are racing for First Tracks: the first commercial
              rover to roll off its lander and drive. Every race like this one can have a DePrize,
              where anyone can predict or bet on who gets there first. Just past the rovers is where
              it all starts.
            </TourCard>
          </TourChapter>

          <TourChapter id="race">
            <TourCard
              location={TOUR_STOPS.race.label}
              title="Follow one race: Touchdown."
              actions={
                <CtaButton href="/deprize" variant="primary">
                  See live DePrizes
                </CtaButton>
              }
            >
              Six landers stand in the landing zone: Blue Ghost, Nova-C, Blue Moon MK1, Griffin,
              ispace&apos;s ULTRA and Chang&apos;e-7. Touchdown asks which one makes the next
              upright, working lunar landing. Here is how a DePrize turns that question into a
              market, from the first bet to the payout.
            </TourCard>
          </TourChapter>

          <TourChapter id="market">
            <TourCard
              location={TOUR_STOPS.market.label}
              title="The race becomes a market."
              visual={<OddsRaceScene variant="tour" active={activeId === 'market'} />}
            >
              Every competitor has a live chance to win, set by what people are paying to back them.
              It starts even and moves with every bet.
            </TourCard>
          </TourChapter>

          <TourChapter id="predict">
            <TourCard
              location={TOUR_STOPS.predict.label}
              title="Predict for free."
              visual={<PredictScene variant="tour" active={activeId === 'predict'} />}
            >
              Anyone in the world can pick who they think wins for free. Citizens&apos; picks are
              weighted by voting power to form the MOONEY forecast, which sits beside the ETH odds
              and never moves them.
            </TourCard>
          </TourChapter>

          <TourChapter id="bet">
            <TourCard
              location={TOUR_STOPS.bet.label}
              title="Or add ETH to your prediction."
              visual={<BetScene variant="tour" active={activeId === 'bet'} />}
            >
              A share costs the current chance and pays 1 ETH if that team wins.
              <span className="mt-1 block text-xs text-white/50">
                {DEPRIZE_AVAILABILITY_LEGEND}
              </span>
            </TourCard>
          </TourChapter>

          <TourChapter id="resolve">
            <TourCard
              location={TOUR_STOPS.resolve.label}
              title="A winner is decided in the open."
              visual={<ResolveScene variant="tour" active={activeId === 'resolve'} />}
            >
              Against rules published before betting opened, with time for anyone to object.
            </TourCard>
          </TourChapter>

          <TourChapter id="prize">
            <TourCard
              location={TOUR_STOPS.prize.label}
              title="The prize builds the base."
              visual={<PrizeScene variant="tour" active={activeId === 'prize'} />}
            >
              Every bet feeds the winner&apos;s prize, and the prize flies a community payload on
              their next mission.
            </TourCard>
          </TourChapter>

          <TourChapter id="ladder" heightSvh={300}>
            {(pinned) => <LadderCard pinned={pinned} onBuildChange={onBuildChange} />}
          </TourChapter>

          <TourChapter id="explore">
            <TourCard
              location={TOUR_STOPS.explore.label}
              title="See it for yourself."
              actions={
                <>
                  <CtaButton href="/moonbase" variant="primary">
                    Open Moon Base Zero
                  </CtaButton>
                  <CtaButton href="/deprize" variant="quiet">
                    Browse DePrizes
                  </CtaButton>
                </>
              }
            >
              Fly around the base, open any district to see who&apos;s racing, and follow a race
              into its market to predict or bet on a team.
            </TourCard>
          </TourChapter>
        </div>

        <div className="relative z-10 bg-[#010208]">
          <ExpandedFooter hasCallToAction={false} darkBackground={true} isFullwidth={true} />
        </div>
      </div>
    </Container>
  )
}
