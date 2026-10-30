import Link from 'next/link'
import type { ReactNode } from 'react'
import { BuyScene, DecayScene, LockLengthScene, SquareRootScene, VoteScene } from './scenes'

const STEP_LINK =
  'inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-blue-400 hover:text-blue-300'

function Step(props: {
  number: number
  title: string
  children: ReactNode
  scene: ReactNode
  link?: { href: string; label: string }
  flip?: boolean
}) {
  return (
    <section className="grid items-center gap-6 md:grid-cols-2 md:gap-12">
      <div className={props.flip ? 'md:order-2' : undefined}>
        <span className="text-xs font-semibold uppercase tracking-wider text-blue-300">
          Step {props.number}
        </span>
        <h3 className="mt-1 font-heading text-2xl font-bold text-white sm:text-3xl">
          {props.title}
        </h3>
        <div className="mt-3 flex flex-col gap-3 text-[15px] leading-relaxed text-gray-300">
          {props.children}
        </div>
        {props.link && (
          <Link href={props.link.href} className={`mt-4 ${STEP_LINK}`}>
            {props.link.label} <span aria-hidden>→</span>
          </Link>
        )}
      </div>
      <div className={props.flip ? 'md:order-1' : undefined}>{props.scene}</div>
    </section>
  )
}

export default function MooneyHowItWorks() {
  return (
    <section id="how-it-works" className="w-full scroll-mt-24 px-6 py-20">
      <div className="mx-auto flex max-w-6xl flex-col gap-16 sm:gap-24">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-heading text-3xl font-bold text-white md:text-4xl">
            How MOONEY works
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-gray-300">
            MOONEY is how members decide where MoonDAO&apos;s treasury goes. Buy it, lock it for
            voting power, and vote on the projects that get funded.
          </p>
        </div>

        <Step
          number={1}
          title="Buy MOONEY"
          scene={<BuyScene />}
          link={{ href: '/get-mooney', label: 'Get MOONEY' }}
        >
          <p>
            Sign in with a wallet, email, phone, or a Google, X, Discord or GitHub account. If you
            don&apos;t have a wallet yet, one is created for you.
          </p>
          <p>
            Pick Ethereum, Arbitrum or Base and swap ETH for MOONEY on Uniswap v4. You see the
            quote, price impact and network fee before you confirm, and a 5% slippage limit cancels
            the swap if the price moves too far.
          </p>
        </Step>

        <Step
          number={2}
          title="Lock longer, get more vMOONEY"
          scene={<LockLengthScene />}
          link={{ href: '/lock', label: 'Lock MOONEY' }}
          flip
        >
          <p>
            Lock MOONEY for anywhere from one week to four years and you receive vMOONEY, the token
            that counts in votes.
          </p>
          <p>
            vMOONEY = MOONEY × (time left on the lock ÷ 4 years). A four-year lock gives 1 vMOONEY
            per MOONEY; a one-year lock gives a quarter of that.
          </p>
        </Step>

        <Step number={3} title="vMOONEY winds down over time" scene={<DecayScene />}>
          <p>
            Your MOONEY stays yours, held by the lock contract. As the unlock date gets closer your
            vMOONEY falls steadily, reaching zero on the day the lock ends.
          </p>
          <p>
            Add more MOONEY or extend the lock at any time to top it back up. Once the lock expires,
            withdraw your MOONEY.
          </p>
        </Step>

        <Step number={4} title="Voting power is the square root" scene={<SquareRootScene />} flip>
          <p>
            Your voting power is the square root of your vMOONEY, counted across every network you
            hold it on. 4× the vMOONEY gives 2× the voting power.
          </p>
          <p>That quadratic curve keeps the largest holders from outvoting everyone else.</p>
        </Step>

        <Step
          number={5}
          title="Vote on where funds go"
          scene={<VoteScene />}
          link={{ href: '/projects', label: 'See this quarter’s projects' }}
        >
          <p>
            In each quarter&apos;s Member Vote, split your voting power across the Senate-approved
            project proposals as percentages. The top proposals get funded.
          </p>
          <p>Retroactive rewards for completed projects are allocated the same way.</p>
        </Step>
      </div>
    </section>
  )
}
