import Link from 'next/link'
import type { ReactNode } from 'react'
import { CampaignScene, ContributeScene, PayoutScene, RefundScene, VestingScene } from './scenes'

const CTA_BASE =
  'inline-flex min-h-[44px] items-center justify-center rounded-xl px-6 py-3 text-sm font-semibold text-white transition-all duration-300 sm:text-base'
const PRIMARY_CTA = `${CTA_BASE} bg-gradient-to-r from-[#6C407D] via-[#5F4BA2] to-[#4660E7] hover:shadow-xl hover:shadow-purple-500/30`
const SECONDARY_CTA = `${CTA_BASE} border border-white/15 hover:bg-white/[0.06]`

const TRACK_RECORD = [
  { value: '$8M', label: 'raised through decentralized funding' },
  { value: '12,000', label: '$MOONEY holders' },
  { value: '80', label: 'projects funded' },
  { value: '2', label: 'people sent to space' },
]

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
        <span className="text-xs font-semibold uppercase tracking-wider text-violet-300">
          Step {props.number}
        </span>
        <h3 className="mt-1 font-heading text-2xl font-bold text-white sm:text-3xl">
          {props.title}
        </h3>
        <div className="mt-3 flex flex-col gap-3 text-[15px] leading-relaxed text-gray-300">
          {props.children}
        </div>
      </div>
      <div className={props.flip ? 'md:order-1' : undefined}>{props.scene}</div>
    </section>
  )
}

function LaunchCta({
  citizenHasAccess,
  onLaunchClick,
}: {
  citizenHasAccess: boolean
  onLaunchClick: () => void
}) {
  return citizenHasAccess ? (
    <button type="button" onClick={onLaunchClick} className={PRIMARY_CTA}>
      Launch your mission
    </button>
  ) : (
    <Link href="/join" className={PRIMARY_CTA}>
      Join the network to launch
    </Link>
  )
}

export default function LaunchpadHowItWorks({
  citizenHasAccess,
  onLaunchClick,
}: {
  citizenHasAccess: boolean
  onLaunchClick: () => void
}) {
  return (
    <section
      id="how-it-works"
      className="relative scroll-mt-20 bg-gradient-to-b from-[#010618] via-[#060b24] to-[#0A0A0A]"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-16 px-4 py-16 sm:gap-24 sm:px-6 md:py-24 lg:px-8">
        <section className="grid items-center gap-8 md:grid-cols-2 md:gap-10">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-violet-300">
              How the Launchpad works
            </span>
            <h2 className="mt-2 font-heading text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Crowdfund a space mission, on-chain
            </h2>
            <p className="mt-4 text-base leading-relaxed text-gray-300 sm:text-lg">
              A team sets a funding goal and a deadline. Anyone in the world can back it with ETH or
              a debit card and gets mission tokens in return. Reach the goal and the funds go to
              work. Miss it and contributors can get their money back.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <LaunchCta citizenHasAccess={citizenHasAccess} onLaunchClick={onLaunchClick} />
              <a href="#launch-step-1" className={SECONDARY_CTA}>
                See each step
              </a>
            </div>
          </div>
          <CampaignScene />
        </section>

        <div id="launch-step-1" className="scroll-mt-24">
          <Step number={1} title="Back a mission, get tokens" scene={<ContributeScene />}>
            <p>
              Contribute with ETH on Ethereum or a supported Layer 2, or pay by card if you have
              never used crypto. Each contribution mints mission tokens at a fixed rate.
            </p>
            <p>
              Half the tokens go to contributors. The rest is reserved: 30% for the team, 17.5% for
              MoonDAO and 2.5% for a trading pool. Tokens give you a stake in the mission and a
              voice in how it is run.
            </p>
          </Step>
        </div>

        <Step number={2} title="Goal reached: the funds go to work" scene={<PayoutScene />} flip>
          <p>
            If the mission reaches its goal by the deadline, 90% of the ETH goes to the team&apos;s
            multisig to build the mission.
          </p>
          <p>
            5% and 2.5% of the tokens seed a Uniswap pool so the token can be traded. On missions
            created today, MoonDAO and Juicebox each receive 2.5% when the mission pays out. After
            the treasury-fee creator is deployed, MoonDAO&apos;s 2.5% is taken when a contribution
            arrives and is kept if the mission refunds, and the funding goal is the amount the
            mission keeps. Every payout is on-chain, so anyone can trace how the money is spent.
          </p>
        </Step>

        <Step number={3} title="Goal missed: get your money back" scene={<RefundScene />}>
          <p>
            If the deadline passes before the goal is reached, the mission doesn&apos;t go ahead and
            the team receives nothing.
          </p>
          <p>
            Contributors can return their tokens for a refund during a 28-day window. Missions
            created today refund the full contribution. Missions created after the treasury-fee
            creator is deployed refund 97.5%. Teams choose whether to offer refunds when they
            launch, so check the mission page before you contribute.
          </p>
        </Step>

        <Step number={4} title="Locked in for the long run" scene={<VestingScene />} flip>
          <p>
            The team&apos;s and MoonDAO&apos;s tokens are locked for a year, then unlock steadily
            until year four, so neither can sell their tokens early.
          </p>
          <p>Teams succeed when their mission does, the same as the people who backed them.</p>
        </Step>

        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-violet-400/25 bg-violet-500/[0.06] p-5">
            <p className="text-lg font-bold text-white">For teams</p>
            <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-5 text-sm text-gray-300">
              <li>Launch in minutes with a goal, a deadline and an optional token</li>
              <li>No upfront cost beyond network gas</li>
              <li>Reach backers around the world, including people new to crypto</li>
              <li>Funds and the mission are controlled by your team&apos;s multisig</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-sky-400/25 bg-sky-500/[0.06] p-5">
            <p className="text-lg font-bold text-white">For contributors</p>
            <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-5 text-sm text-gray-300">
              <li>Back missions with ETH or a debit card</li>
              <li>Get mission tokens for every contribution</li>
              <li>Refunds if a mission that offers them misses its goal</li>
              <li>See exactly where the money goes, on-chain</li>
            </ul>
          </div>
        </section>

        <section>
          <h2 className="text-center font-heading text-2xl font-bold text-white sm:text-3xl">
            A proven way to fund space
          </h2>
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            {TRACK_RECORD.map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-5 text-center"
              >
                <p className="font-heading text-3xl font-bold text-white">{item.value}</p>
                <p className="mt-1 text-sm text-gray-400">{item.label}</p>
              </div>
            ))}
          </div>
          <p className="mx-auto mt-4 max-w-2xl text-center text-sm text-gray-400">
            Missions run on Juicebox, an audited funding protocol behind 1,000+ projects and over
            $200M raised.
          </p>
        </section>

        <section className="flex flex-col items-center gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-6 py-10 text-center">
          <h2 className="font-heading text-2xl font-bold text-white sm:text-3xl">
            The next great space mission starts here
          </h2>
          <p className="max-w-xl text-sm text-gray-400 sm:text-base">
            Teams in the Space Acceleration Network can launch a mission today.
          </p>
          <LaunchCta citizenHasAccess={citizenHasAccess} onLaunchClick={onLaunchClick} />
        </section>
      </div>
    </section>
  )
}
