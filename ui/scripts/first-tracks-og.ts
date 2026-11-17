/**
 * Builds First Tracks' link-preview images from a 1200x630 frame of the real
 * game (the start screen's hero view with the UI hidden):
 *
 *   public/first-tracks/og-base.jpg   the frame, darkened where text goes; the
 *                                     challenge route writes the score to beat on it
 *   public/first-tracks/og.jpg        the same with the hook, for plain links
 *
 *   yarn tsx --tsconfig tsconfig.json scripts/first-tracks-og.ts <frame.png>
 */
import { mkdirSync } from 'fs'
import { join } from 'path'
import sharp from 'sharp'
import { SHARE_URL_LABEL } from '../lib/first-tracks/share'
import { embedOgFontFace } from '../lib/og/rasterize'
import { escapeXml } from '../lib/og/svg'

const frame = process.argv[2]
if (!frame) {
  console.error('usage: first-tracks-og.ts <frame.png>')
  process.exit(1)
}

const shade = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <defs>
    <linearGradient id="b" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#000" stop-opacity="0"/>
      <stop offset="0.55" stop-color="#000" stop-opacity="0.72"/>
      <stop offset="1" stop-color="#000" stop-opacity="0.92"/>
    </linearGradient>
    <linearGradient id="t" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#000" stop-opacity="0.6"/>
      <stop offset="1" stop-color="#000" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect x="0" y="380" width="1200" height="250" fill="url(#b)"/>
  <rect x="640" y="0" width="560" height="180" fill="url(#t)"/>
</svg>`

const text = (attrs: string, body: string) => `<text font-family="Lato, sans-serif" fill="#fff" ${attrs}>${body}</text>`
const words = embedOgFontFace(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs></defs>
  ${text('x="1144" y="74" font-size="40" font-weight="700" letter-spacing="3" text-anchor="end" stroke="#fff" stroke-width="1.2"', 'LUNAR ROVER')}
  ${text('x="1144" y="108" font-size="24" letter-spacing="4" text-anchor="end" fill-opacity="0.9"', 'FIRST TRACKS')}
  ${text('x="1144" y="142" font-size="22" text-anchor="end" fill-opacity="0.8"', escapeXml(SHARE_URL_LABEL))}
  ${text('x="54" y="542" font-size="70" font-weight="700" stroke="#fff" stroke-width="2"', 'Can you drive on the Moon?')}
  ${text('x="56" y="592" font-size="28" fill-opacity="0.88"', 'Drive a rover through real signal delay. New site every day.')}
</svg>`)

async function main() {
  const out = join(process.cwd(), 'public/first-tracks')
  mkdirSync(out, { recursive: true })
  const base = await sharp(frame)
    .resize(1200, 630, { fit: 'cover' })
    .composite([{ input: Buffer.from(shade), top: 0, left: 0 }])
    .jpeg({ quality: 88 })
    .toBuffer()
  await sharp(base).toFile(join(out, 'og-base.jpg'))
  await sharp(base)
    .composite([{ input: Buffer.from(words), top: 0, left: 0 }])
    .jpeg({ quality: 88 })
    .toFile(join(out, 'og.jpg'))
  console.log('wrote', join(out, 'og-base.jpg'), 'and og.jpg')
}

void main()
