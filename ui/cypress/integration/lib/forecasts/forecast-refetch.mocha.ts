/// <reference types="node" />
/**
 * Acceptance: one consensus URL builder, and a cache-bust after a write.
 *
 * ForecastPanel and DePrizeCallers must share a non-fresh URL so the first
 * paint hits one CDN entry. After a write the panel refetches with a
 * changing t= so s-maxage=60 cannot serve the pre-write body. Neither
 * component builds that query itself.
 */
import fs from 'fs'
import path from 'path'

const REQUEST = '@/lib/forecasts/consensusQuery'
const UI_ROOT = path.resolve(__dirname, '../../../../')

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

function readUi(...parts: string[]): string {
  return fs.readFileSync(path.join(UI_ROOT, ...parts), 'utf8')
}

function keysOf(urlPath: string): string[] {
  return [...new URL(urlPath, 'https://example.test').searchParams.keys()]
}

describe('deprize forecast consensus query', () => {
  let mod: any

  before(() => {
    mod = loadModule(REQUEST)
    requireExports(mod, REQUEST, ['consensusQuery'])
  })

  it('returns an identical non-fresh URL for the same args so both panels share one CDN entry', () => {
    const a = mod.consensusQuery({ chain: 'sepolia', deprizeId: 1, outcomes: 4 })
    const b = mod.consensusQuery({ chain: 'sepolia', deprizeId: 1, outcomes: 4 })
    expect(a).to.equal(b)
    expect(a).to.equal('/api/forecasts/consensus?chain=sepolia&deprizeId=1&outcomes=4')
    expect(a).to.not.match(/[?&]t=/)
  })

  it('adds a changing t= param when fresh, using now when it is passed', () => {
    const first = mod.consensusQuery({
      chain: 'sepolia',
      deprizeId: 1,
      outcomes: 4,
      fresh: true,
      now: 1000,
    })
    const second = mod.consensusQuery({
      chain: 'sepolia',
      deprizeId: 1,
      outcomes: 4,
      fresh: true,
      now: 2000,
    })
    expect(first).to.include('t=1000')
    expect(second).to.include('t=2000')
    expect(first).to.not.equal(second)
  })

  it('keeps a deterministic param order: chain, deprizeId, outcomes, resolved, t', () => {
    const plain = mod.consensusQuery({ chain: 'arbitrum', deprizeId: 9, outcomes: 3 })
    expect(keysOf(plain)).to.deep.equal(['chain', 'deprizeId', 'outcomes'])

    const withResolved = mod.consensusQuery({
      chain: 'arbitrum',
      deprizeId: 9,
      outcomes: 2,
      resolved: [1, 0],
      fresh: true,
      now: 9,
    })
    expect(keysOf(withResolved)).to.deep.equal([
      'chain',
      'deprizeId',
      'outcomes',
      'resolved',
      't',
    ])
    const parsed = new URL(withResolved, 'https://example.test')
    expect(parsed.searchParams.get('t')).to.equal('9')
    expect(JSON.parse(parsed.searchParams.get('resolved') as string)).to.deep.equal([1, 0])
  })

  it('omits resolved when it is null or missing so the shared CDN key stays stable', () => {
    const missing = mod.consensusQuery({ chain: 'sepolia', deprizeId: 1, outcomes: 2 })
    const explicit = mod.consensusQuery({
      chain: 'sepolia',
      deprizeId: 1,
      outcomes: 2,
      resolved: null,
    })
    expect(missing).to.equal(explicit)
    expect(keysOf(missing)).to.not.include('resolved')
  })
})

describe('deprize forecast consensus query wiring', () => {
  const consumers = [
    'components/deprize/ForecastPanel.tsx',
    'components/deprize/DePrizeCallers.tsx',
  ]

  it('neither component builds the consensus query itself', () => {
    for (const file of consumers) {
      const src = readUi(file)
      if (!src.includes('consensusQuery')) {
        throw new Error(
          `[not implemented] ${file} must import consensusQuery from @/lib/forecasts/consensusQuery`
        )
      }
      if (src.includes('/api/forecasts/consensus?') || /URLSearchParams\(\s*\{/.test(src)) {
        throw new Error(
          `[not implemented] ${file} still builds the consensus query itself. Use consensusQuery().`
        )
      }
    }
  })

  it('refetches fresh after a write and keeps the callers list on the shared key', () => {
    const panel = readUi('components/deprize/ForecastPanel.tsx')
    const callers = readUi('components/deprize/DePrizeCallers.tsx')
    if (!/fresh\s*:\s*true/.test(panel)) {
      throw new Error(
        '[not implemented] ForecastPanel must refetch with consensusQuery({ ..., fresh: true }) after a write'
      )
    }
    if (/fresh\s*:\s*true/.test(callers)) {
      throw new Error(
        '[not implemented] DePrizeCallers must use the non-fresh consensusQuery so it shares the CDN entry'
      )
    }
  })
})

export {}
