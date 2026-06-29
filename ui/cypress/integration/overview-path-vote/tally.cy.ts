import {
  parsePathVotes,
  aggregatePathVotes,
  buildPathVoteResults,
  computePathVoteWinner,
  formatVoteClosedMessage,
} from '@/lib/overview-path-vote/tally'
import type { ParsedPathVote } from '@/lib/overview-path-vote/tally'
import { getPathVoteSnapshot, hasPathVoteSnapshot } from '@/lib/overview-path-vote/snapshot'

describe('Overview Path Vote – Tally Logic', () => {
  // ---------------------------------------------------------------------------
  // parsePathVotes
  // ---------------------------------------------------------------------------
  describe('parsePathVotes', () => {
    it('parses a single vote row with string vote JSON', () => {
      const rows = [
        {
          address: '0xABC123',
          vote: JSON.stringify({ 'option-b': 500 }),
        },
      ]
      const result = parsePathVotes(rows)
      expect(result).to.have.length(1)
      expect(result[0].voterAddress).to.equal('0xabc123')
      expect(result[0].optionId).to.equal('option-b')
      expect(result[0].storedAmount).to.equal(500)
    })

    it('parses a vote row with object vote (already parsed)', () => {
      const rows = [{ address: '0xABC', vote: { 'option-a': 100 } }]
      const result = parsePathVotes(rows)
      expect(result).to.have.length(1)
      expect(result[0].optionId).to.equal('option-a')
      expect(result[0].storedAmount).to.equal(100)
    })

    it('skips invalid option ids', () => {
      const rows = [
        { address: '0x111', vote: JSON.stringify({ 'not-an-option': 50 }) },
        { address: '0x222', vote: JSON.stringify({ 'option-c': 10 }) },
      ]
      const result = parsePathVotes(rows)
      expect(result).to.have.length(1)
      expect(result[0].optionId).to.equal('option-c')
    })

    it('skips rows with invalid JSON', () => {
      const rows = [
        { address: '0x111', vote: '{bad json' },
        { address: '0x222', vote: JSON.stringify({ abstain: 25 }) },
      ]
      const result = parsePathVotes(rows)
      expect(result).to.have.length(1)
      expect(result[0].voterAddress).to.equal('0x222')
    })

    it('uses only the first entry when vote has multiple keys', () => {
      const rows = [
        {
          address: '0x111',
          vote: JSON.stringify({ 'option-a': 50, 'option-b': 30 }),
        },
      ]
      const result = parsePathVotes(rows)
      expect(result).to.have.length(1)
      expect(result[0].optionId).to.equal('option-a')
    })

    it('lowercases voter addresses', () => {
      const rows = [
        {
          address: '0xABCDEF1234567890ABCDEF1234567890ABCDEF12',
          vote: JSON.stringify({ 'option-b': 100 }),
        },
      ]
      const result = parsePathVotes(rows)
      expect(result[0].voterAddress).to.equal(
        '0xabcdef1234567890abcdef1234567890abcdef12'
      )
    })
  })

  // ---------------------------------------------------------------------------
  // aggregatePathVotes
  // ---------------------------------------------------------------------------
  describe('aggregatePathVotes', () => {
    it('uses current balance as effective voting weight', () => {
      const votes: ParsedPathVote[] = [
        {
          voterAddress: '0xv1',
          optionId: 'option-b',
          storedAmount: 100,
        },
      ]
      const balanceMap = { '0xv1': 200 }
      const { totals, voters, totalVoted, totalVoters } = aggregatePathVotes(
        votes,
        balanceMap
      )
      expect(totals['option-b'].totalVoted).to.equal(200)
      expect(totals['option-b'].voterCount).to.equal(1)
      expect(totalVoted).to.equal(200)
      expect(totalVoters).to.equal(1)
      expect(voters[0].votingPower).to.equal(200)
      expect(voters[0].optionId).to.equal('option-b')
    })

    it('reflects current balance even when below stored amount (anti-gaming)', () => {
      const votes: ParsedPathVote[] = [
        {
          voterAddress: '0xv1',
          optionId: 'option-a',
          storedAmount: 1000,
        },
      ]
      const { totals } = aggregatePathVotes(votes, { '0xv1': 300 })
      expect(totals['option-a'].totalVoted).to.equal(300)
    })

    it('excludes voters with zero balance', () => {
      const votes: ParsedPathVote[] = [
        {
          voterAddress: '0xv1',
          optionId: 'option-c',
          storedAmount: 100,
        },
      ]
      const { totals, voters, totalVoters } = aggregatePathVotes(votes, {
        '0xv1': 0,
      })
      expect(totals['option-c'].totalVoted).to.equal(0)
      expect(voters).to.have.length(0)
      expect(totalVoters).to.equal(0)
    })

    it('falls back to stored amount when balance is non-finite (RPC sentinel)', () => {
      const votes: ParsedPathVote[] = [
        {
          voterAddress: '0xv1',
          optionId: 'option-b',
          storedAmount: 150,
        },
      ]
      const { totals } = aggregatePathVotes(votes, { '0xv1': Infinity })
      expect(totals['option-b'].totalVoted).to.equal(150)
    })

    it('aggregates multiple voters across options', () => {
      const votes: ParsedPathVote[] = [
        { voterAddress: '0xv1', optionId: 'option-b', storedAmount: 100 },
        { voterAddress: '0xv2', optionId: 'option-b', storedAmount: 200 },
        { voterAddress: '0xv3', optionId: 'option-a', storedAmount: 50 },
        { voterAddress: '0xv4', optionId: 'abstain', storedAmount: 25 },
      ]
      const balanceMap = {
        '0xv1': 500,
        '0xv2': 300,
        '0xv3': 100,
        '0xv4': 50,
      }
      const { totals, totalVoted, totalVoters } = aggregatePathVotes(
        votes,
        balanceMap
      )
      expect(totals['option-b'].totalVoted).to.equal(800)
      expect(totals['option-b'].voterCount).to.equal(2)
      expect(totals['option-a'].totalVoted).to.equal(100)
      expect(totals['abstain'].totalVoted).to.equal(50)
      expect(totalVoted).to.equal(950)
      expect(totalVoters).to.equal(4)
    })

    it('sorts voters by voting power descending', () => {
      const votes: ParsedPathVote[] = [
        { voterAddress: '0xv1', optionId: 'option-b', storedAmount: 10 },
        { voterAddress: '0xv2', optionId: 'option-a', storedAmount: 10 },
      ]
      const { voters } = aggregatePathVotes(votes, {
        '0xv1': 100,
        '0xv2': 500,
      })
      expect(voters[0].address).to.equal('0xv2')
      expect(voters[1].address).to.equal('0xv1')
    })
  })

  // ---------------------------------------------------------------------------
  // computePathVoteWinner
  // ---------------------------------------------------------------------------
  describe('computePathVoteWinner', () => {
    it('picks the non-abstain option with the most voting power', () => {
      const winner = computePathVoteWinner([
        { optionId: 'option-a', totalVoted: 100 },
        { optionId: 'option-b', totalVoted: 500 },
        { optionId: 'option-c', totalVoted: 50 },
        { optionId: 'abstain', totalVoted: 1000 },
      ])
      expect(winner).to.equal('option-b')
    })

    it('returns null when substantive options are tied', () => {
      const winner = computePathVoteWinner([
        { optionId: 'option-a', totalVoted: 100 },
        { optionId: 'option-b', totalVoted: 100 },
        { optionId: 'option-c', totalVoted: 50 },
      ])
      expect(winner).to.be.null
    })

    it('returns null when all substantive options have zero weight', () => {
      const winner = computePathVoteWinner([
        { optionId: 'option-a', totalVoted: 0 },
        { optionId: 'option-b', totalVoted: 0 },
        { optionId: 'abstain', totalVoted: 100 },
      ])
      expect(winner).to.be.null
    })
  })

  // ---------------------------------------------------------------------------
  // buildPathVoteResults
  // ---------------------------------------------------------------------------
  describe('buildPathVoteResults', () => {
    it('computes percentages and winning option', () => {
      const totals = {
        'option-a': { totalVoted: 100, voterCount: 1 },
        'option-b': { totalVoted: 300, voterCount: 2 },
        'option-c': { totalVoted: 0, voterCount: 0 },
        abstain: { totalVoted: 100, voterCount: 1 },
      }
      const voters = [
        { address: '0xv1', votingPower: 200, optionId: 'option-b' as const },
        { address: '0xv2', votingPower: 100, optionId: 'option-b' as const },
      ]
      const result = buildPathVoteResults(totals, voters, 500, 4)
      expect(result.totalVoted).to.equal(500)
      expect(result.totalVoters).to.equal(4)
      expect(result.winningOptionId).to.equal('option-b')
      const optionB = result.results.find((r) => r.optionId === 'option-b')!
      expect(optionB.percentage).to.equal(60)
    })
  })

  // ---------------------------------------------------------------------------
  // full pipeline: parse → aggregate → build
  // ---------------------------------------------------------------------------
  describe('full pipeline: parse → aggregate → build', () => {
    it('processes raw rows into final results', () => {
      const rows = [
        { address: '0xv1', vote: JSON.stringify({ 'option-b': 1000 }) },
        { address: '0xv2', vote: JSON.stringify({ 'option-b': 500 }) },
        { address: '0xv3', vote: JSON.stringify({ 'option-a': 800 }) },
        { address: '0xv4', vote: JSON.stringify({ abstain: 200 }) },
      ]
      const balanceMap: Record<string, number> = {
        '0xv1': 1000,
        '0xv2': 300,
        '0xv3': 100,
        '0xv4': 50,
      }

      const votes = parsePathVotes(rows)
      const { totals, voters, totalVoted, totalVoters } = aggregatePathVotes(
        votes,
        balanceMap
      )
      const results = buildPathVoteResults(
        totals,
        voters,
        totalVoted,
        totalVoters
      )

      expect(results.winningOptionId).to.equal('option-b')
      expect(results.totalVoted).to.equal(1450)
      expect(results.totalVoters).to.equal(4)

      const optionB = results.results.find((r) => r.optionId === 'option-b')!
      expect(optionB.totalVoted).to.equal(1300)
      expect(optionB.voterCount).to.equal(2)
    })
  })

  // ---------------------------------------------------------------------------
  // formatVoteClosedMessage (SSR-safe closed banner)
  // ---------------------------------------------------------------------------
  describe('formatVoteClosedMessage', () => {
    it('uses deadline when set', () => {
      const msg = formatVoteClosedMessage(new Date('2026-06-15T12:00:00Z'), null)
      expect(msg).to.include('Voting closed on')
      expect(msg).to.include('Results below are final')
      expect(msg).to.include('June')
    })

    it('uses snapshot date when deadline is null (flag-only close)', () => {
      const msg = formatVoteClosedMessage(
        null,
        '2026-06-22T22:21:15.420Z'
      )
      expect(msg).to.include('Voting closed on')
      expect(msg).to.include('June')
      expect(msg).to.not.include('null')
    })

    it('falls back to generic copy when neither deadline nor snapshot date is set', () => {
      const msg = formatVoteClosedMessage(null, null)
      expect(msg).to.equal(
        'Voting is now closed. Results below are final.'
      )
    })

    it('prefers deadline over snapshot date when both are set', () => {
      const deadline = new Date('2026-06-10T12:00:00Z')
      const msg = formatVoteClosedMessage(
        deadline,
        '2026-06-22T22:21:15.420Z'
      )
      expect(msg).to.include('June 10')
      expect(msg).to.not.include('June 22')
    })
  })

  // ---------------------------------------------------------------------------
  // committed snapshot (closed page data)
  // ---------------------------------------------------------------------------
  describe('committed snapshot', () => {
    it('hasPathVoteSnapshot returns true for the committed close snapshot', () => {
      expect(hasPathVoteSnapshot()).to.be.true
    })

    it('snapshot declares Option B as the winner', () => {
      const snap = getPathVoteSnapshot()
      expect(snap.winningOptionId).to.equal('option-b')
      expect(snap.totalVoters).to.be.greaterThan(0)
      expect(snap.generatedAt).to.be.a('string')
    })

    it('snapshot option totals sum to totalVoted', () => {
      const snap = getPathVoteSnapshot()
      const sum = snap.results.reduce((s, r) => s + r.totalVoted, 0)
      expect(Math.round(sum * 100) / 100).to.be.closeTo(snap.totalVoted, 0.02)
    })

    it('every voter in the snapshot has a valid option and positive power', () => {
      const snap = getPathVoteSnapshot()
      for (const voter of snap.voters) {
        expect(voter.votingPower).to.be.greaterThan(0)
        expect(['option-a', 'option-b', 'option-c', 'abstain']).to.include(
          voter.optionId
        )
      }
    })
  })
})
