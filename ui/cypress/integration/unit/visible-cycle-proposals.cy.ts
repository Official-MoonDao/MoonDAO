import {
  isSenateClosedBelowQuorum,
  visibleCycleProposals,
} from '../../../lib/proposals/visibleCycleProposals'

const q4Proposals = [
  { id: 159, MDP: 277, tempCheckApproved: false, tempCheckFailed: false },
  { id: 158, MDP: 276, tempCheckApproved: true, tempCheckFailed: false },
  { id: 157, MDP: 275, tempCheckApproved: true, tempCheckFailed: false },
  { id: 156, MDP: 274, tempCheckApproved: true, tempCheckFailed: false },
  { id: 155, MDP: 273, tempCheckApproved: true, tempCheckFailed: false },
  { id: 151, MDP: 269, tempCheckApproved: true, tempCheckFailed: false },
]

describe('visible cycle proposals', () => {
  it('counts only Senate-approved proposals during the Member Vote', () => {
    const visible = visibleCycleProposals(q4Proposals, {
      isSenateVote: false,
      isMemberVote: true,
    })
    expect(visible.map((p) => p.MDP)).to.deep.equal([276, 275, 274, 273, 269])
    expect(visible).to.have.length(5)
    expect(q4Proposals).to.have.length(6)
  })

  it('hides already-approved proposals during the Senate vote', () => {
    const visible = visibleCycleProposals(q4Proposals, {
      isSenateVote: true,
      isMemberVote: false,
    })
    expect(visible.map((p) => p.MDP)).to.deep.equal([277])
  })

  it('lists every proposal that has not failed outside a vote window', () => {
    const withFailure = [
      ...q4Proposals,
      { id: 1, MDP: 1, tempCheckApproved: false, tempCheckFailed: true },
    ]
    const visible = visibleCycleProposals(withFailure, {
      isSenateVote: false,
      isMemberVote: false,
    })
    expect(visible.map((p) => p.MDP)).to.deep.equal([277, 276, 275, 274, 273, 269])
  })

  it('hides a below-quorum Senate proposal once that vote is closed', () => {
    // MDP-277, Q4 2026: 4 Senate votes, quorum 5, neither approved nor failed.
    // tallyVotes is a no-op under quorum, so the row stays pending on-chain.
    const withVotes = q4Proposals.map((proposal) => ({
      ...proposal,
      tempCheckVoteCount: proposal.MDP === 277 ? 4 : 5,
      senateQuorum: 5,
    }))
    const visible = visibleCycleProposals(withVotes, {
      isSenateVote: false,
      isMemberVote: false,
    })
    expect(visible.map((p) => p.MDP)).to.deep.equal([276, 275, 274, 273, 269])
    expect(isSenateClosedBelowQuorum(withVotes[0])).to.equal(true)
    expect(
      isSenateClosedBelowQuorum({
        tempCheckApproved: false,
        tempCheckVoteCount: '4',
        senateQuorum: '5',
      })
    ).to.equal(true)
  })

  it('keeps a below-quorum proposal on the ballot during the Senate vote', () => {
    const withVotes = q4Proposals.map((proposal) => ({
      ...proposal,
      tempCheckVoteCount: proposal.MDP === 277 ? 4 : 5,
      senateQuorum: 5,
    }))
    const visible = visibleCycleProposals(withVotes, {
      isSenateVote: true,
      isMemberVote: false,
    })
    expect(visible.map((p) => p.MDP)).to.deep.equal([277])
  })

  it('keeps a proposal that has not been voted on outside the Senate window', () => {
    const fresh = [
      {
        id: 200,
        MDP: 300,
        tempCheckApproved: false,
        tempCheckFailed: false,
        tempCheckVoteCount: 0,
        senateQuorum: 5,
      },
    ]
    const visible = visibleCycleProposals(fresh, {
      isSenateVote: false,
      isMemberVote: false,
    })
    expect(visible.map((p) => p.MDP)).to.deep.equal([300])
    expect(isSenateClosedBelowQuorum(fresh[0])).to.equal(false)
  })

  it('returns an empty list when there are no proposals', () => {
    expect(
      visibleCycleProposals(undefined, { isSenateVote: false, isMemberVote: true })
    ).to.deep.equal([])
    expect(visibleCycleProposals([], { isSenateVote: false, isMemberVote: false })).to.deep.equal(
      []
    )
  })
})
