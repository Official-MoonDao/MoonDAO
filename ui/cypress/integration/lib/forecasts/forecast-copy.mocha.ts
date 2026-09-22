/// <reference types="node" />
/**
 * Acceptance: the forecast UI speaks plain language.
 *
 * Scoring stays Brier in the math modules and weighting stays sqrt(vMOONEY)
 * in weighting.ts. The strings people read must not say call / Brier / √ / VP.
 * FORECAST_COPY is the lexicon; ForecastPanel and DePrizeCallers import it.
 */
import fs from 'fs'
import path from 'path'

const REQUEST = '@/lib/forecasts/forecastCopy'
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

const BANNED =
  /\bcall(?:ed|ing)?\b|Brier|[√]|sqrt|\bVP\b/i

const REQUIRED_KEYS = [
  'panelIntro',
  'restrictedNote',
  'singlePick',
  'daoPending',
  'callersHeading',
  'callersEmpty',
  'callersCount',
  'votingPower',
  'predictThis',
  'predicted',
  'backedWithEth',
] as const

function flattenCopy(copy: Record<string, unknown>): string[] {
  const out: string[] = []
  for (const key of REQUIRED_KEYS) {
    const value = copy[key]
    if (typeof value === 'string') {
      out.push(value)
      continue
    }
    if (typeof value === 'function') {
      if (key === 'daoPending') out.push(value(3, 1))
      else if (key === 'callersCount') {
        out.push(value(1))
        out.push(value(4))
      } else out.push(String(value()))
      continue
    }
    throw new Error(
      `[not implemented] FORECAST_COPY.${key} must be a string or function, got ${typeof value}`
    )
  }
  return out
}

describe('deprize forecast copy', () => {
  let copy: Record<string, unknown>

  before(() => {
    const mod = loadModule(REQUEST)
    requireExports(mod, REQUEST, ['FORECAST_COPY'])
    copy = mod.FORECAST_COPY
    if (!copy || typeof copy !== 'object') {
      throw new Error('[not implemented] "@/lib/forecasts/forecastCopy" FORECAST_COPY must be an object')
    }
    const missing = REQUIRED_KEYS.filter((key) => typeof copy[key] === 'undefined')
    if (missing.length > 0) {
      throw new Error(
        `[not implemented] FORECAST_COPY must include: ${missing.join(', ')}`
      )
    }
  })

  it('keeps banned terms out of every exported string', () => {
    for (const text of flattenCopy(copy)) {
      expect(text, `banned term in "${text}"`).to.not.match(BANNED)
    }
  })

  it('explains a single pick in plain language, without Brier', () => {
    const sentence = copy.singlePick
    expect(sentence).to.be.a('string')
    expect(String(sentence).length).to.be.greaterThan(40)
    expect(sentence).to.match(/pick|predict/i)
    expect(sentence).to.match(/not win|will not|other/i)
    expect(sentence).to.not.match(/Brier|√|sqrt|\bVP\b|\bcall(?:ed|ing)?\b/i)
  })

  it('spells voting power out in full', () => {
    expect(copy.votingPower).to.equal('voting power')
  })

  it('daoPending names the reveal threshold and the count so far', () => {
    expect(copy.daoPending).to.be.a('function')
    const text = (copy.daoPending as (min: number, have: number) => string)(3, 1)
    expect(text).to.include('3')
    expect(text).to.include('1')
    expect(text).to.not.match(BANNED)
  })
})

describe('deprize forecast copy wiring', () => {
  const consumers = [
    'components/deprize/ForecastPanel.tsx',
    'components/deprize/DePrizeCallers.tsx',
  ]

  it('both surfaces import FORECAST_COPY instead of hardcoding jargon', () => {
    for (const file of consumers) {
      const src = readUi(file)
      if (!/FORECAST_COPY/.test(src)) {
        throw new Error(
          `[not implemented] ${file} must import FORECAST_COPY from @/lib/forecasts/forecastCopy`
        )
      }
      if (
        /Your call|Save prediction|Who.?s called|Who&apos;s called|\bBrier\b|[√]|\bVP\b/.test(src)
      ) {
        throw new Error(
          `[not implemented] ${file} still contains banned forecast copy (call / Brier / √ / VP / Your call / Save prediction)`
        )
      }
    }
  })
})

export {}
