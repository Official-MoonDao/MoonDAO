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

// Stops with an animation get more scroll, which is what the animation plays over.
const SCENE_SVH = 260

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
        description="A walkthrough of Moon Base Zero and DePrize: the districts of the base, how one race becomes a market, how predictions and bets work, how a winner is decided and where the prize goes."
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
              would on the Shackleton ridge. First a walk down the base, then one of its races from
              first bet to payout.
            </TourCard>
            <p className="mt-10 flex items-center gap-3 font-RobotoMono text-[11px] uppercase tracking-[0.24em] text-white/50">
              <span className="block h-px w-8 bg-white/40" />
              Scroll to start the tour
            </p>
          </TourChapter>

          <TourChapter id="power">
            <TourCard location={TOUR_STOPS.power.label} title="Every district is a race.">
              The base is laid out along one road, a district for each thing the Moon needs. Each
              district holds the teams racing to deliver it. Out here at the east end is power:
              two weeks of sunlight, then two weeks of night, and the base has to survive both.
              Working through that night is a race of its own, called Night Shift.
            </TourCard>
          </TourChapter>

          <TourChapter id="comms">
            <TourCard location={TOUR_STOPS.comms.label} title="A line home.">
              Relays and beacons that keep the base talking to Earth and let everything on the
              surface know where it is. Like every machine on this map, each one is a real mission
              from a real team, placed where it would stand.
            </TourCard>
          </TourChapter>

          <TourChapter id="habitat">
            <TourCard location={TOUR_STOPS.habitat.label} title="Where people will live.">
              The heart of the base. Pressurized modules, from single habitats up to flagship
              programs like Artemis Base Camp and ILRS, stand here side by side, racing to keep
              people living on the Moon.
            </TourCard>
          </TourChapter>

          <TourChapter id="rover">
            <TourCard location={TOUR_STOPS.rover.label} title="First Tracks.">
              The rovers driving the base road are racing for First Tracks: the first commercial
              rover to roll off its lander and drive. Every race like this one can have a DePrize,
              where anyone can predict or bet on who gets there first. Just past the rovers is
              where it all starts.
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
              HAKUTO-R and Chang&apos;e-7. Touchdown asks which one makes the next upright, working
              lunar landing. Here is how a DePrize turns that question into a market, from the
              first bet to the payout.
            </TourCard>
          </TourChapter>

          <TourChapter id="market" heightSvh={SCENE_SVH}>
            {(p) => (
              <TourCard
                location={TOUR_STOPS.market.label}
                title="The race becomes a market."
                visual={<OddsRaceScene variant="tour" progress={p} />}
              >
                Every competitor has a live chance to win, set by what people are paying to back
                them. It starts even and moves with every bet.
              </TourCard>
            )}
          </TourChapter>

          <TourChapter id="predict" heightSvh={SCENE_SVH}>
            {(p) => (
              <TourCard
                location={TOUR_STOPS.predict.label}
                title="Predict for free with MOONEY."
                visual={<PredictScene variant="tour" progress={p} />}
              >
                Citizens pick who they think wins, weighted by voting power. Picks form the MOONEY
                forecast, which sits beside the ETH odds and never moves them.
              </TourCard>
            )}
          </TourChapter>

          <TourChapter id="bet" heightSvh={SCENE_SVH}>
            {(p) => (
              <TourCard
                location={TOUR_STOPS.bet.label}
                title="Or bet real ETH."
                visual={<BetScene variant="tour" progress={p} />}
              >
                A share costs the current chance and pays 1 ETH if that team wins.
                <span className="mt-1 block text-xs text-white/50">
                  {DEPRIZE_AVAILABILITY_LEGEND}
                </span>
              </TourCard>
            )}
          </TourChapter>

          <TourChapter id="resolve" heightSvh={SCENE_SVH}>
            {(p) => (
              <TourCard
                location={TOUR_STOPS.resolve.label}
                title="A winner is decided in the open."
                visual={<ResolveScene variant="tour" progress={p} />}
              >
                Against rules published before betting opened, with time for anyone to object.
              </TourCard>
            )}
          </TourChapter>

          <TourChapter id="prize" heightSvh={SCENE_SVH}>
            {(p) => (
              <TourCard
                location={TOUR_STOPS.prize.label}
                title="The prize builds the base."
                visual={<PrizeScene variant="tour" progress={p} />}
              >
                Every bet feeds the winner&apos;s prize, and the prize flies a community payload on
                their next mission.
              </TourCard>
            )}
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
