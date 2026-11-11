/**
 * Touchdown share card + share plumbing (client-only).
 *
 * The image is the post: X suppresses links, so the card carries the end shot,
 * score, verdict, mission number and the URL printed on it.
 */
import type { ModeId } from './modes'
import type { FlightResult } from './scoring'
import { bragLine, formatScore, outcomeHeadline } from './verdicts'

export const SHARE_PATH = '/touchdown'
export const SHARE_URL_LABEL = 'moondao.com/touchdown'
export const CARD_W = 1200
export const CARD_H = 675

export type Challenge = { mission: number; score: number; mode: ModeId; nickname?: string }

/** Nickname as it may appear in a URL or on a card: short, plain characters. */
export function cleanNickname(raw: string | undefined | null): string {
  return (raw ?? '')
    .replace(/[^\p{L}\p{N} _.-]/gu, '')
    .trim()
    .slice(0, 16)
}

export function challengeQuery(c: Challenge): string {
  const q = new URLSearchParams()
  q.set('m', String(c.mission))
  q.set('s', String(Math.round(c.score)))
  if (c.mode === 'pro') q.set('p', '1')
  const nick = cleanNickname(c.nickname)
  if (nick) q.set('n', nick)
  return q.toString()
}

export function parseChallenge(query: Record<string, string | string[] | undefined>): Challenge | null {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)
  const mission = Number(one(query.m))
  const score = Number(one(query.s))
  if (!Number.isInteger(mission) || mission < 1 || mission > 100000) return null
  if (!Number.isFinite(score) || score < 0 || score > 2000) return null
  return {
    mission,
    score: Math.round(score),
    mode: one(query.p) === '1' ? 'pro' : 'easy',
    nickname: cleanNickname(one(query.n)) || undefined,
  }
}

/**
 * Prefilled post text. The image carries the picture; this carries the tone:
 * an emoji for what happened, the numbers people quote, and a dare.
 */
export function shareText(result: FlightResult): string {
  const pro = result.mode === 'pro' ? ' (PRO 🏅)' : ''
  const score = `${formatScore(result.score)} pts${pro}`
  const dare = 'Can you do better? Play Touchdown 🚀'
  let lines: string[]
  switch (result.outcome) {
    case 'crashed':
      lines = [
        '💥 I just made a brand new crater on the Moon.',
        `${result.touchdownSpeed.toFixed(0)} m/s straight into the regolith 😭${pro}`,
      ]
      break
    case 'lost':
      lines = ['🛰️ I missed the Moon. The whole Moon. 😭', `0 pts${pro}`]
      break
    case 'inverted':
      lines = ['🙃 Landed on the Moon. Upside down.', score]
      break
    case 'tipped':
      lines = ['😬 Landed on the Moon... sideways. Real landers do it too.', score]
      break
    case 'hard':
      lines = result.damaged
        ? ['🛠️ It is upright! Nobody ask about the landing gear.', `${score} · ${bragLine(result)}`]
        : ['😅 Hard landing, but it is upright on the Moon.', `${score} · ${bragLine(result)}`]
      break
    default:
      lines = result.bullseye
        ? ['🎯 BULLSEYE. Landed on the Moon, dead on target.', `${score} · ${bragLine(result)}`]
        : ['🌕 Touchdown! Upright on the Moon.', `${score} · ${bragLine(result)}`]
  }
  return [...lines, '', dare].join('\n')
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const next = line ? `${line} ${w}` : w
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line)
      line = w
    } else line = next
  }
  if (line) lines.push(line)
  return lines.slice(0, maxLines)
}

/** Compose the 1200×675 share card over a captured end-shot frame. */
export function composeCard(args: {
  frame: HTMLCanvasElement
  result: FlightResult
  verdict: string
  nickname?: string
}): HTMLCanvasElement {
  const { frame, result, verdict } = args
  const c = document.createElement('canvas')
  c.width = CARD_W
  c.height = CARD_H
  const g = c.getContext('2d')!

  // Cover-fit the frame, biased slightly down so the lander clears the text.
  const scale = Math.max(CARD_W / frame.width, CARD_H / frame.height)
  const dw = frame.width * scale
  const dh = frame.height * scale
  g.fillStyle = '#000'
  g.fillRect(0, 0, CARD_W, CARD_H)
  g.drawImage(frame, (CARD_W - dw) / 2, (CARD_H - dh) * 0.5, dw, dh)

  const top = g.createLinearGradient(0, 0, 0, 190)
  top.addColorStop(0, 'rgba(0,0,0,0.78)')
  top.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = top
  g.fillRect(0, 0, CARD_W, 190)
  const bottom = g.createLinearGradient(0, CARD_H - 300, 0, CARD_H)
  bottom.addColorStop(0, 'rgba(0,0,0,0)')
  bottom.addColorStop(0.55, 'rgba(0,0,0,0.72)')
  bottom.addColorStop(1, 'rgba(0,0,0,0.92)')
  g.fillStyle = bottom
  g.fillRect(0, CARD_H - 300, CARD_W, 300)

  const head = '"Archivo", "Lato", system-ui, sans-serif'
  const body = '"Lato", system-ui, sans-serif'
  g.textBaseline = 'alphabetic'

  // Top row: brand + mission
  g.fillStyle = '#fff'
  g.font = `800 34px ${head}`
  g.fillText('TOUCHDOWN', 48, 70)
  const brandW = g.measureText('TOUCHDOWN').width
  g.font = `600 22px ${body}`
  g.fillStyle = 'rgba(255,255,255,0.75)'
  g.fillText('Land beside Moon Base Zero', 48 + brandW + 18, 68)
  if (result.mode === 'pro') {
    const x = CARD_W - 48 - 96
    g.fillStyle = '#ffd34d'
    roundRect(g, x, 38, 96, 42, 8)
    g.fill()
    g.fillStyle = '#111'
    g.font = `800 24px ${head}`
    g.textAlign = 'center'
    g.fillText('PRO', x + 48, 68)
    g.textAlign = 'left'
  }

  // Bottom block: headline, score, verdict, stats
  const good = result.outcome === 'landed' || result.outcome === 'hard'
  g.font = `800 26px ${head}`
  g.fillStyle = good ? '#7dffb0' : '#ff8a6b'
  g.fillText(outcomeHeadline(result), 48, CARD_H - 196)

  g.fillStyle = '#fff'
  g.font = `800 104px ${head}`
  const scoreText = formatScore(result.score)
  g.fillText(scoreText, 44, CARD_H - 100)
  const scoreW = g.measureText(scoreText).width
  g.font = `600 24px ${body}`
  g.fillStyle = 'rgba(255,255,255,0.7)'
  g.fillText('pts', 44 + scoreW + 12, CARD_H - 102)

  g.font = `600 30px ${body}`
  g.fillStyle = '#fff'
  const textX = Math.max(360, 44 + scoreW + 90)
  const lines = wrap(g, verdict, CARD_W - textX - 48, 3)
  const startY = CARD_H - 112 - (lines.length - 1) * 38
  lines.forEach((line, i) => g.fillText(line, textX, startY + i * 38))

  g.font = `600 22px ${body}`
  g.fillStyle = 'rgba(255,255,255,0.82)'
  const nick = cleanNickname(args.nickname)
  g.fillText(`${nick ? `${nick} · ` : ''}${bragLine(result)}`, 48, CARD_H - 44)
  g.textAlign = 'right'
  g.font = `700 24px ${body}`
  g.fillStyle = '#fff'
  g.fillText(SHARE_URL_LABEL, CARD_W - 48, CARD_H - 44)
  g.textAlign = 'left'
  return c
}

/** Stamp a player photo with a small credit, bottom-right. Returns the same canvas. */
export function stampPhoto(photo: HTMLCanvasElement): HTMLCanvasElement {
  const g = photo.getContext('2d')
  if (!g) return photo
  const s = Math.max(photo.width, photo.height) / 1600
  g.textBaseline = 'alphabetic'
  g.textAlign = 'right'
  g.shadowColor = 'rgba(0,0,0,0.8)'
  g.shadowBlur = 8 * s
  g.fillStyle = 'rgba(255,255,255,0.92)'
  g.font = `800 ${Math.round(26 * s)}px "Archivo", "Lato", system-ui, sans-serif`
  g.fillText('TOUCHDOWN', photo.width - 28 * s, photo.height - 54 * s)
  g.font = `700 ${Math.round(20 * s)}px "Lato", system-ui, sans-serif`
  g.fillText(SHARE_URL_LABEL, photo.width - 28 * s, photo.height - 26 * s)
  g.shadowBlur = 0
  g.textAlign = 'left'
  return photo
}

/**
 * Copy a PNG to the clipboard. Accepts a promise so the write can be started
 * synchronously inside a tap or click (Safari requires that).
 */
export async function copyImage(blob: Blob | null | Promise<Blob | null>): Promise<boolean> {
  if (!blob || typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) return false
  try {
    const data =
      blob instanceof Promise
        ? blob.then((b) => {
            if (!b) throw new Error('no image')
            return b
          })
        : blob
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': data })])
    return true
  } catch {
    return false
  }
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath()
  g.moveTo(x + r, y)
  g.arcTo(x + w, y, x + w, y + h, r)
  g.arcTo(x + w, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r)
  g.arcTo(x, y, x + w, y, r)
  g.closePath()
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      canvas.toBlob((b) => resolve(b), 'image/png')
    } catch {
      resolve(null)
    }
  })
}

export type ShareMethod = 'sheet' | 'clipboard' | 'fallback'

export function xIntentUrl(text: string, url: string): string {
  return `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`
}

/**
 * Share the card. Must be called directly from a click/tap handler with the
 * blob already prepared, so the share sheet / popup / clipboard write all run
 * inside the user gesture.
 *
 * - Touch devices: system share sheet with the PNG attached.
 * - Desktop: copy the PNG to the clipboard and open the X composer.
 * - Otherwise: 'fallback' — the caller shows the image to save plus the X link.
 */
export async function shareCard(args: {
  blob: Blob | null
  text: string
  url: string
  preferSheet: boolean
}): Promise<ShareMethod | 'cancelled'> {
  const { blob, text, url, preferSheet } = args
  if (blob && preferSheet && typeof navigator !== 'undefined' && navigator.share) {
    const file = new File([blob], 'touchdown.png', { type: 'image/png' })
    if (!navigator.canShare || navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text: `${text} ${url}` })
        return 'sheet'
      } catch (err: any) {
        if (err?.name === 'AbortError') return 'cancelled'
      }
    }
  }
  if (blob && typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    // Open the composer first: a popup opened after an await is blocked.
    const popup = window.open(xIntentUrl(text, url), '_blank', 'noopener')
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      return 'clipboard'
    } catch {
      if (popup === null) return 'fallback'
      return 'fallback'
    }
  }
  return 'fallback'
}
