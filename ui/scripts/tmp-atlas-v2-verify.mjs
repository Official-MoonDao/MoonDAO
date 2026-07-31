// Temporary visual verification for the south-pole v2 pass.
// Finds a site beacon by scanning for the hover cursor, clicks it, then
// clicks the first competitor row in the race panel.
// Usage: node scripts/tmp-atlas-v2-verify.mjs
import { chromium } from 'playwright'

const BASE = 'http://localhost:3000/moonbase'
const OUT = '/tmp/atlas-v2'

const browser = await chromium.launch({
  channel: 'chromium',
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 240000 })
await page.waitForSelector('canvas', { timeout: 120000 })
// Terrain decode + texture upgrade + camera settle.
await page.waitForTimeout(22000)
// Dismiss the Next dev-error overlay (pre-existing hydration warning) and
// the cookie banner so they don't cover the scene.
await page.keyboard.press('Escape')
const accept = page.locator('button:text-is("Accept")')
if (await accept.count()) await accept.first().click().catch(() => {})
await page.waitForTimeout(1000)
await page.screenshot({ path: `${OUT}-overview.png` })
console.log('shot: overview')

// Scan the central region for a hoverable beacon (cursor turns 'pointer').
let hit = null
outer: for (let y = 250; y <= 480; y += 8) {
  for (let x = 430; x <= 750; x += 8) {
    await page.mouse.move(x, y)
    await page.waitForTimeout(35)
    const cur = await page.evaluate(() => document.body.style.cursor)
    if (cur === 'pointer') {
      hit = { x, y }
      break outer
    }
  }
}
console.log('beacon found at:', JSON.stringify(hit))

if (hit) {
  await page.mouse.click(hit.x, hit.y)
  await page.waitForTimeout(8000)
  await page.screenshot({ path: `${OUT}-site.png` })
  const raceOpen =
    (await page.locator('h2').filter({ hasText: /./ }).count()) > 0 &&
    (await page.locator('h3:has-text("Competitors")').count()) > 0
  console.log('shot: site | competitors section:', raceOpen)

  const row = page.locator('h3:has-text("Competitors") + div button').first()
  if (await row.count()) {
    await row.click()
    await page.waitForTimeout(9000)
    await page.screenshot({ path: `${OUT}-competitor.png` })
    console.log('shot: competitor drill-in')
  } else {
    console.log('no competitor row found')
  }
}

await browser.close()
