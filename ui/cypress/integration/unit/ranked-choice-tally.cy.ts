import {
  computeRankedChoiceTally,
  parseRankedBallot,
  type RankedChoiceVoteRow,
} from '../../../lib/proposals/computeRankedChoiceTally'

const CHOICES = ['Alice', 'Bob', 'Carol', 'None of the above']
const NONE_KEY = 4

describe('Ranked-choice tally / ballot parsing', () => {
  it('accepts arrays and JSON strings, drops invalid and duplicate keys', () => {
    expect(parseRankedBallot([2, 1], 4)).to.deep.equal([2, 1])
    expect(parseRankedBallot('[3,1]', 4)).to.deep.equal([3, 1])
    expect(parseRankedBallot([2, 2, 9, 0, 'x', 1], 4)).to.deep.equal([2, 1])
    expect(parseRankedBallot({ '1': 100 }, 4)).to.deep.equal([])
    expect(parseRankedBallot('not json', 4)).to.deep.equal([])
  })
})

describe('Ranked-choice tally / instant runoff', () => {
  it('elects a first-round majority without further rounds', () => {
    const votes: RankedChoiceVoteRow[] = [
      { address: '0xa', vote: [1, 2] },
      { address: '0xb', vote: [2] },
    ]
    const tally = computeRankedChoiceTally(votes, { '0xa': 60, '0xb': 40 }, CHOICES, NONE_KEY)
    expect(tally.rounds).to.have.length(1)
    expect(tally.winnerKey).to.equal(1)
    expect(tally.winnerLabel).to.equal('Alice')
    expect(tally.passed).to.equal(true)
  })

  it('transfers eliminated ballots to the next preference', () => {
    // Round 1: Alice 40, Bob 35, Carol 25 → Carol out.
    // Round 2: Carol's ballots go to Bob → Bob 60, Alice 40.
    const votes: RankedChoiceVoteRow[] = [
      { address: '0xa', vote: [1] },
      { address: '0xb', vote: [2, 1] },
      { address: '0xc', vote: [3, 2] },
    ]
    const power = { '0xa': 40, '0xb': 35, '0xc': 25 }
    const tally = computeRankedChoiceTally(votes, power, CHOICES, NONE_KEY)
    expect(tally.winnerKey).to.equal(2)
    expect(tally.rounds[tally.rounds.length - 1].totals['2']).to.equal(60)
    const carolOut = tally.rounds.find((r) => r.eliminated.includes(3))
    expect(carolOut).to.not.equal(undefined)
  })

  it('weights ballots by voting power, not head count', () => {
    const votes: RankedChoiceVoteRow[] = [
      { address: '0xa', vote: [1] },
      { address: '0xb', vote: [2] },
      { address: '0xc', vote: [2] },
    ]
    const power = { '0xa': 100, '0xb': 10, '0xc': 10 }
    const tally = computeRankedChoiceTally(votes, power, CHOICES, NONE_KEY)
    expect(tally.winnerKey).to.equal(1)
  })

  it('measures the majority against continuing VP, excluding exhausted ballots', () => {
    // Round 1: Alice 45, Bob 30, Carol 25 → Carol out; her ballot ranks
    // nobody else, so it exhausts. Round 2: Alice 45 of 75 continuing.
    const votes: RankedChoiceVoteRow[] = [
      { address: '0xa', vote: [1] },
      { address: '0xb', vote: [2] },
      { address: '0xc', vote: [3] },
    ]
    const power = { '0xa': 45, '0xb': 30, '0xc': 25 }
    const tally = computeRankedChoiceTally(votes, power, CHOICES, NONE_KEY)
    const last = tally.rounds[tally.rounds.length - 1]
    expect(last.exhaustedVP).to.equal(25)
    expect(last.continuingVP).to.equal(75)
    expect(tally.winnerKey).to.equal(1)
  })

  it('reports None of the above as a non-passing result', () => {
    const votes: RankedChoiceVoteRow[] = [
      { address: '0xa', vote: [NONE_KEY] },
      { address: '0xb', vote: [1] },
    ]
    const tally = computeRankedChoiceTally(votes, { '0xa': 70, '0xb': 30 }, CHOICES, NONE_KEY)
    expect(tally.winnerKey).to.equal(NONE_KEY)
    expect(tally.noneWon).to.equal(true)
    expect(tally.passed).to.equal(false)
  })

  it('runs multiple elimination rounds until a majority emerges', () => {
    // Round 1: Alice 30, Bob 26, Carol 24, None 20 → None out, 20 → Carol.
    // Round 2: Alice 30, Bob 26, Carol 44 → Bob out, 26 → Alice.
    // Round 3: Alice 56, Carol 44 → Alice wins.
    const votes: RankedChoiceVoteRow[] = [
      { address: '0xa', vote: [1] },
      { address: '0xb', vote: [2, 1] },
      { address: '0xc', vote: [3] },
      { address: '0xd', vote: [NONE_KEY, 3] },
    ]
    const power = { '0xa': 30, '0xb': 26, '0xc': 24, '0xd': 20 }
    const tally = computeRankedChoiceTally(votes, power, CHOICES, NONE_KEY)
    expect(tally.rounds[0].eliminated).to.deep.equal([NONE_KEY])
    expect(tally.rounds[1].eliminated).to.deep.equal([2])
    expect(tally.winnerKey).to.equal(1)
  })

  it('transfers ballots from an eliminated None of the above', () => {
    // Round 1: Alice 35, Bob 25, Carol 15, None 25 → Carol out, 15 → Bob.
    // Round 2: Alice 35, Bob 40, None 25 → None out, 25 → Alice.
    // Round 3: Alice 60, Bob 40 → Alice wins.
    const votes: RankedChoiceVoteRow[] = [
      { address: '0xa', vote: [1] },
      { address: '0xb', vote: [2] },
      { address: '0xc', vote: [3, 2] },
      { address: '0xd', vote: [NONE_KEY, 1] },
    ]
    const power = { '0xa': 35, '0xb': 25, '0xc': 15, '0xd': 25 }
    const tally = computeRankedChoiceTally(votes, power, CHOICES, NONE_KEY)
    expect(tally.rounds[0].eliminated).to.deep.equal([3])
    expect(tally.rounds[1].eliminated).to.deep.equal([NONE_KEY])
    expect(tally.winnerKey).to.equal(1)
  })

  it('resolves a last-place tie by looking back to an earlier round', () => {
    const choices = ['X', 'Y', 'Z', 'W']
    const votes: RankedChoiceVoteRow[] = [
      { address: '0x1', vote: [1] },
      { address: '0x2', vote: [2] },
      { address: '0x3', vote: [3] },
      { address: '0x4', vote: [4, 3] },
    ]
    // Round 1: X 40, Y 30, Z 25, W 5 → W out, 5 → Z.
    // Round 2: X 40, Y 30, Z 30 → Y and Z tie; round 1 had Z 25 < Y 30 → Z out.
    const power = { '0x1': 40, '0x2': 30, '0x3': 25, '0x4': 5 }
    const tally = computeRankedChoiceTally(votes, power, choices, null)
    expect(tally.rounds[1].eliminated).to.deep.equal([3])
    expect(tally.winnerKey).to.equal(1)
  })

  it('flags an unresolvable exact tie instead of picking a winner', () => {
    const choices = ['X', 'Y']
    const votes: RankedChoiceVoteRow[] = [
      { address: '0x1', vote: [1] },
      { address: '0x2', vote: [2] },
    ]
    const tally = computeRankedChoiceTally(votes, { '0x1': 50, '0x2': 50 }, choices, null)
    expect(tally.tied).to.equal(true)
    expect(tally.winnerKey).to.equal(null)
    expect(tally.passed).to.equal(false)
  })

  it('ignores zero-VP voters, empty ballots, and legacy For/Against rows', () => {
    const votes: RankedChoiceVoteRow[] = [
      { address: '0xA', vote: [2] },
      { address: '0xb', vote: [1] },
      { address: '0xc', vote: [] },
      { address: '0xd', vote: { '1': 100 } },
    ]
    const power = { '0xa': 10, '0xb': 0, '0xc': 50, '0xd': 50 }
    const tally = computeRankedChoiceTally(votes, power, CHOICES, NONE_KEY)
    expect(tally.ballotCount).to.equal(1)
    expect(tally.totalParticipationVP).to.equal(10)
    expect(tally.winnerKey).to.equal(2)
  })

  it('returns no winner when nobody voted', () => {
    const tally = computeRankedChoiceTally([], {}, CHOICES, NONE_KEY)
    expect(tally.winnerKey).to.equal(null)
    expect(tally.tied).to.equal(false)
    expect(tally.passed).to.equal(false)
  })
})
