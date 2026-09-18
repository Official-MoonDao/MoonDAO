/// <reference types="node" />
/**
 * Acceptance: betting on more than one outcome in a single transaction.
 *
 * A portfolio across outcomes is a belief vector (for a Kelly bettor the
 * normalized cost split IS the distribution), so multi-outcome betting is what
 * lets an ETH staker express the same confidence a vMOONEY voter expresses by
 * splitting their allocation.
 */
import fs from 'fs'
import path from 'path'

const REQUEST = '@/lib/deprize/quote-math'
const UI_ROOT = path.resolve(__dirname, '../../../../')
const REPO_ROOT = path.resolve(UI_ROOT, '..')

const uiPath = (...parts: string[]) => path.join(UI_ROOT, ...parts)
const repoPath = (...parts: string[]) => path.join(REPO_ROOT, ...parts)

/** Lazy load so an unimplemented export fails this suite, not the whole run. */
function loadModule(request: string): any {
  try {
    return require(request)
  } catch (err: any) {
    throw new Error(
      `[not implemented] Could not load "${request}". Create it as described in the plan. ` +
        `Underlying error: ${err?.message ?? String(err)}`
    )
  }
}

function requireExports(mod: any, request: string, names: string[]): void {
  const missing = names.filter((name) => typeof mod?.[name] === 'undefined')
  if (missing.length > 0) {
    throw new Error(`[not implemented] "${request}" must export: ${missing.join(', ')}`)
  }
}

describe('deprize multi-outcome betting', () => {
  let mod: any

  before(() => {
    mod = loadModule(REQUEST)
    requireExports(mod, REQUEST, [
      'betSlice',
      'betBudget',
      'buildAmounts',
      'buildAmountsFromAllocation',
      'searchMaxQtyWithinCost',
      'isGuaranteedLoss',
    ])
  })

  it('keeps the existing single-outcome amounts vector working', () => {
    const { buildAmounts } = mod
    expect(buildAmounts(1, 500n, 3)).to.deep.equal([0n, 500n, 0n])
  })

  it('splits a total quantity across outcomes in the allocation proportions', () => {
    const { buildAmountsFromAllocation } = mod
    expect(buildAmountsFromAllocation([60, 40], 1000n)).to.deep.equal([600n, 400n])
    expect(buildAmountsFromAllocation([100, 0, 0], 750n)).to.deep.equal([750n, 0n, 0n])
  })

  it('never loses or invents quantity to rounding', () => {
    const { buildAmountsFromAllocation } = mod
    for (const total of [10n, 99n, 1000n, 123456789n]) {
      const amounts = buildAmountsFromAllocation([33, 33, 34], total)
      expect(amounts).to.have.length(3)
      expect(amounts.reduce((a: bigint, b: bigint) => a + b, 0n)).to.equal(total)
      for (const a of amounts) expect(a >= 0n).to.equal(true)
    }
  })

  it('leaves unbacked outcomes at exactly zero', () => {
    const { buildAmountsFromAllocation } = mod
    const amounts = buildAmountsFromAllocation([0, 70, 0, 30], 1000n)
    expect(amounts[0]).to.equal(0n)
    expect(amounts[2]).to.equal(0n)
    expect(amounts[1] + amounts[3]).to.equal(1000n)
  })

  it('flags an allocation that cannot win as a guaranteed loss', () => {
    const { isGuaranteedLoss } = mod
    // Covering every outcome: each leg pays out less than the whole trade cost.
    expect(isGuaranteedLoss([100n, 100n, 100n], 150n)).to.equal(true)
    // One leg pays more than it cost, so there is something to win.
    expect(isGuaranteedLoss([1000n, 100n], 150n)).to.equal(false)
    // Break-even is not a loss.
    expect(isGuaranteedLoss([150n, 150n], 150n)).to.equal(false)
  })

  it('sizes a multi-leg trade with the existing scalar search, unchanged', async () => {
    const { buildAmountsFromAllocation, searchMaxQtyWithinCost } = mod
    const allocation = [60, 40]
    const unitCost = [1n, 3n]
    const costFn = async (scale: bigint) =>
      buildAmountsFromAllocation(allocation, scale).reduce(
        (acc: bigint, qty: bigint, i: number) => acc + qty * unitCost[i],
        0n
      )

    const budget = 1800n
    const scale = await searchMaxQtyWithinCost(costFn, budget)
    expect(scale > 0n, 'search should find a positive scale').to.equal(true)
    expect((await costFn(scale)) <= budget, 'result must fit the budget').to.equal(true)
    expect((await costFn(scale + 1n)) > budget, 'result must be the largest that fits').to.equal(
      true
    )
  })

  it('still routes the 5 percent prize slice out of the total stake', () => {
    const { betSlice, betBudget } = mod
    const value = 1000n
    expect(betSlice(value) + betBudget(value)).to.equal(value)
    expect(betSlice(value)).to.equal(50n)
  })
})

describe('deprize mint multi-outcome surface', () => {
  it('exposes a bet entry point that accepts an amounts array', () => {
    const abi = JSON.parse(fs.readFileSync(uiPath('const/abis/DePrizeMint.json'), 'utf8'))
    const entries = Array.isArray(abi) ? abi : abi.abi
    const bets = entries.filter((e: any) => e.type === 'function' && e.name === 'bet')
    expect(bets.length, 'DePrizeMint ABI must still expose bet').to.be.greaterThan(0)
    const takesArray = bets.some((e: any) =>
      (e.inputs ?? []).some((i: any) => i.type === 'uint256[]')
    )
    expect(takesArray, 'bet must take a uint256[] of per-outcome amounts').to.equal(true)
  })

  it('builds the LMSR amounts vector from the caller-supplied legs', () => {
    const src = fs.readFileSync(
      repoPath('subscription-contracts/src/deprize/DePrizeMint.sol'),
      'utf8'
    )
    expect(src).to.match(/function bet\(/)
    expect(src, 'bet must accept an array of per-outcome amounts').to.match(/uint256\[\]\s+calldata/)
    // The single-index assignment is what multi-outcome replaces.
    expect(src).to.not.match(/amounts\[outcomeIndex\]\s*=\s*int256\(outcomeTokenAmount\)/)
  })
})
