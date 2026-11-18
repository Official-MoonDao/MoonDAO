import type { ForecastSharePick } from '@/lib/forecasts/forecastShare'
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from './preview'
import { escapeXml, wrapText } from './svg'

const FONT = 'Lato, sans-serif'
export const FORECAST_CARD_URL_LABEL = 'moondao.com/deprize'

function headlineSize(name: string): { size: number; perLine: number } {
  if (name.length <= 12) return { size: 84, perLine: 12 }
  if (name.length <= 16) return { size: 64, perLine: 16 }
  return { size: 54, perLine: 20 }
}

function capitalize(value: string): string {
  return value ? `${value[0].toUpperCase()}${value.slice(1)}` : value
}

/**
 * Text layer for a shared forecast, laid over the lunar scene in
 * public/touchdown/og-base.jpg. Only Lato Regular ships with the OG
 * functions, so bold is a same-colour stroke.
 */
export function renderForecastCardSvg(share: ForecastSharePick | null): string {
  const text = (attrs: string, body: string) =>
    `<text font-family="${FONT}" ${
      /\bfill="/.test(attrs) ? '' : 'fill="#fff" '
    }${attrs}>${body}</text>`
  const bold = (width: number) => `stroke="#fff" stroke-width="${width}" paint-order="stroke"`

  const parts: string[] = []
  let y: number
  if (share) {
    const { size, perLine } = headlineSize(share.name)
    const lines = wrapText(share.name, perLine, 2)
    y = 262
    lines.forEach((line, i) => {
      parts.push(
        text(`x="56" y="${y + i * (size + 6)}" font-size="${size}" ${bold(2.4)}`, escapeXml(line))
      )
    })
    y += (lines.length - 1) * (size + 6)
    if (share.org) {
      y += 52
      parts.push(text(`x="58" y="${y}" font-size="34" fill-opacity="0.92"`, escapeXml(share.org)))
    }
    const race = share.raceName
      ? `${share.raceName}: ${capitalize(share.race)}`
      : capitalize(share.race)
    wrapText(race, 44, 2).forEach((line, i) => {
      parts.push(
        text(`x="58" y="${y + 58 + i * 36}" font-size="28" fill="#cbd5e1"`, escapeXml(line))
      )
    })
  } else {
    y = 262
    parts.push(text(`x="56" y="${y}" font-size="76" ${bold(2.2)}`, 'Who reaches'))
    parts.push(text(`x="56" y="${y + 82}" font-size="76" ${bold(2.2)}`, 'the Moon first?'))
    parts.push(
      text(
        `x="58" y="${y + 140}" font-size="30" fill="#cbd5e1"`,
        'Pick the winner of each Moon race'
      )
    )
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}" viewBox="0 0 ${OG_IMAGE_WIDTH} ${OG_IMAGE_HEIGHT}">
  <defs>
    <linearGradient id="shade" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#05070f" stop-opacity="0.94"/>
      <stop offset="0.42" stop-color="#05070f" stop-opacity="0.82"/>
      <stop offset="0.68" stop-color="#05070f" stop-opacity="0.18"/>
      <stop offset="1" stop-color="#05070f" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0.6" stop-color="#05070f" stop-opacity="0"/>
      <stop offset="1" stop-color="#05070f" stop-opacity="0.7"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#shade)"/>
  <rect width="100%" height="100%" fill="url(#floor)"/>
  ${text(`x="116" y="83" font-size="32" letter-spacing="0.5" ${bold(1.2)}`, 'MoonDAO')}
  <rect x="56" y="128" width="236" height="44" rx="22" fill="#22c55e" fill-opacity="0.12" stroke="#22c55e" stroke-opacity="0.55"/>
  <circle cx="80" cy="150" r="6" fill="#4ade80"/>
  ${text(
    `x="96" y="158" font-size="21" letter-spacing="3.5" fill="#86efac" stroke="#86efac" stroke-width="0.6"`,
    share ? 'MY FORECAST' : 'DEPRIZE'
  )}
  ${parts.join('\n  ')}
  <rect x="56" y="514" width="330" height="64" rx="32" fill="#fff"/>
  ${text(
    `x="84" y="555" font-size="27" fill="#0b1020" stroke="#0b1020" stroke-width="0.8"`,
    'Make your forecast'
  )}
  <path d="M330 546h24m-9-9l9 9-9 9" fill="none" stroke="#0b1020" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  ${text(`x="412" y="556" font-size="24" fill-opacity="0.78"`, FORECAST_CARD_URL_LABEL)}
</svg>`
}
