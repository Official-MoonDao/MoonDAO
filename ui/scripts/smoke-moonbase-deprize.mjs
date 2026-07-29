/**
 * Headed-less Playwright smoke: /moonbase?race=shared-fission-power on a local
 * Next server pointed at Sepolia. Asserts the Wave 2 panel surface — Back a
 * competitor, live odds, roster disclaimer — against the LMSR we just skewed.
 *
 *   node scripts/smoke-moonbase-deprize.mjs [baseUrl]
 */
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const BASE = process.argv[2] || 'http://127.0.0.1:3001'
const RACE = 'shared-fission-power'
const OUT = fileURLToPath(
  new URL('../../.cursor/artifacts/moonbase-deprize-smoke/', import.meta.url)
)
mkdirSync(OUT, { recursive: true })

let pass = 0
let fail = 0
const ok = (n, d = '') => {
  pass++
  console.log(`  PASS  ${n}${d ? ` — ${d}` : ''}`)
}
const bad = (n, d) => {
  fail++
  console.log(`  FAIL  ${n} — ${d}`)
}

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

try {
  // noglobe=1 skips the R3F canvas — headless Chromium has no usable WebGL and
  // a failed Canvas unmounts the page via the Next error overlay.
  const url = `${BASE}/moonbase?race=${RACE}&noglobe=1&year=2030`
  console.log(`Opening ${url}`)
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 })

  // Race panel header
  await page.getByText('Capability race', { exact: false }).first().waitFor({
    timeout: 45_000,
  })
  ok('race panel opened from ?race=')

  // Market live pill or Back a competitor (bound race on Sepolia)
  const back = page.getByRole('link', { name: /Back a competitor/i })
  try {
    await back.waitFor({ timeout: 60_000 })
    ok('Back a competitor link visible')
    const href = await back.getAttribute('href')
    if (href === '/deprize/9') ok('link targets /deprize/9', href)
    else bad('link targets /deprize/9', `href=${href}`)
  } catch (e) {
    bad('Back a competitor link visible', e.message)
    // Still capture what we have — may be chain mismatch (mainnet default).
  }

  // Live odds caption once the bridge merges
  const liveCaption = page.getByText('Odds are live market-implied probabilities.')
  try {
    await liveCaption.waitFor({ timeout: 60_000 })
    ok('live odds caption')
  } catch (e) {
    bad('live odds caption', e.message)
  }

  // Roster disclaimer (bound race)
  const disclaimer = page.getByText(/editorial discretion/i)
  try {
    await disclaimer.waitFor({ timeout: 10_000 })
    ok('roster disclaimer visible')
  } catch (e) {
    bad('roster disclaimer visible', e.message)
  }

  // Live LMSR we skewed: westinghouse ~56%. Chips live in cyan tabular spans.
  const chips = page.locator('span.tabular-nums', { hasText: /%/ })
  try {
    await chips.first().waitFor({ timeout: 30_000 })
    const texts = await chips.allInnerTexts()
    const pcts = texts
      .map((t) => Number(String(t).replace('%', '').trim()))
      .filter((n) => Number.isFinite(n))
    // Post-bet westinghouse was ~56%; allow drift if the market moved again.
    const hasLeader = pcts.some((p) => p >= 45 && p <= 70)
    const sum = pcts.reduce((a, b) => a + b, 0)
    if (hasLeader && pcts.length >= 3) {
      ok('panel shows live competitor percentages', pcts.join(', '))
    } else {
      bad('panel shows live competitor percentages', `found=${pcts.join(', ')} sum≈${sum}`)
    }
  } catch (e) {
    bad('panel shows live competitor percentages', e.message)
  }

  // "No market exists yet" must NOT show for a bound live race
  const body = await page.locator('body').innerText()
  if (/No market exists yet/i.test(body)) {
    bad('no-market footer hidden when bound', 'still visible')
  } else {
    ok('no-market footer hidden when bound')
  }

  // Claim-gated branding: unclaimed competitors keep the neutral accent (no
  // brand-color glow). Soft check — presence of "listed" roster badges.
  if (/\blisted\b/i.test(body)) ok('roster status badges render')
  else bad('roster status badges render', 'no listed badges found')

  const shot = join(OUT, 'moonbase-fission-race.png')
  await page.screenshot({ path: shot, fullPage: false })
  ok('screenshot written', shot)
} catch (e) {
  bad('smoke', e.message)
  try {
    await page.screenshot({ path: join(OUT, 'moonbase-fission-race-error.png') })
  } catch {
    /* ignore */
  }
} finally {
  await browser.close()
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)
