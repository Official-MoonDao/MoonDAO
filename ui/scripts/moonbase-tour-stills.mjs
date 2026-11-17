// Captures the still frames the Moon Base Zero tour shows on phones,
// low-power machines and reduced motion, from the live 3D tour itself.
//
// Run against a dev server that serves the tour:
//   node scripts/moonbase-tour-stills.mjs [baseUrl]
// (default http://localhost:3000). Writes public/moonbase-tour/<shot>.webp.
//
// Stops that share a camera shot share a frame, so this captures one per
// shot; lib/moonbase-tour/stops.ts maps each stop to its file. Re-run it
// after the base, the camera framing or the models change.
import { chromium } from 'playwright'
import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const BASE = process.argv[2] ?? 'http://localhost:3000'
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'moonbase-tour')

// shot file name -> a tour stop that frames it
const SHOTS = {
  base: 'arrival',
  power: 'power',
  comms: 'comms',
  habitat: 'habitat',
  rover: 'rover',
  landing: 'race',
  lander: 'bet',
  orbit: 'explore',
}

const VIEWPORT = { width: 1600, height: 900 }
const OUT_WIDTH = 1280
// The camera glides for 2.5 s; terrain and models stream in behind it.
const SETTLE_MS = 9000

// Everything but the scene's canvas, so the frames carry no cards, rail,
// header or shading (the tour lays its own shading over the still).
const HIDE_UI = `
  body * { visibility: hidden !important; }
  canvas { visibility: visible !important; }
  html, body { background: #010208 !important; }
`

const browser = await chromium.launch({
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'],
})
const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 })
await mkdir(OUT, { recursive: true })

await page.goto(`${BASE}/moonbase/tour?globe=1`, { waitUntil: 'load', timeout: 180_000 })
// TourScene fades the globe in once its terrain is ready.
await page.waitForFunction(
  () => {
    const c = document.querySelector('canvas')
    const wrap = c?.closest('.transition-opacity.duration-1000')
    return !!wrap && wrap.classList.contains('opacity-100')
  },
  null,
  { timeout: 180_000 }
)
await page.addStyleTag({ content: HIDE_UI })

for (const [shot, stop] of Object.entries(SHOTS)) {
  await page.evaluate((id) => {
    window.location.hash = id === 'arrival' ? '' : id
    if (id === 'arrival') window.scrollTo({ top: 0, behavior: 'auto' })
  }, stop)
  await page.waitForTimeout(SETTLE_MS)
  const active = await page.evaluate(
    () => document.querySelector('[aria-current=step]')?.textContent ?? null
  )
  const png = await page.screenshot({ type: 'png' })
  const file = path.join(OUT, `${shot}.webp`)
  const info = await sharp(png).resize({ width: OUT_WIDTH }).webp({ quality: 62 }).toFile(file)
  console.log(`${shot.padEnd(8)} (${stop}, rail: ${active}) -> ${Math.round(info.size / 1024)} KB`)
}

await browser.close()
