import { useCallback, useRef, useState } from 'react'
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

  return (
    <Container>
      <WebsiteHead
        title="Moon Base Zero tour"
        description="A walkthrough of Moon Base Zero and DePrize: how lunar capability races work, how predictions and bets set the odds, how prize pools grow, and how a winner is decided."
      />
      <div className="relative bg-[#010208]">
        <TourScene stop={stop} build={build} visible={activeId !== null} mode={mode} />
        <TourRail active={activeId} />

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
              habitat here is a real project from a real company or space agency, standing where it
              would on the Shackleton ridge. Scroll to see how the base works and how DePrize lets
              you back who builds it first.
            </TourCard>
            <p className="mt-10 flex items-center gap-3 font-RobotoMono text-[11px] uppercase tracking-[0.24em] text-white/50">
              <span className="block h-px w-8 bg-white/40" />
              Scroll to start the tour
            </p>
          </TourChapter>

          <TourChapter id="race">
            <TourCard
              location={TOUR_STOPS.race.label}
              title="Every district is a race."
              actions={
                <CtaButton href="/moonbase" variant="primary">
                  Explore the districts
                </CtaButton>
              }
            >
              The base is split into districts, one for each capability the Moon needs: landing,
              roving, power, habitats, construction, communications. The teams trying to deliver a
              capability stand in its district. This is the landing zone, home to Touchdown: the
              race to the next upright, working lunar landing.
            </TourCard>
          </TourChapter>

          <TourChapter id="market">
            <TourCard
              location={TOUR_STOPS.market.label}
              title="Every race has a market."
              visual={<OddsRaceScene variant="tour" />}
            >
              A DePrize turns a race into a prediction market. Each competitor has a live chance to
              win, and it moves every time someone backs them.
            </TourCard>
          </TourChapter>

          <TourChapter id="predict">
            <TourCard
              location={TOUR_STOPS.predict.label}
              title="Predict for free."
              visual={<PredictScene variant="tour" />}
            >
              Pick who you think gets there first. It costs nothing. Citizens&apos; picks are
              weighted by voting power and combine into the DAO forecast, and accurate predictions
              climb the leaderboard when the race ends.
            </TourCard>
          </TourChapter>

          <TourChapter id="bet">
            <TourCard
              location={TOUR_STOPS.bet.label}
              title="Or back your pick with ETH."
              visual={<BetScene variant="tour" />}
            >
              A share costs the current chance and pays 1 ETH if that team wins, so a 25% pick pays
              about 4x. Your bet moves the odds, and you can cash out at the current price any time
              the market is open.
              <span className="mt-2 block text-xs text-white/50">
                {DEPRIZE_AVAILABILITY_LEGEND}
              </span>
            </TourCard>
          </TourChapter>

          <TourChapter id="prize">
            <TourCard
              location={TOUR_STOPS.prize.label}
              title="Every bet grows the prize."
              visual={<PrizeScene variant="tour" />}
            >
              About 5% of every bet goes into the prize pool, and anyone can fund it directly.
              Bettors don&apos;t share in it: it goes to the team that wins, as a community payload
              on their next flight.
            </TourCard>
          </TourChapter>

          <TourChapter id="resolve">
            <TourCard
              location={TOUR_STOPS.resolve.label}
              title="A winner is decided in the open."
              visual={<ResolveScene variant="tour" />}
            >
              Experts check the evidence against rules published before betting opened. The Senate
              votes, anyone can challenge for 72 hours, then the result goes on-chain. Winning
              shares pay out; if nobody wins or the race is cancelled, bets are refunded.
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
              into its market to predict or back a team.
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
