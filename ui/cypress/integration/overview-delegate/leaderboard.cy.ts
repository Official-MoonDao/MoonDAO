import {
  parseDelegations,
  aggregateDelegations,
  buildLeaderboard,
  applyOptimisticUpdate,
  sanitizeSearchQuery,
  isValidEthAddress,
  resolveVoteCitizenInfo,
  formatLeaderboardStandings,
} from '@/lib/overview-delegate/leaderboard'
import type {
  ParsedDelegation,
  AggregatedEntry,
  LeaderboardEntry,
} from '@/lib/overview-delegate/leaderboard'

describe('Overview Delegate – Leaderboard Logic', () => {
  // ---------------------------------------------------------------------------
  // parseDelegations
  // ---------------------------------------------------------------------------
  describe('parseDelegations', () => {
    it('parses a single delegation row with string vote', () => {
      const rows = [
        {
          address: '0xABC123',
          vote: JSON.stringify({ '0xdelegatee1': 500 }),
        },
      ]
      const result = parseDelegations(rows)
      expect(result).to.have.length(1)
      expect(result[0].delegatorAddress).to.equal('0xabc123')
      expect(result[0].delegateeAddress).to.equal('0xdelegatee1')
      expect(result[0].storedAmount).to.equal(500)
    })

    it('parses a delegation row with object vote (already parsed)', () => {
      const rows = [
        { address: '0xABC', vote: { '0xDEF': 100 } },
      ]
      const result = parseDelegations(rows)
      expect(result).to.have.length(1)
      expect(result[0].delegateeAddress).to.equal('0xdef')
      expect(result[0].storedAmount).to.equal(100)
    })

    it('uses only the first entry when vote has multiple keys', () => {
      const rows = [
        {
          address: '0x111',
          vote: JSON.stringify({ '0xaaa': 50, '0xbbb': 30 }),
        },
      ]
      const result = parseDelegations(rows)
      expect(result).to.have.length(1)
      expect(result[0].storedAmount).to.equal(50)
    })

    it('skips rows with invalid JSON', () => {
      const rows = [
        { address: '0x111', vote: '{bad json' },
        { address: '0x222', vote: JSON.stringify({ '0xaaa': 10 }) },
      ]
      const result = parseDelegations(rows)
      expect(result).to.have.length(1)
      expect(result[0].delegatorAddress).to.equal('0x222')
    })

    it('skips rows with empty vote objects', () => {
      const rows = [
        { address: '0x111', vote: JSON.stringify({}) },
        { address: '0x222', vote: JSON.stringify({ '0xaaa': 10 }) },
      ]
      const result = parseDelegations(rows)
      expect(result).to.have.length(1)
    })

    it('handles zero amount', () => {
      const rows = [
        { address: '0x111', vote: JSON.stringify({ '0xaaa': 0 }) },
      ]
      const result = parseDelegations(rows)
      expect(result).to.have.length(1)
      expect(result[0].storedAmount).to.equal(0)
    })

    it('handles non-numeric amounts gracefully', () => {
      const rows = [
        { address: '0x111', vote: JSON.stringify({ '0xaaa': 'abc' }) },
      ]
      const result = parseDelegations(rows)
      expect(result).to.have.length(1)
      expect(result[0].storedAmount).to.equal(0)
    })

    it('lowercases all addresses', () => {
      const rows = [
        {
          address: '0xABCDEF1234567890ABCDEF1234567890ABCDEF12',
          vote: JSON.stringify({
            '0x1234ABCD5678EF901234ABCD5678EF901234ABCD': 100,
          }),
        },
      ]
      const result = parseDelegations(rows)
      expect(result[0].delegatorAddress).to.equal(
        '0xabcdef1234567890abcdef1234567890abcdef12'
      )
      expect(result[0].delegateeAddress).to.equal(
        '0x1234abcd5678ef901234abcd5678ef901234abcd'
      )
    })

    it('returns empty array for empty input', () => {
      expect(parseDelegations([])).to.have.length(0)
    })
  })

  // ---------------------------------------------------------------------------
  // aggregateDelegations
  // ---------------------------------------------------------------------------
  describe('aggregateDelegations', () => {
    it('uses current balance as effective delegation weight', () => {
      const delegations: ParsedDelegation[] = [
        {
          delegatorAddress: '0xd1',
          delegateeAddress: '0xc1',
          storedAmount: 100,
        },
      ]
      const balanceMap = { '0xd1': 200 }
      const result = aggregateDelegations(delegations, balanceMap)
      expect(result).to.have.length(1)
      expect(result[0].totalDelegated).to.equal(200)
      expect(result[0].delegatorCount).to.equal(1)
    })

    it('reflects current balance even when below stored amount (anti-gaming)', () => {
      const delegations: ParsedDelegation[] = [
        {
          delegatorAddress: '0xd1',
          delegateeAddress: '0xc1',
          storedAmount: 1000,
        },
      ]
      const balanceMap = { '0xd1': 300 }
      const result = aggregateDelegations(delegations, balanceMap)
      expect(result[0].totalDelegated).to.equal(300)
    })

    it('reflects increased balance without re-voting', () => {
      const delegations: ParsedDelegation[] = [
        {
          delegatorAddress: '0xd1',
          delegateeAddress: '0xc1',
          storedAmount: 100,
        },
      ]
      const balanceMap = { '0xd1': 5000 }
      const result = aggregateDelegations(delegations, balanceMap)
      expect(result).to.have.length(1)
      expect(result[0].totalDelegated).to.equal(5000)
    })

    it('excludes delegations when delegator balance is 0', () => {
      const delegations: ParsedDelegation[] = [
        {
          delegatorAddress: '0xd1',
          delegateeAddress: '0xc1',
          storedAmount: 100,
        },
      ]
      const balanceMap = { '0xd1': 0 }
      const result = aggregateDelegations(delegations, balanceMap)
      expect(result).to.have.length(0)
    })

    it('excludes delegations when delegator has no balance entry', () => {
      const delegations: ParsedDelegation[] = [
        {
          delegatorAddress: '0xd1',
          delegateeAddress: '0xc1',
          storedAmount: 100,
        },
      ]
      const result = aggregateDelegations(delegations, {})
      expect(result).to.have.length(0)
    })

    it('aggregates multiple delegators to same delegatee', () => {
      const delegations: ParsedDelegation[] = [
        { delegatorAddress: '0xd1', delegateeAddress: '0xc1', storedAmount: 100 },
        { delegatorAddress: '0xd2', delegateeAddress: '0xc1', storedAmount: 200 },
        { delegatorAddress: '0xd3', delegateeAddress: '0xc1', storedAmount: 50 },
      ]
      const balanceMap = { '0xd1': 500, '0xd2': 500, '0xd3': 500 }
      const result = aggregateDelegations(delegations, balanceMap)
      expect(result).to.have.length(1)
      expect(result[0].totalDelegated).to.equal(1500)
      expect(result[0].delegatorCount).to.equal(3)
    })

    it('separates delegations to different delegatees', () => {
      const delegations: ParsedDelegation[] = [
        { delegatorAddress: '0xd1', delegateeAddress: '0xc1', storedAmount: 100 },
        { delegatorAddress: '0xd2', delegateeAddress: '0xc2', storedAmount: 200 },
      ]
      const balanceMap = { '0xd1': 500, '0xd2': 500 }
      const result = aggregateDelegations(delegations, balanceMap)
      expect(result).to.have.length(2)
    })

    it('uses each delegator current balance regardless of stored amount', () => {
      const delegations: ParsedDelegation[] = [
        { delegatorAddress: '0xd1', delegateeAddress: '0xc1', storedAmount: 1000 },
        { delegatorAddress: '0xd2', delegateeAddress: '0xc1', storedAmount: 500 },
      ]
      const balanceMap = { '0xd1': 200, '0xd2': 1000 }
      const result = aggregateDelegations(delegations, balanceMap)
      expect(result[0].totalDelegated).to.equal(1200)
      expect(result[0].delegatorCount).to.equal(2)
    })

    it('rounds totalDelegated to 2 decimal places', () => {
      const delegations: ParsedDelegation[] = [
        { delegatorAddress: '0xd1', delegateeAddress: '0xc1', storedAmount: 100 },
        { delegatorAddress: '0xd2', delegateeAddress: '0xc1', storedAmount: 200 },
      ]
      const balanceMap = { '0xd1': 33.333, '0xd2': 66.667 }
      const result = aggregateDelegations(delegations, balanceMap)
      expect(result[0].totalDelegated).to.equal(100)
    })
  })

  // ---------------------------------------------------------------------------
  // buildLeaderboard
  // ---------------------------------------------------------------------------
  describe('buildLeaderboard', () => {
    it('enriches aggregated entries with citizen data', () => {
      const aggregated: AggregatedEntry[] = [
        { delegateeAddress: '0xc1', totalDelegated: 500, delegatorCount: 3 },
      ]
      const citizenMap = {
        '0xc1': { id: 42, name: 'Alice', image: 'ipfs://img' },
      }
      const result = buildLeaderboard(aggregated, citizenMap)
      expect(result).to.have.length(1)
      expect(result[0].citizenId).to.equal(42)
      expect(result[0].citizenName).to.equal('Alice')
      expect(result[0].citizenImage).to.equal('ipfs://img')
      expect(result[0].totalDelegated).to.equal(500)
    })

    it('filters out entries without citizen data', () => {
      const aggregated: AggregatedEntry[] = [
        { delegateeAddress: '0xc1', totalDelegated: 500, delegatorCount: 1 },
        { delegateeAddress: '0xc2', totalDelegated: 300, delegatorCount: 2 },
      ]
      const citizenMap = {
        '0xc1': { id: 1, name: 'Alice' },
      }
      const result = buildLeaderboard(aggregated, citizenMap)
      expect(result).to.have.length(1)
      expect(result[0].delegateeAddress).to.equal('0xc1')
    })

    it('sorts by totalDelegated descending', () => {
      const aggregated: AggregatedEntry[] = [
        { delegateeAddress: '0xc1', totalDelegated: 100, delegatorCount: 1 },
        { delegateeAddress: '0xc2', totalDelegated: 500, delegatorCount: 1 },
        { delegateeAddress: '0xc3', totalDelegated: 300, delegatorCount: 1 },
      ]
      const citizenMap = {
        '0xc1': { id: 1, name: 'A' },
        '0xc2': { id: 2, name: 'B' },
        '0xc3': { id: 3, name: 'C' },
      }
      const result = buildLeaderboard(aggregated, citizenMap)
      expect(result[0].citizenName).to.equal('B')
      expect(result[1].citizenName).to.equal('C')
      expect(result[2].citizenName).to.equal('A')
    })

    it('limits results to the given limit', () => {
      const aggregated: AggregatedEntry[] = Array.from({ length: 30 }, (_, i) => ({
        delegateeAddress: `0x${String(i).padStart(40, '0')}`,
        totalDelegated: 30 - i,
        delegatorCount: 1,
      }))
      const citizenMap = Object.fromEntries(
        aggregated.map((e, i) => [
          e.delegateeAddress,
          { id: i, name: `Citizen ${i}` },
        ])
      )
      const result = buildLeaderboard(aggregated, citizenMap, 10)
      expect(result).to.have.length(10)
      expect(result[0].totalDelegated).to.equal(30)
      expect(result[9].totalDelegated).to.equal(21)
    })

    it('defaults to limit=25', () => {
      const aggregated: AggregatedEntry[] = Array.from({ length: 30 }, (_, i) => ({
        delegateeAddress: `0x${String(i).padStart(40, '0')}`,
        totalDelegated: 30 - i,
        delegatorCount: 1,
      }))
      const citizenMap = Object.fromEntries(
        aggregated.map((e, i) => [
          e.delegateeAddress,
          { id: i, name: `Citizen ${i}` },
        ])
      )
      const result = buildLeaderboard(aggregated, citizenMap)
      expect(result).to.have.length(25)
    })

    it('handles empty citizen name gracefully', () => {
      const aggregated: AggregatedEntry[] = [
        { delegateeAddress: '0xc1', totalDelegated: 100, delegatorCount: 1 },
      ]
      const citizenMap = { '0xc1': { id: 1, name: '' } }
      const result = buildLeaderboard(aggregated, citizenMap)
      expect(result[0].citizenName).to.equal('')
    })
  })

  // ---------------------------------------------------------------------------
  // applyOptimisticUpdate
  // ---------------------------------------------------------------------------
  describe('applyOptimisticUpdate', () => {
    const baseLb: LeaderboardEntry[] = [
      {
        delegateeAddress: '0xalice',
        citizenId: 1,
        citizenName: 'Alice',
        citizenImage: 'ipfs://alice',
        totalDelegated: 500,
        delegatorCount: 3,
      },
      {
        delegateeAddress: '0xbob',
        citizenId: 2,
        citizenName: 'Bob',
        citizenImage: 'ipfs://bob',
        totalDelegated: 300,
        delegatorCount: 2,
      },
    ]

    it('adds a new delegation to an existing citizen on the leaderboard', () => {
      const result = applyOptimisticUpdate(
        baseLb,
        {
          delegateeAddress: '0xalice',
          citizenId: 1,
          citizenName: 'Alice',
          citizenImage: 'ipfs://alice',
          amount: 100,
        },
        null,
        false
      )
      const alice = result.find((e) => e.delegateeAddress === '0xalice')!
      expect(alice.totalDelegated).to.equal(600)
      expect(alice.delegatorCount).to.equal(4)
    })

    it('adds a new citizen to the leaderboard', () => {
      const result = applyOptimisticUpdate(
        baseLb,
        {
          delegateeAddress: '0xcharlie',
          citizenId: 3,
          citizenName: 'Charlie',
          citizenImage: 'ipfs://charlie',
          amount: 700,
        },
        null,
        false
      )
      expect(result).to.have.length(3)
      expect(result[0].citizenName).to.equal('Charlie')
      expect(result[0].totalDelegated).to.equal(700)
    })

    it('redelegation: subtracts from old delegatee and adds to new', () => {
      const result = applyOptimisticUpdate(
        baseLb,
        {
          delegateeAddress: '0xbob',
          citizenId: 2,
          citizenName: 'Bob',
          citizenImage: 'ipfs://bob',
          amount: 200,
        },
        { delegatee: '0xalice', amount: 200 },
        true
      )
      const alice = result.find((e) => e.delegateeAddress === '0xalice')!
      const bob = result.find((e) => e.delegateeAddress === '0xbob')!
      expect(alice.totalDelegated).to.equal(300)
      expect(alice.delegatorCount).to.equal(2)
      expect(bob.totalDelegated).to.equal(500)
      expect(bob.delegatorCount).to.equal(3)
    })

    it('redelegation removes old delegatee if total drops to 0', () => {
      const lb: LeaderboardEntry[] = [
        {
          delegateeAddress: '0xone',
          citizenId: 10,
          citizenName: 'One',
          totalDelegated: 100,
          delegatorCount: 1,
        },
        {
          delegateeAddress: '0xtwo',
          citizenId: 20,
          citizenName: 'Two',
          totalDelegated: 200,
          delegatorCount: 2,
        },
      ]
      const result = applyOptimisticUpdate(
        lb,
        {
          delegateeAddress: '0xtwo',
          citizenId: 20,
          citizenName: 'Two',
          amount: 100,
        },
        { delegatee: '0xone', amount: 100 },
        true
      )
      expect(result.find((e) => e.delegateeAddress === '0xone')).to.be
        .undefined
      const two = result.find((e) => e.delegateeAddress === '0xtwo')!
      expect(two.totalDelegated).to.equal(300)
    })

    it('redelegation to the same citizen updates amount but not delegatorCount', () => {
      const result = applyOptimisticUpdate(
        baseLb,
        {
          delegateeAddress: '0xalice',
          citizenId: 1,
          citizenName: 'Alice',
          citizenImage: 'ipfs://alice',
          amount: 150,
        },
        { delegatee: '0xalice', amount: 100 },
        true
      )
      const alice = result.find((e) => e.delegateeAddress === '0xalice')!
      expect(alice.totalDelegated).to.equal(550)
      expect(alice.delegatorCount).to.equal(3)
    })

    it('result is sorted descending by totalDelegated', () => {
      const result = applyOptimisticUpdate(
        baseLb,
        {
          delegateeAddress: '0xbob',
          citizenId: 2,
          citizenName: 'Bob',
          amount: 1000,
        },
        null,
        false
      )
      expect(result[0].citizenName).to.equal('Bob')
      expect(result[1].citizenName).to.equal('Alice')
    })

    it('limits result to 25 entries', () => {
      const bigLb: LeaderboardEntry[] = Array.from({ length: 25 }, (_, i) => ({
        delegateeAddress: `0x${String(i).padStart(40, '0')}`,
        citizenId: i,
        citizenName: `Citizen ${i}`,
        totalDelegated: 100 - i,
        delegatorCount: 1,
      }))
      const result = applyOptimisticUpdate(
        bigLb,
        {
          delegateeAddress: '0xnew',
          citizenId: 99,
          citizenName: 'New',
          amount: 1,
        },
        null,
        false
      )
      expect(result).to.have.length(25)
    })

    it('does not mutate the input array', () => {
      const original = [...baseLb]
      applyOptimisticUpdate(
        baseLb,
        {
          delegateeAddress: '0xalice',
          citizenId: 1,
          citizenName: 'Alice',
          amount: 999,
        },
        null,
        false
      )
      expect(baseLb).to.deep.equal(original)
    })
  })

  // ---------------------------------------------------------------------------
  // sanitizeSearchQuery
  // ---------------------------------------------------------------------------
  describe('sanitizeSearchQuery', () => {
    it('trims whitespace', () => {
      expect(sanitizeSearchQuery('  hello  ')).to.equal('hello')
    })

    it('escapes single quotes for SQL safety', () => {
      expect(sanitizeSearchQuery("O'Brien")).to.equal("O''Brien")
    })

    it('strips LIKE wildcards (%)', () => {
      expect(sanitizeSearchQuery('100%')).to.equal('100')
    })

    it('strips LIKE wildcards (_)', () => {
      expect(sanitizeSearchQuery('test_name')).to.equal('testname')
    })

    it('handles combined dangerous chars', () => {
      expect(sanitizeSearchQuery(" O'%_test ")).to.equal("O''test")
    })

    it('returns empty string for whitespace-only input', () => {
      expect(sanitizeSearchQuery('   ')).to.equal('')
    })
  })

  // ---------------------------------------------------------------------------
  // isValidEthAddress
  // ---------------------------------------------------------------------------
  describe('isValidEthAddress', () => {
    it('accepts a valid 42-char hex address', () => {
      expect(isValidEthAddress('0xABCDEF1234567890ABCDEF1234567890ABCDEF12')).to
        .be.true
    })

    it('accepts lowercase address', () => {
      expect(isValidEthAddress('0xabcdef1234567890abcdef1234567890abcdef12')).to
        .be.true
    })

    it('rejects address without 0x prefix', () => {
      expect(isValidEthAddress('ABCDEF1234567890ABCDEF1234567890ABCDEF12')).to.be
        .false
    })

    it('rejects address that is too short', () => {
      expect(isValidEthAddress('0xABCD')).to.be.false
    })

    it('rejects address with non-hex characters', () => {
      expect(isValidEthAddress('0xZZZZZZ1234567890ABCDEF1234567890ABCDEF12')).to
        .be.false
    })

    it('rejects empty string', () => {
      expect(isValidEthAddress('')).to.be.false
    })
  })

  // ---------------------------------------------------------------------------
  // End-to-end: parse → aggregate → build pipeline
  // ---------------------------------------------------------------------------
  describe('full pipeline: parse → aggregate → build', () => {
    it('processes raw rows into a sorted, capped leaderboard', () => {
      const rows = [
        { address: '0xd1', vote: JSON.stringify({ '0xc1': 1000 }) },
        { address: '0xd2', vote: JSON.stringify({ '0xc1': 500 }) },
        { address: '0xd3', vote: JSON.stringify({ '0xc2': 800 }) },
        { address: '0xd4', vote: JSON.stringify({ '0xc3': 200 }) },
      ]
      const balanceMap: Record<string, number> = {
        '0xd1': 1000,
        '0xd2': 300,
        '0xd3': 100,
        '0xd4': 50,
      }
      const citizenMap = {
        '0xc1': { id: 1, name: 'Alice', image: 'ipfs://a' },
        '0xc2': { id: 2, name: 'Bob', image: 'ipfs://b' },
        '0xc3': { id: 3, name: 'Charlie' },
      }

      const delegations = parseDelegations(rows)
      const aggregated = aggregateDelegations(delegations, balanceMap)
      const leaderboard = buildLeaderboard(aggregated, citizenMap)

      expect(leaderboard).to.have.length(3)

      // Alice: d1 balance=1000, d2 balance=300 → 1300
      expect(leaderboard[0].citizenName).to.equal('Alice')
      expect(leaderboard[0].totalDelegated).to.equal(1300)
      expect(leaderboard[0].delegatorCount).to.equal(2)

      // Bob: d3 balance=100
      expect(leaderboard[1].citizenName).to.equal('Bob')
      expect(leaderboard[1].totalDelegated).to.equal(100)

      // Charlie: d4 balance=50
      expect(leaderboard[2].citizenName).to.equal('Charlie')
      expect(leaderboard[2].totalDelegated).to.equal(50)
    })

    it('filters out delegatees with no citizen record', () => {
      const rows = [
        { address: '0xd1', vote: JSON.stringify({ '0xc1': 100 }) },
        { address: '0xd2', vote: JSON.stringify({ '0xunknown': 200 }) },
      ]
      const balanceMap = { '0xd1': 999, '0xd2': 999 }
      const citizenMap = { '0xc1': { id: 1, name: 'Known' } }

      const delegations = parseDelegations(rows)
      const aggregated = aggregateDelegations(delegations, balanceMap)
      const leaderboard = buildLeaderboard(aggregated, citizenMap)

      expect(leaderboard).to.have.length(1)
      expect(leaderboard[0].citizenName).to.equal('Known')
    })

    it('anti-gaming: token recycler gets effective=0 after selling tokens', () => {
      const rows = [
        { address: '0xgamer', vote: JSON.stringify({ '0xc1': 10000 }) },
      ]
      const balanceMap = { '0xgamer': 0 }
      const citizenMap = { '0xc1': { id: 1, name: 'Alice' } }

      const delegations = parseDelegations(rows)
      const aggregated = aggregateDelegations(delegations, balanceMap)
      const leaderboard = buildLeaderboard(aggregated, citizenMap)

      expect(leaderboard).to.have.length(0)
    })
  })

  // ---------------------------------------------------------------------------
  // resolveVoteCitizenInfo
  // ---------------------------------------------------------------------------
  describe('resolveVoteCitizenInfo', () => {
    const leaderboard: LeaderboardEntry[] = [
      {
        delegateeAddress: '0xalice',
        citizenId: 1,
        citizenName: 'Alice',
        citizenImage: 'ipfs://alice',
        totalDelegated: 500,
        delegatorCount: 3,
      },
      {
        delegateeAddress: '0xbob',
        citizenId: 2,
        citizenName: 'Bob',
        totalDelegated: 300,
        delegatorCount: 2,
      },
    ]

    it('returns citizen info when delegatee is on leaderboard', () => {
      const result = resolveVoteCitizenInfo('0xalice', leaderboard)
      expect(result).to.not.be.null
      expect(result!.citizenName).to.equal('Alice')
      expect(result!.citizenImage).to.equal('ipfs://alice')
      expect(result!.citizenId).to.equal(1)
    })

    it('matches case-insensitively', () => {
      const result = resolveVoteCitizenInfo('0xALICE', leaderboard)
      expect(result).to.not.be.null
      expect(result!.citizenName).to.equal('Alice')
    })

    it('returns null when delegatee is not on leaderboard', () => {
      const result = resolveVoteCitizenInfo('0xunknown', leaderboard)
      expect(result).to.be.null
    })

    it('returns null for empty leaderboard', () => {
      const result = resolveVoteCitizenInfo('0xalice', [])
      expect(result).to.be.null
    })

    it('handles entry without citizenImage', () => {
      const result = resolveVoteCitizenInfo('0xbob', leaderboard)
      expect(result).to.not.be.null
      expect(result!.citizenName).to.equal('Bob')
      expect(result!.citizenImage).to.be.undefined
    })

    it('matches mixed-case leaderboard address against lowercase input', () => {
      const lb: LeaderboardEntry[] = [
        {
          delegateeAddress: '0xAbCdEf',
          citizenId: 99,
          citizenName: 'Mixed',
          totalDelegated: 100,
          delegatorCount: 1,
        },
      ]
      const result = resolveVoteCitizenInfo('0xabcdef', lb)
      expect(result).to.not.be.null
      expect(result!.citizenId).to.equal(99)
    })
  })

  // ---------------------------------------------------------------------------
  // formatLeaderboardStandings
  // ---------------------------------------------------------------------------
  describe('formatLeaderboardStandings', () => {
    const stubFormatLink = (name: string, id: string | number) =>
      `${name.toLowerCase().replace(/\s+/g, '-')}-${id}`

    const sampleLeaderboard: LeaderboardEntry[] = [
      {
        delegateeAddress: '0xc1',
        citizenId: 1,
        citizenName: 'Alice',
        citizenImage: 'ipfs://a',
        totalDelegated: 1500,
        delegatorCount: 5,
      },
      {
        delegateeAddress: '0xc2',
        citizenId: 2,
        citizenName: 'Bob',
        citizenImage: 'ipfs://b',
        totalDelegated: 1000,
        delegatorCount: 3,
      },
      {
        delegateeAddress: '0xc3',
        citizenId: 3,
        citizenName: 'Charlie',
        totalDelegated: 800,
        delegatorCount: 1,
      },
      {
        delegateeAddress: '0xc4',
        citizenId: 4,
        citizenName: 'Diana',
        totalDelegated: 500,
        delegatorCount: 2,
      },
    ]

    it('formats top entries with medal emojis for top 3', () => {
      const result = formatLeaderboardStandings(
        sampleLeaderboard,
        'https://app.example.com',
        stubFormatLink
      )
      const lines = result.split('\n')
      expect(lines[0]).to.include('🥇')
      expect(lines[1]).to.include('🥈')
      expect(lines[2]).to.include('🥉')
    })

    it('uses numeric rank for entries beyond top 3', () => {
      const result = formatLeaderboardStandings(
        sampleLeaderboard,
        'https://app.example.com',
        stubFormatLink
      )
      const lines = result.split('\n')
      expect(lines[3]).to.match(/^4\./)
    })

    it('includes citizen name as a link with correct origin', () => {
      const result = formatLeaderboardStandings(
        sampleLeaderboard,
        'https://moondao.com',
        stubFormatLink
      )
      expect(result).to.include('[Alice](https://moondao.com/citizen/alice-1)')
    })

    it('includes total delegated and backer count', () => {
      const result = formatLeaderboardStandings(
        sampleLeaderboard,
        'https://app.example.com',
        stubFormatLink
      )
      expect(result).to.include('$OVERVIEW')
      expect(result).to.include('5 backers')
    })

    it('uses singular "backer" for count of 1', () => {
      const result = formatLeaderboardStandings(
        sampleLeaderboard,
        'https://app.example.com',
        stubFormatLink
      )
      expect(result).to.include('1 backer)')
    })

    it('respects the limit parameter', () => {
      const result = formatLeaderboardStandings(
        sampleLeaderboard,
        'https://app.example.com',
        stubFormatLink,
        2
      )
      const lines = result.split('\n')
      expect(lines).to.have.length(2)
    })

    it('defaults to 10 entries', () => {
      const bigLb: LeaderboardEntry[] = Array.from(
        { length: 15 },
        (_, i) => ({
          delegateeAddress: `0x${i}`,
          citizenId: i,
          citizenName: `Citizen ${i}`,
          totalDelegated: 100 - i,
          delegatorCount: 1,
        })
      )
      const result = formatLeaderboardStandings(
        bigLb,
        'https://app.example.com',
        stubFormatLink
      )
      const lines = result.split('\n')
      expect(lines).to.have.length(10)
    })

    it('handles empty leaderboard', () => {
      const result = formatLeaderboardStandings(
        [],
        'https://app.example.com',
        stubFormatLink
      )
      expect(result).to.equal('')
    })

    it('falls back to Citizen #id when citizenName is empty', () => {
      const lb: LeaderboardEntry[] = [
        {
          delegateeAddress: '0xc1',
          citizenId: 42,
          citizenName: '',
          totalDelegated: 100,
          delegatorCount: 1,
        },
      ]
      const result = formatLeaderboardStandings(
        lb,
        'https://app.example.com',
        stubFormatLink
      )
      expect(result).to.include('Citizen #42')
      expect(result).to.not.include('[Citizen #42]')
    })
  })

  // ---------------------------------------------------------------------------
  // applyOptimisticUpdate – citizen info preservation
  // ---------------------------------------------------------------------------
  describe('applyOptimisticUpdate – citizen info fields', () => {
    const baseLb: LeaderboardEntry[] = [
      {
        delegateeAddress: '0xalice',
        citizenId: 1,
        citizenName: 'Alice',
        citizenImage: 'ipfs://alice',
        totalDelegated: 500,
        delegatorCount: 3,
      },
    ]

    it('preserves existing citizen image when updating an existing entry', () => {
      const result = applyOptimisticUpdate(
        baseLb,
        {
          delegateeAddress: '0xalice',
          citizenId: 1,
          citizenName: 'Alice',
          citizenImage: 'ipfs://alice',
          amount: 200,
        },
        null,
        false
      )
      const alice = result.find((e) => e.delegateeAddress === '0xalice')!
      expect(alice.citizenImage).to.equal('ipfs://alice')
      expect(alice.citizenName).to.equal('Alice')
      expect(alice.citizenId).to.equal(1)
    })

    it('stores citizen info when adding a brand-new entry', () => {
      const result = applyOptimisticUpdate(
        baseLb,
        {
          delegateeAddress: '0xnew',
          citizenId: 99,
          citizenName: 'NewCitizen',
          citizenImage: 'ipfs://new',
          amount: 100,
        },
        null,
        false
      )
      const newEntry = result.find((e) => e.delegateeAddress === '0xnew')!
      expect(newEntry.citizenName).to.equal('NewCitizen')
      expect(newEntry.citizenImage).to.equal('ipfs://new')
      expect(newEntry.citizenId).to.equal(99)
    })

    it('preserves citizen info on redelegation to same candidate', () => {
      const result = applyOptimisticUpdate(
        baseLb,
        {
          delegateeAddress: '0xalice',
          citizenId: 1,
          citizenName: 'Alice',
          citizenImage: 'ipfs://alice',
          amount: 300,
        },
        { delegatee: '0xalice', amount: 200 },
        true
      )
      const alice = result.find((e) => e.delegateeAddress === '0xalice')!
      expect(alice.citizenImage).to.equal('ipfs://alice')
      expect(alice.citizenName).to.equal('Alice')
      expect(alice.totalDelegated).to.equal(600)
    })

    it('preserves citizen info on both entries during cross-candidate redelegation', () => {
      const lb: LeaderboardEntry[] = [
        {
          delegateeAddress: '0xalice',
          citizenId: 1,
          citizenName: 'Alice',
          citizenImage: 'ipfs://alice',
          totalDelegated: 500,
          delegatorCount: 2,
        },
        {
          delegateeAddress: '0xbob',
          citizenId: 2,
          citizenName: 'Bob',
          citizenImage: 'ipfs://bob',
          totalDelegated: 300,
          delegatorCount: 1,
        },
      ]
      const result = applyOptimisticUpdate(
        lb,
        {
          delegateeAddress: '0xbob',
          citizenId: 2,
          citizenName: 'Bob',
          citizenImage: 'ipfs://bob',
          amount: 200,
        },
        { delegatee: '0xalice', amount: 200 },
        true
      )
      const alice = result.find((e) => e.delegateeAddress === '0xalice')!
      const bob = result.find((e) => e.delegateeAddress === '0xbob')!
      expect(alice.citizenImage).to.equal('ipfs://alice')
      expect(alice.citizenName).to.equal('Alice')
      expect(bob.citizenImage).to.equal('ipfs://bob')
      expect(bob.citizenName).to.equal('Bob')
    })

    it('handles new entry without citizenImage', () => {
      const result = applyOptimisticUpdate(
        baseLb,
        {
          delegateeAddress: '0xnoimage',
          citizenId: 50,
          citizenName: 'NoImage',
          amount: 100,
        },
        null,
        false
      )
      const entry = result.find((e) => e.delegateeAddress === '0xnoimage')!
      expect(entry.citizenName).to.equal('NoImage')
      expect(entry.citizenImage).to.be.undefined
    })
  })
})
