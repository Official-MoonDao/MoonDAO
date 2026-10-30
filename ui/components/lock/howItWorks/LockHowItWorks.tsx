import type { ReactNode } from 'react'
import { DecayScene, LockLengthScene, SquareRootScene, VoteScene } from './scenes'

function Step(props: { number: number; title: string; children: ReactNode; scene: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <span className="text-xs font-semibold uppercase tracking-wider text-blue-300">
          Step {props.number}
        </span>
        <h3 className="mt-1 font-heading text-xl font-bold text-white sm:text-2xl">
          {props.title}
        </h3>
        <div className="mt-2 flex flex-col gap-2 text-sm leading-relaxed text-gray-300 sm:text-[15px]">
          {props.children}
        </div>
      </div>
      {props.scene}
    </section>
  )
}

export default function LockHowItWorks() {
  return (
    <div className="flex flex-col gap-10 sm:gap-14">
      <div>
        <h2 className="font-heading text-2xl font-bold text-white sm:text-3xl">
          How locking works
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-gray-400 sm:text-base">
          Lock MOONEY to get vMOONEY, and vMOONEY gives you a say in how MoonDAO spends its
          treasury.
        </p>
      </div>

      <Step number={1} title="Lock longer, get more vMOONEY" scene={<LockLengthScene />}>
        <p>
          You choose how much MOONEY to lock and for how long, from one week up to four years.
          vMOONEY = MOONEY × (time left on the lock ÷ 4 years).
        </p>
        <p>Your MOONEY stays yours. It&apos;s held by the lock contract until the unlock date.</p>
      </Step>

      <Step number={2} title="vMOONEY winds down over time" scene={<DecayScene />}>
        <p>
          As the unlock date gets closer, your vMOONEY falls steadily, reaching zero on the day the
          lock ends.
        </p>
        <p>
          Add more MOONEY or extend the lock at any time to top it back up. Once the lock expires,
          withdraw your MOONEY.
        </p>
      </Step>

      <Step number={3} title="Voting power is the square root" scene={<SquareRootScene />}>
        <p>
          Your voting power is the square root of your vMOONEY, counted across every network you
          hold it on. Holding 4× the vMOONEY gives you 2× the voting power.
        </p>
        <p>That keeps the largest holders from outvoting everyone else.</p>
      </Step>

      <Step number={4} title="Vote on where funds go" scene={<VoteScene />}>
        <p>
          In each quarter&apos;s Member Vote, split your voting power across the Senate-approved
          project proposals as percentages. The top proposals get funded.
        </p>
        <p>Retroactive rewards for completed projects are allocated the same way.</p>
      </Step>
    </div>
  )
}
