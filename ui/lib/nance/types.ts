export type ProposalState = 'temp-check' | 'temp-check-failed' | 'active'

export const PROJECT_VOTE_FAILED = 4
export const PROJECT_TEMP_CHECK_FAILED = 3
export const PROJECT_PENDING = 2
export const PROJECT_ACTIVE = 1
export const PROJECT_ENDED = 0

export function getProposalStatus(active: number) {
  if (project.active == PROJECT_PENDING) {
    if (tempCheckApproved) {
      proposalStatus = 'Voting'
    } else if (tempCheckFailed) {
      proposalStatus = 'Cancelled'
    } else {
      proposalStatus = 'Temperature Check'
    }
  } else if (project.active == PROJECT_ACTIVE) {
    proposalStatus = 'Approved'
  } else {
    proposalStatus = 'Archived'
  }
}
