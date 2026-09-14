// Screenshot the moonbase scene under both suns, so a change to the lighting can be
// LOOKED at rather than only argued about.
//
// Headless Chromium renders WebGL through SwiftShader, which is slow but produces the
// same image the GPU would for everything this is used to check — lighting, exposure,
// where the shadows fall. It is not a pixel-exact reference for antialiasing.
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const BASE = process.env.BASE ?? 'http://localhost:3999'
const OUT = process.env.OUT ?? '/tmp/moonshots'
// SwiftShader needs a long time for the first frame of a scene this size, and the
// terrain, the horizon sweep and the environment bake all land asynchronously.
const SETTLE_MS = Number(process.env.SETTLE_MS ?? 45000)

mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
  ],
})
const context = await browser.newContext({ viewport: { width: 1400, height: 900 } })
// /moonbase sits behind the server-side access gate, so present the session cookie
// directly rather than driving the login form. Token comes from the environment; it is
// never written down here.
if (process.env.MOONBASE_GATE_TOKEN) {
  await context.addCookies([
    {
      name: 'moondao_gate',
      value: process.env.MOONBASE_GATE_TOKEN,
      url: BASE,
    },
  ])
}
const page = await context.newPage()
page.on('console', (m) => {
  if (m.type() === 'error') console.log('  [console error]', m.text().slice(0, 200))
})
page.on('pageerror', (e) => console.log('  [page error]', String(e).slice(0, 200)))

console.log('loading', BASE + '/moonbase')
await page.goto(BASE + '/moonbase', { waitUntil: 'domcontentloaded', timeout: 120000 })

// The globe mounts lazily behind an IntersectionObserver and a next/dynamic boundary.
await page.waitForSelector('canvas', { timeout: 120000 })
console.log('canvas up; letting the scene settle', SETTLE_MS, 'ms')
await page.waitForTimeout(SETTLE_MS)

async function shoot(name) {
  const path = `${OUT}/${name}.png`
  await page.screenshot({ path })
  console.log('  wrote', path)
}

// 1. The scene as it ships: design sun, furniture on.
await shoot('1-design-sun')

// 2. Clean view under the design sun, as the baseline for comparing lighting only.
await page.getByRole('button', { name: /clean view/i }).click()
await page.waitForTimeout(4000)
await shoot('2-design-sun-clean')

// Back out, then into the real sun (which forces the clean view itself).
await page.keyboard.press('Escape')
await page.waitForTimeout(2000)

// 3..n. The real sun, at a few points around the month.
await page.getByRole('button', { name: /real sun/i }).click()
await page.waitForTimeout(8000)
await shoot('3-real-sun-noon')

const readout = async () => {
  const t = await page.locator('dl').first().innerText()
  return t.replace(/\s+/g, ' ')
}
console.log('  readout:', await readout())

for (const [name, frac] of [
  ['4-real-sun-day07', 0.25],
  ['5-real-sun-day15', 0.5],
  ['6-real-sun-day22', 0.75],
]) {
  const slider = page.getByLabel('lunar day')
  await slider.fill(String(frac))
  await page.waitForTimeout(6000)
  console.log(' ', name, await readout())
  await shoot(name)
}

await browser.close()
console.log('done')
