import { getOgFontDataUri } from './installOgFonts'
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from './preview'

const OG_FONT_FAMILY = 'Lato, sans-serif'

export type OgSvgFields = {
  eyebrow: string
  title: string
  subtitle?: string
  chips?: string[]
  footer: string
  mediaDataUri?: string
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export function wrapText(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean)
  if (!words.length) return []

  const lines: string[] = []
  let current = ''
  for (let i = 0; i < words.length; i++) {
    const word = words[i]
    const next = current ? `${current} ${word}` : word
    if (next.length <= maxChars || !current) {
      current = next
      continue
    }
    lines.push(current)
    const remaining = words.slice(i).join(' ')
    if (lines.length === maxLines - 1) {
      lines.push(remaining.length > maxChars ? `${remaining.slice(0, maxChars - 1)}…` : remaining)
      return lines
    }
    current = word
  }
  if (current) lines.push(current)
  return lines.slice(0, maxLines)
}

function chipRow(chips: string[], startX: number, y: number): string {
  let x = startX
  return chips
    .map((chip) => {
      const width = Math.min(360, 32 + chip.length * 13)
      const svg = `<g>
        <rect x="${x}" y="${y}" rx="22" ry="22" width="${width}" height="44"
          fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.18)"/>
        <text x="${x + width / 2}" y="${y + 29}" text-anchor="middle"
          font-size="20" fill="#e2e8f0" font-family="${OG_FONT_FAMILY}">${escapeXml(chip)}</text>
      </g>`
      x += width + 12
      return svg
    })
    .join('')
}

/** Branded 1200×630 card used by the job and listing OG routes. */
export function renderOgSvg({
  eyebrow,
  title,
  subtitle,
  chips,
  footer,
  mediaDataUri,
}: OgSvgFields): string {
  const visibleChips = (chips || []).filter(Boolean).slice(0, 4)
  const titleSize = title.length > 48 ? 46 : 56
  const titleLines = wrapText(title, title.length > 48 ? 28 : 22, 2)
  const subtitleLine = subtitle ? escapeXml(subtitle) : ''

  const titleTspans = titleLines
    .map((line, index) => {
      const dy = index === 0 ? 0 : titleSize + 8
      return `<tspan x="56" dy="${dy}">${escapeXml(line)}</tspan>`
    })
    .join('')

  const media = mediaDataUri
    ? `<defs>
        <clipPath id="media-clip">
          <rect x="800" y="135" width="344" height="360" rx="28" ry="28"/>
        </clipPath>
      </defs>
      <rect x="800" y="135" width="344" height="360" rx="28" ry="28"
        fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.12)"/>
      <image href="${escapeXml(mediaDataUri)}" x="800" y="135" width="344" height="360"
        preserveAspectRatio="xMidYMid slice" clip-path="url(#media-clip)"/>`
    : ''

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}" viewBox="0 0 ${OG_IMAGE_WIDTH} ${OG_IMAGE_HEIGHT}">
  <defs>
    ${
      getOgFontDataUri()
        ? `<style>@font-face{font-family:Lato;src:url('${getOgFontDataUri()}') format('truetype');}</style>`
        : ''
    }
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0b1533"/>
      <stop offset="55%" stop-color="#090D21"/>
      <stop offset="100%" stop-color="#1a0b2e"/>
    </linearGradient>
    <linearGradient id="moon" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#e2e8f0"/>
      <stop offset="100%" stop-color="#64748b"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  <circle cx="65" cy="78" r="9" fill="url(#moon)"/>
  <text x="86" y="86" font-size="22" letter-spacing="3" fill="#93c5fd"
    font-family="${OG_FONT_FAMILY}" font-weight="600">${escapeXml(eyebrow.toUpperCase())}</text>
  <text x="56" y="200" font-size="${titleSize}" fill="#ffffff" font-family="${OG_FONT_FAMILY}"
    font-weight="700">${titleTspans}</text>
  ${
    subtitleLine
      ? `<text x="56" y="${
          200 + titleLines.length * (titleSize + 8) + 20
        }" font-size="28" fill="#cbd5e1" font-family="${OG_FONT_FAMILY}">${subtitleLine}</text>`
      : ''
  }
  ${chipRow(visibleChips, 56, 478)}
  <text x="56" y="568" font-size="22" fill="#94a3b8" font-family="${OG_FONT_FAMILY}">${escapeXml(
    footer
  )}</text>
  ${media}
</svg>`
}
