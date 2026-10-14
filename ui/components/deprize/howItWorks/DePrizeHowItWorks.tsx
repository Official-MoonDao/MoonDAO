import Link from 'next/link'
import type { ReactNode } from 'react'
import {
  DEPRIZE_AVAILABILITY_LEGEND,
  DEPRIZE_PRIZE_RULES_URL,
  DEPRIZE_RISK_DISCLOSURES_URL,
  DEPRIZE_TERMS_URL,
  deprizeOgDescription,
} from '@/lib/deprize/constants'
import { TOUCH } from '@/components/deprize/detail/primitives'
import Container from '@/components/layout/Container'
import ContentLayout from '@/components/layout/ContentLayout'
import Head from '@/components/layout/Head'
import { NoticeFooter } from '@/components/layout/NoticeFooter'
import { BetScene, OddsRaceScene, PredictScene, PrizeScene, ResolveScene } from './scenes'

const PRIMARY_CTA = `inline-flex items-center justify-center rounded-lg bg-[#2f5bff] px-5 py-3 text-sm font-semibold text-white hover:bg-[#2a50e0] ${TOUCH}`
const SECONDARY_CTA = `inline-flex items-center justify-center rounded-lg border border-white/15 px-5 py-3 text-sm font-semibold text-white hover:bg-white/[0.06] ${TOUCH}`

function Step(props: {
  number: number
  title: string
  children: ReactNode
  scene: ReactNode
  flip?: boolean
}) {
  return (
    <section className="grid items-center gap-6 md:grid-cols-2 md:gap-10">
      <div className={props.flip ? 'md:order-2' : undefined}>
        <span className="text-xs font-semibold uppercase tracking-wider text-blue-300">
          Step {props.number}
        </span>
        <h2 className="mt-1 font-heading text-2xl font-bold text-white sm:text-3xl">
          {props.title}
        </h2>
        <div className="mt-3 flex flex-col gap-3 text-[15px] leading-relaxed text-gray-300">
          {props.children}
        </div>
      </div>
      <div className={props.flip ? 'md:order-1' : undefined}>{props.scene}</div>
    </section>
  )
}

const FAQS: { q: string; a: ReactNode }[] = [
  {
    q: 'What do the percentages mean?',
    a: "The market's current chance that a competitor wins. They move every time someone bets.",
  },
  {
    q: 'How much can I win?',
    a: 'Each winning share pays 1 ETH. Buying at a 25% chance pays about 4x, a little less after the 5% prize share and the price move from your own bet.',
  },
  {
    q: 'Can I get out before the race ends?',
    a: 'Yes. While the market is open you can cash out your shares at the current price.',
  },
  {
    q: 'Who decides the winner?',
    a: "An expert review committee checks the evidence against the published rules, MoonDAO's Senate votes, anyone can challenge the result for 72 hours, and then it is reported on-chain.",
  },
  {
    q: 'What if nobody gets there?',
    a: 'If a DePrize is cancelled, ends with no winner, or a required milestone fails, bets are refundable.',
  },
  {
    q: 'Where does the prize go?',
    a: "To the winning team. For Moon capability prizes it buys a community payload on the winner's next flight.",
  },
  {
    q: 'Does betting affect who wins?',
    a: 'No. The winner is decided only by the published criteria. Competitors and insiders are not allowed to bet.',
  },
]

export default function DePrizeHowItWorks({ restricted }: { restricted: boolean }) {
  return (
    <div className="animate-fadeIn flex flex-col items-center">
      <Head
        title="How DePrize works"
        description={deprizeOgDescription(
          'Predict for free or bet ETH on who reaches a lunar milestone first. Every bet grows the prize.'
        )}
      />
      <Container>
        <ContentLayout
          header="How DePrize works"
          mainPadding
          mode="compact"
          popOverEffect={false}
          isProfile
          preFooter={<NoticeFooter />}
        >
          <div className="flex w-full flex-col gap-16 pb-8 sm:gap-24">
            <section className="grid items-center gap-8 md:grid-cols-2 md:gap-10">
              <div>
                <h2 className="font-heading text-3xl font-bold uppercase tracking-tight text-white sm:text-4xl">
                  Who gets to the Moon first?
                </h2>
                <p className="mt-4 text-base leading-relaxed text-gray-300 sm:text-lg">
                  Each DePrize is a race to a real lunar milestone, like landing on the Moon or
                  making fuel there. Pick who you think gets there first. Predict for free, or back
                  your pick with ETH. Every bet grows the prize for the team that wins.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link href="/deprize" className={PRIMARY_CTA}>
                    Browse prizes
                  </Link>
                  <a href="#step-1" className={SECONDARY_CTA}>
                    See how it works
                  </a>
                </div>
              </div>
              <OddsRaceScene />
            </section>

            <div id="step-1" className="scroll-mt-24">
              <Step number={1} title="Predict for free" scene={<PredictScene />}>
                <p>
                  Tap a competitor to predict them as the winner. It costs nothing and anyone can do
                  it.
                </p>
                <p>
                  Predictions from Citizens are weighted by voting power and combine into the DAO
                  forecast. When the race ends, accurate predictions climb the leaderboard.
                </p>
              </Step>
            </div>

            <Step number={2} title="Back your pick with ETH" scene={<BetScene />} flip>
              <p>
                The price of a share is the current chance. At 25%, a share costs 0.25 ETH and pays
                1 ETH if that team wins, so your bet can return about 4x.
              </p>
              <p>
                About 5% of every bet goes straight into the prize. Your bet also nudges the odds
                toward your pick.
              </p>
              {restricted && (
                <p className="text-sm text-amber-200">
                  Betting isn&apos;t available in your region. You can still predict.
                </p>
              )}
            </Step>

            <Step number={3} title="The prize grows" scene={<PrizeScene />}>
              <p>
                The prize pool fills from a share of every bet and from anyone who funds it
                directly. The more people take part, the bigger the reward for whoever gets there
                first.
              </p>
              <p>Bettors don&apos;t share in the prize. It goes to the winning team.</p>
            </Step>

            <Step number={4} title="A winner is decided" scene={<ResolveScene />} flip>
              <p>
                Experts review the evidence against rules published before betting opened. The
                Senate votes, anyone can challenge for 72 hours, and then the result goes on-chain.
              </p>
              <p>
                Winning shares pay 1 ETH each. If there&apos;s no winner or the race is cancelled,
                bets are refunded.
              </p>
            </Step>

            <section>
              <h2 className="font-heading text-2xl font-bold text-white sm:text-3xl">
                Predict or bet?
              </h2>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-blue-400/25 bg-blue-500/[0.06] p-5">
                  <p className="text-lg font-bold text-white">Predict</p>
                  <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-5 text-sm text-gray-300">
                    <li>Free, open to everyone</li>
                    <li>Citizens&apos; picks shape the DAO forecast</li>
                    <li>Scored on the leaderboard</li>
                    <li>No money at stake</li>
                  </ul>
                </div>
                <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/[0.06] p-5">
                  <p className="text-lg font-bold text-white">Bet</p>
                  <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-5 text-sm text-gray-300">
                    <li>Uses ETH, priced at the current chance</li>
                    <li>Winning shares pay 1 ETH each</li>
                    <li>About 5% of every bet grows the prize</li>
                    <li>Cash out any time the market is open</li>
                  </ul>
                </div>
              </div>
            </section>

            <section>
              <h2 className="font-heading text-2xl font-bold text-white sm:text-3xl">Questions</h2>
              <div className="mt-5 flex flex-col divide-y divide-white/[0.08] rounded-2xl border border-white/[0.08]">
                {FAQS.map((faq) => (
                  <details key={faq.q} className="group px-5 py-4">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-semibold text-white">
                      {faq.q}
                      <span className="text-gray-500 transition-transform group-open:rotate-45">
                        +
                      </span>
                    </summary>
                    <p className="mt-2 text-sm leading-relaxed text-gray-400">{faq.a}</p>
                  </details>
                ))}
              </div>
            </section>

            <section className="flex flex-col items-center gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-6 py-10 text-center">
              <h2 className="font-heading text-2xl font-bold text-white sm:text-3xl">
                Pick your winner
              </h2>
              <Link href="/deprize" className={PRIMARY_CTA}>
                Browse prizes
              </Link>
              <p className="max-w-xl text-xs text-gray-500">
                {DEPRIZE_AVAILABILITY_LEGEND}{' '}
                <Link href={DEPRIZE_TERMS_URL} className="underline hover:text-gray-300">
                  Terms
                </Link>
                {' · '}
                <Link href={DEPRIZE_PRIZE_RULES_URL} className="underline hover:text-gray-300">
                  Prize Rules
                </Link>
                {' · '}
                <Link href={DEPRIZE_RISK_DISCLOSURES_URL} className="underline hover:text-gray-300">
                  Risks
                </Link>
              </p>
            </section>
          </div>
        </ContentLayout>
      </Container>
    </div>
  )
}
