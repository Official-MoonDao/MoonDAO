import {
  ANNOUNCE_PROJECT_BUDGET,
  MAX_BUDGET_USD,
  NEXT_QUARTER_BUDGET_USD,
  PROJECT_CYCLE,
} from 'const/config'
import type { ProjectCyclePhase } from 'const/config'
import RewardAsset from '@/components/project/RewardAsset'

type ProposalCycleStatusProps = {
  phase: ProjectCyclePhase
  isIntake: boolean
  submissionsClosed: boolean
  submissionCloseLabel: string
  daysLeft: number
}

// The current cycle's phase and deadlines on /proposals.
export function ProposalCycleStatus({
  phase,
  isIntake,
  submissionsClosed,
  submissionCloseLabel,
  daysLeft,
}: ProposalCycleStatusProps) {
  return (
    <div className="bg-black/20 rounded-xl p-3 md:p-4 border border-white/10">
      <p className="text-xs uppercase tracking-wider text-white/50 mb-1">
        Q{PROJECT_CYCLE.quarter} {PROJECT_CYCLE.year}{' '}
        {isIntake
          ? 'Intake'
          : phase === 'senate'
          ? 'Senate Vote'
          : phase === 'member'
          ? 'Member Vote'
          : 'Cycle'}
      </p>
      {submissionsClosed ? (
        <p className="text-sm text-amber-200">
          Submissions closed at {submissionCloseLabel}. You can still edit a proposal you already
          submitted until {PROJECT_CYCLE.editingDeadline}. New proposals will open for the next
          cycle after Senate Vote begins.
        </p>
      ) : (
        <p className="text-sm text-gray-300">
          Submit by <span className="font-semibold text-white">{submissionCloseLabel}</span>
          {daysLeft > 0 ? ` — ${daysLeft} day${daysLeft === 1 ? '' : 's'} remaining` : ''}. Edits
          close {PROJECT_CYCLE.editingDeadline}. Senate Vote opens {PROJECT_CYCLE.votingDate}.
        </p>
      )}
    </div>
  )
}

// Total and per-project budget for the quarter. Renders nothing until the
// budget is announced.
export function ProposalBudgetTiles() {
  if (!ANNOUNCE_PROJECT_BUDGET) return null
  return (
    <div className="bg-black/20 rounded-xl p-3 md:p-4 border border-white/10">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
        <div className="bg-black/20 rounded-lg p-2 md:p-3 border border-white/10">
          <h2 className="font-heading font-semibold text-white/80 text-xs md:text-sm mb-1">
            Total Quarter Budget
          </h2>
          <RewardAsset
            name="USDC"
            value={`$${NEXT_QUARTER_BUDGET_USD.toLocaleString()}`}
            usdValue={NEXT_QUARTER_BUDGET_USD}
          />
        </div>
        <div className="bg-black/20 rounded-lg p-2 md:p-3 border border-white/10">
          <h2 className="font-heading font-semibold text-white/80 text-xs md:text-sm mb-1">
            Max Project Budget
          </h2>
          <RewardAsset
            name="USDC"
            value={`$${MAX_BUDGET_USD.toLocaleString()}`}
            usdValue={MAX_BUDGET_USD}
          />
        </div>
      </div>
    </div>
  )
}
