// Temporary visual verification for the south-pole Lunar Atlas rework.
// Screenshots: home overview, a site click (panel + zoom), a competitor
// pick (model swap + surface view), and background-click deselection.
import { chromium } from 'playwright-core'

const URL = 'http://localhost:3009/moonbase'
const OUT = '/tmp/sp-shots'
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 810 } })
const errors = []
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console: ${m.text().slice(0, 300)}`)
})

await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 240000 })
// Terrain geometry + textures decode takes a moment.
await page.waitForTimeout(14000)
await page.screenshot({ path: `${OUT}/1-home.png` })
console.log('shot: home overview')

// Click a site: probe a grid of points for a pointer-cursor 3D hit.
const canvas = page.locator('canvas').first()
const box = await canvas.boundingBox()
const candidates = []
for (let fx = 0.3; fx <= 0.72; fx += 0.06) {
  for (let fy = 0.3; fy <= 0.72; fy += 0.08) {
    candidates.push([box.x + box.width * fx, box.y + box.height * fy])
  }
}
let sitePanel = false
for (const [x, y] of candidates) {
  await page.mouse.move(x, y)
  await page.waitForTimeout(180)
  const cursor = await page.evaluate(() => document.body.style.cursor)
  if (cursor === 'pointer') {
    await page.mouse.click(x, y)
    await page.waitForTimeout(6000)
    sitePanel = (await page.locator('text=/competitor|project/i').count()) > 0
    break
  }
}
await page.screenshot({ path: `${OUT}/2-site.png` })
console.log('shot: site selected, panel open:', sitePanel)

// If a race panel with competitors opened, click the first competitor row.
const competitorBtn = page
  .locator('button:has-text("SpaceX"), button:has-text("Blue Origin")')
  .first()
if ((await competitorBtn.count()) > 0) {
  await competitorBtn.click()
  await page.waitForTimeout(8000)
  await page.screenshot({ path: `${OUT}/3-competitor.png` })
  console.log('shot: competitor drill-in')
} else {
  console.log('no competitor button found')
}

// Background click deselects and returns home.
await page.mouse.click(box.x + box.width * 0.08, box.y + box.height * 0.9)
await page.waitForTimeout(6000)
await page.screenshot({ path: `${OUT}/4-deselected.png` })
console.log('shot: after background click')

console.log('errors:', errors.length ? errors.slice(0, 8) : 'none')
await browser.close()
