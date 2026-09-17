/**
 * PR-0 geo-gate unit specs. Mocha-only: do not import getServerSideProps
 * helpers into a Cypress webpack spec (ChunkLoadError).
 */
import fs from 'fs'
import path from 'path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { EU_EEA_COUNTRIES, isEUCountry } from '@/lib/geo'
import {
  DePrizeRestrictedProvider,
  useDePrizeRestricted,
} from '@/lib/deprize/deprizeRestrictedContext'
import { getDePrizePageEligibility } from '@/lib/deprize/pageEligibility'
import { isRestrictedJurisdiction } from '@/lib/deprize/restrictedJurisdictions'

const UI_ROOT = path.resolve(__dirname, '../../../../')

function readUi(...parts: string[]): string {
  return fs.readFileSync(path.join(UI_ROOT, ...parts), 'utf8')
}

function listFilesRecursive(dir: string, acc: string[] = []): string[] {
  if (!fs.existsSync(dir)) return acc
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const next = path.join(dir, entry.name)
    if (entry.isDirectory()) listFilesRecursive(next, acc)
    else acc.push(next)
  }
  return acc
}

function loadEslintConfig(): any {
  const jsonPath = path.join(UI_ROOT, '.eslintrc.json')
  const rcPath = path.join(UI_ROOT, '.eslintrc')
  const chosen = fs.existsSync(jsonPath) ? jsonPath : rcPath
  return JSON.parse(fs.readFileSync(chosen, 'utf8'))
}

function Probe() {
  const value = useDePrizeRestricted()
  return createElement('span', { 'data-restricted': String(value) }, String(value))
}

describe('PR-0 DePrize geo gate', () => {
  const prevBypass = process.env.DEPRIZE_ELIGIBILITY_BYPASS

  beforeEach(() => {
    delete process.env.DEPRIZE_ELIGIBILITY_BYPASS
  })

  afterEach(() => {
    if (prevBypass === undefined) delete process.env.DEPRIZE_ELIGIBILITY_BYPASS
    else process.env.DEPRIZE_ELIGIBILITY_BYPASS = prevBypass
  })

  it('treats every EU/EEA code as a restricted DePrize jurisdiction', () => {
    for (const code of EU_EEA_COUNTRIES) {
      expect(isRestrictedJurisdiction(code), code).to.equal(true)
    }
  })

  it('records the EU-vs-Schedule-A gap for non-GDPR restricted codes', () => {
    const gap = ['US', 'PR', 'KP', 'RU', 'CA', 'SG', 'BR'] as const
    for (const code of gap) {
      expect(isEUCountry(code), `${code} EU`).to.equal(false)
      expect(isRestrictedJurisdiction(code), `${code} DePrize`).to.equal(true)
    }
  })

  it('uses the DePrize list for the page gate, including unknown and occupied UA', () => {
    expect(process.env.DEPRIZE_ELIGIBILITY_BYPASS).to.equal(undefined)
    expect(
      getDePrizePageEligibility({ headers: { 'x-vercel-ip-country': 'US' } }).restricted
    ).to.equal(true)
    for (const code of EU_EEA_COUNTRIES) {
      expect(
        getDePrizePageEligibility({ headers: { 'x-vercel-ip-country': code } }).restricted,
        code
      ).to.equal(true)
    }
    expect(getDePrizePageEligibility({ headers: {} }).restricted).to.equal(true)
    expect(getDePrizePageEligibility({ headers: {} }).country).to.equal(null)
    expect(
      getDePrizePageEligibility({
        headers: {
          'x-vercel-ip-country': 'UA',
          'x-vercel-ip-country-region': '43',
        },
      }).restricted
    ).to.equal(true)
  })

  it('carries the SSR boolean through the context and never fetches', () => {
    const contextSrc = readUi('lib/deprize/deprizeRestrictedContext.tsx')
    expect(contextSrc).to.not.match(/\bfetch\b/)
    expect(contextSrc).to.not.include('useSWR')
    expect(contextSrc).to.not.include('useEffect')
    expect(contextSrc).to.not.include('/api/geo/country')

    const restricted = renderToStaticMarkup(
      createElement(DePrizeRestrictedProvider, {
        restricted: true,
        children: createElement(Probe),
      })
    )
    const allowed = renderToStaticMarkup(
      createElement(DePrizeRestrictedProvider, {
        restricted: false,
        children: createElement(Probe),
      })
    )
    expect(restricted).to.include('true')
    expect(allowed).to.include('false')
  })

  it('throws when useDePrizeRestricted is used outside a provider', () => {
    expect(() => renderToStaticMarkup(createElement(Probe))).to.throw(
      /useDePrizeRestricted must be used inside DePrizeRestrictedProvider/
    )
  })

  it('mounts the provider on both DePrize page trees', () => {
    const detail = readUi('pages/deprize/[id].tsx')
    const index = readUi('pages/deprize/index.tsx')
    expect(detail).to.include('DePrizeRestrictedProvider')
    expect(index).to.include('DePrizeRestrictedProvider')
    expect(detail).to.include('DePrizeDetailContent restricted={restricted}')
    expect(index).to.include('DePrizeIndexContent restricted={restricted}')
  })

  it('ships the no-restricted-imports rule at error for all three globs', () => {
    const config = loadEslintConfig()
    const override = (config.overrides || []).find((entry: any) =>
      Array.isArray(entry.files) &&
      entry.files.includes('pages/deprize/**') &&
      entry.files.includes('components/deprize/**') &&
      entry.files.includes('lib/deprize/**')
    )
    expect(override, 'DePrize lint override').to.exist
    expect(override.excludedFiles).to.deep.equal(['lib/deprize/deprizeRestrictedContext.tsx'])
    const rule = override.rules['no-restricted-imports']
    expect(rule[0]).to.equal('error')
    const paths = rule[1].paths || []
    const banned = paths.find((p: any) => p.name === '@/lib/geo/useRegionRestriction')
    expect(banned, 'banned path').to.exist
    expect(banned.message).to.include('useDePrizeRestricted')
  })

  it('does not import useRegionRestriction under DePrize paths', () => {
    const roots = [
      path.join(UI_ROOT, 'pages/deprize'),
      path.join(UI_ROOT, 'components/deprize'),
      path.join(UI_ROOT, 'lib/deprize'),
    ]
    const allowed = path.join(UI_ROOT, 'lib/deprize/deprizeRestrictedContext.tsx')
    const hits: string[] = []
    for (const root of roots) {
      for (const file of listFilesRecursive(root)) {
        if (file === allowed) continue
        if (!/\.(ts|tsx)$/.test(file)) continue
        const src = fs.readFileSync(file, 'utf8')
        if (
          /useRegionRestriction/.test(src) ||
          /eslint-disable[^\n]*no-restricted-imports/.test(src)
        ) {
          hits.push(path.relative(UI_ROOT, file))
        }
      }
    }
    expect(hits).to.deep.equal([])
  })

  it('keys the Back CTA on the SSR restricted prop, not the EU hook', () => {
    const detail = readUi('pages/deprize/[id].tsx')
    expect(detail).to.include('!restricted')
    expect(detail).to.include('bettingOpen={bettingAllowed}')
    expect(detail).to.not.include('region.isRestricted')
    expect(detail).to.not.include('useRegionRestriction')
    const allowedBlock = detail.slice(
      detail.indexOf('const bettingAllowed'),
      detail.indexOf('const handleBet')
    )
    expect(allowedBlock).to.include('!restricted')
    expect(allowedBlock).to.not.include('region.')

    const index = readUi('components/deprize/DePrizeIndexContent.tsx')
    expect(index).to.include('const bettingBlockedReason = restricted')
    expect(index).to.not.include('useRegionRestriction')
    expect(index).to.not.include('Checking your region')
  })

  it('does not gate claim or exit on restricted or bettingAllowed', () => {
    const claim = readUi('components/deprize/ClaimPanel.tsx')
    const exit = readUi('components/deprize/ExitPositionModal.tsx')
    const position = readUi('components/deprize/DePrizePositionPanel.tsx')
    const detail = readUi('pages/deprize/[id].tsx')
    for (const [name, src] of [
      ['ClaimPanel', claim],
      ['ExitPositionModal', exit],
      ['DePrizePositionPanel', position],
    ] as const) {
      expect(src, name).to.not.match(/\brestricted\b/)
      expect(src, name).to.not.include('bettingAllowed')
    }
    const claimMount = detail.slice(detail.indexOf('<ClaimPanel'), detail.indexOf('/>', detail.indexOf('<ClaimPanel')))
    const exitMount = detail.slice(
      detail.indexOf('<ExitPositionModal'),
      detail.indexOf('/>', detail.indexOf('<ExitPositionModal'))
    )
    expect(claimMount).to.not.include('restricted')
    expect(claimMount).to.not.include('bettingAllowed')
    expect(exitMount).to.not.include('restricted')
    expect(exitMount).to.not.include('bettingAllowed')
  })

  it('keeps the existing region-notice sentence and deletes the full-page notice', () => {
    const detail = readUi('pages/deprize/[id].tsx')
    expect(detail).to.include(
      "Betting isn&apos;t available in your region. You can view odds, cash out and claim."
    )
    expect(
      fs.existsSync(path.join(UI_ROOT, 'components/deprize/DePrizeRestrictedNotice.tsx'))
    ).to.equal(false)
  })
})
