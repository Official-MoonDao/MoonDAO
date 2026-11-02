/// <reference types="node" />
/// <reference types="mocha" />
import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { formatCountStat, resolveCitizenCount } from '../lib/stats/publicFigures'
import {
  displayedYearUsd,
  FALLBACK_CITIZEN_YEAR_USD,
  FALLBACK_TEAM_YEAR_USD,
  formatYearlyUsd,
  publicYearWei,
  SECONDS_PER_YEAR,
  withMooneyQuarter,
  yearlyUsd,
} from '../lib/subscription/publicYearPrice'

const uiRoot = path.join(__dirname, '..')

describe('public citizen count', () => {
  it('uses a positive ballpark when supply is missing or zero', () => {
    assert.strictEqual(resolveCitizenCount(null), 260)
    assert.strictEqual(resolveCitizenCount(undefined), 260)
    assert.strictEqual(resolveCitizenCount(0), 260)
    assert.strictEqual(resolveCitizenCount(Number.NaN), 260)
  })

  it('keeps a real supply', () => {
    assert.strictEqual(resolveCitizenCount(641), 641)
    assert.strictEqual(resolveCitizenCount(641.8), 641)
  })

  it('does not format a literal zero', () => {
    assert.strictEqual(formatCountStat(0, '', '+'), '')
    assert.strictEqual(formatCountStat(resolveCitizenCount(null), '', '+'), '260+')
    assert.strictEqual(formatCountStat(8, '$', 'M+'), '$8M+')
    assert.strictEqual(formatCountStat(12_000, '', '+'), '12,000+')
    const initial = [
      formatCountStat(resolveCitizenCount(null), '', '+'),
      formatCountStat(8, '$', 'M+'),
      formatYearlyUsd(0),
    ].join(' ')
    assert.ok(!initial.includes('0+ Citizens'))
    assert.ok(!initial.includes('$0M+'))
    assert.ok(!initial.includes('~$0'))
  })
})

describe('public yearly USD', () => {
  it('prices a citizen year with the MOONEY quarter and a team year with the discount', () => {
    const perSecond = BigInt(1_000_000_000)
    const treasury = perSecond * BigInt(SECONDS_PER_YEAR)
    assert.strictEqual(
      publicYearWei({
        kind: 'citizen',
        pricePerSecond: perSecond,
        citizenCheckoutLive: false,
      }),
      treasury
    )
    assert.strictEqual(
      publicYearWei({
        kind: 'citizen',
        pricePerSecond: perSecond,
        citizenCheckoutLive: true,
      }),
      withMooneyQuarter(treasury)
    )
    assert.strictEqual(
      publicYearWei({
        kind: 'team',
        pricePerSecond: perSecond,
        teamDiscount: BigInt(100),
        citizenCheckoutLive: false,
      }),
      (treasury * BigInt(900)) / BigInt(1000)
    )
    assert.strictEqual(
      publicYearWei({
        kind: 'citizen',
        pricePerSecond: BigInt(0),
        citizenCheckoutLive: true,
      }),
      BigInt(0)
    )
  })

  it('converts ETH to a positive USD amount and never falls through to zero', () => {
    assert.strictEqual(
      yearlyUsd({
        yearEth: 0.036,
        ethUsd: 4000,
        fallbackEth: 0.036,
        fallbackUsd: FALLBACK_CITIZEN_YEAR_USD,
      }),
      144
    )
    assert.strictEqual(
      yearlyUsd({
        yearEth: null,
        ethUsd: 4000,
        fallbackEth: 0.036,
        fallbackUsd: FALLBACK_CITIZEN_YEAR_USD,
      }),
      144
    )
    assert.strictEqual(
      yearlyUsd({
        yearEth: null,
        ethUsd: null,
        fallbackEth: 0.036,
        fallbackUsd: FALLBACK_CITIZEN_YEAR_USD,
      }),
      FALLBACK_CITIZEN_YEAR_USD
    )
    assert.ok(FALLBACK_CITIZEN_YEAR_USD > 0)
    assert.ok(FALLBACK_TEAM_YEAR_USD > 0)
    assert.strictEqual(formatYearlyUsd(0), `~$${FALLBACK_CITIZEN_YEAR_USD} / Year`)
    assert.strictEqual(formatYearlyUsd(1260, FALLBACK_TEAM_YEAR_USD), '~$1,260 / Year')
    assert.ok(!formatYearlyUsd(0).includes('~$0'))
    assert.ok(!formatYearlyUsd(1260, FALLBACK_TEAM_YEAR_USD).includes('ETH'))
  })

  it('prefers a live USD quote, then the server quote, and ignores zeros', () => {
    assert.strictEqual(displayedYearUsd(0, 140, 126), 140)
    assert.strictEqual(displayedYearUsd(undefined, undefined, 126), 126)
    assert.strictEqual(displayedYearUsd(151.4, 140, 126), 151)
  })
})

describe('server HTML does not start public stats at zero', () => {
  it('CountUp paints its target instead of useState(0)', () => {
    const source = fs.readFileSync(path.join(uiRoot, 'components/home/landing/CountUp.tsx'), 'utf8')
    assert.ok(source.includes('useState(to)'))
    assert.ok(!source.includes('useState(0)'))
    assert.ok(source.includes('formatCountStat'))
  })

  it('the join pricing card is USD from props, not a zero or an ETH amount', () => {
    const source = fs.readFileSync(path.join(uiRoot, 'pages/join.tsx'), 'utf8')
    assert.ok(!source.includes('citizenUsdPrice || 0'))
    assert.ok(!source.includes('teamUsdPrice || 0'))
    assert.ok(!source.includes('Arbitrum ETH'))
    assert.ok(source.includes('formatYearlyUsd'))
    assert.ok(source.includes('readPublicYearlyUsd'))
  })
})
