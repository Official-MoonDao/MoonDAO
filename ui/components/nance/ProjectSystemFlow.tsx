import { motion, useReducedMotion } from 'framer-motion'
import { useState } from 'react'

type ProjectSystemFlowProps = {
  isSenateVote: boolean
  isMemberVote: boolean
  rewardVotingActive: boolean
}

type Phase = {
  id: string
  label: string
  subtitle: string
  description: string
  iconPath: string
  live: boolean
}

type PhaseStatus = 'live' | 'done' | 'upcoming'

const STATUS_CHIP: Record<PhaseStatus, { text: string; className: string }> = {
  live: {
    text: 'Live now',
    className: 'text-emerald-300 bg-emerald-400/10 border-emerald-400/30',
  },
  done: {
    text: 'Done',
    className: 'text-blue-300 bg-blue-400/10 border-blue-400/25',
  },
  upcoming: {
    text: 'Up next',
    className: 'text-gray-400 bg-white/5 border-white/10',
  },
}

function getPhases({
  isSenateVote,
  isMemberVote,
  rewardVotingActive,
}: ProjectSystemFlowProps): Phase[] {
  return [
    {
      id: 'submit',
      label: 'Submit',
      subtitle: 'Proposal',
      live: !isSenateVote && !isMemberVote,
      description:
        'Anyone can submit a project proposal through the proposal portal. Each proposal lays out the problem, the solution, the team, and a requested budget. A winner receives min(their ask, ¼ of the quarterly pot). Proposals can be edited at any time leading up to the Townhall.',
      iconPath: 'M15.232 5.232l3.536 3.536M9 13h3l8-8a2.828 2.828 0 00-4-4l-8 8v3zM5 19h14',
    },
    {
      id: 'present',
      label: 'Present',
      subtitle: 'Townhall',
      live: false,
      description:
        "At the quarterly Townhall, every proposal gets a chance to pitch to the community. Each project has 10 minutes to walk through the problem they're solving, their proposed solution, the team, and the budget, followed by Q&A from the community.",
      iconPath:
        'M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z',
    },
    {
      id: 'senate',
      label: 'Senate',
      subtitle: 'Review',
      live: isSenateVote,
      description:
        'After the Townhall, the Senate votes to approve or reject each proposal under the rules in the Constitution. Each Senator has one vote. Approval requires a super-majority (more than 66.6%) of Senate votes in favor, with a quorum of at least 70% of all Senators participating. Only proposals that pass the Senate advance to the Member Vote.',
      iconPath: 'M12 3l8 4v5c0 4.418-3.582 8-8 9-4.418-1-8-4.582-8-9V7l8-4z',
    },
    {
      id: 'member',
      label: 'Member',
      subtitle: 'Vote',
      live: isMemberVote,
      description:
        'Once the Senate has approved proposals, voting members distribute their voting power across the approved proposals as percentages. The top three by voting power are funded at min(ask, ¼ of the pot). If fewer than three Senate-passed proposals are considered, all of them are funded. Project authors, managers and members cannot vote on their own project.',
      iconPath: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
    },
    {
      id: 'build',
      label: 'Build',
      subtitle: 'Execute',
      live: false,
      description:
        "Funded teams execute the project over the quarter, with budgets paid through the project's multisig. Leads give monthly written updates to the Senate and attend weekly Townhalls; Contributors post weekly progress in the #wdygdtw Discord channel. Missed updates and townhalls reduce retroactive rewards.",
      iconPath: 'M13 10V3L4 14h7v7l9-11h-7z',
    },
    {
      id: 'retro',
      label: 'Retroactive',
      subtitle: 'Rewards',
      live: isMemberVote && rewardVotingActive,
      description:
        'At the end of the quarter, each completed project submits a Final Report with its contributor split. Citizens and Voting Members then allocate their voting power across the projects to determine retroactive ETH and vMOONEY rewards based on impact.',
      iconPath:
        'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    },
  ]
}

export default function ProjectSystemFlow(props: ProjectSystemFlowProps) {
  const reduceMotion = useReducedMotion()
  const phases = getPhases(props)
  const currentIdx = Math.max(
    0,
    phases.findIndex((p) => p.live)
  )
  const [pinnedIdx, setPinnedIdx] = useState<number | null>(null)
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const shownIdx = hoveredIdx ?? pinnedIdx ?? currentIdx
  const progress = currentIdx / (phases.length - 1)

  const statusOf = (idx: number): PhaseStatus =>
    phases[idx].live ? 'live' : idx < currentIdx ? 'done' : 'upcoming'

  return (
    <div className="w-full pt-2" onMouseLeave={() => setHoveredIdx(null)}>
      <div className="relative">
        {/* Track spans from the centre of the first node to the centre of the last. */}
        <div className="absolute top-[18px] sm:top-[22px] left-[calc(100%/12)] right-[calc(100%/12)] h-0.5 -translate-y-1/2 rounded-full bg-white/10">
          <motion.div
            className="relative h-full overflow-hidden rounded-full bg-gradient-to-r from-blue-500 to-purple-500"
            initial={reduceMotion ? false : { width: 0 }}
            whileInView={{ width: `${progress * 100}%` }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ duration: 1.1, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
          >
            {!reduceMotion && progress > 0 && (
              <motion.span
                className="absolute inset-y-0 w-16 bg-gradient-to-r from-transparent via-white/80 to-transparent"
                initial={{ left: '-4rem' }}
                animate={{ left: '100%' }}
                transition={{
                  duration: 2.2,
                  delay: 1.4,
                  repeat: Infinity,
                  repeatDelay: 1.2,
                  ease: 'easeInOut',
                }}
              />
            )}
          </motion.div>
        </div>

        <ol className="relative grid grid-cols-6">
          {phases.map((phase, idx) => {
            const status = statusOf(idx)
            const selected = idx === shownIdx
            return (
              <motion.li
                key={phase.id}
                className="flex flex-col items-center min-w-0"
                initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.6 }}
                transition={{ duration: 0.45, delay: idx * 0.08, ease: 'easeOut' }}
              >
                <button
                  type="button"
                  onClick={() => setPinnedIdx(idx)}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onFocus={() => setHoveredIdx(idx)}
                  onBlur={() => setHoveredIdx(null)}
                  aria-pressed={selected}
                  aria-label={`${phase.label} ${phase.subtitle}${
                    status === 'live' ? ' (current phase)' : ''
                  }`}
                  className="group flex flex-col items-center w-full min-w-0 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60"
                >
                  <span className="relative flex items-center justify-center">
                    {status === 'live' && !reduceMotion && (
                      <motion.span
                        aria-hidden
                        className="absolute inset-0 rounded-full bg-indigo-500/40"
                        animate={{ scale: [1, 1.7], opacity: [0.6, 0] }}
                        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
                      />
                    )}
                    {selected && (
                      <motion.span
                        aria-hidden
                        layoutId="project-flow-selected"
                        className="absolute -inset-1.5 rounded-full border border-white/30"
                        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                      />
                    )}
                    <span className="relative rounded-full bg-dark-cool">
                      <span
                        className={`flex w-9 h-9 sm:w-11 sm:h-11 items-center justify-center rounded-full border transition-colors duration-300 ${
                          status === 'live'
                            ? 'border-white/30 bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-[0_0_20px_rgba(99,102,241,0.45)]'
                            : status === 'done'
                            ? 'border-blue-400/40 bg-blue-500/10 text-blue-300'
                            : 'border-white/10 bg-white/[0.03] text-gray-500 group-hover:text-gray-300 group-hover:border-white/25'
                        }`}
                      >
                        <svg
                          className="w-4 h-4 sm:w-5 sm:h-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                          aria-hidden
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d={phase.iconPath} />
                        </svg>
                      </span>
                    </span>
                  </span>
                  <span className="hidden sm:flex flex-col items-center mt-3 w-full px-1 min-w-0">
                    <span
                      className={`text-[11px] font-RobotoMono font-semibold uppercase tracking-wider truncate max-w-full transition-colors ${
                        selected || status === 'live' ? 'text-white' : 'text-gray-500'
                      }`}
                    >
                      {phase.label}
                    </span>
                    <span
                      className={`text-xs truncate max-w-full transition-colors ${
                        status === 'live' ? 'text-blue-300' : 'text-gray-600'
                      }`}
                    >
                      {phase.subtitle}
                    </span>
                  </span>
                </button>
              </motion.li>
            )
          })}
        </ol>
      </div>

      {/* Every panel shares one grid cell, so the box is sized to the longest
          description and never jumps in height as the selection changes. */}
      <div
        className="mt-4 sm:mt-5 grid rounded-lg border border-white/10 bg-white/[0.03] p-3 sm:p-4"
        aria-live="polite"
      >
        {phases.map((phase, idx) => {
          const chip = STATUS_CHIP[statusOf(idx)]
          const shown = idx === shownIdx
          return (
            <motion.div
              key={phase.id}
              className="col-start-1 row-start-1"
              initial={false}
              animate={{ opacity: shown ? 1 : 0, y: shown || reduceMotion ? 0 : 6 }}
              transition={{ duration: reduceMotion ? 0 : 0.25, ease: 'easeOut' }}
              aria-hidden={!shown}
              style={{ pointerEvents: shown ? 'auto' : 'none' }}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-RobotoMono text-gray-500 tracking-wider">
                  {String(idx + 1).padStart(2, '0')}
                </span>
                <span className="text-sm sm:text-base font-heading font-semibold text-white">
                  {phase.label}
                  <span className="text-blue-300 font-normal"> · {phase.subtitle}</span>
                </span>
                <span
                  className={`text-[10px] font-RobotoMono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${chip.className}`}
                >
                  {chip.text}
                </span>
              </div>
              <p className="mt-2 text-xs sm:text-sm text-gray-300 leading-relaxed">
                {phase.description}
              </p>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
