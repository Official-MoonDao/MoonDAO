/**
 * Unit tests for proposal author voting restriction (member vote):
 * - Strip author's allocation to their own project
 * - Run iterative normalization (fill with column average, rows sum to 100%)
 * - Run quadratic voting on normalized distributions
 *
 * Run: npx ts-node -r tsconfig-paths/register scripts/test-voting-author-restriction.ts
 */

import assert from 'assert'
import {
  runIterativeNormalization,
  runQuadraticVoting,
} from '../lib/utils/rewards'

function closeTo(actual: number, expected: number, delta: number): boolean {
  return Math.abs(actual - expected) <= delta
}

console.log('Running proposal author voting restriction unit tests...\n')

// --- Test 1: Iterative normalization when author has no allocation to own project ---
{
  console.log('Test 1: Iterative normalization - author has no key for own project')
  const projects = [
    { id: '1', name: 'Project 1' },
    { id: '2', name: 'Project 2' },
    { id: '3', name: 'Project 3' },
  ]
  const distributionsWithAuthorExcluded = [
    { address: '0xauthor', year: 2025, quarter: 1, distribution: { '2': 50, '3': 50 } },
    { address: '0xvoterb', year: 2025, quarter: 1, distribution: { '1': 33, '2': 33, '3': 34 } },
    { address: '0xvoterc', year: 2025, quarter: 1, distribution: { '1': 30, '2': 40, '3': 30 } },
  ]
  const [normalizedDistributions, votesMatrix] = runIterativeNormalization(
    distributionsWithAuthorExcluded,
    projects
  )
  votesMatrix.forEach((row, i) => {
    const sum = row.reduce((s, v) => s + v, 0)
    assert(closeTo(sum, 100, 0.01), `Row ${i} should sum to 100, got ${sum}`)
  })
  assert(Number.isFinite(votesMatrix[0][0]), 'Author should have project 1 filled (number)')
  assert(votesMatrix[0][0] > 0 && votesMatrix[0][0] < 50, 'Author project 1 should be column average (~31)')
  normalizedDistributions.forEach((d) => {
    assert.strictEqual(Object.keys(d.distribution).length, 3, 'Each distribution should have 3 projects')
    const sum = (Object.values(d.distribution) as number[]).reduce((s, v) => s + v, 0)
    assert(closeTo(sum, 100, 0.01), `Distribution sum should be 100, got ${sum}`)
  })
  console.log('  ✓ Rows sum to 100, author project 1 filled from column average\n')
}

// --- Test 2: Full pipeline - strip author self-vote then normalize then quadratic ---
{
  console.log('Test 2: Full pipeline - author cannot boost own project')
  const projects = [
    { id: '1', name: 'P1' },
    { id: '2', name: 'P2' },
    { id: '3', name: 'P3' },
  ]
  const projectIdToAuthorAddress: Record<string, string> = { '1': '0xauthor' }
  const votes = [
    { address: '0xauthor', year: 2025, quarter: 1, distribution: { '1': 100, '2': 0, '3': 0 } },
    { address: '0xvoterb', year: 2025, quarter: 1, distribution: { '1': 0, '2': 50, '3': 50 } },
    { address: '0xvoterc', year: 2025, quarter: 1, distribution: { '1': 0, '2': 50, '3': 50 } },
  ]
  const votesWithAuthorOwnExcluded = votes.map((v) => {
    const voterAddr = (v as any).address?.toLowerCase()
    const distribution: Record<string, number> = {}
    for (const [projectId, value] of Object.entries((v as any).distribution)) {
      const author = projectIdToAuthorAddress[projectId]?.toLowerCase()
      if (author && author === voterAddr) continue
      distribution[projectId] = Number(value)
    }
    return { ...v, distribution }
  })
  const [normalizedDistributions] = runIterativeNormalization(votesWithAuthorOwnExcluded, projects)
  const addressToQuadraticVotingPower: Record<string, number> = {
    '0xauthor': 10,
    '0xvoterb': 10,
    '0xvoterc': 10,
  }
  const outcome = runQuadraticVoting(normalizedDistributions, addressToQuadraticVotingPower, 100)
  assert(outcome['1'] >= 0 && outcome['1'] <= 1, `Project 1 should be ~0 (author stripped), got ${outcome['1']}`)
  assert(outcome['2'] > 0, 'Project 2 should be > 0')
  assert(outcome['3'] > 0, 'Project 3 should be > 0')
  const total = outcome['1'] + outcome['2'] + outcome['3']
  assert(closeTo(total, 100, 1), `Outcome should sum to 100, got ${total}`)
  console.log('  ✓ Author self-vote stripped; project 1 outcome ~0; total 100%\n')
}

// --- Test 3: Multiple authors each excluded from own project only ---
{
  console.log('Test 3: Multiple authors - each excluded from own project only')
  const projects = [
    { id: '1', name: 'P1' },
    { id: '2', name: 'P2' },
    { id: '3', name: 'P3' },
  ]
  const projectIdToAuthorAddress: Record<string, string> = {
    '1': '0xauthora',
    '2': '0xauthorb',
  }
  const votes = [
    { address: '0xauthora', year: 2025, quarter: 1, distribution: { '1': 100, '2': 0, '3': 0 } },
    { address: '0xauthorb', year: 2025, quarter: 1, distribution: { '1': 0, '2': 100, '3': 0 } },
    { address: '0xvoterc', year: 2025, quarter: 1, distribution: { '1': 33, '2': 33, '3': 34 } },
  ]
  const votesWithAuthorOwnExcluded = votes.map((v) => {
    const voterAddr = (v as any).address?.toLowerCase()
    const distribution: Record<string, number> = {}
    for (const [projectId, value] of Object.entries((v as any).distribution)) {
      const author = projectIdToAuthorAddress[projectId]?.toLowerCase()
      if (author && author === voterAddr) continue
      distribution[projectId] = Number(value)
    }
    return { ...v, distribution }
  })
  const [normalizedDistributions] = runIterativeNormalization(votesWithAuthorOwnExcluded, projects)
  const addressToQuadraticVotingPower: Record<string, number> = {
    '0xauthora': 10,
    '0xauthorb': 10,
    '0xvoterc': 10,
  }
  const outcome = runQuadraticVoting(normalizedDistributions, addressToQuadraticVotingPower, 100)
  assert(outcome['1'] > 0, 'Project 1 should be > 0')
  assert(outcome['2'] > 0, 'Project 2 should be > 0')
  assert(outcome['3'] > 0, 'Project 3 should be > 0')
  const total = outcome['1'] + outcome['2'] + outcome['3']
  assert(closeTo(total, 100, 1), `Outcome should sum to 100, got ${total}`)
  console.log('  ✓ All three projects get share; total 100%\n')
}

// --- Test 4: Normalize-to-100% when filtering author's project (submit flow) ---
{
  console.log('Test 4: Normalize distribution to 100% after removing author projects (submit flow)')
  const proposalDistribution: Record<string, number> = { '1': 50, '2': 50, '3': 0 }
  const projectIdToAuthorAddress: Record<string, string> = { '1': '0xauthor' }
  const userAddr = '0xauthor'
  const distributionToSubmit: Record<string, number> = {}
  for (const [projectId, value] of Object.entries(proposalDistribution)) {
    const author = projectIdToAuthorAddress[projectId]?.toLowerCase()
    if (author && author === userAddr.toLowerCase()) continue
    distributionToSubmit[projectId] = value
  }
  const sum = Object.values(distributionToSubmit).reduce((s, v) => s + v, 0)
  assert.strictEqual(sum, 50, 'After removing author project 1 (50%), sum should be 50')
  const normalizedDistribution: Record<string, number> = {}
  for (const [projectId, value] of Object.entries(distributionToSubmit)) {
    normalizedDistribution[projectId] = Math.round((value / sum) * 1000) / 10
  }
  const normalizedSum = Object.values(normalizedDistribution).reduce((s, v) => s + v, 0)
  assert(closeTo(normalizedSum, 100, 0.1), `Normalized should sum to 100, got ${normalizedSum}`)
  assert.strictEqual(normalizedDistribution['1'], undefined, 'Author project 1 should be absent')
  assert.strictEqual(normalizedDistribution['2'], 100, 'Project 2 should be 100%')
  console.log('  ✓ Author project removed; remaining normalized to 100%\n')
}

console.log('All 4 tests passed.\n')
